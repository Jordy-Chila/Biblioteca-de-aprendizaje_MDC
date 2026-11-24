import { normalize, STOPWORDS } from '../../utils/normalize';
import { gradeOpenLocal, rng } from '../education-engine';
import { oraciones, contarPalabras } from './planner';
import type { BloqueEstudio, ConceptoBloque, PreguntaMini, RespuestaUsuario, ResultadoPregunta, ResultadoPrueba, Tarjeta, TipoPregunta } from './types';

/**
 * Mini pruebas de práctica de recuperación (Roediger & Karpicke, 2006; Dunlosky et al., 2013).
 * Todas las preguntas se construyen EXCLUSIVAMENTE con el texto del bloque recién estudiado.
 * Son breves (3–5 preguntas) para reforzar sin generar estrés.
 */

function mezclar<T>(a: T[], r: () => number): T[] {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function ocultar(texto: string, termino: string) {
  return texto.replace(new RegExp(esc(termino), 'ig'), '_____');
}

/** Términos clave del bloque cuando el análisis no encontró conceptos suficientes. */
function terminosClave(b: BloqueEstudio): ConceptoBloque[] {
  const texto = b.segmentos.map((s) => s.texto).join(' ');
  const freq = new Map<string, { n: number; orig: string }>();
  for (const w of texto.match(/[\p{L}][\p{L}-]{5,}/gu) ?? []) {
    const k = normalize(w);
    if (STOPWORDS.has(k)) continue;
    const f = freq.get(k) ?? { n: 0, orig: w };
    f.n++;
    freq.set(k, f);
  }
  const ors = oraciones(texto).filter((o) => contarPalabras(o) >= 7 && contarPalabras(o) <= 55);
  return [...freq.entries()]
    .sort((a, b) => b[1].n * b[0].length - a[1].n * a[0].length)
    .slice(0, 12)
    .map(([k, f]) => {
      const o = ors.find((x) => normalize(x).includes(k));
      return o ? { key: `t-${k}`, nombre: f.orig.toLowerCase(), definicion: o } : null;
    })
    .filter((x): x is ConceptoBloque => Boolean(x))
    .slice(0, 6);
}

export function conceptosEvaluables(b: BloqueEstudio): ConceptoBloque[] {
  const base = b.conceptos.filter((c) => c.definicion.length > 15);
  if (base.length >= 3) return base;
  const extra = terminosClave(b).filter((t) => !base.some((c) => normalize(c.nombre) === normalize(t.nombre)));
  return [...base, ...extra].slice(0, 6);
}

/** Genera la mini prueba del bloque. `seed` cambia las preguntas en cada intento. */
export function generarMiniPrueba(b: BloqueEstudio, seed = 1, cantidad?: number, soloConceptos?: string[]): PreguntaMini[] {
  const r = rng(seed * 7919 + b.palabras);
  let cs = conceptosEvaluables(b);
  if (soloConceptos?.length) cs = cs.filter((c) => soloConceptos.includes(c.key));
  const n = cantidad ?? Math.min(5, Math.max(3, Math.round(2 + cs.length / 2)));
  const out: PreguntaMini[] = [];
  let id = 0;
  const nuevoId = () => `${b.id}-q${seed}-${++id}`;
  const usados = new Set<string>();

  // 1) Relacionar términos (si hay al menos 3 conceptos): una sola pregunta evalúa varios
  if (!soloConceptos && cs.length >= 3 && r() < 0.75) {
    const sel = mezclar(cs, r).slice(0, Math.min(4, cs.length));
    out.push({
      id: nuevoId(),
      tipo: 'relacionar',
      enunciado: 'Relaciona cada término con su descripción.',
      pares: sel.map((c) => ({ termino: c.nombre, definicion: ocultar(c.definicion, c.nombre), key: c.key })),
      respuesta: sel.map((c) => `${c.nombre}: ${c.definicion}`).join('\n'),
      conceptKeys: sel.map((c) => c.key),
      fuente: sel.map((c) => c.definicion).join(' '),
    });
    sel.slice(0, 2).forEach((c) => usados.add(c.key));
  }

  const tipos: TipoPregunta[] = ['opcion-multiple', 'completar', 'verdadero-falso', 'corta'];
  let t = Math.floor(r() * tipos.length);
  for (const c of mezclar(cs, r)) {
    if (out.length >= n) break;
    if (usados.has(c.key) && cs.length > n) continue;
    const otros = cs.filter((o) => o.key !== c.key);
    const tipo = tipos[t++ % tipos.length];
    const def = c.definicion;
    if (tipo === 'opcion-multiple' && otros.length >= 2) {
      const opciones = mezclar([c.nombre, ...mezclar(otros, r).slice(0, 3).map((o) => o.nombre)], r);
      out.push({ id: nuevoId(), tipo, enunciado: `¿A qué término corresponde esta descripción?\n«${ocultar(def, c.nombre)}»`, opciones, correcta: opciones.indexOf(c.nombre), respuesta: c.nombre, conceptKeys: [c.key], fuente: def });
    } else if (tipo === 'verdadero-falso' && otros.length >= 1) {
      const verdadero = r() < 0.5;
      const otro = otros[Math.floor(r() * otros.length)];
      const mostrada = verdadero ? def : otro.definicion.replace(new RegExp(esc(otro.nombre), 'ig'), c.nombre);
      out.push({
        id: nuevoId(),
        tipo,
        enunciado: `Verdadero o falso:\n«${mostrada}»`,
        opciones: ['Verdadero', 'Falso'],
        correcta: verdadero ? 0 : 1,
        respuesta: verdadero ? 'Verdadero' : `Falso: esa descripción corresponde a «${otro.nombre}». Lo correcto sobre «${c.nombre}»: ${def}`,
        conceptKeys: verdadero ? [c.key] : [c.key, otro.key],
        fuente: def,
      });
    } else if ((tipo === 'completar' || tipo === 'opcion-multiple' || tipo === 'verdadero-falso') && new RegExp(esc(c.nombre), 'i').test(def)) {
      out.push({ id: nuevoId(), tipo: 'completar', enunciado: `Completa el concepto que falta:\n«${ocultar(def, c.nombre)}»`, respuesta: c.nombre, conceptKeys: [c.key], fuente: def });
    } else {
      const docQ = b.preguntasDoc.find((q) => normalize(q.pregunta).includes(normalize(c.nombre)));
      out.push({ id: nuevoId(), tipo: 'corta', enunciado: docQ?.pregunta ?? `Sin mirar tus apuntes: explica brevemente qué es «${c.nombre}».`, respuesta: docQ?.respuesta ?? def, conceptKeys: [c.key], fuente: docQ?.respuesta ?? def });
    }
    usados.add(c.key);
  }
  // Ejercicio práctico: si el bloque tiene una lista (pasos, clasificación), pedir enumerar
  const lista = b.segmentos.filter((s) => s.tipo === 'list-item');
  if (!soloConceptos && out.length < n && lista.length >= 3) {
    const sec = lista[0].seccion ?? b.titulo;
    out.push({ id: nuevoId(), tipo: 'corta', enunciado: `Ejercicio: enumera de memoria los puntos de «${sec}».`, respuesta: lista.map((l) => `• ${l.texto}`).join('\n'), conceptKeys: [], fuente: lista.map((l) => l.texto).join(' ') });
  }
  return out.slice(0, n);
}

function cerca(a: string, b: string) {
  const x = normalize(a).replace(/[^a-z0-9 ]/g, '').trim();
  const y = normalize(b).replace(/[^a-z0-9 ]/g, '').trim();
  if (!x || !y) return false;
  if (x === y) return true;
  // tolerar una errata cada 6 letras
  const d = lev(x, y);
  return d <= Math.floor(y.length / 6) || (x.length >= 4 && y.startsWith(x) && x.length / y.length > 0.7);
}

function lev(a: string, b: string) {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return m[a.length][b.length];
}

export function corregirPregunta(q: PreguntaMini, resp: RespuestaUsuario): ResultadoPregunta {
  const base = { preguntaId: q.id };
  if (q.tipo === 'relacionar') {
    const m = (resp ?? {}) as Record<string, string>;
    const ok = q.pares!.filter((p) => m[p.key] === p.key);
    const mal = q.pares!.filter((p) => m[p.key] !== p.key);
    const estado = mal.length === 0 ? 'correcta' : ok.length >= q.pares!.length / 2 ? 'parcial' : 'incorrecta';
    return { ...base, estado, acertados: ok.map((p) => p.key), fallados: mal.map((p) => p.key), explicacion: mal.length ? `Revisa: ${mal.map((p) => `«${p.termino}» → ${p.definicion}`).join(' · ')}` : '¡Todas las relaciones son correctas!' };
  }
  if (q.tipo === 'opcion-multiple' || q.tipo === 'verdadero-falso') {
    const ok = resp === q.correcta;
    return { ...base, estado: ok ? 'correcta' : 'incorrecta', acertados: ok ? q.conceptKeys : [], fallados: ok ? [] : q.conceptKeys.slice(0, 1), explicacion: ok ? 'Correcto.' : `La respuesta correcta es «${q.opciones![q.correcta!]}». ${q.tipo === 'verdadero-falso' ? q.respuesta : `Según el texto: «${q.fuente}»`}` };
  }
  if (q.tipo === 'completar') {
    const ok = typeof resp === 'string' && cerca(resp, q.respuesta);
    return { ...base, estado: ok ? 'correcta' : 'incorrecta', acertados: ok ? q.conceptKeys : [], fallados: ok ? [] : q.conceptKeys, explicacion: ok ? 'Correcto.' : `El término era «${q.respuesta}». Según el texto: «${q.fuente}»` };
  }
  const g = gradeOpenLocal(q.respuesta, typeof resp === 'string' ? resp : '');
  return { ...base, estado: g.resultado, acertados: g.resultado === 'correcta' ? q.conceptKeys : [], fallados: g.resultado === 'correcta' ? [] : q.conceptKeys, explicacion: `${g.comentario} Respuesta de referencia: ${q.respuesta}` };
}

export function corregirPrueba(b: BloqueEstudio, qs: PreguntaMini[], resp: Record<string, RespuestaUsuario>): ResultadoPrueba {
  const resultados = qs.map((q) => corregirPregunta(q, resp[q.id]));
  const puntos = resultados.reduce((s, x) => s + (x.estado === 'correcta' ? 1 : x.estado === 'parcial' ? 0.5 : 0), 0);
  const nota = qs.length ? puntos / qs.length : 1;
  const falladas = new Set(resultados.flatMap((x) => x.fallados));
  const cs = conceptosEvaluables(b);
  const reforzar = cs.filter((c) => falladas.has(c.key));
  const recomendacion = nota >= 0.8 ? 'avanzar' : nota >= 0.5 ? 'repaso-breve' : 'repaso';
  const mensaje =
    recomendacion === 'avanzar'
      ? '¡Muy bien! Dominas lo esencial de este bloque. Puedes avanzar.'
      : recomendacion === 'repaso-breve'
        ? `Vas bien. Te conviene un repaso breve de ${reforzar.length || 'algunos'} concepto${reforzar.length === 1 ? '' : 's'} antes de seguir (no hace falta repetir todo el bloque).`
        : 'Este bloque necesita refuerzo. Haz un repaso focalizado de los conceptos que fallaste; no tienes que repetir todo el bloque.';
  return { nota, resultados, reforzar, recomendacion, mensaje };
}

/** Explicación sencilla para el repaso focalizado: primera oración de la definición, más corta. */
export function explicacionSencilla(c: ConceptoBloque) {
  const o = oraciones(c.definicion)[0] ?? c.definicion;
  return o.length > 220 ? `${o.slice(0, 217)}…` : o;
}

/** Palabras clave de un concepto para ayudar a recordarlo. */
export function pistas(c: ConceptoBloque) {
  const vistas = new Set<string>();
  const nombre = normalize(c.nombre);
  return (c.definicion.match(/[\p{L}][\p{L}-]{5,}/gu) ?? [])
    .filter((w) => {
      const k = normalize(w);
      if (vistas.has(k) || STOPWORDS.has(k) || nombre.includes(k)) return false;
      vistas.add(k);
      return true;
    })
    .slice(0, 4);
}

/** Preguntas de repaso espaciado a partir de tarjetas (pueden venir de varios bloques: práctica intercalada). */
export function preguntasDeRepaso(tarjetas: Tarjeta[], todas: Tarjeta[], seed = Date.now()): PreguntaMini[] {
  const r = rng(seed % 100000);
  return tarjetas.map((t, i) => {
    const otros = mezclar(
      todas.filter((x) => x.key !== t.key && normalize(x.nombre) !== normalize(t.nombre)),
      r,
    ).slice(0, 3);
    if (otros.length >= 2 && r() < 0.6) {
      const opciones = mezclar([t.nombre, ...otros.map((o) => o.nombre)], r);
      return { id: `rep-${i}-${t.key}`, tipo: 'opcion-multiple' as const, enunciado: `¿Qué término corresponde a esta descripción?\n«${ocultar(t.definicion, t.nombre)}»`, opciones, correcta: opciones.indexOf(t.nombre), respuesta: t.nombre, conceptKeys: [t.key], fuente: t.definicion };
    }
    if (new RegExp(esc(t.nombre), 'i').test(t.definicion)) return { id: `rep-${i}-${t.key}`, tipo: 'completar' as const, enunciado: `Completa:\n«${ocultar(t.definicion, t.nombre)}»`, respuesta: t.nombre, conceptKeys: [t.key], fuente: t.definicion };
    return { id: `rep-${i}-${t.key}`, tipo: 'corta' as const, enunciado: `Explica de memoria qué es «${t.nombre}».`, respuesta: t.definicion, conceptKeys: [t.key], fuente: t.definicion };
  });
}
