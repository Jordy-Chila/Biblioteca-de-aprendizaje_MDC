import type { DocumentModel } from '../../types/document';
import type { Afirmacion, StudyPlan } from '../../types/plan';
import { normalize } from '../../utils/normalize';

const cache = new WeakMap<DocumentModel, string>();
/** Normaliza para comparar citas: las celdas de tabla (' | ') cuentan como espacios. */
const nq = (s: string) => normalize(s.replace(/\s*\|\s*/g, ' '));
const normDoc = (doc: DocumentModel) => {
  let n = cache.get(doc);
  if (n === undefined) {
    n = nq(doc.canonicalText);
    cache.set(doc, n);
  }
  return n;
};

/** Encuentra el bloque que contiene la cita (para enlazarla y obtener la página). */
export function locateQuote(cita: string, doc: DocumentModel): string | undefined {
  const q = nq(cita);
  return doc.blocks.find((b) => nq(b.text).includes(q))?.id;
}

/**
 * Verifica una afirmación de origen "documento": su cita debe aparecer literalmente en el documento.
 * Si no aparece (o no tiene cita) se degrada a "complementario" y se marca como no verificada.
 */
export function verifyAfirmacion(a: Afirmacion, doc: DocumentModel): Afirmacion {
  if (a.origen !== 'documento') return a;
  const cita = a.cita?.trim();
  if (!cita || cita.length < 3 || !normDoc(doc).includes(nq(cita))) {
    return { ...a, origen: 'complementario', verificada: false };
  }
  const blockId = a.blockId && doc.blocks.some((b) => b.id === a.blockId && nq(b.text).includes(nq(cita))) ? a.blockId : locateQuote(cita, doc);
  const pagina = doc.blocks.find((b) => b.id === blockId)?.page;
  return { ...a, verificada: true, blockId, ...(pagina ? { pagina } : {}) };
}

/** Recorre todas las afirmaciones de un plan. */
export function collectAfirmaciones(plan: StudyPlan): Afirmacion[] {
  return [
    ...plan.temas.flatMap((t) => t.resumen),
    ...plan.conceptos.flatMap((c) => [...c.definicion, ...c.fichas.flatMap((f) => f.afirmaciones)]),
    ...plan.relaciones.map((r) => r.afirmacion),
    ...plan.procesos.flatMap((p) => p.pasos.map((s) => s.afirmacion)),
    ...plan.eventos.map((e) => e.afirmacion),
    ...plan.preguntas.map((q) => q.respuesta),
    ...plan.alertas,
    ...plan.fuentes,
  ];
}

export function verifyPlan(plan: StudyPlan, doc: DocumentModel): StudyPlan {
  const v = (a: Afirmacion) => verifyAfirmacion(a, doc);
  return {
    ...plan,
    temas: plan.temas.map((t) => ({ ...t, resumen: t.resumen.map(v) })),
    conceptos: plan.conceptos.map((c) => ({
      ...c,
      definicion: c.definicion.map(v),
      fichas: c.fichas.map((f) => ({ ...f, afirmaciones: f.afirmaciones.map(v) })),
    })),
    relaciones: plan.relaciones.map((r) => ({ ...r, afirmacion: v(r.afirmacion) })),
    procesos: plan.procesos.map((p) => ({ ...p, pasos: p.pasos.map((s) => ({ ...s, afirmacion: v(s.afirmacion) })) })),
    eventos: plan.eventos.map((e) => ({ ...e, afirmacion: v(e.afirmacion) })),
    preguntas: plan.preguntas.map((q) => ({ ...q, respuesta: v(q.respuesta) })),
    alertas: plan.alertas.map(v),
    fuentes: plan.fuentes.map(v),
  };
}

/** Afirmación literal de un bloque (helper para extractores locales). */
export function fromBlock(texto: string, blockId: string, cita = texto): Afirmacion {
  return { texto, origen: 'documento', cita, blockId };
}
