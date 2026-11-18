import type { CatalogEntry, MeshSpec, V3 } from '../../../types/scene';
import { curve, m, PI, sph, staticModel } from './helpers';
import { fetus, yaw } from './body';

type Profile = [number, number][];

/** Perfil exterior del útero gestante (radio, altura): forma de pera, fondo ancho y estrechamiento hacia el istmo. */
const UTERO: Profile = [
  [0.6, -1.25], [0.82, -1.08], [1.2, -0.75], [1.56, -0.25], [1.82, 0.35], [1.96, 0.95], [1.94, 1.55], [1.74, 2.08], [1.36, 2.5], [0.84, 2.78], [0.32, 2.9], [0.02, 2.93],
];
const CENTRO_Y = 0.85;

/** Contrae el perfil hacia el centro del útero (capas internas). */
const inset = (p: Profile, k: number): Profile => p.map(([r, y]) => [r * k, CENTRO_Y + (y - CENTRO_Y) * k]);

/** Radio del perfil a una altura dada. */
function radiusAt(p: Profile, y: number): number {
  for (let i = 0; i < p.length - 1; i++) {
    const [r0, y0] = p[i], [r1, y1] = p[i + 1];
    if ((y >= y0 && y <= y1) || (y <= y0 && y >= y1)) return r0 + ((y - y0) / (y1 - y0 || 1)) * (r1 - r0);
  }
  return p[p.length - 1][0];
}

// Corte orientado hacia la cámara inicial (acimut ≈ 0,64 rad): se retira un gajo de 0,6π
const CAM: V3 = [4.6, 1.6, 6.1];
const PHI_CAM = Math.atan2(CAM[0], CAM[2]);
const PHI_START = PHI_CAM + 0.3 * PI;
const PHI_LEN = 1.4 * PI;
const PHI_END = PHI_START + PHI_LEN;
const PHI_BACK = PHI_CAM + PI;

/** Punto en la cara del corte de una capa (entre k1 y k2) a cierta altura. */
function onCut(k1: number, k2: number, y: number, phi = PHI_START): V3 {
  const yk = CENTRO_Y + (y - CENTRO_Y);
  const r = ((radiusAt(inset(UTERO, k1), yk) + radiusAt(inset(UTERO, k2), yk)) / 2) * 1;
  return [Math.sin(phi) * r, y, Math.cos(phi) * r];
}

const shell = (k1: number, k2: number): MeshSpec => m({ kind: 'shell', outer: inset(UTERO, k1), inner: inset(UTERO, k2), phiStart: PHI_START, phiLength: PHI_LEN, segments: 96 });


// ── Placenta adherida a la pared posterior y superior ──
const placR = radiusAt(inset(UTERO, 0.83), 1.55) - 0.12;
const PLAC: V3 = [Math.sin(PHI_BACK) * placR, 1.55, Math.cos(PHI_BACK) * placR];
// ── Cordón umbilical: de la cara fetal de la placenta al abdomen fetal, con dos arterias y una vena en espiral ──
const CORD_FROM: V3 = [PLAC[0] * 0.82, PLAC[1] - 0.1, PLAC[2] * 0.82];
const CORD_TO: V3 = yaw([0.4, 0.86, 0], PHI_CAM, [0.04, 0, -0.05]);
const cordAxis = (t: number): V3 => {
  const s = Math.sin(t * PI);
  return [CORD_FROM[0] + (CORD_TO[0] - CORD_FROM[0]) * t + s * 0.55, CORD_FROM[1] + (CORD_TO[1] - CORD_FROM[1]) * t + s * 0.65, CORD_FROM[2] + (CORD_TO[2] - CORD_FROM[2]) * t + s * 0.35];
};
const spiral = (phase: number, rad: number): V3[] =>
  curve(90, (t) => {
    const a = cordAxis(t);
    const ang = t * PI * 14 + phase;
    return [a[0] + Math.cos(ang) * rad, a[1] + Math.sin(ang) * rad, a[2] + Math.sin(ang + 1.3) * rad * 0.8];
  });

export const utero: CatalogEntry = {
  id: 'anatomia.utero',
  titulo: 'Útero gestante',
  tipo: 'modelo',
  materias: ['Medicina y anatomía', 'Biología'],
  palabrasClave: ['utero', 'uterino', 'uterina', 'miometrio', 'endometrio', 'perimetrio', 'cervix', 'cuello uterino', 'placenta', 'feto', 'fetal', 'cordon umbilical', 'liquido amniotico', 'amnios', 'corion', 'membranas ovulares', 'vagina', 'embarazo', 'gestacion', 'saco amniotico', 'decidua', 'presentacion', 'cefalica', 'podalica', 'situacion fetal', 'actitud fetal', 'occipucio'],
  requiereAlguna: ['utero', 'uterino', 'uterina', 'placenta', 'feto', 'fetal', 'embarazo', 'gestacion'],
  build: () =>
    staticModel({
      id: 'anatomia.utero',
      titulo: 'Útero gestante (corte)',
      tipo: 'modelo',
      wiki: 'Embarazo',
      camera: { position: CAM, target: [0, 0.5, 0] },
      vistas: [
        { nombre: 'Corte (oblicua)', position: CAM },
        { nombre: 'Frontal', position: [Math.sin(PHI_CAM) * 7.5, 0.8, Math.cos(PHI_CAM) * 7.5] },
        { nombre: 'Lateral', position: [Math.sin(PHI_START) * 7.5, 0.8, Math.cos(PHI_START) * 7.5] },
        { nombre: 'Superior', position: [0.01, 9, 0.01] },
      ],
      capas: [
        { id: 'pared', nombre: 'Pared uterina' },
        { id: 'anexos', nombre: 'Placenta y membranas' },
        { id: 'feto', nombre: 'Feto y cordón' },
        { id: 'canal', nombre: 'Cérvix y vagina' },
      ],
      parts: [
        { id: 'perimetrio', nombre: 'Perimetrio', alias: ['perimetrio', 'serosa uterina', 'capa externa'], wiki: 'Perimetrio', color: '#efc3b2', material: 'membrana', capa: 'pared', meshes: [shell(1.0, 0.975)], explode: [Math.sin(PHI_BACK), 0.1, Math.cos(PHI_BACK)], labelAt: [3.15, 2.75, -0.2], anchorAt: onCut(1.0, 0.975, 2.0) },
        { id: 'miometrio', nombre: 'Miometrio', alias: ['miometrio', 'musculo uterino', 'capa muscular', 'contracciones uterinas'], wiki: 'Miometrio', color: '#b23a3a', material: 'tejido', capa: 'pared', meshes: [shell(0.975, 0.865)], explode: [Math.sin(PHI_BACK) * 0.7, 0.05, Math.cos(PHI_BACK) * 0.7], labelAt: [3.3, 1.35, -0.2], anchorAt: onCut(0.975, 0.865, 1.2) },
        { id: 'endometrio', nombre: 'Endometrio (decidua)', alias: ['endometrio', 'decidua', 'revestimiento interno'], wiki: 'Endometrio', color: '#e98276', material: 'tejido', capa: 'pared', meshes: [shell(0.865, 0.835)], explode: [Math.sin(PHI_BACK) * 0.45, 0, Math.cos(PHI_BACK) * 0.45], labelAt: [3.2, 0.0, -0.2], anchorAt: onCut(0.865, 0.835, 0.35) },
        { id: 'placenta', nombre: 'Placenta', alias: ['placenta', 'lecho placentario', 'alumbramiento', 'retencion placentaria'], wiki: 'Placenta', color: '#7c2342', material: 'tejido', capa: 'anexos', meshes: [{ ...sph(1, PLAC, [1.05, 0.95, 0.24], [0, PHI_BACK, 0]), noise: 0.035, noiseScale: 5 }, { ...sph(0.98, [PLAC[0] * 0.985, PLAC[1], PLAC[2] * 0.985], [1.0, 0.9, 0.2], [0, PHI_BACK, 0]), color: '#a3405f', noise: 0.02, noiseScale: 6 }], labelAt: [-2.4, 3.35, -0.6], anchorAt: [PLAC[0] * 0.86, PLAC[1] + 0.2, PLAC[2] * 0.86] },
        { id: 'corion', nombre: 'Corion', alias: ['corion', 'membrana externa', 'membranas ovulares', 'membranas'], wiki: 'Corion', color: '#d8c4ea', material: 'membrana', capa: 'anexos', opacity: 0.85, meshes: [shell(0.835, 0.82)], labelAt: [-3.1, 2.15, 1.3], anchorAt: onCut(0.835, 0.82, 1.9, PHI_END) },
        { id: 'amnios', nombre: 'Amnios', alias: ['amnios', 'membrana interna', 'saco amniotico', 'bolsa amniotica', 'rotura de membranas'], wiki: 'Amnios', color: '#bfe6f6', material: 'membrana', capa: 'anexos', opacity: 0.8, meshes: [shell(0.82, 0.808)], labelAt: [-3.25, 1.05, 1.4], anchorAt: onCut(0.82, 0.808, 1.1, PHI_END) },
        { id: 'liquido-amniotico', nombre: 'Líquido amniótico', alias: ['liquido amniotico'], wiki: 'Líquido amniótico', color: '#7cc8ee', material: 'liquido', capa: 'anexos', opacity: 0.2, meshes: [m({ kind: 'lathe', points: inset(UTERO, 0.805).map(([r, y]) => [Math.max(0.01, r), y] as [number, number]), phiStart: PHI_START, phiLength: PHI_LEN })], labelAt: [-3.0, -0.25, 1.4], anchorAt: [Math.sin(PHI_END - 0.5) * 1.1, -0.1, Math.cos(PHI_END - 0.5) * 1.1] },
        { id: 'feto', nombre: 'Feto', alias: ['feto', 'fetal', 'presentacion cefalica', 'cabeza fetal', 'vertice', 'occipucio', 'recien nacido', 'bebe', 'actitud fetal'], wiki: 'Feto', color: '#f3c9ae', material: 'piel', capa: 'feto', meshes: fetus(PHI_CAM, [0.04, 0, -0.05]), labelAt: [2.1, 0.55, 2.2], anchorAt: yaw([0.3, 0.5, 0.25], PHI_CAM, [0.04, 0, -0.05]), explode: [0, 0, 1] },
        { id: 'cordon', nombre: 'Cordón umbilical', alias: ['cordon umbilical', 'cordon', 'pinzamiento del cordon', 'prolapso del cordon'], wiki: 'Cordón umbilical', color: '#e6dcc0', material: 'membrana', capa: 'feto', meshes: [m({ kind: 'tube', r: 0.075, points: curve(60, cordAxis) }), { ...m({ kind: 'tube', r: 0.028, points: spiral(0, 0.065) }), color: '#b3263e' }, { ...m({ kind: 'tube', r: 0.028, points: spiral(PI * 0.66, 0.065) }), color: '#b3263e' }, { ...m({ kind: 'tube', r: 0.036, points: spiral(PI * 1.33, 0.065) }), color: '#3d5fb0' }], labelAt: [2.0, 3.0, 0.9], anchorAt: cordAxis(0.55) },
        { id: 'cervix', nombre: 'Cuello uterino (cérvix)', alias: ['cervix', 'cuello uterino', 'cuello del utero', 'borramiento', 'dilatacion', 'tapon mucoso', 'orificio cervical'], wiki: 'Cuello uterino', color: '#d46f68', material: 'tejido', capa: 'canal', meshes: [m({ kind: 'shell', outer: [[0.62, -1.24], [0.6, -1.45], [0.55, -1.72], [0.52, -1.98]], inner: [[0.2, -1.24], [0.13, -1.45], [0.11, -1.72], [0.17, -1.98]], phiStart: PHI_START, phiLength: PHI_LEN, segments: 64 })], labelAt: [2.35, -1.5, 0.7], anchorAt: onCutCervix(-1.6), explode: [0, -0.6, 0] },
        { id: 'vagina', nombre: 'Vagina', alias: ['vagina', 'vaginal', 'canal vaginal', 'parto vaginal'], wiki: 'Vagina', color: '#d99189', material: 'tejido', capa: 'canal', meshes: [m({ kind: 'shell', outer: [[0.56, -1.98], [0.6, -2.3], [0.57, -2.75], [0.5, -3.15]], inner: [[0.44, -1.98], [0.46, -2.3], [0.44, -2.75], [0.38, -3.15]], phiStart: PHI_START, phiLength: PHI_LEN, segments: 64 })], labelAt: [2.2, -2.85, 0.7], anchorAt: [Math.sin(PHI_START) * 0.53, -2.6, Math.cos(PHI_START) * 0.53], explode: [0, -1, 0] },
      ],
    }),
};

function onCutCervix(y: number): V3 {
  return [Math.sin(PHI_START) * 0.36, y, Math.cos(PHI_START) * 0.36];
}

