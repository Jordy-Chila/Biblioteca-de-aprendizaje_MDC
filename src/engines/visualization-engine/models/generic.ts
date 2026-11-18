import type { Concepto, Relacion, StudyPlan, Tema } from '../../../types/plan';
import type { CatalogEntry, PartDef, V3 } from '../../../types/scene';
import { m, PI, sph } from './helpers';

const TIPO_COLOR: Record<Concepto['tipo'], string> = {
  termino: '#22d3ee',
  estructura: '#f472b6',
  proceso: '#a78bfa',
  sustancia: '#facc15',
  clasificacion: '#4ade80',
  alerta: '#fb923c',
  persona: '#60a5fa',
  evento: '#f87171',
  lugar: '#34d399',
};
export const colorTipo = (t: Concepto['tipo']) => TIPO_COLOR[t] ?? '#22d3ee';

/** Temas descendientes (incluido el propio). */
export function subtree(temaId: string, temas: Tema[]): Set<string> {
  const ids = new Set([temaId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of temas) if (t.padreId && ids.has(t.padreId) && !ids.has(t.id)) (ids.add(t.id), (grew = true));
  }
  return ids;
}

/** Disposición determinista: esfera de Fibonacci + atracción por relaciones. */
export function layoutConceptMap(ids: string[], relaciones: Pick<Relacion, 'origenId' | 'destinoId'>[], radius = 4): Record<string, V3> {
  const n = ids.length;
  const pos: Record<string, V3> = {};
  ids.forEach((id, i) => {
    const y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * 2.399963;
    pos[id] = [Math.cos(a) * r * radius, y * radius * 0.7, Math.sin(a) * r * radius];
  });
  const rel = relaciones.filter((r) => pos[r.origenId] && pos[r.destinoId]);
  for (let it = 0; it < 30; it++) {
    for (const r of rel) {
      const a = pos[r.origenId], b = pos[r.destinoId];
      for (let k = 0; k < 3; k++) {
        const d = (b[k] - a[k]) * 0.02;
        a[k] += d;
        b[k] -= d;
      }
    }
    // mantener dentro del radio
    for (const id of ids) {
      const p = pos[id];
      const len = Math.hypot(...p);
      if (len > radius) for (let k = 0; k < 3; k++) p[k] = (p[k] / len) * radius;
    }
  }
  return pos;
}

export function conceptsOfTopic(plan: StudyPlan, temaId?: string): Concepto[] {
  if (!temaId) return plan.conceptos;
  const ids = subtree(temaId, plan.temas);
  return plan.conceptos.filter((c) => ids.has(c.temaId));
}

export const mapaConceptos: CatalogEntry = {
  id: 'generico.mapa-conceptos',
  titulo: 'Mapa de conceptos',
  tipo: 'mapa',
  materias: [],
  palabrasClave: [],
  build: ({ plan, tema }) => {
    const cs = conceptsOfTopic(plan, tema?.id).slice(0, 40);
    if (!cs.length) return null;
    const ids = new Set(cs.map((c) => c.id));
    const rel = plan.relaciones.filter((r) => ids.has(r.origenId) && ids.has(r.destinoId));
    const pos = layoutConceptMap(cs.map((c) => c.id), rel, Math.min(5, 2 + cs.length * 0.18));
    const parts: PartDef[] = cs.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      color: colorTipo(c.tipo),
      emissive: colorTipo(c.tipo),
      meshes: [sph(0.22 + Math.min(0.2, c.menciones.length * 0.015), pos[c.id])],
      ref: { type: 'concepto', id: c.id },
      labelAt: [pos[c.id][0], pos[c.id][1] + 0.45, pos[c.id][2]],
    }));
    return {
      id: `mapa-${tema?.id ?? 'doc'}`,
      titulo: `Mapa de conceptos · ${tema?.titulo ?? 'Documento'}`,
      tipo: 'mapa',
      parts,
      links: rel.map((r) => ({ from: r.origenId, to: r.destinoId })),
      camera: { position: [0, 2, 10], target: [0, 0, 0] },
      nota: 'Mapa generado a partir de los conceptos del documento. Las líneas unen conceptos cuya definición menciona a otro.',
    };
  },
};

export const proceso: CatalogEntry = {
  id: 'generico.proceso',
  titulo: 'Proceso paso a paso',
  tipo: 'proceso',
  materias: [],
  palabrasClave: [],
  build: ({ plan, escena }) => {
    const p = plan.procesos.find((x) => x.id === escena.params.procesoId);
    if (!p) return null;
    const n = p.pasos.length;
    const R = Math.max(3, n * 0.65);
    const pts: V3[] = p.pasos.map((_, i) => {
      const a = -PI * 0.85 + (i / Math.max(1, n - 1)) * PI * 1.7;
      return [Math.sin(a) * R, Math.cos(i * 0.9) * 0.4, -Math.cos(a) * R * 0.45];
    });
    const parts: PartDef[] = p.pasos.map((s, i) => ({
      id: `paso-${i}`,
      nombre: `${i + 1}. ${s.nombre}`,
      color: '#a78bfa',
      emissive: '#7c3aed',
      meshes: [m({ kind: 'cylinder', rTop: 0.45, rBottom: 0.45, h: 0.18, segments: 32 }, pts[i], [PI / 2, 0, 0]), sph(0.16, [pts[i][0], pts[i][1], pts[i][2] + 0.12])],
      ref: { type: 'paso', procesoId: p.id, index: i },
      labelAt: [pts[i][0], pts[i][1] + 0.75, pts[i][2]],
    }));
    parts.push({ id: 'trayecto', nombre: 'Secuencia', color: '#334155', selectable: false, meshes: [m({ kind: 'tube', r: 0.04, points: pts })] });
    return {
      id: `proceso-${p.id}`,
      titulo: p.nombre,
      tipo: 'proceso',
      parts,
      pasos: p.pasos.map((_, i) => `paso-${i}`),
      camera: { position: [0, 3, R * 2.1], target: [0, 0, 0] },
      nota: 'Secuencia extraída del documento. Usa ▶ para recorrer los pasos en orden.',
    };
  },
};

export const lineaTiempo: CatalogEntry = {
  id: 'generico.linea-tiempo',
  titulo: 'Línea de tiempo',
  tipo: 'linea-tiempo',
  materias: [],
  palabrasClave: [],
  build: ({ plan, tema }) => {
    const ids = tema ? subtree(tema.id, plan.temas) : null;
    const evs = plan.eventos.filter((e) => !ids || ids.has(e.temaId)).slice(0, 24);
    if (evs.length < 2) return null;
    const span = 1.6;
    const total = (evs.length - 1) * span;
    const parts: PartDef[] = evs.map((e, i) => {
      const x = i * span - total / 2;
      const up = i % 2 === 0 ? 1 : -1;
      return {
        id: e.id,
        nombre: e.fecha,
        color: '#f87171',
        emissive: '#ef4444',
        meshes: [sph(0.2, [x, 0, 0]), m({ kind: 'cylinder', rTop: 0.02, rBottom: 0.02, h: 0.8 }, [x, up * 0.4, 0])],
        ref: { type: 'evento', id: e.id },
        labelAt: [x, up * 1.0, 0],
      };
    });
    parts.push({ id: 'eje', nombre: 'Eje temporal', color: '#475569', selectable: false, meshes: [m({ kind: 'cylinder', rTop: 0.05, rBottom: 0.05, h: total + 1.5 }, [0, 0, 0], [0, 0, PI / 2])] });
    return {
      id: `tiempo-${tema?.id ?? 'doc'}`,
      titulo: `Línea de tiempo · ${tema?.titulo ?? 'Documento'}`,
      tipo: 'linea-tiempo',
      parts,
      pasos: evs.map((e) => e.id),
      camera: { position: [0, 1.5, Math.max(7, total * 0.8)], target: [0, 0, 0] },
      nota: 'Eventos con fecha encontrados en el documento, ordenados cronológicamente.',
    };
  },
};

export const comparacion: CatalogEntry = {
  id: 'generico.comparacion',
  titulo: 'Comparación',
  tipo: 'comparacion',
  materias: [],
  palabrasClave: [],
  build: ({ plan, escena }) => {
    const c = plan.comparaciones.find((x) => x.id === escena.params.comparacionId);
    if (!c) return null;
    // Tabla de clasificación (categoría → descripción): un bloque por categoría, en escalera
    if (c.columnas.length === 2 && c.filas.length >= 3) {
      const n = c.filas.length;
      const gap = 1.25;
      const pal = ['#22d3ee', '#38bdf8', '#818cf8', '#a78bfa', '#c084fc', '#f472b6', '#fb7185', '#fbbf24'];
      const parts: PartDef[] = c.filas.map((f, i) => {
        const x = i * gap - ((n - 1) * gap) / 2;
        const h = 0.5 + i * 0.28;
        return {
          id: `fila-${i}`,
          nombre: f[0],
          color: pal[i % pal.length],
          emissive: pal[i % pal.length],
          material: 'plastico',
          meshes: [m({ kind: 'box', size: [1.0, h, 0.7] }, [x, h / 2 - 0.9, 0])],
          ref: { type: 'fila', comparacionId: c.id, index: i },
          labelAt: [x, h - 0.45, 0.45],
        };
      });
      parts.push({ id: 'base', nombre: c.columnas[0], color: '#1e293b', selectable: false, meshes: [m({ kind: 'box', size: [n * gap + 0.6, 0.08, 1.2] }, [0, -0.94, 0])] });
      return {
        id: `cmp-${c.id}`,
        titulo: `${c.columnas[0]}: ${c.filas.map((f) => f[0]).slice(0, 3).join(', ')}${n > 3 ? '…' : ''}`,
        tipo: 'comparacion',
        parts,
        pasos: parts.filter((p) => p.ref).map((p) => p.id),
        camera: { position: [0, 2.2, 7.5], target: [0, 0, 0] },
        nota: `Tabla «${c.columnas.join(' / ')}» del documento: un bloque por categoría. Toca uno para ver su descripción; ▶ las recorre en orden.`,
      };
    }
    const cols = c.columnas.length;
    const w = 2.4;
    const parts: PartDef[] = c.columnas.map((col, i) => {
      const x = i * (w + 0.4) - ((cols - 1) * (w + 0.4)) / 2;
      const h = 0.6 + c.filas.length * 0.45;
      return {
        id: `col-${i}`,
        nombre: col,
        color: ['#22d3ee', '#a78bfa', '#f472b6', '#facc15'][i % 4],
        opacity: 0.85,
        meshes: [m({ kind: 'box', size: [w, h, 0.25] }, [x, h / 2 - 1, 0])],
        ref: { type: 'columna', comparacionId: c.id, index: i },
        labelAt: [x, h - 0.6, 0.3],
      };
    });
    return {
      id: `cmp-${c.id}`,
      titulo: `Comparación: ${c.columnas.join(' · ')}`,
      tipo: 'comparacion',
      parts,
      camera: { position: [0, 1, 7], target: [0, 0.2, 0] },
      nota: 'Tabla del documento representada como columnas. Selecciona una columna para ver su contenido.',
    };
  },
};

export const jerarquia: CatalogEntry = {
  id: 'generico.jerarquia',
  titulo: 'Estructura del documento',
  tipo: 'jerarquia',
  materias: [],
  palabrasClave: [],
  build: ({ plan, tema }) => {
    const ids = tema ? subtree(tema.id, plan.temas) : new Set(plan.temas.map((t) => t.id));
    const temas = plan.temas.filter((t) => ids.has(t.id));
    if (!temas.length) return null;
    const levels = new Map<number, Tema[]>();
    temas.forEach((t) => levels.set(t.nivel, [...(levels.get(t.nivel) ?? []), t]));
    const pos: Record<string, V3> = {};
    const parts: PartDef[] = [];
    const root: V3 = [0, 3, 0];
    [...levels.entries()].forEach(([nivel, ts]) => {
      const r = 1.8 + nivel * 1.6;
      ts.forEach((t, i) => {
        const a = (i / ts.length) * PI * 2;
        pos[t.id] = [Math.cos(a) * r, 3 - nivel * 1.6, Math.sin(a) * r];
        parts.push({ id: t.id, nombre: t.titulo.replace(/^\d+(\.\d+)*\.?\s*/, ''), color: nivel === 1 ? '#22d3ee' : nivel === 2 ? '#a78bfa' : '#f472b6', emissive: nivel === 1 ? '#0891b2' : '#6d28d9', meshes: [sph(nivel === 1 ? 0.3 : 0.2, pos[t.id])], ref: { type: 'tema', id: t.id }, labelAt: [pos[t.id][0], pos[t.id][1] + 0.45, pos[t.id][2]] });
      });
    });
    parts.push({ id: 'raiz', nombre: plan.dominio.tema, color: '#f8fafc', emissive: '#94a3b8', meshes: [sph(0.45, root)], selectable: false, labelAt: [0, 3.6, 0] });
    const links = temas.map((t) => ({ from: t.padreId && pos[t.padreId] ? t.padreId : 'raiz', to: t.id }));
    return {
      id: `jerarquia-${tema?.id ?? 'doc'}`,
      titulo: tema ? `Estructura · ${tema.titulo}` : 'Mapa del documento',
      tipo: 'jerarquia',
      parts,
      links,
      camera: { position: [0, 4, 13], target: [0, 0, 0] },
      nota: 'Temas y subtemas del documento. Selecciona un tema para abrirlo.',
    };
  },
};

export const genericos: CatalogEntry[] = [mapaConceptos, proceso, lineaTiempo, comparacion, jerarquia];
