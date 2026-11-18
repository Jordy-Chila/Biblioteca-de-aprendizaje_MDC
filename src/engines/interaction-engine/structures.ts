import type { DocumentModel } from '../../types/document';
import type { Concepto, Escena, StudyPlan } from '../../types/plan';
import type { ModelDef, PartDef } from '../../types/scene';
import { buildScene } from '../visualization-engine';
import { rootTopic } from '../document-engine/analysis/topics';
import { conceptForPart } from './index';

export interface StructureHit {
  escena: Escena;
  model: ModelDef;
  part: PartDef;
}

const isDomain = (e: Escena) => !e.sceneTypeId.startsWith('generico.');

/** Busca la pieza 3D que representa un concepto: primero en las escenas de su tema, después en cualquier modelo del documento. */
export function findStructure(c: Concepto, plan: StudyPlan, doc: DocumentModel): StructureHit | undefined {
  const root = rootTopic(c.temaId, plan.temas)?.id ?? c.temaId;
  const ordered = [...plan.escenas.filter((e) => isDomain(e) && e.temaId === root), ...plan.escenas.filter((e) => isDomain(e) && e.temaId !== root)];
  // primero las escenas donde la estructura está en el foco del tema; después cualquiera
  for (const pass of [0, 1]) {
    for (const e of ordered) {
      const focus = Array.isArray(e.params.focus) ? (e.params.focus as string[]) : undefined;
      const model = buildScene(e, plan, doc);
      const part = model?.parts.find((p) => p.selectable !== false && (!p.ref || p.ref.type === 'estructura') && conceptForPart(p, plan)?.id === c.id);
      if (!model || !part) continue;
      if (pass === 0 && focus && !focus.includes(part.id)) continue;
      return { escena: e, model, part };
    }
  }
  return undefined;
}

export interface ChallengeModel {
  escena: Escena;
  model: ModelDef;
  /** Piezas que se pueden preguntar (nombre único, seleccionables). */
  parts: PartDef[];
}

/** Modelos 3D del documento que sirven para el Reto 3D (al menos 3 estructuras). */
export function challengeModels(plan: StudyPlan, doc: DocumentModel): ChallengeModel[] {
  const out: ChallengeModel[] = [];
  const seen = new Set<string>();
  for (const e0 of plan.escenas.filter(isDomain)) {
    // el reto usa el modelo completo, sin el foco de ningún tema
    const { focus: _f, ...params } = e0.params;
    void _f;
    const e = { ...e0, params };
    const key = e.sceneTypeId + JSON.stringify(params);
    if (seen.has(key)) continue;
    seen.add(key);
    const model = buildScene(e, plan, doc);
    if (!model) continue;
    const names = new Set<string>();
    const parts = model.parts.filter((p) => {
      if (p.selectable === false || names.has(p.nombre)) return false;
      names.add(p.nombre);
      return true;
    });
    if (parts.length >= 3) out.push({ escena: e, model, parts });
  }
  return out;
}
