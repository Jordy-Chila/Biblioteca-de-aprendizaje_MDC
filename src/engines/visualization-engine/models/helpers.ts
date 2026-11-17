import type { GeometrySpec, MeshSpec, ModelDef, V3 } from '../../../types/scene';

export const m = (geom: GeometrySpec, position: V3 = [0, 0, 0], rotation: V3 = [0, 0, 0], scale?: V3): MeshSpec => ({ geom, position, rotation, scale });
export const sph = (r: number, position: V3 = [0, 0, 0], scale?: V3, rotation: V3 = [0, 0, 0]): MeshSpec => m({ kind: 'sphere', r }, position, rotation, scale);
/** Refleja una malla en el eje X (estructuras bilaterales). */
export const mirrorX = (s: MeshSpec): MeshSpec => ({
  ...s,
  position: s.position ? [-s.position[0], s.position[1], s.position[2]] : undefined,
  rotation: s.rotation ? [s.rotation[0], -s.rotation[1], -s.rotation[2]] : undefined,
});
export const both = (s: MeshSpec): MeshSpec[] => [s, mirrorX(s)];

export const NOTA_PROCEDURAL = 'Modelo procedural esquemático generado por la aplicación: aproximación didáctica, no a escala ni anatómicamente exacta.';

export const PI = Math.PI;

/** Puntos de una curva paramétrica. */
export function curve(n: number, f: (t: number) => V3): V3[] {
  return Array.from({ length: n }, (_, i) => f(i / (n - 1)));
}

export function staticModel(def: Omit<ModelDef, 'nota'> & { nota?: string }): ModelDef {
  return { nota: NOTA_PROCEDURAL, ...def };
}
