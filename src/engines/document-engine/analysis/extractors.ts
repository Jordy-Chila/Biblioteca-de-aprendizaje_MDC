import type { DocumentModel } from '../../../types/document';
import type { Afirmacion, Concepto, Evento, Pregunta, Proceso, Relacion, Tema } from '../../../types/plan';
import { fromBlock } from '../grounding';
import { containsWord, normalize } from '../../../utils/normalize';
import { topicOfBlock } from './topics';

/** Listas numeradas consecutivas (≥ 2) y secuencias con flechas → procesos paso a paso. */
export function extractProcesses(doc: DocumentModel, temas: Tema[]): Proceso[] {
  const out: Proceso[] = [];
  let run: typeof doc.blocks = [];
  const flush = () => {
    if (run.length >= 2) {
      const temaId = topicOfBlock(run[0].id, temas);
      const tema = temas.find((t) => t.id === temaId);
      out.push({
        id: `proc-${run[0].id}`,
        temaId,
        nombre: tema?.titulo ?? 'Proceso',
        pasos: run.map((b) => {
          const m = b.text.match(/^([^:]{2,60}):\s+(.+)$/);
          return { nombre: (m ? m[1] : b.text.split(/[.,;]/)[0]).trim().slice(0, 60), afirmacion: fromBlock(b.text, b.id) };
        }),
      });
    }
    run = [];
  };
  for (const b of doc.blocks) {
    if (b.type === 'list-item' && b.ordered) run.push(b);
    else flush();
  }
  flush();
  // "A → B → C"
  for (const b of doc.blocks) {
    if (!/→|->/.test(b.text)) continue;
    const body = b.text.includes(':') ? b.text.slice(b.text.indexOf(':') + 1) : b.text;
    const steps = body.split(/\s*(?:→|->)\s*/).map((s) => s.replace(/[.]$/, '').trim()).filter(Boolean);
    if (steps.length < 3) continue;
    const temaId = topicOfBlock(b.id, temas);
    if (out.some((p) => p.temaId === temaId && p.pasos.length === steps.length)) continue;
    out.push({
      id: `proc-${b.id}`,
      temaId,
      nombre: temas.find((t) => t.id === temaId)?.titulo ?? 'Secuencia',
      pasos: steps.map((s) => ({ nombre: s.slice(0, 60), afirmacion: fromBlock(s, b.id) })),
    });
  }
  return out;
}

/** Pares pregunta / respuesta presentes en el documento. */
export function extractQuestions(doc: DocumentModel, temas: Tema[]): Pregunta[] {
  const out: Pregunta[] = [];
  const bs = doc.blocks;
  for (let i = 0; i < bs.length - 1; i++) {
    const q = bs[i];
    const a = bs[i + 1];
    if (q.type === 'heading' || !/\?\s*$/.test(q.text) || q.text.length > 250) continue;
    if (a.type === 'heading' || /\?\s*$/.test(a.text)) continue;
    out.push({ id: `q-${q.id}`, temaId: topicOfBlock(q.id, temas), pregunta: q.text, respuesta: fromBlock(a.text, a.id), generada: false });
  }
  return out;
}

const ALERT = /signos? de alarma|se[ñn]ales? de alarma|urgente|urgencia|emergencia|peligro|advertencia|precauci[oó]n|warning|danger/i;

/** Avisos de seguridad: se conservan íntegros. */
export function extractAlerts(doc: DocumentModel): Afirmacion[] {
  const out: Afirmacion[] = [];
  for (const b of doc.blocks) {
    if (b.type === 'heading' || !ALERT.test(b.text)) continue;
    if (b.type === 'table' && b.rows) {
      for (const r of b.rows) if (ALERT.test(r.join(' '))) out.push(fromBlock(r.join(': '), b.id, r.join(' | ')));
    } else out.push(fromBlock(b.text, b.id));
  }
  return out;
}

const SOURCES = /bibliograf|referencias|fuentes|recursos|references|sources/i;

/** Elementos bajo títulos de bibliografía o referencias. */
export function extractSources(doc: DocumentModel, temas: Tema[]): Afirmacion[] {
  const t = temas.filter((x) => SOURCES.test(x.titulo));
  const ids = new Set(t.flatMap((x) => x.blockIds));
  return doc.blocks.filter((b) => ids.has(b.id) && b.type === 'list-item').map((b) => fromBlock(b.text, b.id));
}

/** Relación A → B cuando la definición de A menciona a B. */
export function extractRelations(conceptos: Concepto[]): Relacion[] {
  const out: Relacion[] = [];
  const keys = conceptos.map((c) => ({ c, k: normalize(c.nombre) })).filter((x) => x.k.length >= 4);
  for (const a of conceptos) {
    for (const d of a.definicion) {
      const nd = normalize(d.texto);
      for (const { c: b, k } of keys) {
        if (b.id === a.id || !containsWord(nd, k)) continue;
        if (out.some((r) => r.origenId === a.id && r.destinoId === b.id)) continue;
        out.push({ id: `rel-${a.id}-${b.id}`, origenId: a.id, destinoId: b.id, tipo: 'se relaciona con', afirmacion: d });
      }
    }
  }
  return out;
}

const YEAR = /\b(?:(?:en|año|hacia|desde|hasta|de|el)\s+)?((?:1[0-9]{3}|20[0-9]{2}|[1-9][0-9]{0,2})\s*(?:a\.?\s?C\.?|d\.?\s?C\.?)|1[0-9]{3}|20[0-9]{2}|siglo\s+[IVXLC]+(?:\s*a\.?\s?C\.?)?)\b/i;

function yearValue(s: string): number {
  const roman = s.match(/siglo\s+([IVXLC]+)/i);
  if (roman) {
    const map: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };
    let n = 0;
    const r = roman[1].toUpperCase();
    for (let i = 0; i < r.length; i++) n += map[r[i]] < (map[r[i + 1]] ?? 0) ? -map[r[i]] : map[r[i]];
    const v = (n - 1) * 100 + 50;
    return /a\.?\s?C/i.test(s) ? -v : v;
  }
  const num = Number(s.match(/\d+/)?.[0] ?? 0);
  return /a\.?\s?C/i.test(s) ? -num : num;
}

/** Oraciones con fechas → eventos (para líneas de tiempo). Solo si hay al menos 3 en el documento. */
export function extractEvents(doc: DocumentModel, temas: Tema[]): Evento[] {
  const out: Evento[] = [];
  for (const b of doc.blocks) {
    if (b.type === 'heading' || b.type === 'table') continue;
    for (const s of b.text.match(/[^.!?]+[.!?]?/g) ?? []) {
      const m = s.match(YEAR);
      if (!m || s.trim().length < 15) continue;
      // evitar números que son medidas (10 cm, 37 semanas)
      if (/^\d+$/.test(m[1]) && Number(m[1]) < 1000) continue;
      out.push({ id: `ev-${b.id}-${out.length}`, temaId: topicOfBlock(b.id, temas), fecha: m[1].trim(), orden: yearValue(m[1]), afirmacion: fromBlock(s.trim(), b.id) });
    }
  }
  return out.length >= 3 ? out.sort((a, b) => a.orden - b.orden) : [];
}
