import type { ModelDef, PartDef } from '../../types/scene';

/** Clave de progreso de una pieza: los conceptos cuentan como c:<id>; las estructuras de modelos como s:<modelo>:<pieza>. */
export function partKey(p: PartDef, model: ModelDef): string {
  const r = p.ref;
  if (!r || r.type === 'estructura') return `s:${model.id}:${p.id}`;
  if (r.type === 'concepto') return `c:${r.id}`;
  if (r.type === 'paso') return `p:${r.procesoId}:${r.index}`;
  if (r.type === 'evento') return `e:${r.id}`;
  if (r.type === 'tema') return `t:${r.id}`;
  if (r.type === 'fila') return `f:${r.comparacionId}:${r.index}`;
  return `k:${r.comparacionId}:${r.index}`;
}
