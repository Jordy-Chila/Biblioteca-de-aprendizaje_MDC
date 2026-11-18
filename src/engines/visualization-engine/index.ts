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

  // Sin vista general del documento: cada tema muestra solo lo suyo, para no saturar al estudiante.
  const roots = plan.temas.filter((t) => t.nivel === 1);
  for (const tema of roots) {
    const sub = subtree(tema.id, plan.temas);
    const text = topicText(doc, plan, tema);
    const titulo = normalize(tema.titulo);
    // temas de repaso, glosario o bibliografía: no repiten modelos, usan su mapa de conceptos
    const meta = /repaso|resumen|conceptos que|glosario|preguntas|bibliograf|referencias|evaluaci|autoevaluaci|examen/.test(titulo);
    const queue: { entry: CatalogEntry; titulo: string; score: number; params: Record<string, unknown>; prioridad: number }[] = [];

    // 1) Modelos 3D: solo si el tema habla de sus estructuras, y centrados en ellas
    const hijos = plan.temas.filter((t) => t.padreId === tema.id);
    const candidatos = meta ? [] : matchDomainModels(text, { plan, doc, tema });
    for (const m of candidatos) {
      const focus = focusParts(m.entry, m.params, text, { plan, doc, tema });
      const enTitulo = m.entry.palabrasClave.some((k) => containsWord(titulo, normalize(k))) || focus.nombres.some((n) => containsWord(titulo, normalize(n)));
      // Subtemas que tratan otro aspecto de las mismas estructuras: una vista del modelo por subtema
      const aspectos = hijos
        .map((h) => ({ h, f: focusParts(m.entry, m.params, topicText(doc, plan, h), { plan, doc, tema: h }) }))
        // un aspecto cuenta si trata al menos dos estructuras o nombra una en su título
        .filter((x) => x.f.ids.length >= 2 || (x.f.ids.length >= 1 && x.f.nombres.some((n) => containsWord(normalize(x.h.titulo), normalize(n)))));
      const secuencial = aspectos.length >= 2;
      if (focus.ids.length < 2 && !enTitulo && !secuencial) continue; // menciona el órgano de pasada: no aporta repetir el modelo
      const parcial = focus.ids.length >= 1 && focus.ids.length < focus.total;
      const prioridad = enTitulo ? 0 : focus.ids.length >= 3 || secuencial ? 2 : 3;
      queue.push({
        entry: m.entry,
        titulo: secuencial ? `${m.entry.titulo} · visión general` : parcial ? `${m.entry.titulo} · ${resumenNombres(focus.nombres)}` : m.entry.titulo,
        score: m.score,
        params: { ...(m.params ?? {}), ...(parcial ? { focus: focus.ids } : {}) },
        prioridad,
      });
      if (secuencial)
        aspectos.forEach(({ h, f }, k) =>
          queue.push({ entry: m.entry, titulo: h.titulo, score: m.score, params: { ...(m.params ?? {}), focus: f.ids, subtemaId: h.id }, prioridad: prioridad + 0.01 * (k + 1) }),
        );
    }
    const tieneModelo = queue.length > 0;
    // 2) Representaciones propias del tema
    const propias: typeof queue = [];
    plan.procesos.filter((p) => sub.has(p.temaId)).forEach((p) => propias.push({ entry: proceso, titulo: `Proceso: ${p.nombre.replace(/^\d+(\.\d+)*\.?\s*/, '')}`, score: 0, params: { procesoId: p.id }, prioridad: 1 }));
    plan.comparaciones.filter((c) => sub.has(c.temaId)).slice(0, 4).forEach((c) => propias.push({ entry: comparacion, titulo: `Comparación: ${c.columnas.slice(0, 2).join(' / ')}`, score: 0, params: { comparacionId: c.id }, prioridad: 1 }));
    if (plan.eventos.filter((e) => sub.has(e.temaId)).length >= 2) propias.push({ entry: lineaTiempo, titulo: 'Línea de tiempo', score: 0, params: {}, prioridad: 1 });
    if (plan.conceptos.some((c) => sub.has(c.temaId))) propias.push({ entry: mapaConceptos, titulo: 'Mapa de conceptos', score: 0, params: {}, prioridad: 4 });
    // Sin modelo 3D: una sola visualización que englobe el tema (la más específica)
    if (tieneModelo) queue.push(...propias);
    else if (propias.length) queue.push(propias.sort((a, b) => a.prioridad - b.prioridad)[0]);
    queue.sort((a, b) => a.prioridad - b.prioridad).forEach((q) => add(tema.id, q.entry, q.titulo, q.score, q.params));
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
    const model = entry.build({ plan, doc, tema, escena });
    const focus = Array.isArray(escena.params.focus) ? (escena.params.focus as string[]) : undefined;
    return model && focus?.length ? applyFocus(model, focus) : model;
  } catch (e) {
    console.error('Error al construir la escena', escena.sceneTypeId, e);
    return null;
  }
}

/** Estructuras del modelo que menciona el texto del tema (por nombre o alias). */
export function focusParts(entry: CatalogEntry, params: Record<string, unknown> | undefined, text: string, ctx: { plan: StudyPlan; doc: DocumentModel; tema?: Tema }): { ids: string[]; nombres: string[]; total: number } {
  const model = entry.build({ ...ctx, escena: { id: 'tmp', temaId: ctx.tema?.id ?? '', sceneTypeId: entry.id, titulo: '', confianza: 0, params: params ?? {} } });
  if (!model) return { ids: [], nombres: [], total: 0 };
  const seen = new Set<string>();
  const partes = model.parts.filter((p) => p.selectable !== false && p.labelAt && !seen.has(p.nombre) && seen.add(p.nombre));
  const hit = partes.filter((p) => [p.nombre.replace(/\s*\(.*?\)\s*/g, ' ').trim(), ...(p.alias ?? [])].some((a) => a.length >= 4 && containsWord(text, normalize(a))));
  return { ids: hit.map((p) => p.id), nombres: hit.map((p) => p.nombre.replace(/\s*\(.*?\)\s*/g, ' ').trim()), total: partes.length };
}

function resumenNombres(n: string[]): string {
  return n.length <= 2 ? n.join(' y ') : `${n.slice(0, 2).join(', ')} +${n.length - 2}`;
}

/**
 * Centra un modelo en las estructuras de un tema: esas conservan su aspecto y su etiqueta;
 * el resto queda como contorno translúcido de contexto (sigue siendo seleccionable).
 */
export function applyFocus(model: ModelDef, focus: string[]): ModelDef {
  const set = new Set(focus);
  const nombresFoco = new Set(model.parts.filter((p) => set.has(p.id)).map((p) => p.nombre));
  return {
    ...model,
    focusIds: focus,
    parts: model.parts.map((p) =>
      set.has(p.id) || nombresFoco.has(p.nombre) || p.selectable === false ? p : { ...p, opacity: Math.min(p.opacity ?? 1, 0.14), labelAt: undefined, anchorAt: undefined },
    ),
  };
}
