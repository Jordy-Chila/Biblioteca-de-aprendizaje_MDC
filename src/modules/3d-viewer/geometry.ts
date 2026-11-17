import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GeometrySpec, MeshSpec } from '../../types/scene';

const surfaceFns = {
  paraboloide: (x: number, y: number) => (x * x + y * y) * 0.5,
  silla: (x: number, y: number) => (x * x - y * y) * 0.5,
  onda: (x: number, y: number) => Math.sin(x * 2) * Math.cos(y * 2) * 0.4,
};

/** Crea la geometría Three.js de una especificación procedural. */
export function createGeometry(spec: GeometrySpec): THREE.BufferGeometry {
  switch (spec.kind) {
    case 'sphere':
      return new THREE.SphereGeometry(spec.r, spec.segments ?? 40, Math.round((spec.segments ?? 40) * 0.75), spec.phiStart ?? 0, spec.phiLength ?? Math.PI * 2, spec.thetaStart ?? 0, spec.thetaLength ?? Math.PI);
    case 'box': {
      const g = new THREE.BoxGeometry(...spec.size);
      return g;
    }
    case 'cylinder':
      return new THREE.CylinderGeometry(spec.rTop, spec.rBottom, spec.h, spec.segments ?? 36, 1, spec.open ?? false);
    case 'cone':
      return new THREE.ConeGeometry(spec.r, spec.h, spec.segments ?? 36);
    case 'torus':
      return new THREE.TorusGeometry(spec.r, spec.tube, 20, 80, spec.arc ?? Math.PI * 2);
    case 'capsule':
      return new THREE.CapsuleGeometry(spec.r, spec.len, 8, 20);
    case 'tube': {
      const curve = new THREE.CatmullRomCurve3(spec.points.map((p) => new THREE.Vector3(...p)), spec.closed ?? false, 'catmullrom', 0.1);
      return new THREE.TubeGeometry(curve, Math.max(24, spec.points.length * 8), spec.r, 12, spec.closed ?? false);
    }
    case 'lathe':
      return new THREE.LatheGeometry(spec.points.map(([x, y]) => new THREE.Vector2(x, y)), spec.segments ?? 72, spec.phiStart ?? 0, spec.phiLength ?? Math.PI * 2);
    case 'ring':
      return new THREE.CircleGeometry(spec.outer, 64);
    case 'shell':
      return shellGeometry(spec.outer, spec.inner, spec.segments ?? 72, spec.phiStart ?? 0, spec.phiLength ?? Math.PI * 2);
    case 'polyhedron':
      return spec.type === 'tetra'
        ? new THREE.TetrahedronGeometry(spec.r)
        : spec.type === 'octa'
          ? new THREE.OctahedronGeometry(spec.r)
          : spec.type === 'dodeca'
            ? new THREE.DodecahedronGeometry(spec.r)
            : new THREE.IcosahedronGeometry(spec.r);
    case 'surface': {
      const g = new THREE.PlaneGeometry(spec.size * 2, spec.size * 2, 40, 40);
      const pos = g.attributes.position as THREE.BufferAttribute;
      const f = surfaceFns[spec.fn];
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i);
        pos.setZ(i, f(x, y));
      }
      g.rotateX(-Math.PI / 2);
      g.computeVertexNormals();
      return g;
    }
    case 'arrow': {
      const r = spec.r ?? 0.05;
      const shaftLen = spec.length * 0.78;
      const shaft = new THREE.CylinderGeometry(r, r, shaftLen, 12);
      shaft.translate(0, shaftLen / 2, 0);
      const head = new THREE.ConeGeometry(r * 2.8, spec.length - shaftLen, 16);
      head.translate(0, shaftLen + (spec.length - shaftLen) / 2, 0);
      const merged = mergeTwo(shaft, head);
      shaft.dispose();
      head.dispose();
      return merged;
    }
  }
}

/** Pared con grosor: dos superficies de revolución unidas por las caras del corte y por los bordes. */
function shellGeometry(outer: [number, number][], inner: [number, number][], segments: number, phiStart: number, phiLength: number): THREE.BufferGeometry {
  const toV2 = (pts: [number, number][]) => pts.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y));
  const parts: THREE.BufferGeometry[] = [new THREE.LatheGeometry(toV2(outer), segments, phiStart, phiLength), new THREE.LatheGeometry(toV2(inner), segments, phiStart, phiLength)];
  const ribbon = (a: THREE.Vector3[], b: THREE.Vector3[], normal: THREE.Vector3) => {
    const pos: number[] = [], nor: number[] = [], uv: number[] = [];
    for (let i = 0; i < a.length - 1; i++) {
      const quad = [a[i], b[i], a[i + 1], b[i], b[i + 1], a[i + 1]];
      for (const v of quad) {
        pos.push(v.x, v.y, v.z);
        nor.push(normal.x, normal.y, normal.z);
        uv.push(0, 0);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return g;
  };
  const at = (r: number, y: number, phi: number) => new THREE.Vector3(Math.sin(phi) * r, y, Math.cos(phi) * r);
  if (phiLength < Math.PI * 2 - 1e-3) {
    for (const [phi, sign] of [
      [phiStart, -1],
      [phiStart + phiLength, 1],
    ] as const) {
      const n = new THREE.Vector3(Math.cos(phi) * sign, 0, -Math.sin(phi) * sign);
      parts.push(ribbon(outer.map(([r, y]) => at(r, y, phi)), inner.map(([r, y]) => at(r, y, phi)), n));
    }
  }
  // bordes superior e inferior (anillos que cierran el grosor)
  for (const idx of [0, outer.length - 1]) {
    const [ro, yo] = outer[idx], [ri, yi] = inner[Math.min(idx, inner.length - 1)];
    if (Math.abs(ro - ri) < 1e-3 && Math.abs(yo - yi) < 1e-3) continue;
    const a: THREE.Vector3[] = [], b: THREE.Vector3[] = [];
    for (let s = 0; s <= segments; s++) {
      const phi = phiStart + (s / segments) * phiLength;
      a.push(at(ro, yo, phi));
      b.push(at(ri, yi, phi));
    }
    parts.push(ribbon(a, b, new THREE.Vector3(0, idx === 0 ? -1 : 1, 0)));
  }
  const merged = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)), false);
  parts.forEach((p) => p.dispose());
  return merged ?? new THREE.BufferGeometry();
}

/** Une dos geometrías no indexadas (para flechas). */
function mergeTwo(a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry {
  const A = a.toNonIndexed(), B = b.toNonIndexed();
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal'] as const) {
    const x = A.attributes[name].array as Float32Array, y = B.attributes[name].array as Float32Array;
    const arr = new Float32Array(x.length + y.length);
    arr.set(x);
    arr.set(y, x.length);
    out.setAttribute(name, new THREE.BufferAttribute(arr, 3));
  }
  A.dispose();
  B.dispose();
  return out;
}

/** Ruido suave determinista (suma de senos) para dar relieve orgánico. */
function smoothNoise(x: number, y: number, z: number): number {
  return (
    Math.sin(x * 1.7 + Math.sin(y * 2.3) * 1.1) * 0.5 +
    Math.sin(y * 2.9 + Math.sin(z * 1.9) * 1.3) * 0.3 +
    Math.sin(z * 3.7 + Math.sin(x * 2.7) * 0.9) * 0.2 +
    Math.sin((x + y + z) * 6.1) * 0.08
  );
}

/** Geometría de una malla, con relieve orgánico opcional y normales suaves. */
export function createMeshGeometry(spec: MeshSpec): THREE.BufferGeometry {
  let g = createGeometry(spec.geom);
  if (spec.noise) {
    // Las geometrías de three duplican vértices en las costuras: se fusionan para que el relieve no abra grietas
    g.deleteAttribute('uv');
    const merged = mergeVertices(g);
    g.dispose();
    g = merged;
    const pos = g.attributes.position as THREE.BufferAttribute;
    g.computeVertexNormals();
    const nor = g.attributes.normal as THREE.BufferAttribute;
    const f = spec.noiseScale ?? 2.2;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const d = smoothNoise(x * f, y * f, z * f) * spec.noise;
      pos.setXYZ(i, x + nor.getX(i) * d, y + nor.getY(i) * d, z + nor.getZ(i) * d);
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
  }
  return g;
}

/** Fusiona vértices con la misma posición. */
function mergeVertices(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const src = g.index ? g.toNonIndexed() : g;
  const pos = src.attributes.position as THREE.BufferAttribute;
  const map = new Map<string, number>();
  const verts: number[] = [];
  const index: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    let id = map.get(key);
    if (id === undefined) {
      id = verts.length / 3;
      map.set(key, id);
      verts.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    }
    index.push(id);
  }
  if (src !== g) src.dispose();
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  out.setIndex(index);
  return out;
}
