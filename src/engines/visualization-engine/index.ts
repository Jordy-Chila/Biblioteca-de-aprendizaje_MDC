import type { DocumentModel } from '../../types/document';
import type { Escena, StudyPlan, Tema } from '../../types/plan';
import type { CatalogEntry, ModelDef } from '../../types/scene';
import { containsWord, normalize } from '../../utils/normalize';
import { anatomia } from './models/anatomy';
import { ciencia } from './models/science';
import { tecnologiaMatematicas } from './models/tech-math';
import { comparacion, genericos, jerarquia, lineaTiempo, mapaConceptos, proceso, subtree } from './models/generic';

/** Catálogo completo: modelos de dominio primero, generadores genéricos después. */
export const CATALOG: CatalogEntry[] = [...anatomia, ...ciencia, ...tecnologiaMatematicas, ...genericos];
export const DOMAIN_ENTRIES = [...anatomia, ...ciencia, ...tecnologiaMatematicas];
export const DOC_TOPIC = '__doc__';

export function getEntry(id: string): CatalogEntry | undefined {
  return CATALOG.find((e) => e.id === id);
}

/** Puntuación de una entrada de dominio para un texto normalizado. */
export function scoreEntry(entry: CatalogEntry, text: string, materia?: string): { score: number; params?: Record<string, unknown> } | null {
  if (entry.detect) return null;
  if (entry.requiereAlguna && !entry.requiereAlguna.some((w) => containsWord(text, normalize(w)))) return { score: 0 };
  let score = entry.palabrasClave.reduce((s, k) => s + (containsWord(text, normalize(k)) ? 1 : 0), 0);
  if (materia && entry.materias.includes(materia) && score > 0) score += 1;
  return { score };
}

export function topicText(doc: DocumentModel, plan: StudyPlan, tema?: Tema): string {
  if (!tema) return normalize(doc.canonicalText);
  const ids = subtree(tema.id, plan.temas);
  const blockIds = new Set(plan.temas.filter((t) => ids.has(t.id)).flatMap((t) => t.blockIds));
  return normalize([tema.titulo, ...doc.blocks.filter((b) => blockIds.has(b.id)).map((b) => b.text)].join(' \n '));
}

/** Mejores modelos de dominio para un texto. */
export function matchDomainModels(text: string, ctx: { plan: StudyPlan; doc: DocumentModel; tema?: Tema }, limit = 2): { entry: CatalogEntry; score: number; params?: Record<string, unknown> }[] {
  const out: { entry: CatalogEntry; score: number; params?: Record<string, unknown> }[] = [];
  for (const e of DOMAIN_ENTRIES) {
    const r = e.detect ? e.detect(text, ctx) : scoreEntry(e, text, ctx.plan.dominio.materia);
    if (r && r.score >= (e.minScore ?? 3)) out.push({ entry: e, score: r.score, params: r.params });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Decide qué representaciones visuales necesita cada tema principal.
 * Nunca fuerza un modelo: si ningún modelo de dominio supera el umbral se usan representaciones genéricas
 * (proceso, comparación, línea de tiempo, mapa de conceptos o estructura).
 */
export function planScenes(doc: DocumentModel, plan: StudyPlan): Escena[] {
  const escenas: Escena[] = [];
  const add = (temaId: string, entry: CatalogEntry, titulo: string, confianza: number, params: Record<string, unknown> = {}) =>
    escenas.push({ id: `${temaId}::${entry.id}::${escenas.length}`, temaId, sceneTypeId: entry.id, titulo, confianza, params });

  // Vista general del documento
  add(DOC_TOPIC, jerarquia, 'Mapa del documento', 0);
  if (plan.eventos.length >= 3) add(DOC_TOPIC, lineaTiempo, 'Línea de tiempo del documento', 0);
  const docModels = matchDomainModels(topicText(doc, plan), { plan, doc }, 3);
  docModels.forEach((m) => add(DOC_TOPIC, m.entry, m.entry.titulo, m.score, m.params));

  const roots = plan.temas.filter((t) => t.nivel === 1);
  for (const tema of roots) {
    const sub = subtree(tema.id, plan.temas);
    const text = topicText(doc, plan, tema);
    matchDomainModels(text, { plan, doc, tema }).forEach((m) => add(tema.id, m.entry, m.entry.titulo, m.score, m.params));
    plan.procesos.filter((p) => sub.has(p.temaId)).forEach((p) => add(tema.id, proceso, `Proceso: ${p.nombre.replace(/^\d+(\.\d+)*\.?\s*/, '')}`, 0, { procesoId: p.id }));
    plan.comparaciones.filter((c) => sub.has(c.temaId)).slice(0, 4).forEach((c) => add(tema.id, comparacion, `Comparación: ${c.columnas.slice(0, 2).join(' / ')}`, 0, { comparacionId: c.id }));
    if (plan.eventos.filter((e) => sub.has(e.temaId)).length >= 2) add(tema.id, lineaTiempo, 'Línea de tiempo', 0);
    if (plan.conceptos.some((c) => sub.has(c.temaId))) add(tema.id, mapaConceptos, 'Mapa de conceptos', 0);
    if (!escenas.some((e) => e.temaId === tema.id)) add(tema.id, jerarquia, 'Estructura del tema', 0);
  }
  return escenas;
}

/** Construye la geometría de una escena (null si el generador no tiene datos suficientes). */
export function buildScene(escena: Escena, plan: StudyPlan, doc: DocumentModel): ModelDef | null {
  const entry = getEntry(escena.sceneTypeId);
  if (!entry) return null;
  const tema = plan.temas.find((t) => t.id === escena.temaId);
  try {
    return entry.build({ plan, doc, tema, escena });
  } catch (e) {
    console.error('Error al construir la escena', escena.sceneTypeId, e);
    return null;
  }
}
