import type { DocumentModel } from '../../types/document';
import { StudyPlanSchema, type StudyPlan } from '../../types/plan';
import { extractTopics } from '../../engines/document-engine/analysis/topics';
import { extractConcepts } from '../../engines/document-engine/analysis/concepts';
import { extractAlerts, extractEvents, extractProcesses, extractQuestions, extractRelations, extractSources } from '../../engines/document-engine/analysis/extractors';
import { classifyDomain } from '../../engines/document-engine/analysis/domain';
import { fromBlock, verifyPlan } from '../../engines/document-engine/grounding';
import { planScenes } from '../../engines/visualization-engine';
import { blocksMentioning, indexFor } from '../../engines/education-engine/retrieval';
import { subtree } from '../../engines/visualization-engine/models/generic';
import type { AIProvider, TutorAnswer } from './types';

/** Análisis 100 % local: estructura, conceptos, procesos, preguntas, alertas y escenas. Solo usa texto literal del documento. */
export function analyzeLocal(doc: DocumentModel): StudyPlan {
  const temas = extractTopics(doc);
  const { conceptos, comparaciones } = extractConcepts(doc, temas);
  const base: StudyPlan = {
    documentId: doc.id,
    proveedor: 'local',
    dominio: classifyDomain(doc),
    temas,
    conceptos,
    relaciones: extractRelations(conceptos),
    procesos: extractProcesses(doc, temas),
    comparaciones,
    eventos: extractEvents(doc, temas),
    escenas: [],
    preguntas: extractQuestions(doc, temas),
    alertas: extractAlerts(doc),
    fuentes: extractSources(doc, temas),
  };
  base.escenas = planScenes(doc, base);
  return verifyPlan(StudyPlanSchema.parse(base), doc);
}

export const localProvider: AIProvider = {
  id: 'local',
  nombre: 'Análisis local',
  externo: false,
  async analyze(doc, onProgress) {
    onProgress?.(0.5, 'Identificando temas, conceptos y procesos');
    await new Promise((r) => setTimeout(r, 0));
    return analyzeLocal(doc);
  },
  /** Sin IA: devuelve los fragmentos del documento más relevantes, sin redactar una respuesta. */
  async ask(doc, plan, scope, question): Promise<TutorAnswer> {
    let restrict: Set<string> | undefined;
    if (scope.temaId) {
      const ids = subtree(scope.temaId, plan.temas);
      restrict = new Set(plan.temas.filter((t) => ids.has(t.id)).flatMap((t) => t.blockIds));
    }
    const query = `${question} ${scope.nombres?.join(' ') ?? ''} ${scope.tipo === 'concepto' || scope.tipo === 'pieza' ? scope.titulo : ''}`;
    let hits = indexFor(doc).search(query, 4, restrict);
    if (scope.nombres?.length) {
      const named = new Set(blocksMentioning(doc, scope.nombres).map((b) => b.id));
      hits = [...hits.filter((h) => named.has(h.block.id)), ...hits.filter((h) => !named.has(h.block.id))].slice(0, 4);
      if (!hits.length) hits = indexFor(doc).search(query, 4);
    }
    return {
      documento: hits.map((h) => ({ ...fromBlock(h.block.text, h.block.id), verificada: true, pagina: h.block.page })),
      adicional: [],
      insuficiente: hits.length === 0,
      nota: 'Modo local: se muestran los fragmentos del documento más relacionados con tu pregunta. Para obtener una respuesta redactada, conecta Claude o ChatGPT en «Configuración de IA».',
    };
  },
};
