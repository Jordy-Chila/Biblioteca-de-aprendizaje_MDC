import type { Block, DocumentModel } from '../../../types/document';
import type { Comparacion, Concepto, Tema } from '../../../types/plan';
import { fromBlock } from '../grounding';
import { containsWord, normalize, slug } from '../../../utils/normalize';
import { topicOfBlock } from './topics';

const DEF_HEADER = /descrip|defini|signific|funci|caracter|edad|qu[eé]\s|qu[eé]$|que es|concepto|meaning|description|definition|function|uso|rol/i;
const TERM_ITEM = /^([^:]{2,60}):\s+(.{3,})$/;

type TipoConcepto = Concepto['tipo'];

const POSICIONAL = /^(superior|inferior|medio|media|interno|interna|externo|externa|anterior|posterior|lateral|izquierdo|izquierda|derecho|derecha|mayor|menor|primario|primaria|secundario|secundaria|central|periferico|periferica)$/i;

/** "Estrecho" + "Medio" → "Estrecho medio": un adjetivo posicional solo no es un nombre útil. */
function qualify(header: string, cell: string): string {
  return POSICIONAL.test(cell.trim()) && /^\S+$/.test(header.trim()) ? `${header.trim()} ${cell.trim().toLowerCase()}` : cell;
}

function guessTipo(context: string, ordered = false): TipoConcepto {
  const c = normalize(context);
  if (/hormona|sustancia|compuesto|elemento quimico|molecula|farmaco|enzima/.test(c)) return 'sustancia';
  if (/clasificacion|tipos?\b|categor/.test(c)) return 'clasificacion';
  if (/complicacion|alarma|riesgo|emergencia/.test(c)) return 'alerta';
  if (/anatomia|estructura|componente|parte|organo|capa|hueso|musculo|organelo|hardware/.test(c)) return 'estructura';
  if (ordered || /proceso|etapa|fase|periodo|paso|mecanismo|ciclo|movimiento/.test(c)) return 'proceso';
  return 'termino';
}

/** Conceptos (término → definición) y tablas comparativas. */
export function extractConcepts(doc: DocumentModel, temas: Tema[]): { conceptos: Concepto[]; comparaciones: Comparacion[] } {
  const byKey = new Map<string, Concepto>();
  const comparaciones: Comparacion[] = [];
  const headingText = (b: Block) => doc.blocks.find((x) => x.id === b.parentHeadingId)?.text ?? '';

  const add = (nombre: string, definicion: string, cita: string, block: Block, contexto: string, ordered = false) => {
    const clean = nombre.replace(/^[\d.\s)]+/, '').replace(/\s+/g, ' ').trim();
    if (clean.length < 2 || clean.length > 60 || /^(nota|ejemplo|importante|para memorizar)$/i.test(clean)) return;
    const key = normalize(clean);
    const def = fromBlock(definicion, block.id, cita);
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.definicion.some((d) => normalize(d.texto) === normalize(definicion))) existing.definicion.push(def);
      return;
    }
    let id = slug(clean);
    while ([...byKey.values()].some((c) => c.id === id)) id += '-2';
    byKey.set(key, {
      id,
      nombre: clean,
      alias: [],
      temaId: topicOfBlock(block.id, temas),
      tipo: guessTipo(contexto, ordered),
      definicion: [def],
      fichas: [],
      menciones: [],
    });
  };

  const SOURCES = /bibliograf|referencias|fuentes|recursos|references|sources/i;
  for (const b of doc.blocks) {
    if (SOURCES.test(headingText(b))) continue;
    if (b.type === 'list-item' || b.type === 'paragraph') {
      // Un párrafo puede encadenar varias definiciones: "A: def. B: def. C: def."
      const segs = b.type === 'paragraph' ? b.text.split(/(?<=[.;])\s+(?=[A-ZÁÉÍÓÚÑ][^:.;]{1,40}:\s)/) : [b.text];
      for (const seg of segs) {
        const m = seg.match(TERM_ITEM);
        if (m && (b.type === 'list-item' || m[1].split(' ').length <= 4)) add(m[1], m[2], m[2], b, headingText(b), b.ordered);
      }
    } else if (b.type === 'table' && b.rows && b.rows.length >= 2) {
      const [header, ...rows] = b.rows;
      if (header.length === 2 && DEF_HEADER.test(header[1])) {
        for (const r of rows) if (r[0] && r[1]) add(qualify(header[0], r[0]), r[1], r[1], b, `${header[0]} ${headingText(b)}`);
        // las tablas de clasificación también se visualizan como comparación
        if (/clasificaci|tipo|categor|etapa|fase|grado|estadio/i.test(header[0])) comparaciones.push({ id: `cmp-${b.id}`, temaId: topicOfBlock(b.id, temas), columnas: header, filas: rows, blockId: b.id });
      } else if (header.length === 3 && DEF_HEADER.test(header[2]) && !DEF_HEADER.test(header[1])) {
        // Letra | Parámetro | Qué evalúa → concepto = 2.ª columna
        for (const r of rows) if (r[1] && r[2]) add(r[1], r[2], r[2], b, `${header[1]} ${headingText(b)}`);
        comparaciones.push({ id: `cmp-${b.id}`, temaId: topicOfBlock(b.id, temas), columnas: header, filas: rows, blockId: b.id });
      } else {
        comparaciones.push({ id: `cmp-${b.id}`, temaId: topicOfBlock(b.id, temas), columnas: header, filas: rows, blockId: b.id });
      }
    }
  }

  // Subtítulos tipo "Primer período: dilatación" → concepto con el primer párrafo como definición
  for (const t of temas.filter((t) => t.nivel >= 2)) {
    const head = doc.blocks.find((b) => b.type === 'heading' && b.text === t.titulo);
    // solo el párrafo que sigue inmediatamente al subtítulo define el concepto
    const next = head ? doc.blocks[doc.blocks.indexOf(head) + 1] : undefined;
    const para = next && next.type === 'paragraph' ? next : undefined;
    if (!head || !para) continue;
    const nombre = t.titulo.includes(':') ? t.titulo.split(':').pop()!.trim() : t.titulo;
    if (nombre.split(' ').length <= 5 && !byKey.has(normalize(nombre))) add(nombre, para.text, para.text, para, t.titulo);
  }

  const conceptos = [...byKey.values()];
  // Menciones: bloques donde aparece el nombre como palabra completa
  const normBlocks = doc.blocks.map((b) => ({ id: b.id, n: normalize(b.text) }));
  for (const c of conceptos) {
    const key = normalize(c.nombre);
    c.menciones = normBlocks.filter((b) => containsWord(b.n, key)).map((b) => b.id).slice(0, 30);
  }
  return { conceptos, comparaciones };
}
