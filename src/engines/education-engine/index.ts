import type { DocumentModel } from '../../types/document';
import type { Afirmacion, Concepto, StudyPlan } from '../../types/plan';
import type { GeneratedQuestion, OpenGrade } from '../../services/ai/types';
import { subtree } from '../visualization-engine/models/generic';
import { firstSentences } from '../document-engine/analysis/topics';
import { fromBlock } from '../document-engine/grounding';
import { normalize, tokens } from '../../utils/normalize';

export interface Flashcard {
  id: string;
  frente: string;
  reverso: Afirmacion;
  temaId: string;
  conceptoId?: string;
}

/** Generador pseudoaleatorio determinista (mismas preguntas para el mismo documento y semilla). */
export function rng(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
function shuffle<T>(arr: T[], r: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const inScope = (plan: StudyPlan, temaId?: string) => (temaId ? subtree(temaId, plan.temas) : null);

/** Tarjetas de memoria: término → definición y preguntas del propio documento. */
export function buildFlashcards(plan: StudyPlan, temaId?: string): Flashcard[] {
  const ids = inScope(plan, temaId);
  const cards: Flashcard[] = plan.conceptos
    .filter((c) => (!ids || ids.has(c.temaId)) && c.definicion.some((d) => d.origen === 'documento'))
    .map((c) => ({ id: `fc-${c.id}`, frente: c.nombre, reverso: c.definicion.find((d) => d.origen === 'documento')!, temaId: c.temaId, conceptoId: c.id }));
  for (const q of plan.preguntas) if (!ids || ids.has(q.temaId)) cards.push({ id: `fc-${q.id}`, frente: q.pregunta, reverso: q.respuesta, temaId: q.temaId });
  return cards;
}

function definitionText(c: Concepto): Afirmacion | undefined {
  return c.definicion.find((d) => d.origen === 'documento' && d.texto.length > 12 && d.texto.length < 260);
}

/**
 * Cuestionario local: opción múltiple (definición → término), verdadero/falso (término con su definición o con la de otro)
 * y abiertas (preguntas del propio documento). Todo se construye con texto literal del documento.
 */
export function buildLocalQuiz(plan: StudyPlan, temaId: string | undefined, count = 10, seed = 7): GeneratedQuestion[] {
  const r = rng(seed + plan.conceptos.length);
  const ids = inScope(plan, temaId);
  const pool = plan.conceptos.filter((c) => definitionText(c));
  const scoped = pool.filter((c) => !ids || ids.has(c.temaId));
  const out: GeneratedQuestion[] = [];
  const nombreEn = (d: Afirmacion, c: Concepto) => d.texto.replace(new RegExp(c.nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), '_____');

  for (const c of shuffle(scoped, r)) {
    const def = definitionText(c)!;
    // distractores: preferir el mismo tipo y tema
    const others = shuffle(pool.filter((o) => o.id !== c.id && normalize(o.nombre) !== normalize(c.nombre)), r).sort((a, b) => Number(b.tipo === c.tipo) - Number(a.tipo === c.tipo));
    const kind = out.length % 3;
    if (kind !== 1 && others.length >= 3) {
      const opciones = shuffle([c.nombre, ...others.slice(0, 3).map((o) => o.nombre)], r);
      out.push({ tipo: 'opcion-multiple', pregunta: `¿A qué concepto corresponde esta descripción?\n«${nombreEn(def, c)}»`, opciones, correcta: opciones.indexOf(c.nombre), respuestaModelo: { ...def, texto: `${c.nombre}: ${def.texto}` } });
    } else if (others.length >= 1) {
      const verdadero = r() < 0.5;
      const other = others[0];
      const shown = verdadero ? def : definitionText(other)!;
      out.push({
        tipo: 'verdadero-falso',
        pregunta: `Verdadero o falso: «${c.nombre}» se describe como: ${shown.texto}`,
        opciones: ['Verdadero', 'Falso'],
        correcta: verdadero ? 0 : 1,
        respuestaModelo: { ...def, texto: `${c.nombre}: ${def.texto}` },
        explicacion: verdadero ? undefined : `Esa descripción corresponde a «${other.nombre}».`,
      });
    }
    if (out.length >= count) break;
  }
  const preguntas = plan.preguntas.filter((q) => !ids || ids.has(q.temaId));
  for (const q of shuffle(preguntas, r).slice(0, Math.max(2, Math.floor(count / 4)))) {
    out.push({ tipo: 'abierta', pregunta: q.pregunta, respuestaModelo: q.respuesta });
  }
  return shuffle(out, r).slice(0, count);
}

/** Evaluación local de una respuesta abierta por coincidencia de palabras clave (se indica al usuario que es aproximada). */
export function gradeOpenLocal(esperada: string, respuesta: string): OpenGrade {
  const exp = new Set(tokens(esperada));
  const got = new Set(tokens(respuesta));
  if (!exp.size) return { resultado: 'parcial', comentario: 'No se pudo evaluar automáticamente: compara con la respuesta del documento.' };
  let hit = 0;
  exp.forEach((w) => {
    if ([...got].some((g) => g === w || (w.length > 5 && g.startsWith(w.slice(0, 5))))) hit++;
  });
  const ratio = hit / exp.size;
  if (ratio >= 0.6) return { resultado: 'correcta', comentario: `Tu respuesta contiene ${hit} de ${exp.size} ideas clave de la respuesta del documento.` };
  if (ratio >= 0.3) return { resultado: 'parcial', comentario: `Coinciden ${hit} de ${exp.size} palabras clave. Revisa la respuesta del documento para completarla.` };
  return { resultado: 'incorrecta', comentario: `Solo coinciden ${hit} de ${exp.size} palabras clave con la respuesta del documento.` };
}

/** Resumen extractivo de un tema: primeras oraciones de sus párrafos y elementos clave. */
export function summarizeLocal(doc: DocumentModel, plan: StudyPlan, temaId: string, max = 6): Afirmacion[] {
  const ids = subtree(temaId, plan.temas);
  const temas = plan.temas.filter((t) => ids.has(t.id));
  const out: Afirmacion[] = [];
  for (const t of temas) {
    for (const id of t.blockIds) {
      const b = doc.blocks.find((x) => x.id === id);
      if (!b || b.type === 'heading' || b.type === 'table' || b.type === 'note') continue;
      if (out.some((a) => a.blockId === b.id)) continue;
      const txt = b.type === 'paragraph' ? firstSentences(b.text, 220) : b.text;
      if (txt.length < 25) continue;
      out.push({ ...fromBlock(txt, b.id), verificada: true, pagina: b.page });
      if (out.length >= max) return out;
    }
  }
  return out;
}

export interface GuidedStep {
  temaId: string;
  titulo: string;
  escenaId?: string;
  conceptoIds: string[];
}

/** Recorrido guiado: cada tema principal en el orden del documento con su escena principal y sus conceptos. */
export function buildGuidedRoute(plan: StudyPlan): GuidedStep[] {
  return plan.temas
    .filter((t) => t.nivel === 1)
    .map((t) => {
      const sub = subtree(t.id, plan.temas);
      return {
        temaId: t.id,
        titulo: t.titulo,
        escenaId: plan.escenas.find((e) => e.temaId === t.id)?.id,
        conceptoIds: plan.conceptos.filter((c) => sub.has(c.temaId)).map((c) => c.id),
      };
    })
    .filter((s) => !/bibliograf|referencias|fuentes|repaso/i.test(s.titulo));
}
