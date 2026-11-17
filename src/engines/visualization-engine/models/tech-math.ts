import type { CatalogEntry, MeshSpec, PartDef, V3 } from '../../../types/scene';
import { containsWord } from '../../../utils/normalize';
import { m, PI, sph, staticModel } from './helpers';

// ───────────── Informática ─────────────

export const computadora: CatalogEntry = {
  id: 'informatica.computadora',
  titulo: 'Componentes de una computadora',
  tipo: 'modelo',
  materias: ['Informática'],
  palabrasClave: ['cpu', 'procesador', 'unidad central de procesamiento', 'memoria ram', 'ram', 'placa base', 'tarjeta madre', 'placa madre', 'disco duro', 'ssd', 'almacenamiento', 'gpu', 'tarjeta grafica', 'fuente de poder', 'fuente de alimentacion', 'hardware', 'bus', 'ventilador', 'disipador', 'arquitectura de computadores'],
  requiereAlguna: ['cpu', 'procesador', 'placa base', 'tarjeta madre', 'placa madre', 'hardware', 'memoria ram'],
  build: () =>
    staticModel({
      id: 'informatica.computadora',
      titulo: 'Componentes internos de una computadora',
      tipo: 'modelo',
      camera: { position: [4, 4.5, 5], target: [0, 0.5, 0] },
      vistas: [
        { nombre: 'Superior', position: [0, 8, 0.01] },
        { nombre: 'Oblicua', position: [4, 4.5, 5] },
      ],
      parts: [
        { id: 'chasis', nombre: 'Chasis (gabinete)', alias: ['chasis', 'gabinete', 'case', 'torre'], color: '#334155', opacity: 0.18, meshes: [m({ kind: 'box', size: [4.4, 2.6, 3.4] }, [0, 1.1, 0])], explode: [0, 1, 0], labelAt: [-2.4, 2.6, -1.7] },
        { id: 'placa-base', nombre: 'Placa base', alias: ['placa base', 'tarjeta madre', 'placa madre', 'motherboard', 'bus'], color: '#14532d', meshes: [m({ kind: 'box', size: [3.6, 0.08, 2.8] }, [0, 0, 0])], explode: [0, -0.5, 0], labelAt: [-1.6, 0.3, 1.6] },
        { id: 'cpu', nombre: 'Procesador (CPU)', alias: ['cpu', 'procesador', 'unidad central de procesamiento', 'microprocesador'], color: '#cbd5e1', meshes: [m({ kind: 'box', size: [0.7, 0.1, 0.7] }, [-0.4, 0.1, -0.3])], explode: [0, 1.2, 0], labelAt: [-0.4, 1.6, -0.3] },
        { id: 'disipador', nombre: 'Disipador y ventilador', alias: ['disipador', 'ventilador', 'refrigeracion', 'cooler'], color: '#64748b', meshes: [m({ kind: 'cylinder', rTop: 0.45, rBottom: 0.45, h: 0.5 }, [-0.4, 0.45, -0.3])], explode: [0, 1.8, 0], labelAt: [-1.3, 1.2, -0.8] },
        { id: 'ram', nombre: 'Memoria RAM', alias: ['ram', 'memoria ram', 'memoria principal', 'memoria volatil'], color: '#22c55e', meshes: [0, 1, 2].map((i) => m({ kind: 'box', size: [0.08, 0.5, 1.4] }, [0.5 + i * 0.22, 0.3, -0.3])), explode: [0, 1, 0], labelAt: [1.0, 1.0, -0.3] },
        { id: 'gpu', nombre: 'Tarjeta gráfica (GPU)', alias: ['gpu', 'tarjeta grafica', 'tarjeta de video'], color: '#ef4444', meshes: [m({ kind: 'box', size: [2.2, 0.3, 0.7] }, [-0.2, 0.3, 0.9])], explode: [0, 0.8, 0.6], labelAt: [-0.2, 0.9, 1.6] },
        { id: 'almacenamiento', nombre: 'Almacenamiento (SSD / disco)', alias: ['almacenamiento', 'disco duro', 'ssd', 'hdd', 'disco', 'memoria secundaria'], color: '#3b82f6', meshes: [m({ kind: 'box', size: [0.9, 0.12, 0.6] }, [1.3, 0.12, 0.9])], explode: [0.8, 0.6, 0.4], labelAt: [1.7, 0.7, 1.4] },
        { id: 'fuente', nombre: 'Fuente de alimentación', alias: ['fuente de poder', 'fuente de alimentacion', 'psu', 'fuente'], color: '#a16207', meshes: [m({ kind: 'box', size: [1.2, 0.8, 1.0] }, [1.4, 0.45, -1.0])], explode: [0.8, 0.4, -0.6], labelAt: [2.1, 1.1, -1.2] },
      ],
    }),
};

const DEVICES: { id: string; nombre: string; alias: string[]; color: string; geom: MeshSpec }[] = [
  { id: 'internet', nombre: 'Internet / nube', alias: ['internet', 'nube', 'wan'], color: '#93c5fd', geom: sph(0.5, [0, 0, 0], [1.4, 0.8, 1]) },
  { id: 'firewall', nombre: 'Firewall', alias: ['firewall', 'cortafuegos'], color: '#f97316', geom: m({ kind: 'box', size: [0.8, 0.6, 0.3] }) },
  { id: 'router', nombre: 'Router', alias: ['router', 'enrutador', 'encaminador', 'enrutamiento'], color: '#22d3ee', geom: m({ kind: 'cylinder', rTop: 0.45, rBottom: 0.45, h: 0.3 }) },
  { id: 'switch', nombre: 'Switch', alias: ['switch', 'conmutador'], color: '#a78bfa', geom: m({ kind: 'box', size: [1.0, 0.25, 0.5] }) },
  { id: 'servidor', nombre: 'Servidor', alias: ['servidor', 'servidores', 'server'], color: '#e2e8f0', geom: m({ kind: 'box', size: [0.5, 1.0, 0.6] }) },
  { id: 'base-datos', nombre: 'Base de datos', alias: ['base de datos', 'bases de datos', 'sgbd', 'database'], color: '#facc15', geom: m({ kind: 'cylinder', rTop: 0.35, rBottom: 0.35, h: 0.7 }) },
  { id: 'punto-acceso', nombre: 'Punto de acceso inalámbrico', alias: ['punto de acceso', 'wifi', 'inalambrico', 'access point'], color: '#4ade80', geom: m({ kind: 'cone', r: 0.3, h: 0.5 }) },
  { id: 'cliente', nombre: 'Equipos cliente', alias: ['cliente', 'clientes', 'host', 'hosts', 'computadora', 'pc', 'estacion de trabajo', 'terminal'], color: '#94a3b8', geom: m({ kind: 'box', size: [0.6, 0.45, 0.08] }) },
];

export const red: CatalogEntry = {
  id: 'informatica.red',
  titulo: 'Red de computadoras',
  tipo: 'modelo',
  materias: ['Informática'],
  palabrasClave: [],
  detect: (text) => {
    const found = DEVICES.filter((d) => d.alias.some((a) => containsWord(text, a))).map((d) => d.id);
    const ctx = /\bred(es)?\b|protocolo|topologia|lan|wan|tcp|ip\b/.test(text);
    return found.length >= 3 && ctx ? { score: found.length + 1, params: { dispositivos: found } } : null;
  },
  build: ({ escena }) => {
    const ids = (escena.params.dispositivos as string[]) ?? DEVICES.map((d) => d.id);
    const present = DEVICES.filter((d) => ids.includes(d.id) || d.id === 'cliente');
    const order = ['internet', 'firewall', 'router', 'switch', 'punto-acceso', 'servidor', 'base-datos', 'cliente'];
    present.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    const pos = new Map<string, V3>();
    const tiers: Record<string, V3> = { internet: [0, 3, 0], firewall: [0, 2, 0], router: [0, 1, 0], switch: [0, 0, 0], 'punto-acceso': [2.4, 0, 0.6], servidor: [-2.4, -0.3, -0.6], 'base-datos': [-3.4, -1.4, -0.6], cliente: [0, -1.6, 0] };
    const parts: PartDef[] = present.map((d) => {
      const p = tiers[d.id];
      pos.set(d.id, p);
      const meshes = d.id === 'cliente' ? [-1.6, 0, 1.6].map((x) => ({ ...d.geom, position: [p[0] + x, p[1], p[2] + 0.4] as V3 })) : [{ ...d.geom, position: p }];
      return { id: d.id, nombre: d.nombre, alias: d.alias, color: d.color, meshes, labelAt: [p[0] + 0.9, p[1] + 0.4, p[2]] };
    });
    const links: { from: string; to: string }[] = [];
    const has = (id: string) => pos.has(id);
    const chain = order.filter((id) => has(id) && ['internet', 'firewall', 'router', 'switch'].includes(id));
    for (let i = 0; i < chain.length - 1; i++) links.push({ from: chain[i], to: chain[i + 1] });
    const hub = has('switch') ? 'switch' : has('router') ? 'router' : chain[chain.length - 1];
    for (const id of ['punto-acceso', 'servidor', 'cliente']) if (has(id) && hub && id !== hub) links.push({ from: hub, to: id });
    if (has('base-datos') && has('servidor')) links.push({ from: 'servidor', to: 'base-datos' });
    return staticModel({ id: 'informatica.red', titulo: 'Topología de red', tipo: 'modelo', camera: { position: [0, 1.5, 9], target: [0, 0.6, 0] }, parts, links, nota: 'Topología esquemática construida con los dispositivos que menciona el documento.' });
  },
};

// ───────────── Matemáticas ─────────────

const SOLIDOS: { id: string; nombre: string; alias: string[]; geom: MeshSpec }[] = [
  { id: 'cubo', nombre: 'Cubo', alias: ['cubo', 'hexaedro'], geom: m({ kind: 'box', size: [1.4, 1.4, 1.4] }) },
  { id: 'esfera', nombre: 'Esfera', alias: ['esfera'], geom: sph(0.85) },
  { id: 'cilindro', nombre: 'Cilindro', alias: ['cilindro'], geom: m({ kind: 'cylinder', rTop: 0.7, rBottom: 0.7, h: 1.6 }) },
  { id: 'cono', nombre: 'Cono', alias: ['cono'], geom: m({ kind: 'cone', r: 0.8, h: 1.6 }) },
  { id: 'piramide', nombre: 'Pirámide cuadrangular', alias: ['piramide'], geom: m({ kind: 'cone', r: 0.95, h: 1.5, segments: 4 }) },
  { id: 'prisma', nombre: 'Prisma triangular', alias: ['prisma'], geom: m({ kind: 'cylinder', rTop: 0.85, rBottom: 0.85, h: 1.5, segments: 3 }) },
  { id: 'tetraedro', nombre: 'Tetraedro', alias: ['tetraedro'], geom: m({ kind: 'polyhedron', type: 'tetra', r: 1 }) },
  { id: 'octaedro', nombre: 'Octaedro', alias: ['octaedro'], geom: m({ kind: 'polyhedron', type: 'octa', r: 0.95 }) },
  { id: 'dodecaedro', nombre: 'Dodecaedro', alias: ['dodecaedro'], geom: m({ kind: 'polyhedron', type: 'dodeca', r: 0.9 }) },
  { id: 'icosaedro', nombre: 'Icosaedro', alias: ['icosaedro'], geom: m({ kind: 'polyhedron', type: 'icosa', r: 0.9 }) },
  { id: 'toro', nombre: 'Toro', alias: ['toro', 'toroide'], geom: m({ kind: 'torus', r: 0.65, tube: 0.25 }) },
  { id: 'paraboloide', nombre: 'Paraboloide (z = x² + y²)', alias: ['paraboloide'], geom: m({ kind: 'surface', fn: 'paraboloide', size: 1.6 }) },
  { id: 'silla', nombre: 'Paraboloide hiperbólico (z = x² − y²)', alias: ['paraboloide hiperbolico', 'silla de montar', 'punto de silla'], geom: m({ kind: 'surface', fn: 'silla', size: 1.6 }) },
];
const PALETA = ['#22d3ee', '#a78bfa', '#f472b6', '#facc15', '#4ade80', '#fb923c', '#60a5fa', '#f87171'];

export const solidos: CatalogEntry = {
  id: 'matematicas.solidos',
  titulo: 'Cuerpos geométricos',
  tipo: 'modelo',
  materias: ['Matemáticas'],
  palabrasClave: [],
  detect: (text) => {
    const found = SOLIDOS.filter((s) => s.alias.some((a) => containsWord(text, a))).map((s) => s.id);
    const ctx = /geometri|solido|volumen|cuerpo|figura|poliedro|superficie|area|funcion/.test(text);
    return found.length >= 2 && ctx ? { score: found.length + 1, params: { solidos: found } } : found.length === 1 && /paraboloide|silla/.test(found[0]) ? { score: 3, params: { solidos: found } } : null;
  },
  build: ({ escena }) => {
    const ids = (escena.params.solidos as string[]) ?? ['cubo', 'esfera', 'cilindro'];
    const list = SOLIDOS.filter((s) => ids.includes(s.id)).slice(0, 8);
    const cols = Math.min(4, list.length);
    const parts: PartDef[] = list.map((s, i) => {
      const x = (i % cols) * 2.4 - ((cols - 1) * 2.4) / 2;
      const z = -Math.floor(i / cols) * 2.6;
      return { id: s.id, nombre: s.nombre, alias: s.alias, color: PALETA[i % PALETA.length], meshes: [{ ...s.geom, position: [x, 0.9, z] }], labelAt: [x, 2.3, z], anim: { type: 'spin', axis: [0, 1, 0], speed: 0.3 } };
    });
    return staticModel({ id: 'matematicas.solidos', titulo: 'Cuerpos geométricos', tipo: 'modelo', camera: { position: [0, 4, 8], target: [0, 0.6, -0.8] }, parts, nota: 'Cuerpos geométricos mencionados en el documento.' });
  },
};

export const tecnologiaMatematicas: CatalogEntry[] = [computadora, red, solidos];
export { PI };
