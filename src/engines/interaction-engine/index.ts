import type { Block, DocumentModel } from '../../types/document';
import type { Afirmacion, Concepto, Ficha, StudyPlan } from '../../types/plan';
import type { ModelDef, PartDef, V3 } from '../../types/scene';
import { normalize } from '../../utils/normalize';
import { blocksMentioning } from '../education-engine/retrieval';
import { fromBlock } from '../document-engine/grounding';

/** Estado visual de una pieza según la selección, los ocultos y los transparentes. */
export function visualState(
  id: string,
  opts: { seleccionId?: string; hoverId?: string; ocultos?: string[]; transparentes?: string[]; aislado?: boolean; baseOpacity?: number },
): { visible: boolean; opacity: number; emissive: number; scale: number; dim: boolean } {
  const base = opts.baseOpacity ?? 1;
  const hidden = opts.ocultos?.includes(id) ?? false;
  const transp = opts.transparentes?.includes(id) ?? false;
  const selected = opts.seleccionId === id;
  if (opts.aislado && opts.seleccionId && !selected) return { visible: false, opacity: 0, emissive: 0, scale: 1, dim: true };
  if (hidden) return { visible: false, opacity: 0, emissive: 0, scale: 1, dim: false };
  if (selected) return { visible: true, opacity: transp ? 0.35 : Math.max(base, 0.85), emissive: 0.55, scale: 1.04, dim: false };
  const dim = Boolean(opts.seleccionId);
  let opacity = transp ? Math.min(base, 0.18) : base;
  if (dim) opacity = Math.min(opacity, 0.22);
  return { visible: true, opacity, emissive: opts.hoverId === id ? 0.25 : 0, scale: 1, dim };
}

/** Centro aproximado de una pieza (media de las posiciones de sus mallas). */
export function partCenter(p: PartDef): V3 {
  const ps = p.meshes.map((m) => m.position ?? [0, 0, 0]);
  const n = Math.max(1, ps.length);
  return [ps.reduce((s, q) => s + q[0], 0) / n, ps.reduce((s, q) => s + q[1], 0) / n, ps.reduce((s, q) => s + q[2], 0) / n];
}

/** Centro de todo el modelo. */
export function modelCenter(model: ModelDef): V3 {
  const cs = model.parts.filter((p) => p.selectable !== false).map(partCenter);
  const n = Math.max(1, cs.length);
  return [cs.reduce((s, q) => s + q[0], 0) / n, cs.reduce((s, q) => s + q[1], 0) / n, cs.reduce((s, q) => s + q[2], 0) / n];
}

/** Desplazamiento de explosión de una pieza (0..1). */
export function explodeOffset(p: PartDef, center: V3, amount: number): V3 {
  if (!amount) return [0, 0, 0];
  let d = p.explode;
  if (!d) {
    const c = partCenter(p);
    const v: V3 = [c[0] - center[0], c[1] - center[1], c[2] - center[2]];
    const len = Math.hypot(...v) || 1;
    d = [v[0] / len, v[1] / len, v[2] / len];
  }
  const k = amount * 1.6;
  return [d[0] * k, d[1] * k, d[2] * k];
}

export interface PartInfo {
  titulo: string;
  subtitulo?: string;
  concepto?: Concepto;
  definiciones: Afirmacion[];
  fichas: Ficha[];
  relacionados: { concepto: Concepto; tipo: string }[];
  menciones: Block[];
  /** El documento no menciona esta pieza. */
  sinMenciones: boolean;
  nombres: string[];
}

/** Busca el concepto del plan que corresponde a una pieza (por nombre o alias). */
export function conceptForPart(part: Pick<PartDef, 'nombre' | 'alias'>, plan: StudyPlan): Concepto | undefined {
  const names = [part.nombre, ...(part.alias ?? [])].map(normalize);
  const strip = (s: string) => s.replace(/\s*\(.*?\)\s*/g, ' ').trim();
  return (
    plan.conceptos.find((c) => names.includes(normalize(c.nombre)) || names.includes(strip(normalize(c.nombre)))) ??
    plan.conceptos.find((c) => names.some((n) => n.length >= 5 && (normalize(c.nombre).startsWith(n) || n.startsWith(normalize(c.nombre)))))
  );
}

/** Reúne toda la información disponible de una pieza seleccionada. */
export function resolvePartInfo(part: PartDef, model: ModelDef, plan: StudyPlan, doc: DocumentModel): PartInfo {
  const ref = part.ref ?? { type: 'estructura' as const };
  const related = (c?: Concepto) =>
    c
      ? plan.relaciones
          .filter((r) => r.origenId === c.id || r.destinoId === c.id)
          .map((r) => ({ concepto: plan.conceptos.find((x) => x.id === (r.origenId === c.id ? r.destinoId : r.origenId))!, tipo: r.tipo }))
          .filter((x) => x.concepto)
          .slice(0, 8)
      : [];
  const blocksOf = (ids: string[]) => ids.map((id) => doc.blocks.find((b) => b.id === id)).filter((b): b is Block => Boolean(b));

  if (ref.type === 'concepto') {
    const c = plan.conceptos.find((x) => x.id === ref.id);
    return {
      titulo: c?.nombre ?? part.nombre,
      subtitulo: plan.temas.find((t) => t.id === c?.temaId)?.titulo,
      concepto: c,
      definiciones: c?.definicion ?? [],
      fichas: c?.fichas ?? [],
      relacionados: related(c),
      menciones: blocksOf(c?.menciones ?? []).slice(0, 6),
      sinMenciones: !c,
      nombres: [c?.nombre ?? part.nombre, ...(c?.alias ?? [])],
    };
  }
  if (ref.type === 'paso') {
    const p = plan.procesos.find((x) => x.id === ref.procesoId);
    const s = p?.pasos[ref.index];
    const c = s ? conceptForPart({ nombre: s.nombre }, plan) : undefined;
    return {
      titulo: part.nombre,
      subtitulo: `Paso ${ref.index + 1} de ${p?.pasos.length ?? '?'} · ${p?.nombre ?? ''}`,
      concepto: c,
      definiciones: s ? [s.afirmacion] : [],
      fichas: c?.fichas ?? [],
      relacionados: related(c),
      menciones: c ? blocksOf(c.menciones).filter((b) => b.id !== s?.afirmacion.blockId).slice(0, 4) : [],
      sinMenciones: false,
      nombres: [s?.nombre ?? part.nombre],
    };
  }
  if (ref.type === 'evento') {
    const e = plan.eventos.find((x) => x.id === ref.id);
    return { titulo: e?.fecha ?? part.nombre, subtitulo: 'Evento', definiciones: e ? [e.afirmacion] : [], fichas: [], relacionados: [], menciones: [], sinMenciones: !e, nombres: [part.nombre] };
  }
  if (ref.type === 'columna') {
    const c = plan.comparaciones.find((x) => x.id === ref.comparacionId);
    const rows = c?.filas.map((f) => f[ref.index]).filter(Boolean) ?? [];
    return {
      titulo: c?.columnas[ref.index] ?? part.nombre,
      subtitulo: `Comparación: ${c?.columnas.join(' · ')}`,
      definiciones: rows.map((t) => fromBlock(t, c!.blockId)).map((a) => ({ ...a, verificada: true })),
      fichas: [],
      relacionados: [],
      menciones: [],
      sinMenciones: false,
      nombres: [part.nombre],
    };
  }
  if (ref.type === 'fila') {
    const c = plan.comparaciones.find((x) => x.id === ref.comparacionId);
    const fila = c?.filas[ref.index] ?? [];
    const concepto = conceptForPart({ nombre: fila[0] ?? part.nombre }, plan);
    return {
      titulo: fila[0] ?? part.nombre,
      subtitulo: c ? `${c.columnas[0]} · ${ref.index + 1} de ${c.filas.length}` : undefined,
      concepto,
      definiciones: fila.slice(1).map((t, i) => ({ ...fromBlock(c?.columnas[i + 1] ? `${c.columnas[i + 1]}: ${t}` : t, c!.blockId, t), verificada: true })),
      fichas: concepto?.fichas ?? [],
      relacionados: related(concepto),
      menciones: [],
      sinMenciones: false,
      nombres: [fila[0] ?? part.nombre],
    };
  }
  if (ref.type === 'tema') {
    const t = plan.temas.find((x) => x.id === ref.id);
    return { titulo: t?.titulo ?? part.nombre, subtitulo: 'Tema', definiciones: t?.resumen ?? [], fichas: [], relacionados: [], menciones: [], sinMenciones: false, nombres: [part.nombre] };
  }
  // Pieza de un modelo de dominio: enlazar con conceptos y menciones del documento
  const nombres = [part.nombre.replace(/\s*\(.*?\)\s*/g, ' ').trim(), ...(part.alias ?? [])];
  const c = conceptForPart(part, plan);
  const menciones = blocksMentioning(doc, nombres).filter((b) => b.type !== 'heading').slice(0, 6);
  return {
    titulo: part.nombre,
    subtitulo: model.titulo,
    concepto: c,
    definiciones: c?.definicion ?? [],
    fichas: c?.fichas ?? [],
    relacionados: related(c),
    menciones: c ? menciones.filter((b) => !c.definicion.some((d) => d.blockId === b.id)) : menciones,
    sinMenciones: !c && menciones.length === 0,
    nombres,
  };
}
