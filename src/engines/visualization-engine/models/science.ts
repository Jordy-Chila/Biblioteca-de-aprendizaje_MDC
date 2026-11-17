import type { CatalogEntry, MeshSpec, PartDef, V3 } from '../../../types/scene';
import { curve, m, PI, sph, staticModel } from './helpers';

// ───────────── Biología ─────────────

export const celula: CatalogEntry = {
  id: 'biologia.celula',
  titulo: 'Célula eucariota',
  tipo: 'modelo',
  materias: ['Biología', 'Medicina y anatomía'],
  palabrasClave: ['celula', 'celular', 'membrana plasmatica', 'membrana celular', 'nucleo', 'nucleolo', 'citoplasma', 'mitocondria', 'mitocondrias', 'ribosoma', 'ribosomas', 'reticulo endoplasmatico', 'aparato de golgi', 'golgi', 'lisosoma', 'lisosomas', 'vacuola', 'centriolo', 'organelo', 'organelos', 'organulo', 'eucariota'],
  requiereAlguna: ['celula', 'celular', 'organelo', 'organelos', 'organulo', 'organulos', 'mitocondria'],
  build: () => {
    const mito: MeshSpec[] = ([[1.2, 0.4, 0.6], [-1.1, -0.6, 0.9], [0.4, -1.2, -0.8], [-0.6, 1.0, -1.0]] as V3[]).map((p, i) => m({ kind: 'capsule', r: 0.18, len: 0.5 }, p, [i, i * 0.7, 0.4]));
    const ribo: MeshSpec[] = Array.from({ length: 40 }, (_, i) => {
      const a = i * 2.39996, y = 1 - (i / 39) * 2, rr = Math.sqrt(1 - y * y) * 1.75;
      return sph(0.045, [Math.cos(a) * rr, y * 1.6, Math.sin(a) * rr]);
    });
    const reticulo: MeshSpec[] = [0, 1, 2, 3].map((i) => m({ kind: 'torus', r: 0.85 + i * 0.12, tube: 0.05, arc: PI * 0.9 }, [0, 0, 0], [PI / 2, 0, 0.3 + i * 0.1]));
    const golgi: MeshSpec[] = [0, 1, 2, 3, 4].map((i) => m({ kind: 'torus', r: 0.4 - i * 0.03, tube: 0.05, arc: PI * 0.8 }, [-1.25, 0.2 + i * 0.13, -0.3], [PI / 2, 0, 0.6]));
    return staticModel({
      id: 'biologia.celula',
      titulo: 'Célula eucariota (corte)',
      tipo: 'modelo',
      camera: { position: [3.8, 2.6, 4.2], target: [0, 0, 0] },
      capas: [
        { id: 'envoltura', nombre: 'Membrana y citoplasma' },
        { id: 'organelos', nombre: 'Organelos' },
        { id: 'nucleo', nombre: 'Núcleo' },
      ],
      parts: [
        { id: 'membrana', nombre: 'Membrana plasmática', alias: ['membrana plasmatica', 'membrana celular', 'bicapa lipidica'], color: '#7dd3fc', capa: 'envoltura', opacity: 0.25, meshes: [m({ kind: 'sphere', r: 2.0, phiStart: PI, phiLength: PI * 1.5 }, [0, 0, 0], [0, 0, 0], [1.1, 0.85, 1])], explode: [0, 0, -1], labelAt: [-2.3, 1.4, 0] },
        { id: 'citoplasma', nombre: 'Citoplasma', alias: ['citoplasma', 'citosol'], color: '#bae6fd', capa: 'envoltura', opacity: 0.12, meshes: [m({ kind: 'sphere', r: 1.94, phiStart: PI, phiLength: PI * 1.5 }, [0, 0, 0], [0, 0, 0], [1.1, 0.85, 1])], labelAt: [2.2, -1.2, 0.6] },
        { id: 'nucleo', nombre: 'Núcleo', alias: ['nucleo', 'nucleo celular', 'envoltura nuclear', 'cromatina'], color: '#a78bfa', capa: 'nucleo', opacity: 0.85, meshes: [m({ kind: 'sphere', r: 0.62, phiStart: PI, phiLength: PI * 1.5 })], labelAt: [0, 1.0, 0.4] },
        { id: 'nucleolo', nombre: 'Nucléolo', alias: ['nucleolo'], color: '#5b21b6', capa: 'nucleo', meshes: [sph(0.22, [0.1, 0.05, 0.1])], labelAt: [0.6, 0.3, 0.6] },
        { id: 'mitocondria', nombre: 'Mitocondrias', alias: ['mitocondria', 'mitocondrias'], color: '#f97316', capa: 'organelos', meshes: mito, labelAt: [1.7, 0.7, 0.8] },
        { id: 'reticulo', nombre: 'Retículo endoplasmático', alias: ['reticulo endoplasmatico', 'reticulo endoplasmatico rugoso', 'reticulo endoplasmatico liso', 'reticulo'], color: '#34d399', capa: 'organelos', meshes: reticulo, labelAt: [0.9, -0.6, 1.2] },
        { id: 'golgi', nombre: 'Aparato de Golgi', alias: ['aparato de golgi', 'golgi', 'complejo de golgi'], color: '#facc15', capa: 'organelos', meshes: golgi, labelAt: [-1.8, 0.9, -0.3] },
        { id: 'ribosomas', nombre: 'Ribosomas', alias: ['ribosoma', 'ribosomas'], color: '#e2e8f0', capa: 'organelos', meshes: ribo, labelAt: [1.4, 1.5, -0.6] },
        { id: 'lisosomas', nombre: 'Lisosomas', alias: ['lisosoma', 'lisosomas'], color: '#f472b6', capa: 'organelos', meshes: [sph(0.16, [1.0, -0.8, -0.6]), sph(0.13, [-0.4, -1.1, 0.7])], labelAt: [1.4, -1.2, -0.6] },
        { id: 'vacuola', nombre: 'Vacuola', alias: ['vacuola', 'vacuolas'], color: '#60a5fa', capa: 'organelos', opacity: 0.7, meshes: [sph(0.32, [-0.9, -0.3, -0.9])], labelAt: [-1.5, -0.6, -1.3] },
        { id: 'centriolos', nombre: 'Centriolos', alias: ['centriolo', 'centriolos', 'centrosoma'], color: '#94a3b8', capa: 'organelos', meshes: [m({ kind: 'cylinder', rTop: 0.06, rBottom: 0.06, h: 0.3 }, [0.6, 0.8, -0.4]), m({ kind: 'cylinder', rTop: 0.06, rBottom: 0.06, h: 0.3 }, [0.7, 0.8, -0.4], [0, 0, PI / 2])], labelAt: [0.9, 1.3, -0.6] },
      ],
    });
  },
};

export const adn: CatalogEntry = {
  id: 'biologia.adn',
  titulo: 'Doble hélice de ADN',
  tipo: 'modelo',
  materias: ['Biología'],
  palabrasClave: ['adn', 'acido desoxirribonucleico', 'doble helice', 'nucleotido', 'nucleotidos', 'adenina', 'timina', 'citosina', 'guanina', 'base nitrogenada', 'bases nitrogenadas', 'desoxirribosa', 'fosfato', 'puentes de hidrogeno', 'replicacion', 'gen'],
  requiereAlguna: ['adn', 'dna', 'doble helice', 'nucleotido', 'nucleotidos'],
  build: () => {
    const N = 22, H = 7, R = 1;
    const strand = (off: number): V3[] => curve(80, (t) => [Math.cos(t * PI * 2 * 2.2 + off) * R, -H / 2 + t * H, Math.sin(t * PI * 2 * 2.2 + off) * R]);
    const pairs: Record<'A' | 'T' | 'C' | 'G', MeshSpec[]> = { A: [], T: [], C: [], G: [] };
    const seq = 'ATCGGATCCTAGCATGCATGCA';
    const comp: Record<string, 'A' | 'T' | 'C' | 'G'> = { A: 'T', T: 'A', C: 'G', G: 'C' };
    for (let i = 0; i < N; i++) {
      const t = (i + 0.5) / N, ang = t * PI * 2 * 2.2, y = -H / 2 + t * H;
      const b = seq[i] as 'A' | 'T' | 'C' | 'G';
      // media base desde cada hebra hacia el centro
      const half = (a: number): MeshSpec => m({ kind: 'cylinder', rTop: 0.08, rBottom: 0.08, h: R * 0.95 }, [Math.cos(a) * R * 0.5, y, Math.sin(a) * R * 0.5], [0, -a, PI / 2]);
      pairs[b].push(half(ang));
      pairs[comp[b]].push(half(ang + PI));
    }
    const parts: PartDef[] = [
      { id: 'esqueleto', nombre: 'Esqueleto de azúcar-fosfato', alias: ['esqueleto azucar fosfato', 'desoxirribosa', 'fosfato', 'grupo fosfato', 'cadena', 'hebra', 'hebras'], color: '#cbd5e1', meshes: [m({ kind: 'tube', r: 0.12, points: strand(0) }), m({ kind: 'tube', r: 0.12, points: strand(PI) })], labelAt: [1.6, 3, 0] },
      { id: 'adenina', nombre: 'Adenina (A)', alias: ['adenina'], color: '#ef4444', meshes: pairs.A, labelAt: [-1.8, 1.5, 0] },
      { id: 'timina', nombre: 'Timina (T)', alias: ['timina'], color: '#f59e0b', meshes: pairs.T, labelAt: [1.8, 0.5, 0] },
      { id: 'citosina', nombre: 'Citosina (C)', alias: ['citosina'], color: '#3b82f6', meshes: pairs.C, labelAt: [-1.8, -1, 0] },
      { id: 'guanina', nombre: 'Guanina (G)', alias: ['guanina'], color: '#22c55e', meshes: pairs.G, labelAt: [1.8, -2, 0] },
    ];
    return staticModel({ id: 'biologia.adn', titulo: 'Doble hélice de ADN', tipo: 'modelo', camera: { position: [6, 1, 6], target: [0, 0, 0] }, parts: parts.map((p) => ({ ...p, anim: { type: 'spin', axis: [0, 1, 0], speed: 0.25 } })) });
  },
};

// ───────────── Química ─────────────

export const atomo: CatalogEntry = {
  id: 'quimica.atomo',
  titulo: 'Átomo (modelo de Bohr)',
  tipo: 'simulacion',
  materias: ['Química', 'Física'],
  palabrasClave: ['atomo', 'atomico', 'nucleo atomico', 'proton', 'protones', 'neutron', 'neutrones', 'electron', 'electrones', 'orbita', 'orbital', 'capa electronica', 'niveles de energia', 'bohr', 'numero atomico', 'isotopo'],
  requiereAlguna: ['atomo', 'atomico', 'atomos', 'electron', 'electrones', 'proton', 'protones'],
  build: () => {
    const prot: MeshSpec[] = [], neut: MeshSpec[] = [];
    for (let i = 0; i < 12; i++) {
      const a = i * 2.39996, y = 1 - (i / 11) * 2, rr = Math.sqrt(1 - y * y) * 0.32;
      (i % 2 ? prot : neut).push(sph(0.17, [Math.cos(a) * rr, y * 0.32, Math.sin(a) * rr]));
    }
    const shells = [1.4, 2.3, 3.2];
    const electrons: PartDef[] = [];
    const counts = [2, 4, 0];
    shells.forEach((r, s) => {
      for (let k = 0; k < counts[s]; k++) electrons.push({ id: `e-${s}-${k}`, nombre: 'Electrones', alias: ['electron', 'electrones'], color: '#38bdf8', emissive: '#0ea5e9', meshes: [sph(0.09)], anim: { type: 'orbit', radius: r, speed: 1.2 / (s + 1), phase: (k / counts[s]) * PI * 2, tilt: s * 0.5 }, selectable: true });
    });
    return staticModel({
      id: 'quimica.atomo',
      titulo: 'Átomo (modelo de Bohr)',
      tipo: 'simulacion',
      camera: { position: [0, 3, 6.5], target: [0, 0, 0] },
      nota: 'Representación esquemática del modelo de Bohr (carbono como ejemplo): los electrones no siguen órbitas reales.',
      parts: [
        { id: 'protones', nombre: 'Protones', alias: ['proton', 'protones', 'numero atomico'], color: '#ef4444', meshes: prot, labelAt: [0.8, 0.6, 0] },
        { id: 'neutrones', nombre: 'Neutrones', alias: ['neutron', 'neutrones', 'isotopo'], color: '#94a3b8', meshes: neut, labelAt: [-0.8, 0.6, 0] },
        ...shells.slice(0, 2).map((r, s): PartDef => ({ id: `capa-${s + 1}`, nombre: `Capa electrónica ${s + 1}`, alias: ['capa electronica', 'nivel de energia', 'niveles de energia', 'orbita', 'orbital'], color: '#334155', meshes: [m({ kind: 'torus', r, tube: 0.012 }, [0, 0, 0], [PI / 2 + s * 0.5, 0, 0])], labelAt: [r, 0.2, 0] })),
        ...electrons.map((e, i) => (i === 0 ? { ...e, id: 'electrones', labelAt: [1.6, 1.2, 0] as V3 } : e)),
      ],
    });
  },
};

type Atom = { el: string; p: V3 };
const MOLECULAS: Record<string, { nombre: string; atoms: Atom[]; bonds: [number, number, number?][] }> = {
  H2O: { nombre: 'Agua (H₂O)', atoms: [{ el: 'O', p: [0, 0, 0] }, { el: 'H', p: [0.76, 0.59, 0] }, { el: 'H', p: [-0.76, 0.59, 0] }], bonds: [[0, 1], [0, 2]] },
  CO2: { nombre: 'Dióxido de carbono (CO₂)', atoms: [{ el: 'C', p: [0, 0, 0] }, { el: 'O', p: [1.16, 0, 0] }, { el: 'O', p: [-1.16, 0, 0] }], bonds: [[0, 1, 2], [0, 2, 2]] },
  CH4: { nombre: 'Metano (CH₄)', atoms: [{ el: 'C', p: [0, 0, 0] }, { el: 'H', p: [0.63, 0.63, 0.63] }, { el: 'H', p: [-0.63, -0.63, 0.63] }, { el: 'H', p: [-0.63, 0.63, -0.63] }, { el: 'H', p: [0.63, -0.63, -0.63] }], bonds: [[0, 1], [0, 2], [0, 3], [0, 4]] },
  NH3: { nombre: 'Amoníaco (NH₃)', atoms: [{ el: 'N', p: [0, 0.3, 0] }, { el: 'H', p: [0.94, 0, 0] }, { el: 'H', p: [-0.47, 0, 0.81] }, { el: 'H', p: [-0.47, 0, -0.81] }], bonds: [[0, 1], [0, 2], [0, 3]] },
  O2: { nombre: 'Oxígeno (O₂)', atoms: [{ el: 'O', p: [0.6, 0, 0] }, { el: 'O', p: [-0.6, 0, 0] }], bonds: [[0, 1, 2]] },
  N2: { nombre: 'Nitrógeno (N₂)', atoms: [{ el: 'N', p: [0.55, 0, 0] }, { el: 'N', p: [-0.55, 0, 0] }], bonds: [[0, 1, 3]] },
  HCl: { nombre: 'Cloruro de hidrógeno (HCl)', atoms: [{ el: 'Cl', p: [0.4, 0, 0] }, { el: 'H', p: [-0.9, 0, 0] }], bonds: [[0, 1]] },
  NaCl: { nombre: 'Cloruro de sodio (NaCl)', atoms: [{ el: 'Na', p: [0.7, 0, 0] }, { el: 'Cl', p: [-0.7, 0, 0] }], bonds: [[0, 1]] },
  C2H5OH: { nombre: 'Etanol (C₂H₅OH)', atoms: [{ el: 'C', p: [-0.75, 0, 0] }, { el: 'C', p: [0.75, 0, 0] }, { el: 'O', p: [1.4, 1.2, 0] }, { el: 'H', p: [2.3, 1.1, 0] }, { el: 'H', p: [-1.2, 0.9, 0.5] }, { el: 'H', p: [-1.2, -0.5, 0.8] }, { el: 'H', p: [-1.1, -0.4, -0.9] }, { el: 'H', p: [1.1, -0.5, 0.9] }, { el: 'H', p: [1.1, -0.5, -0.9] }], bonds: [[0, 1], [1, 2], [2, 3], [0, 4], [0, 5], [0, 6], [1, 7], [1, 8]] },
  H2: { nombre: 'Hidrógeno (H₂)', atoms: [{ el: 'H', p: [0.37, 0, 0] }, { el: 'H', p: [-0.37, 0, 0] }], bonds: [[0, 1]] },
};
const EL: Record<string, { nombre: string; color: string; r: number }> = {
  H: { nombre: 'Hidrógeno', color: '#f8fafc', r: 0.28 },
  O: { nombre: 'Oxígeno', color: '#ef4444', r: 0.45 },
  C: { nombre: 'Carbono', color: '#334155', r: 0.45 },
  N: { nombre: 'Nitrógeno', color: '#3b82f6', r: 0.45 },
  Cl: { nombre: 'Cloro', color: '#22c55e', r: 0.55 },
  Na: { nombre: 'Sodio', color: '#a855f7', r: 0.55 },
};
const NOMBRES_MOL: Record<string, string[]> = { H2O: ['agua', 'h2o'], CO2: ['dioxido de carbono', 'co2'], CH4: ['metano', 'ch4'], NH3: ['amoniaco', 'nh3'], O2: ['o2'], N2: ['n2'], HCl: ['acido clorhidrico', 'cloruro de hidrogeno', 'hcl'], NaCl: ['cloruro de sodio', 'sal comun', 'nacl'], C2H5OH: ['etanol', 'alcohol etilico', 'c2h5oh'], H2: ['h2'] };

export const molecula: CatalogEntry = {
  id: 'quimica.molecula',
  titulo: 'Molécula',
  tipo: 'modelo',
  materias: ['Química', 'Biología'],
  palabrasClave: [],
  detect: (text) => {
    const found = Object.entries(NOMBRES_MOL).filter(([, ns]) => ns.some((n) => new RegExp(`(^|[^a-z0-9])${n}([^a-z0-9]|$)`).test(text))).map(([k]) => k);
    const chem = /molecul|enlace|atomo|compuesto|quimic/.test(text);
    return found.length && chem ? { score: 3 + found.length, params: { formula: found[0] } } : null;
  },
  build: ({ escena }) => {
    const f = String(escena.params.formula ?? 'H2O');
    const mol = MOLECULAS[f] ?? MOLECULAS.H2O;
    const byEl = new Map<string, MeshSpec[]>();
    mol.atoms.forEach((a) => byEl.set(a.el, [...(byEl.get(a.el) ?? []), sph(EL[a.el].r, a.p)]));
    const bonds: MeshSpec[] = [];
    for (const [i, j, order = 1] of mol.bonds) {
      const a = mol.atoms[i].p, b = mol.atoms[j].p;
      const mid: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
      const d: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const len = Math.hypot(...d);
      const rotZ = Math.atan2(Math.hypot(d[0], d[2]), d[1]);
      const rotY = Math.atan2(d[0], d[2]);
      for (let k = 0; k < order; k++) {
        const off = (k - (order - 1) / 2) * 0.12;
        bonds.push(m({ kind: 'cylinder', rTop: 0.07, rBottom: 0.07, h: len }, [mid[0], mid[1] + off, mid[2] + off], [0, rotY, 0], undefined));
        bonds[bonds.length - 1].rotation = [rotZ, rotY, 0];
      }
    }
    return staticModel({
      id: `quimica.molecula.${f}`,
      titulo: mol.nombre,
      tipo: 'modelo',
      camera: { position: [0, 1.2, 4.5], target: [0, 0.2, 0] },
      nota: 'Geometría molecular aproximada (modelo de bolas y varillas).',
      parts: [
        ...[...byEl.entries()].map(([el, meshes]): PartDef => ({ id: `el-${el}`, nombre: `${EL[el].nombre} (${el})`, alias: [EL[el].nombre.toLowerCase()], color: EL[el].color, meshes, labelAt: [mol.atoms.find((a) => a.el === el)!.p[0], mol.atoms.find((a) => a.el === el)!.p[1] + 0.7, 0] })),
        { id: 'enlaces', nombre: 'Enlaces químicos', alias: ['enlace', 'enlaces', 'enlace covalente', 'enlace ionico', 'enlace doble'], color: '#cbd5e1', meshes: bonds, labelAt: [0, -0.7, 0] },
      ],
    });
  },
};

// ───────────── Física ─────────────

export const planoInclinado: CatalogEntry = {
  id: 'fisica.fuerzas',
  titulo: 'Fuerzas sobre un cuerpo',
  tipo: 'simulacion',
  materias: ['Física'],
  palabrasClave: ['fuerza', 'fuerzas', 'plano inclinado', 'peso', 'fuerza normal', 'normal', 'friccion', 'rozamiento', 'newton', 'diagrama de cuerpo libre', 'masa', 'aceleracion', 'gravedad', 'equilibrio'],
  requiereAlguna: ['fuerza', 'fuerzas', 'newton', 'plano inclinado', 'friccion', 'rozamiento'],
  build: () => {
    const ang = 0.45;
    const c: V3 = [0, 0.95, 0];
    return staticModel({
      id: 'fisica.fuerzas',
      titulo: 'Diagrama de fuerzas en un plano inclinado',
      tipo: 'simulacion',
      camera: { position: [0, 2.2, 7], target: [0, 0.8, 0] },
      nota: 'Diagrama de cuerpo libre esquemático: las longitudes de los vectores son ilustrativas.',
      parts: [
        { id: 'plano', nombre: 'Plano inclinado', alias: ['plano inclinado', 'superficie', 'rampa'], color: '#475569', meshes: [m({ kind: 'box', size: [5, 0.2, 2] }, [0, 0.25, 0], [0, 0, ang])], labelAt: [-2, -0.4, 1] },
        { id: 'cuerpo', nombre: 'Cuerpo (masa)', alias: ['cuerpo', 'bloque', 'masa', 'objeto'], color: '#f59e0b', meshes: [m({ kind: 'box', size: [0.9, 0.7, 0.9] }, c, [0, 0, ang])], labelAt: [0.3, 1.9, 0.6] },
        { id: 'peso', nombre: 'Peso (P = m·g)', alias: ['peso', 'gravedad', 'fuerza de gravedad', 'fuerza gravitatoria'], color: '#ef4444', meshes: [m({ kind: 'arrow', length: 1.6 }, c, [0, 0, PI])], labelAt: [0.3, -0.9, 0.4] },
        { id: 'normal', nombre: 'Fuerza normal', alias: ['normal', 'fuerza normal'], color: '#22c55e', meshes: [m({ kind: 'arrow', length: 1.4 }, c, [0, 0, ang])], labelAt: [-0.9, 2.4, 0.4] },
        { id: 'friccion', nombre: 'Fuerza de fricción', alias: ['friccion', 'rozamiento', 'fuerza de rozamiento'], color: '#a855f7', meshes: [m({ kind: 'arrow', length: 1.2 }, c, [0, 0, ang - PI / 2 + PI])], labelAt: [1.8, 1.6, 0.4] },
      ],
    });
  },
};

export const circuito: CatalogEntry = {
  id: 'fisica.circuito',
  titulo: 'Circuito eléctrico',
  tipo: 'simulacion',
  materias: ['Física', 'Informática'],
  palabrasClave: ['circuito', 'corriente', 'voltaje', 'tension', 'resistencia', 'bateria', 'pila', 'interruptor', 'bombilla', 'ohm', 'ley de ohm', 'conductor', 'electrones', 'serie', 'paralelo', 'amperio', 'voltio'],
  requiereAlguna: ['circuito', 'corriente electrica', 'ley de ohm', 'voltaje', 'resistencia electrica'],
  build: () => {
    const path: V3[] = [[-2, -1.2, 0], [-2, 1.2, 0], [2, 1.2, 0], [2, -1.2, 0], [-2, -1.2, 0]];
    const flow: PartDef[] = Array.from({ length: 10 }, (_, i) => ({ id: `flujo-${i}`, nombre: 'Corriente eléctrica', alias: ['corriente', 'corriente electrica', 'electrones', 'flujo de electrones'], color: '#facc15', emissive: '#facc15', meshes: [sph(0.07)], anim: { type: 'flow', path, speed: 0.08, phase: i / 10 } }));
    return staticModel({
      id: 'fisica.circuito',
      titulo: 'Circuito eléctrico simple',
      tipo: 'simulacion',
      camera: { position: [0, 1.5, 6.5], target: [0, 0, 0] },
      nota: 'Circuito esquemático: las esferas amarillas representan el sentido convencional de la corriente.',
      parts: [
        { id: 'cables', nombre: 'Conductores (cables)', alias: ['cable', 'cables', 'conductor', 'conductores'], color: '#94a3b8', meshes: [m({ kind: 'tube', r: 0.04, points: path })], labelAt: [0, -1.6, 0] },
        { id: 'bateria', nombre: 'Batería (fuente de voltaje)', alias: ['bateria', 'pila', 'fuente', 'voltaje', 'tension', 'fuente de voltaje'], color: '#22c55e', meshes: [m({ kind: 'cylinder', rTop: 0.3, rBottom: 0.3, h: 0.9 }, [-2, 0, 0])], labelAt: [-2.9, 0, 0] },
        { id: 'resistencia', nombre: 'Resistencia', alias: ['resistencia', 'resistor', 'ohm'], color: '#f97316', meshes: [m({ kind: 'box', size: [0.9, 0.3, 0.3] }, [0, 1.2, 0])], labelAt: [0, 1.75, 0] },
        { id: 'bombilla', nombre: 'Bombilla (carga)', alias: ['bombilla', 'foco', 'lampara', 'carga'], color: '#fde68a', emissive: '#facc15', meshes: [sph(0.35, [2, 0.2, 0]), m({ kind: 'cylinder', rTop: 0.15, rBottom: 0.15, h: 0.3 }, [2, -0.25, 0])], labelAt: [2.8, 0.3, 0] },
        { id: 'interruptor', nombre: 'Interruptor', alias: ['interruptor', 'switch', 'llave'], color: '#60a5fa', meshes: [m({ kind: 'box', size: [0.6, 0.1, 0.2] }, [0, -1.15, 0], [0, 0, 0.3])], labelAt: [0, -0.7, 0] },
        ...flow,
      ],
    });
  },
};

// ───────────── Tierra y espacio ─────────────

export const tierra: CatalogEntry = {
  id: 'geografia.tierra',
  titulo: 'Capas de la Tierra',
  tipo: 'modelo',
  materias: ['Geografía y geología'],
  palabrasClave: ['corteza', 'corteza terrestre', 'manto', 'nucleo externo', 'nucleo interno', 'litosfera', 'astenosfera', 'placas tectonicas', 'tectonica', 'capas de la tierra', 'estructura interna', 'tierra', 'magma', 'discontinuidad'],
  requiereAlguna: ['manto', 'litosfera', 'tectonica', 'capas de la tierra', 'corteza terrestre', 'astenosfera'],
  build: () =>
    staticModel({
      id: 'geografia.tierra',
      titulo: 'Estructura interna de la Tierra (corte)',
      tipo: 'capas',
      camera: { position: [4.5, 2.5, 5], target: [0, 0, 0] },
      parts: [
        { id: 'corteza', nombre: 'Corteza', alias: ['corteza', 'corteza terrestre', 'corteza continental', 'corteza oceanica', 'litosfera'], color: '#7c9a5b', meshes: [m({ kind: 'sphere', r: 2.5, phiStart: PI, phiLength: PI * 1.5 })], explode: [0, 0, -1], labelAt: [-2.8, 1.5, 0] },
        { id: 'manto', nombre: 'Manto', alias: ['manto', 'manto superior', 'manto inferior', 'astenosfera'], color: '#d9822b', meshes: [m({ kind: 'sphere', r: 2.35, phiStart: PI, phiLength: PI * 1.5 })], explode: [0, 0, -0.6], labelAt: [-2.4, -0.4, 1.4] },
        { id: 'nucleo-externo', nombre: 'Núcleo externo', alias: ['nucleo externo'], color: '#f2b134', meshes: [m({ kind: 'sphere', r: 1.3, phiStart: PI, phiLength: PI * 1.5 })], explode: [0, 0, -0.3], labelAt: [1.6, 1.2, 1.2] },
        { id: 'nucleo-interno', nombre: 'Núcleo interno', alias: ['nucleo interno'], color: '#fff1a8', emissive: '#f59e0b', meshes: [sph(0.65)], labelAt: [0.9, 0.2, 1.2] },
      ],
    }),
};

const PLANETAS: [string, string, number, number][] = [
  ['Mercurio', '#a8a29e', 0.12, 2.0], ['Venus', '#fcd34d', 0.2, 2.8], ['Tierra', '#3b82f6', 0.21, 3.7], ['Marte', '#ef4444', 0.16, 4.5],
  ['Júpiter', '#d6a46c', 0.5, 6.0], ['Saturno', '#eab676', 0.42, 7.5], ['Urano', '#7dd3fc', 0.3, 8.8], ['Neptuno', '#6366f1', 0.29, 9.9],
];
export const sistemaSolar: CatalogEntry = {
  id: 'astronomia.sistema-solar',
  titulo: 'Sistema solar',
  tipo: 'simulacion',
  materias: ['Astronomía'],
  palabrasClave: ['sistema solar', 'sol', 'planeta', 'planetas', 'mercurio', 'venus', 'marte', 'jupiter', 'saturno', 'urano', 'neptuno', 'orbita', 'traslacion', 'rotacion'],
  requiereAlguna: ['sistema solar', 'planetas', 'planeta'],
  build: () =>
    staticModel({
      id: 'astronomia.sistema-solar',
      titulo: 'Sistema solar',
      tipo: 'simulacion',
      camera: { position: [0, 9, 13], target: [0, 0, 0] },
      nota: 'Distancias y tamaños no están a escala.',
      parts: [
        { id: 'sol', nombre: 'Sol', alias: ['sol', 'estrella'], color: '#fbbf24', emissive: '#f59e0b', meshes: [sph(1.1)], labelAt: [0, 1.6, 0] },
        ...PLANETAS.map(([n, c, r, d], i): PartDef => ({ id: n.toLowerCase(), nombre: n, alias: [n.toLowerCase()], color: c, meshes: n === 'Saturno' ? [sph(r), m({ kind: 'ring', inner: r * 1.3, outer: r * 2 }, [0, 0, 0], [PI / 2.3, 0, 0])] : [sph(r)], anim: { type: 'orbit', radius: d, speed: 0.6 / Math.sqrt(d), phase: i * 1.3 } })),
        ...PLANETAS.map(([n, , , d]): PartDef => ({ id: `orbita-${n.toLowerCase()}`, nombre: `Órbita de ${n}`, alias: ['orbita'], color: '#1e293b', selectable: false, meshes: [m({ kind: 'torus', r: d, tube: 0.01 }, [0, 0, 0], [PI / 2, 0, 0])] })),
      ],
    }),
};

export const ciencia: CatalogEntry[] = [celula, adn, atomo, molecula, planoInclinado, circuito, tierra, sistemaSolar];
