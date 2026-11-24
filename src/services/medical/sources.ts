/**
 * Fuentes médicas en línea para el tutor (requieren conexión a internet):
 *  - MedlinePlus (Biblioteca Nacional de Medicina de EE. UU., en español): explicación del tema.
 *  - PubMed (NCBI E-utilities): investigaciones que respaldan la información.
 *  - Cochrane: revisiones sistemáticas de evidencia sobre tratamientos (Cochrane Database of
 *    Systematic Reviews, consultada a través de su indexación en PubMed, que es pública y sin clave).
 * Solo se envían los términos de la pregunta; nunca el contenido del documento del usuario.
 */
import { normalize, STOPWORDS } from '../../utils/normalize';

export interface FuenteMedline {
  titulo: string;
  url: string;
  resumen: string;
  sinonimos: string[];
}

export interface Articulo {
  pmid: string;
  titulo: string;
  revista: string;
  anio: string;
  url: string;
  resumen: string;
}

declare global {
  interface Window {
    ses?: { fetchText(url: string): Promise<string> };
  }
}

/** En la app de escritorio, las peticiones sin CORS pasan por el proceso principal; en desarrollo, por el proxy de Vite. */
async function fetchText(url: string): Promise<string> {
  if (window.ses?.fetchText) return window.ses.fetchText(url);
  const u = new URL(url);
  const destino = u.hostname === 'wsearch.nlm.nih.gov' ? `/proxy/medlineplus${u.pathname}${u.search}` : url;
  const r = await fetch(destino);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

const PREGUNTA = new Set(
  'que qué cual cuál cuales cuáles como cómo cuando cuándo donde dónde por porque para quien quién es son era fue sirve sirven tiene tienen hace hacen funcion función funciones explica explicame explícame define definir definicion definición significa significado causa causas sobre dime puedes podrias podrías cuanto cuánto debe deben hay entre diferencia diferencias tratamiento tratamientos tipo tipos'.split(' '),
);

/** Términos clave de la pregunta (con acentos), sin palabras interrogativas ni vacías. */
export function terminosClave(pregunta: string, max = 3): string[] {
  const ws = pregunta.replace(/[¿?¡!.,;:()"«»]/g, ' ').split(/\s+/).filter(Boolean);
  return ws.filter((w) => w.length > 2 && !STOPWORDS.has(normalize(w)) && !PREGUNTA.has(normalize(w))).slice(0, max);
}

/** ¿La pregunta trata de un tratamiento o terapia? (para priorizar Cochrane) */
export const esSobreTratamiento = (p: string) => /tratamient|terapia|fármaco|farmaco|medicament|cura|curar|manej|prevenci|vacuna|cirug|dosis/i.test(p);

function htmlATexto(html: string) {
  const d = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  d.querySelectorAll('li').forEach((li) => li.prepend('• '));
  d.querySelectorAll('p, li, h3, h2').forEach((el) => el.append('\n'));
  return (d.body.textContent ?? '').replace(/([?!:])(?=[A-ZÁÉÍÓÚÑ¿])/g, '$1\n').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

export async function buscarMedlinePlus(consulta: string, max = 2): Promise<FuenteMedline[]> {
  const url = `https://wsearch.nlm.nih.gov/ws/query?db=healthTopicsSpanish&retmax=${max}&term=${encodeURIComponent(consulta)}`;
  const xml = new DOMParser().parseFromString(await fetchText(url), 'text/xml');
  return [...xml.querySelectorAll('document')].map((d) => {
    const c = (n: string) => [...d.querySelectorAll(`content[name="${n}"]`)].map((x) => x.textContent ?? '');
    return { titulo: htmlATexto(c('title')[0] ?? ''), url: d.getAttribute('url') ?? 'https://medlineplus.gov/spanish/', resumen: htmlATexto(c('FullSummary')[0] ?? ''), sinonimos: c('altTitle').map(htmlATexto) };
  });
}

const traducciones = new Map<string, Promise<string | undefined>>();
/** Traduce un término médico al inglés (para PubMed/Cochrane) usando los enlaces entre idiomas de Wikipedia. */
export function terminoEnIngles(termino: string): Promise<string | undefined> {
  const k = normalize(termino);
  let p = traducciones.get(k);
  if (!p) {
    const u = new URL('https://es.wikipedia.org/w/api.php');
    Object.entries({ action: 'query', format: 'json', formatversion: '2', origin: '*', generator: 'search', gsrsearch: termino, gsrlimit: '1', prop: 'langlinks', lllang: 'en' }).forEach(([a, b]) => u.searchParams.set(a, b));
    p = fetch(u)
      .then((r) => r.json())
      .then((j) => j.query?.pages?.[0]?.langlinks?.[0]?.title as string | undefined)
      .catch(() => undefined);
    traducciones.set(k, p);
  }
  return p;
}

const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

/** PubMed permite 3 peticiones por segundo sin clave: se encolan con 400 ms de separación y se reintenta si responde 429. */
let cola: Promise<unknown> = Promise.resolve();
function eutils(url: string): Promise<Response> {
  const run = async () => {
    for (let intento = 0; intento < 3; intento++) {
      const r = await fetch(url);
      if (r.status !== 429) return r;
      await new Promise((ok) => setTimeout(ok, 1200 * (intento + 1)));
    }
    throw new Error('PubMed está saturado; inténtalo en unos segundos');
  };
  const p = cola.then(run, run);
  cola = p.then(() => new Promise((ok) => setTimeout(ok, 400)), () => new Promise((ok) => setTimeout(ok, 400)));
  return p;
}

async function esearch(term: string, max: number): Promise<string[]> {
  const r = await eutils(`${EUTILS}/esearch.fcgi?db=pubmed&retmode=json&sort=relevance&retmax=${max}&term=${encodeURIComponent(term)}`);
  if (!r.ok) throw new Error(`PubMed respondió ${r.status}`);
  return (await r.json()).esearchresult?.idlist ?? [];
}

async function efetch(ids: string[]): Promise<Articulo[]> {
  if (!ids.length) return [];
  const r = await eutils(`${EUTILS}/efetch.fcgi?db=pubmed&retmode=xml&id=${ids.join(',')}`);
  if (!r.ok) throw new Error(`PubMed respondió ${r.status}`);
  const xml = new DOMParser().parseFromString(await r.text(), 'text/xml');
  return [...xml.querySelectorAll('PubmedArticle')].map((a) => {
    const pmid = a.querySelector('PMID')?.textContent ?? '';
    const abs = [...a.querySelectorAll('Abstract AbstractText')].map((x) => (x.getAttribute('Label') ? `${x.getAttribute('Label')}: ` : '') + (x.textContent ?? '')).join(' ');
    const anio = a.querySelector('PubDate Year')?.textContent ?? a.querySelector('PubDate MedlineDate')?.textContent?.slice(0, 4) ?? '';
    return {
      pmid,
      titulo: a.querySelector('ArticleTitle')?.textContent ?? '',
      revista: a.querySelector('Journal Title')?.textContent ?? '',
      anio,
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      resumen: abs.length > 600 ? `${abs.slice(0, 597)}…` : abs,
    };
  });
}

/** Investigaciones en PubMed: prioriza revisiones y estudios recientes sobre el término. */
export async function buscarPubMed(terminoEn: string, max = 3): Promise<Articulo[]> {
  const ids = await esearch(`(${terminoEn}[Title/Abstract]) AND (review[pt] OR systematic[sb] OR clinical trial[pt]) AND hasabstract AND 2010:3000[dp]`, max);
  return efetch(ids.length ? ids : await esearch(`${terminoEn} AND hasabstract`, max));
}

/** Revisiones Cochrane (Cochrane Database of Systematic Reviews) sobre el término. */
export async function buscarCochrane(terminoEn: string, max = 2): Promise<Articulo[]> {
  return efetch(await esearch(`(${terminoEn}) AND "Cochrane Database Syst Rev"[ta]`, max));
}

/** Oraciones del resumen de MedlinePlus más relacionadas con la pregunta (y siempre la definición inicial). */
export function fragmentoRelevante(resumen: string, pregunta: string, max = 5): string {
  const lineas = resumen.split('\n').map((l) => l.trim()).filter(Boolean);
  const claves = terminosClave(pregunta, 6).map(normalize);
  const score = (l: string) => claves.filter((k) => normalize(l).includes(k.slice(0, Math.max(4, k.length - 1)))).length;
  const elegidas = new Set<number>([0]);
  lineas
    .map((l, i) => ({ i, s: score(l) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, max - 1)
    .forEach((x) => elegidas.add(x.i));
  return [...elegidas].sort((a, b) => a - b).map((i) => lineas[i]).filter(Boolean).join('\n');
}

export interface ConsultaEnLinea {
  medline: (FuenteMedline & { fragmento: string })[];
  pubmed: Articulo[];
  cochrane: Articulo[];
  terminoEn?: string;
  errores: string[];
}

/** Consulta las tres fuentes en paralelo; un fallo en una no impide mostrar las demás. */
export async function consultarFuentes(pregunta: string, contexto = ''): Promise<ConsultaEnLinea> {
  const claves = terminosClave(`${pregunta} ${contexto}`);
  const consulta = claves.join(' ') || pregunta;
  const errores: string[] = [];
  const medlineP = buscarMedlinePlus(consulta).catch(() => {
    errores.push('MedlinePlus');
    return [] as FuenteMedline[];
  });
  const medline = await medlineP;
  // término principal para la búsqueda científica: el tema de MedlinePlus si hay, si no la pregunta
  const base = claves[0] ?? medline[0]?.titulo ?? consulta;
  const terminoEn = (await terminoEnIngles(claves.slice(0, 2).join(' ') || base)) ?? (await terminoEnIngles(base));
  const termino = terminoEn ?? consulta;
  const [pubmed, cochrane] = await Promise.all([
    buscarPubMed(termino).catch(() => {
      errores.push('PubMed');
      return [] as Articulo[];
    }),
    buscarCochrane(termino).catch(() => {
      errores.push('Cochrane');
      return [] as Articulo[];
    }),
  ]);
  return { medline: medline.map((m) => ({ ...m, fragmento: fragmentoRelevante(m.resumen, pregunta) })), pubmed, cochrane, terminoEn, errores };
}
