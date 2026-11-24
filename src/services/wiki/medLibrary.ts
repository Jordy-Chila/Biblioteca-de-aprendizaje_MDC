/**
 * Biblioteca médica de referencia basada en Wikipedia en español.
 * - Biblioteca base: artículos incluidos en el instalador (public/medlib/base.json), disponibles sin conexión.
 * - Mis guardados: artículos que el usuario guarda desde la búsqueda en línea (se conservan en este equipo).
 * - Búsqueda en línea: API pública de Wikipedia; solo se envían los términos que el usuario escribe.
 */
import { normalize, tokens } from '../../utils/normalize';
import { escribir, leer } from '../storage/persist';

const API = 'https://es.wikipedia.org/w/api.php';

export interface MedResult {
  pageid: number;
  titulo: string;
  extracto: string;
  imagen?: string;
  medico: boolean;
  /** Disponible sin conexión (biblioteca base o guardado). */
  local?: boolean;
}

export interface MedArticle {
  pageid: number;
  titulo: string;
  texto: string;
  imagen?: string;
  url: string;
  guardadoEn?: number;
  categorias?: string[];
}

/** Palabras en categorías de Wikipedia que indican contenido de ciencias de la salud. */
const MED_RE = /medicin|enfermedad|anatom|fisiolog|patolog|síndrome|sindrome|farmac|fármaco|farmaco|cardiolog|neurolog|oncolog|infecci|virus|bacteri|ginecolog|obstetric|pediatr|cirug|salud|órgano|organo|sistema (nervioso|circulatorio|respiratorio|digestivo|inmunitario|endocrino|reproductor|urinario)|hormona|trastorno|signos clínicos|epidemiolog|inmunolog|histolog|hueso|músculo|musculo|sangre|terapia|vacuna|diagnóstico|dermatolog|psiquiatr|nefrolog|endocrinolog|hematolog|odontolog|enfermería|microbiolog|genétic/i;

const CATS_IGNORE = /artículos|wikipedia|páginas|wikidata|control de autoridades|plantilla/i;

function q(params: Record<string, string>) {
  const u = new URL(API);
  Object.entries({ format: 'json', formatversion: '2', origin: '*', ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
  return fetch(u.toString()).then((r) => {
    if (!r.ok) throw new Error(`Wikipedia respondió ${r.status}`);
    return r.json();
  });
}

/* ---------- Biblioteca base (incluida en la instalación) ---------- */
let basePromise: Promise<MedArticle[]> | undefined;
export function bibliotecaBase(): Promise<MedArticle[]> {
  basePromise ??= fetch('./medlib/base.json')
    .then((r) => (r.ok ? r.json() : { articulos: [] }))
    .then((j) => (j.articulos ?? []) as MedArticle[])
    .catch(() => []);
  return basePromise;
}

/** Todos los artículos disponibles sin conexión (guardados primero, sin duplicados). */
export async function articulosLocales(): Promise<MedArticle[]> {
  const g = guardados();
  const ids = new Set(g.map((a) => a.pageid));
  return [...g, ...(await bibliotecaBase()).filter((a) => !ids.has(a.pageid))];
}

function extracto(texto: string, n = 220) {
  const t = texto.replace(/\n+/g, ' ').replace(/==+[^=]+==+/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/** Busca en la biblioteca local por título y contenido. */
export async function buscarLocal(texto: string, k = 20): Promise<MedResult[]> {
  const qn = normalize(texto);
  const qt = tokens(texto);
  if (!qt.length && !qn) return [];
  const arts = await articulosLocales();
  return arts
    .map((a) => {
      const tn = normalize(a.titulo);
      let s = tn === qn ? 100 : tn.includes(qn) || qn.includes(tn) ? 40 : 0;
      const intro = normalize(a.texto.slice(0, 1500));
      for (const t of qt) {
        if (tn.includes(t)) s += 12;
        if (intro.includes(t)) s += 3;
      }
      return { a, s };
    })
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s)
    .slice(0, k)
    .map(({ a }) => ({ pageid: a.pageid, titulo: a.titulo, extracto: extracto(a.texto), imagen: a.imagen, medico: true, local: true }));
}

export async function buscarMedicina(texto: string, soloMedicina = true): Promise<MedResult[]> {
  const term = texto.trim();
  if (!term) return [];
  const j = await q({
    action: 'query',
    generator: 'search',
    gsrsearch: term,
    gsrlimit: '20',
    gsrnamespace: '0',
    prop: 'extracts|pageimages|categories',
    exintro: '1',
    explaintext: '1',
    exsentences: '2',
    exlimit: 'max',
    piprop: 'thumbnail',
    pithumbsize: '160',
    pilimit: 'max',
    cllimit: 'max',
    clshow: '!hidden',
  });
  const pages: any[] = j.query?.pages ?? [];
  const res: (MedResult & { idx: number })[] = pages.map((p) => {
    const cats: string[] = (p.categories ?? []).map((c: any) => String(c.title).replace(/^Categoría:/, '')).filter((c: string) => !CATS_IGNORE.test(c));
    return {
      pageid: p.pageid,
      titulo: p.title,
      extracto: p.extract ?? '',
      imagen: p.thumbnail?.source,
      medico: cats.some((c) => MED_RE.test(c)) || MED_RE.test(p.extract ?? ''),
      idx: p.index ?? 99,
    };
  });
  res.sort((a, b) => Number(b.medico) - Number(a.medico) || a.idx - b.idx);
  return (soloMedicina ? res.filter((r) => r.medico) : res).map(({ idx: _i, ...r }) => r);
}

const memo = new Map<number, MedArticle>();

export async function leerArticulo(pageid: number): Promise<MedArticle> {
  if (memo.has(pageid)) return memo.get(pageid)!;
  const local = (await articulosLocales()).find((a) => a.pageid === pageid);
  if (local) return local;
  const j = await q({ action: 'query', pageids: String(pageid), prop: 'extracts|pageimages|info', explaintext: '1', exsectionformat: 'wiki', piprop: 'original', inprop: 'url' });
  const p = j.query.pages[0];
  const art: MedArticle = { pageid, titulo: p.title, texto: p.extract ?? '', imagen: p.original?.source, url: p.fullurl };
  memo.set(pageid, art);
  return art;
}

/* ---------- Mis guardados (sin conexión) ---------- */
const KEY = 'ses.biblioteca-medica.v1';

export function guardados(): MedArticle[] {
  return leer<MedArticle[]>(KEY, []);
}

export function guardar(a: MedArticle) {
  const list = guardados().filter((x) => x.pageid !== a.pageid);
  list.unshift({ ...a, guardadoEn: Date.now() });
  if (!escribir(KEY, list)) throw new Error('No hay espacio para guardar más artículos.');
  pasajesCache = undefined;
}

export function quitar(pageid: number) {
  escribir(
    KEY,
    guardados().filter((x) => x.pageid !== pageid),
  );
  pasajesCache = undefined;
}

/** Divide el texto plano (con encabezados "== X ==") en secciones legibles. */
export function secciones(texto: string): { titulo?: string; nivel: number; parrafos: string[] }[] {
  const out: { titulo?: string; nivel: number; parrafos: string[] }[] = [{ nivel: 1, parrafos: [] }];
  for (const line of texto.split('\n')) {
    const m = line.match(/^(={2,6})\s*(.+?)\s*\1\s*$/);
    if (m) out.push({ titulo: m[2], nivel: m[1].length, parrafos: [] });
    else if (line.trim()) out[out.length - 1].parrafos.push(line.trim());
  }
  return out.filter((s) => s.parrafos.length || s.titulo);
}

/* ---------- Búsqueda de pasajes para el tutor (BM25 sin conexión) ---------- */
export interface Pasaje {
  articulo: MedArticle;
  seccion?: string;
  texto: string;
  score: number;
}

interface Indice {
  docs: { art: MedArticle; seccion?: string; texto: string; toks: string[]; titulo: string[] }[];
  df: Map<string, number>;
  avg: number;
}
let pasajesCache: Promise<Indice> | undefined;

function indice(): Promise<Indice> {
  pasajesCache ??= articulosLocales().then((arts) => {
    const docs: Indice['docs'] = [];
    for (const a of arts) {
      const titulo = tokens(a.titulo);
      for (const s of secciones(a.texto)) {
        for (const p of s.parrafos) {
          if (p.length < 120) continue;
          docs.push({ art: a, seccion: s.titulo, texto: p, toks: tokens(`${p} ${s.titulo ?? ''}`), titulo });
        }
      }
    }
    const df = new Map<string, number>();
    for (const d of docs) for (const t of new Set(d.toks)) df.set(t, (df.get(t) ?? 0) + 1);
    return { docs, df, avg: docs.reduce((s, d) => s + d.toks.length, 0) / Math.max(1, docs.length) };
  });
  return pasajesCache;
}

/** Pasajes de la biblioteca local más relacionados con la pregunta (máx. uno por artículo y sección). */
export async function buscarPasajes(pregunta: string, k = 3): Promise<Pasaje[]> {
  const q = tokens(pregunta);
  if (!q.length) return [];
  const { docs, df, avg } = await indice();
  const N = docs.length;
  const res: Pasaje[] = [];
  for (const d of docs) {
    let s = 0;
    for (const t of q) {
      const tf = d.toks.filter((x) => x === t || (t.length >= 5 && x.startsWith(t.slice(0, -1)))).length;
      if (tf) {
        const idf = Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
        s += idf * ((tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * (d.toks.length / avg))));
      }
      if (d.titulo.includes(t)) s += 2.5; // el artículo trata justamente de ese término
    }
    if (s > 0) res.push({ articulo: d.art, seccion: d.seccion, texto: d.texto, score: s });
  }
  res.sort((a, b) => b.score - a.score);
  const vistos = new Set<string>();
  const out: Pasaje[] = [];
  for (const p of res) {
    const key = `${p.articulo.pageid}`;
    if (vistos.has(key)) continue;
    vistos.add(key);
    out.push(p);
    if (out.length >= k) break;
  }
  // descartar coincidencias muy débiles frente a la mejor
  return out.filter((p) => p.score >= out[0].score * 0.35);
}
