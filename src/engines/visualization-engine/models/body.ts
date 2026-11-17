import { Euler, Quaternion, Vector3, CatmullRomCurve3 } from 'three';
import type { MeshSpec, V3 } from '../../../types/scene';
import { sph } from './helpers';

const UP = new Vector3(0, 1, 0);

/** Cápsula que une dos puntos (segmento de una extremidad, vaso, hueso largo…). */
export function limb(a: V3, b: V3, r: number, color?: string): MeshSpec {
  const va = new Vector3(...a), vb = new Vector3(...b);
  const d = vb.clone().sub(va);
  const len = Math.max(0.001, d.length());
  const q = new Quaternion().setFromUnitVectors(UP, d.normalize());
  const e = new Euler().setFromQuaternion(q, 'XYZ');
  const mid = va.add(vb).multiplyScalar(0.5);
  return { geom: { kind: 'capsule', r, len }, position: [mid.x, mid.y, mid.z], rotation: [e.x, e.y, e.z], color };
}

/** Volumen orgánico: esferas encadenadas a lo largo de una curva con radios interpolados (tronco, órganos alargados). */
export function blob(points: V3[], radii: number[], steps = 14, color?: string): MeshSpec[] {
  const c = new CatmullRomCurve3(points.map((p) => new Vector3(...p)));
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    const p = c.getPoint(t);
    const f = t * (radii.length - 1);
    const k = Math.min(radii.length - 2, Math.floor(f));
    const r = radii[k] + (radii[k + 1] - radii[k]) * (f - k);
    return { ...sph(r, [p.x, p.y, p.z]), color };
  });
}

/** Gira un punto alrededor del eje Y y lo desplaza. */
export function yaw(p: V3, a: number, off: V3 = [0, 0, 0]): V3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [p[0] * c + p[2] * s + off[0], p[1] + off[1], -p[0] * s + p[2] * c + off[2]];
}

/**
 * Feto a término en presentación cefálica de vértice y actitud de flexión general.
 * Coordenadas locales: +y hacia los pies, +x hacia el vientre, ±z hacia los lados.
 * Se gira con `angle` para que la cámara lo vea de perfil.
 */
export function fetus(angle: number, off: V3): MeshSpec[] {
  const T = (p: V3) => yaw(p, angle, off);
  const SKIN = '#f2c6aa', SKIN2 = '#ebb99b', SKIN3 = '#e6b090';
  const out: MeshSpec[] = [];
  // cabeza (abajo, encajada hacia el cérvix), algo alargada; mentón flexionado hacia el tórax
  out.push({ ...sph(0.58, T([0.08, -0.4, 0]), [1.06, 1.0, 0.94]), color: SKIN });
  out.push({ ...sph(0.08, T([0.62, -0.22, 0])), color: SKIN2 }); // nariz
  out.push({ ...sph(0.13, T([0.5, -0.02, 0]), [0.9, 0.8, 1.2]), color: SKIN2 }); // mentón y boca
  for (const z of [-1, 1]) out.push({ ...sph(0.1, T([0.02, -0.36, 0.55 * z]), [0.8, 1.15, 0.45]), color: SKIN3 }); // orejas
  for (const z of [-1, 1]) out.push({ ...sph(0.06, T([0.5, -0.36, 0.2 * z]), [0.6, 0.45, 0.9]), color: '#d79c80' }); // párpados cerrados
  // cuello y tronco en "C"
  out.push(...blob(([[0.06, 0.08, 0], [-0.2, 0.4, 0], [-0.34, 0.78, 0], [-0.3, 1.12, 0], [-0.12, 1.42, 0]] as V3[]).map(T), [0.24, 0.38, 0.43, 0.41, 0.34], 16, SKIN));
  out.push({ ...sph(0.33, T([0.06, 0.86, 0])), color: SKIN }); // abdomen
  out.push({ ...sph(0.28, T([-0.02, 0.5, 0])), color: SKIN }); // tórax anterior
  // brazos flexionados, manos junto a la cara
  for (const z of [-1, 1]) {
    const sh: V3 = [-0.05, 0.3, 0.3 * z], el: V3 = [0.32, 0.56, 0.36 * z], ha: V3 = [0.46, 0.08, 0.2 * z];
    out.push(limb(T(sh), T(el), 0.1, SKIN2), limb(T(el), T(ha), 0.085, SKIN2));
    out.push({ ...sph(0.1, T(sh)), color: SKIN2 }, { ...sph(0.085, T(el)), color: SKIN2 }, { ...sph(0.1, T(ha), [1, 0.75, 0.6]), color: SKIN3 });
  }
  // piernas flexionadas: muslos sobre el abdomen, piernas cruzadas
  for (const z of [-1, 1]) {
    const hip: V3 = [-0.1, 1.28, 0.22 * z], knee: V3 = [0.5, 0.8, 0.28 * z], ank: V3 = [0.32, 1.4, 0.08 * -z], toe: V3 = [0.5, 1.52, 0.04 * -z];
    out.push(limb(T(hip), T(knee), 0.17, SKIN), limb(T(knee), T(ank), 0.12, SKIN2));
    out.push({ ...sph(0.17, T(hip)), color: SKIN }, { ...sph(0.13, T(knee)), color: SKIN2 }, limb(T(ank), T(toe), 0.08, SKIN3));
  }
  return out;
}
