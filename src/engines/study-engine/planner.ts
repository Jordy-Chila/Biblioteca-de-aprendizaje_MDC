import type { Block, DocumentModel } from '../../types/document';
import type { StudyPlan } from '../../types/plan';
import { containsWord, normalize, slug, tokens } from '../../utils/normalize';
import type { BloqueEstudio, ConceptoBloque, ConfigEstudio, Curso, Dificultad, Fase, Segmento } from './types';

/**
 * Planificador del estudio inteligente.
 *
 * Fundamentos aplicados:
 * - Segmentación / carga cognitiva (Sweller; principio de segmentación de Mayer): bloques cortos con
 *   un máximo de conceptos nuevos (≤ 6) para no saturar la memoria de trabajo.
 * - Práctica distribuida (Cepeda et al., 2006/2008): si el material supera el tiempo diario,
 *   se reparte en varias fases (sesiones) en lugar de concentrarlo en una sola jornada.
 * - Pausas (Albulescu et al., 2022): descansos breves entre bloques y uno más largo cada 3 bloques.
 */

const EXCLUIR = /^(bibliograf|referencias|fuentes|webgraf|anexo|índice|indice|contenido)/i;
const MAX_CONCEPTOS = 6;

export function contarPalabras(s: string) {
  return s.split(/\s+/).filter(Boolean).length;
}

export function oraciones(s: string): string[] {
  return s
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?;:])\s+(?=[A-ZÁÉÍÓÚÑ¿¡0-9«"(])/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

/** Dificultad estimada 0..1 a partir de longitud de oraciones, palabras largas y densidad de conceptos. */
export function puntuarDificultad(texto: string, conceptos: number): number {
  const ws = texto.split(/\s+/).filter(Boolean);
  if (!ws.length) return 0.3;
  const ors = Math.max(1, oraciones(texto).length);
  const largoOracion = ws.length / ors; // 12 fácil … 30 difícil
  const largas = ws.filter((w) => w.replace(/[^\p{L}]/gu, '').length >= 10).length / ws.length; // 0.05 … 0.2
  const densidad = (conceptos / ws.length) * 100; // conceptos por 100 palabras: 0.5 … 4
  const s = 0.4 * clamp((largoOracion - 12) / 18, 0, 1) + 0.35 * clamp((largas - 0.05) / 0.15, 0, 1) + 0.25 * clamp(densidad / 4, 0, 1);
  return clamp(s, 0, 1);
}

export function nivelDificultad(p: number): Dificultad {
  return p < 0.38 ? 'baja' : p < 0.62 ? 'media' : 'alta';
}

function clamp(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, x));
}

/** Palabras por minuto de estudio activo (leer, explicarse y autoevaluarse), según dificultad y nivel. */
export function ritmo(dif: number, nivel: ConfigEstudio['nivel']) {
  const base = 95 - 50 * dif; // 95 (fácil) … 45 (difícil)
  return base * (nivel === 'principiante' ? 0.8 : nivel === 'avanzado' ? 1.25 : 1);
}

interface Unidad {
  block: Block;
  texto: string;
  seccion?: string;
  seccionRaiz?: string;
  palabras: number;
}

/** Divide el documento en unidades de contenido (párrafos largos se parten por oraciones). */
function unidades(doc: DocumentModel): Unidad[] {
  const out: Unidad[] = [];
  let seccion: string | undefined;
  let raiz: string | undefined;
  let excluida = false;
  for (const b of doc.blocks) {
    if (b.type === 'heading') {
      seccion = b.text;
      if ((b.level ?? 1) <= 1 || !raiz) raiz = b.text;
      excluida = EXCLUIR.test(b.text.trim());
      continue;
    }
    if (excluida || b.text.trim().length < 3) continue;
    const n = contarPalabras(b.text);
    if (b.type === 'paragraph' && n > 220) {
      let buf: string[] = [];
      let c = 0;
      for (const o of oraciones(b.text)) {
        buf.push(o);
        c += contarPalabras(o);
        if (c >= 140) {
          out.push({ block: b, texto: buf.join(' '), seccion, seccionRaiz: raiz, palabras: c });
          buf = [];
          c = 0;
        }
      }
      if (buf.length) out.push({ block: b, texto: buf.join(' '), seccion, seccionRaiz: raiz, palabras: c });
    } else out.push({ block: b, texto: b.text, seccion, seccionRaiz: raiz, palabras: n });
  }
  return out;
}

/** Conceptos del plan cuya definición o mención está en el texto del bloque (solo con texto del bloque). */
function conceptosDelBloque(plan: StudyPlan, segs: Segmento[]): ConceptoBloque[] {
  const ids = new Set(segs.map((s) => s.blockId));
  const texto = segs.map((s) => s.texto).join(' ');
  const ntexto = normalize(texto);
  const ors = oraciones(texto);
  const out: ConceptoBloque[] = [];
  const vistos = new Set<string>();
  // 1) definidos dentro del bloque
  for (const c of plan.conceptos) {
    const def = c.definicion.find((d) => d.origen === 'documento' && d.blockId && ids.has(d.blockId) && texto.includes(d.texto.slice(0, 40)));
    if (!def) continue;
    const k = normalize(c.nombre);
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push({ key: slug(c.nombre), nombre: c.nombre, definicion: recortar(def.texto) });
  }
  // 2) mencionados con una oración explicativa dentro del bloque
  for (const c of plan.conceptos) {
    if (out.length >= MAX_CONCEPTOS * 2) break;
    const k = normalize(c.nombre);
    if (vistos.has(k) || k.length < 3 || !containsWord(ntexto, k)) continue;
    const o = ors.find((x) => containsWord(normalize(x), k) && contarPalabras(x) >= 6 && contarPalabras(x) <= 60);
    if (!o) continue;
    vistos.add(k);
    out.push({ key: slug(c.nombre), nombre: c.nombre, definicion: recortar(o) });
  }
  return out;
}

function recortar(s: string, max = 320) {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const o = oraciones(t);
  let r = '';
  for (const x of o) {
    if ((r + ' ' + x).length > max) break;
    r = r ? `${r} ${x}` : x;
  }
  return r || `${t.slice(0, max - 1)}…`;
}

function objetivoDe(titulo: string, conceptos: ConceptoBloque[], segs: Segmento[]): string {
  const nombres = conceptos.slice(0, 3).map((c) => c.nombre);
  const pasos = segs.filter((s) => s.tipo === 'list-item').length >= 3;
  const tabla = segs.some((s) => s.tipo === 'table');
  if (nombres.length >= 2) {
    const lista = nombres.length === 2 ? `${nombres[0]} y ${nombres[1]}` : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
    return `Al terminar podrás explicar con tus palabras ${lista}${pasos ? ' y enumerar los puntos clave' : ''}.`;
  }
  if (nombres.length === 1) return `Al terminar podrás definir «${nombres[0]}» y relacionarlo con ${titulo.toLowerCase()}.`;
  if (pasos) return `Al terminar podrás enumerar y explicar los puntos clave de «${titulo}».`;
  if (tabla) return `Al terminar podrás comparar los elementos de la tabla de «${titulo}».`;
  return `Al terminar podrás resumir sin mirar las ideas principales de «${titulo}».`;
}

/** Duración del descanso según el esfuerzo del bloque: corto tras bloques breves, largo cada 3 bloques. */
function descansoPara(estudio: number, posicionEnFase: number) {
  if ((posicionEnFase + 1) % 3 === 0) return 15;
  return estudio <= 12 ? 5 : estudio <= 20 ? 8 : 10;
}

export function construirCurso(doc: DocumentModel, plan: StudyPlan, config: ConfigEstudio, id = cursoIdPara(doc)): Curso {
  const us = unidades(doc);
  const textoTotal = us.map((u) => u.texto).join(' ');
  const palabrasTotales = us.reduce((s, u) => s + u.palabras, 0);
  const difGlobal = puntuarDificultad(textoTotal, plan.conceptos.length);
  const wpm = ritmo(difGlobal, config.nivel);

  // Minutos de estudio objetivo por bloque
  const objetivo = config.modoTiempos === 'manual' ? config.estudio : Math.round(clamp(12 + 10 * difGlobal + (config.nivel === 'principiante' ? 2 : config.nivel === 'avanzado' ? -2 : 0), 10, 25));
  const presupuesto = objetivo * wpm; // palabras por bloque

  // Agrupar unidades en bloques
  type Borrador = { segs: Segmento[]; palabras: number; raiz?: string };
  const borradores: Borrador[] = [];
  let cur: Borrador = { segs: [], palabras: 0 };
  const cerrar = () => {
    if (cur.segs.length) borradores.push(cur);
    cur = { segs: [], palabras: 0 };
  };
  for (const u of us) {
    const cambioTema = cur.raiz !== undefined && u.seccionRaiz !== cur.raiz && cur.palabras >= presupuesto * 0.45;
    const excede = cur.palabras > 0 && cur.palabras + u.palabras > presupuesto * 1.15;
    if (cambioTema || excede) cerrar();
    cur.segs.push({ blockId: u.block.id, tipo: u.block.type, texto: u.texto, seccion: u.seccion, rows: u.block.type === 'table' ? u.block.rows : undefined });
    cur.palabras += u.palabras;
    cur.raiz ??= u.seccionRaiz;
    // límite de conceptos nuevos por bloque (evitar sobrecarga)
    if (cur.palabras >= presupuesto * 0.5 && conceptosDelBloque(plan, cur.segs).length > MAX_CONCEPTOS) cerrar();
  }
  cerrar();
  // fusionar un último bloque demasiado pequeño con el anterior
  if (borradores.length > 1 && borradores[borradores.length - 1].palabras < presupuesto * 0.3) {
    const last = borradores.pop()!;
    const prev = borradores[borradores.length - 1];
    prev.segs.push(...last.segs);
    prev.palabras += last.palabras;
  }

  const bloquesPlanos: Omit<BloqueEstudio, 'faseId' | 'indice'>[] = borradores.map((bz, i) => {
    const texto = bz.segs.map((s) => s.texto).join(' ');
    const conceptos = conceptosDelBloque(plan, bz.segs).slice(0, MAX_CONCEPTOS);
    const dif = puntuarDificultad(texto, conceptos.length);
    const r = ritmo(dif, config.nivel);
    const estudio = config.modoTiempos === 'manual' ? config.estudio : Math.round(clamp(bz.palabras / r, 5, 25));
    const ids = new Set(bz.segs.map((s) => s.blockId));
    const preguntasDoc = plan.preguntas.filter((q) => q.respuesta.blockId && ids.has(q.respuesta.blockId)).map((q) => ({ pregunta: q.pregunta, respuesta: q.respuesta.texto }));
    const titulo = tituloBloque(bz.segs, i);
    const nPreg = clamp(Math.round(2 + conceptos.length / 2), 3, 5);
    return {
      id: `b${i + 1}`,
      titulo,
      objetivo: objetivoDe(titulo, conceptos, bz.segs),
      segmentos: bz.segs,
      conceptos,
      preguntasDoc,
      palabras: bz.palabras,
      dificultad: nivelDificultad(dif),
      minutos: { estudio, prueba: clamp(Math.ceil(nPreg * 0.8), 2, 5), descanso: 0 },
    };
  });

  // Agrupar bloques en fases (sesiones) que caben en el tiempo disponible
  const fases: Fase[] = [];
  let fase: Fase | null = null;
  for (const b of bloquesPlanos) {
    const costo = b.minutos.estudio + b.minutos.prueba;
    const usado = fase ? fase.bloques.reduce((s, x) => s + x.minutos.estudio + x.minutos.prueba + x.minutos.descanso, 0) : 0;
    if (!fase || (fase.bloques.length > 0 && (usado + costo > config.minutosSesion || fase.bloques.length >= 4))) {
      fase = { id: `f${fases.length + 1}`, numero: fases.length + 1, titulo: '', bloques: [], minutos: 0 };
      fases.push(fase);
    }
    const pos = fase.bloques.length;
    const desc = config.modoTiempos === 'manual' ? config.descanso : descansoPara(b.minutos.estudio, pos);
    fase.bloques.push({ ...b, faseId: fase.id, indice: pos, minutos: { ...b.minutos, descanso: desc } });
  }
  // Evitar una última fase diminuta: si cabe con holgura en la anterior, se une a ella
  const costoFase = (f: Fase) => f.bloques.reduce((s, x) => s + x.minutos.estudio + x.minutos.prueba + x.minutos.descanso, 0);
  if (fases.length > 1) {
    const ult = fases[fases.length - 1];
    const prev = fases[fases.length - 2];
    const ultCosto = ult.bloques.reduce((s, x) => s + x.minutos.estudio + x.minutos.prueba, 0);
    const fin = prev.bloques[prev.bloques.length - 1];
    // al unir, el último bloque de la fase anterior pasa a tener un descanso corto en vez del largo
    const corto = config.modoTiempos === 'manual' ? config.descanso : fin.minutos.estudio <= 12 ? 5 : fin.minutos.estudio <= 20 ? 8 : 10;
    const total = costoFase(prev) - fin.minutos.descanso + corto + ultCosto;
    if (ultCosto < config.minutosSesion * 0.35 && prev.bloques.length + ult.bloques.length <= 5 && total <= config.minutosSesion * 1.05) {
      fin.minutos.descanso = corto;
      fases.pop();
      for (const b of ult.bloques) prev.bloques.push({ ...b, faseId: prev.id, indice: prev.bloques.length });
    }
  }
  for (const f of fases) {
    // el último bloque de cada fase no necesita descanso: es el fin de la sesión
    const ult = f.bloques[f.bloques.length - 1];
    ult.minutos.descanso = 0;
    f.minutos = f.bloques.reduce((s, x) => s + x.minutos.estudio + x.minutos.prueba + x.minutos.descanso, 0);
    const temas = [...new Set(f.bloques.map((b) => b.titulo))];
    f.titulo = temas.length <= 2 ? temas.join(' · ') : `${temas[0]} → ${temas[temas.length - 1]}`;
  }

  const minutosEstudio = fases.reduce((s, f) => s + f.bloques.reduce((a, b) => a + b.minutos.estudio, 0), 0);
  return {
    id,
    docName: doc.name,
    titulo: plan.dominio.tema || doc.name,
    creado: Date.now(),
    config,
    fases,
    resumen: {
      palabras: palabrasTotales,
      conceptos: new Set(fases.flatMap((f) => f.bloques.flatMap((b) => b.conceptos.map((c) => c.key)))).size,
      dificultad: nivelDificultad(difGlobal),
      minutosEstudio,
      minutosTotales: fases.reduce((s, f) => s + f.minutos, 0),
    },
  };
}

function tituloBloque(segs: Segmento[], i: number) {
  const secs = [...new Set(segs.map((s) => s.seccion).filter(Boolean))] as string[];
  if (!secs.length) return `Parte ${i + 1}`;
  if (secs.length === 1) return secs[0];
  return `${secs[0]} (+${secs.length - 1})`;
}

/** Identificador estable para un documento (mismo archivo → mismo curso y progreso). */
export function cursoIdPara(doc: DocumentModel) {
  let h = 5381;
  const s = `${doc.name}|${doc.canonicalText.length}|${doc.canonicalText.slice(0, 2000)}`;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `c${(h >>> 0).toString(36)}`;
}

export const _test = { unidades, tokens };
