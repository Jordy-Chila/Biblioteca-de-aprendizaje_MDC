import type { CatalogEntry, MeshSpec, V3 } from '../../../types/scene';
import { m, PI, sph, staticModel } from './helpers';
import { blob, limb } from './body';

// Pelvis femenina (ginecoide): +z anterior, +y craneal. Escala arbitraria (~1 unidad ≈ 10 cm).
const BONE = '#e9dfc9';
const BONE2 = '#ddd0b5';
const CART = '#dbe7ec';

const both = (f: (s: 1 | -1) => MeshSpec[]): MeshSpec[] => [...f(1), ...f(-1)];

/** Ala ilíaca: superficie curva con grosor que asciende y se abre desde el borde pélvico. */
const ala = (s: 1 | -1): MeshSpec[] => {
  const start = s === 1 ? 0.3 * PI : 1.12 * PI;
  const len = 0.58 * PI;
  const outer: [number, number][] = [[1.0, 0.4], [1.26, 0.6], [1.56, 0.86], [1.78, 1.1], [1.86, 1.26], [1.8, 1.38]];
  const inner = outer.map(([r, y]) => [r - 0.09, y - 0.02] as [number, number]);
  const crest: V3[] = Array.from({ length: 24 }, (_, i) => {
    const phi = start + (i / 23) * len;
    return [Math.sin(phi) * 1.83, 1.36 - Math.abs(i / 23 - 0.45) * 0.3, Math.cos(phi) * 1.83 * 0.86];
  });
  return [
    { geom: { kind: 'shell', outer, inner, phiStart: start, phiLength: len, segments: 48 }, scale: [1, 1, 0.86], noise: 0.012, noiseScale: 9 },
    { geom: { kind: 'tube', points: crest, r: 0.065 }, color: BONE2 },
    { ...sph(0.08, crest[0]), color: BONE2 }, // espina ilíaca anterosuperior (lado anterior)
  ];
};

/** Pubis, isquion y acetábulo de un lado (agujero obturador entre ramas). */
const isquiopubis = (s: 1 | -1): MeshSpec[] => [
  limb([s * 0.98, 0.02, 0.22], [s * 0.13, -0.16, 0.9], 0.1), // rama superior del pubis
  limb([s * 0.13, -0.48, 0.86], [s * 0.6, -0.76, 0.16], 0.085), // rama inferior (isquiopubiana)
  limb([s * 1.0, -0.12, 0.02], [s * 0.62, -0.74, 0.08], 0.15), // cuerpo del isquion
  { ...sph(0.17, [s * 0.62, -0.8, 0.1], [1, 0.85, 1.2]), color: BONE2 }, // tuberosidad isquiática
  { geom: { kind: 'torus', r: 0.3, tube: 0.07, arc: 2 * PI }, position: [s * 0.6, -0.36, 0.5], rotation: [0, s * 0.8, 0], scale: [1, 1.25, 1] }, // marco del agujero obturador
  { geom: { kind: 'sphere', r: 0.27, thetaStart: 0, thetaLength: PI / 2 }, position: [s * 1.12, -0.12, 0.14], rotation: [0, 0, s * (PI / 2)], color: BONE2 }, // acetábulo
  { ...sph(0.24, [s * 1.0, -0.12, 0.12]) }, // cuerpo del hueso alrededor del acetábulo
];

const SACRO: { y: number; z: number; w: number }[] = [
  { y: 0.52, z: -0.96, w: 1.2 },
  { y: 0.3, z: -1.04, w: 1.0 },
  { y: 0.08, z: -1.06, w: 0.8 },
  { y: -0.13, z: -1.02, w: 0.6 },
  { y: -0.32, z: -0.93, w: 0.42 },
];

/** Plano de un estrecho: disco translúcido + borde bien definido. */
const plano = (y: number, z: number, rx: number, rz: number, tilt: number): MeshSpec[] => [
  { geom: { kind: 'ring', inner: 0, outer: 1 }, position: [0, y, z], rotation: [-PI / 2 + tilt, 0, 0], scale: [rx, rz, 1] },
  { geom: { kind: 'torus', r: 1, tube: 0.018 }, position: [0, y, z], rotation: [-PI / 2 + tilt, 0, 0], scale: [rx, rz, 1] },
];
/** Punto del borde de un plano (para la línea de la etiqueta). */
const bordePlano = (y: number, z: number, rx: number, rz: number, tilt: number, ang: number): V3 => {
  const lx = Math.cos(ang) * rx, ly = Math.sin(ang) * rz;
  const a = -PI / 2 + tilt;
  return [lx, y + ly * Math.cos(a), z + ly * Math.sin(a)];
};

export const pelvis: CatalogEntry = {
  id: 'anatomia.pelvis',
  titulo: 'Pelvis y canal del parto',
  tipo: 'modelo',
  materias: ['Medicina y anatomía'],
  palabrasClave: ['pelvis', 'pelvica', 'pelvico', 'estrecho superior', 'estrecho medio', 'estrecho inferior', 'estrecho', 'sacro', 'coxis', 'iliaco', 'ilion', 'pubis', 'sinfisis', 'isquion', 'espinas ciaticas', 'suelo pelvico', 'perine', 'coxal', 'canal del parto', 'cadera', 'promontorio'],
  requiereAlguna: ['pelvis', 'pelvica', 'pelvico', 'sacro', 'coxal', 'canal del parto', 'cadera'],
  build: () =>
    staticModel({
      id: 'anatomia.pelvis',
      titulo: 'Pelvis femenina y canal del parto',
      tipo: 'modelo',
      camera: { position: [0.6, 3.4, 6.4], target: [0, 0.35, 0] },
      vistas: [
        { nombre: 'Anterior', position: [0, 0.8, 7] },
        { nombre: 'Superior (entrada)', position: [0.01, 7.5, 1.2] },
        { nombre: 'Lateral', position: [7, 0.4, 0] },
        { nombre: 'Inferior (salida)', position: [0.01, -7, 1.5] },
      ],
      capas: [
        { id: 'hueso', nombre: 'Pelvis ósea' },
        { id: 'planos', nombre: 'Estrechos (planos)' },
        { id: 'blandos', nombre: 'Tejidos blandos' },
      ],
      parts: [
        { id: 'ilion', nombre: 'Ilion (alas ilíacas)', alias: ['ilion', 'iliaco', 'hueso iliaco', 'ala iliaca', 'cresta iliaca', 'coxal', 'hueso coxal', 'cadera', 'pelvis osea'], wiki: 'Ilion', color: BONE, material: 'hueso', capa: 'hueso', meshes: both(ala), labelAt: [2.6, 1.7, -0.3] },
        { id: 'isquiopubis', nombre: 'Pubis e isquion', alias: ['pubis', 'isquion', 'rama del pubis', 'agujero obturador', 'tuberosidad isquiatica', 'acetabulo', 'arco pubico'], wiki: 'Isquion', color: BONE, material: 'hueso', capa: 'hueso', meshes: both(isquiopubis), labelAt: [2.45, -0.62, 0.6] },
        { id: 'sacro', nombre: 'Sacro y promontorio', alias: ['sacro', 'promontorio', 'hueso sacro', 'articulacion sacroiliaca'], wiki: 'Sacro', color: BONE, material: 'hueso', capa: 'hueso', meshes: [...SACRO.map((v, i): MeshSpec => ({ geom: { kind: 'box', size: [v.w, 0.21, 0.22] }, color: i % 2 ? BONE : BONE2, position: [0, v.y, v.z], rotation: [-0.25 + i * 0.12, 0, 0], noise: 0.01 })), { ...sph(0.12, [0, 0.62, -0.84]), color: BONE2 }, limb([0.45, 0.48, -0.95], [0.9, 0.62, -0.72], 0.14), limb([-0.45, 0.48, -0.95], [-0.9, 0.62, -0.72], 0.14)], labelAt: [-2.2, 1.55, -1.3] },
        { id: 'coxis', nombre: 'Cóccix', alias: ['coxis', 'coccix'], wiki: 'Cóccix', color: BONE2, material: 'hueso', capa: 'hueso', meshes: blob([[0, -0.48, -0.86], [0, -0.64, -0.8], [0, -0.76, -0.68], [0, -0.83, -0.56]], [0.1, 0.08, 0.065, 0.05], 6), labelAt: [-1.7, -1.35, -1.0] },
        { id: 'sinfisis', nombre: 'Sínfisis del pubis', alias: ['sinfisis', 'sinfisis del pubis'], wiki: 'Sínfisis del pubis', color: CART, material: 'membrana', capa: 'hueso', meshes: [m({ kind: 'box', size: [0.13, 0.42, 0.2] }, [0, -0.32, 0.9])], labelAt: [2.3, -1.65, 1.4], anchorAt: [0, -0.3, 1.0] },
        { id: 'espinas-ciaticas', nombre: 'Espinas ciáticas', alias: ['espinas ciaticas', 'espina ciatica'], wiki: 'Espina ciática', color: '#f2c879', material: 'hueso', capa: 'hueso', meshes: [m({ kind: 'cone', r: 0.07, h: 0.32 }, [0.66, -0.2, -0.38], [0, 0, PI / 2]), m({ kind: 'cone', r: 0.07, h: 0.32 }, [-0.66, -0.2, -0.38], [0, 0, -PI / 2])], labelAt: [-2.4, -0.3, -0.3], anchorAt: [-0.55, -0.2, -0.38] },
        { id: 'estrecho-superior', nombre: 'Estrecho superior', alias: ['estrecho superior', 'entrada de la pelvis', 'plano de entrada', 'linea terminal'], wiki: null, color: '#22d3ee', material: 'liquido', capa: 'planos', opacity: 0.4, emissive: '#0891b2', meshes: plano(0.36, -0.02, 1.08, 0.94, 0.48), labelAt: [-2.6, 0.75, 0.9], anchorAt: bordePlano(0.36, -0.02, 1.08, 0.94, 0.48, PI * 0.85) },
        { id: 'estrecho-medio', nombre: 'Estrecho medio', alias: ['estrecho medio', 'plano de las espinas ciaticas'], wiki: null, color: '#38bdf8', material: 'liquido', capa: 'planos', opacity: 0.4, emissive: '#0369a1', meshes: plano(-0.2, -0.06, 0.66, 0.84, 0.12), labelAt: [2.55, 0.4, 0.2], anchorAt: bordePlano(-0.2, -0.06, 0.66, 0.84, 0.12, PI * 0.1) },
        { id: 'estrecho-inferior', nombre: 'Estrecho inferior', alias: ['estrecho inferior', 'salida de la pelvis'], wiki: null, color: '#818cf8', material: 'liquido', capa: 'planos', opacity: 0.4, emissive: '#4338ca', meshes: plano(-0.66, 0.0, 0.62, 0.86, -0.18), labelAt: [-2.55, -1.1, 0.6], anchorAt: bordePlano(-0.66, 0.0, 0.62, 0.86, -0.18, -PI * 0.15) },
        { id: 'suelo-pelvico', nombre: 'Suelo pélvico', alias: ['suelo pelvico', 'piso pelvico', 'musculos del suelo pelvico', 'elevador del ano'], wiki: 'Suelo pélvico', color: '#c25b55', material: 'tejido', capa: 'blandos', opacity: 0.6, meshes: [{ geom: { kind: 'sphere', r: 0.9, thetaStart: PI / 2, thetaLength: PI / 2.2 }, position: [0, -0.62, 0.02], scale: [0.95, 0.42, 1.05], noise: 0.01, noiseScale: 8 }], labelAt: [-2.3, -1.9, 0.5] },
        { id: 'perine', nombre: 'Periné', alias: ['perine', 'perineo', 'desgarros perineales'], wiki: 'Periné', color: '#d58b7c', material: 'tejido', capa: 'blandos', meshes: [{ ...sph(0.22, [0, -1.04, 0.36], [1.3, 0.38, 1]) }], labelAt: [1.3, -2.1, 1.3] },
      ],
    }),
};
