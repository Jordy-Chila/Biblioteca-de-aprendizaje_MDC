import { create } from 'zustand';
import type { DocumentModel } from '../types/document';
import type { StudyPlan } from '../types/plan';
import { construirCurso, cursoIdPara } from '../engines/study-engine/planner';
import { conceptosEvaluables, corregirPrueba, generarMiniPrueba, preguntasDeRepaso } from '../engines/study-engine/quiz';
import { actualizarTarjeta, inicioDia, pendientes } from '../engines/study-engine/srs';
import type { BloqueEstudio, ConfigEstudio, Curso, PreguntaMini, ProgresoBloque, RespuestaUsuario, ResultadoPrueba, Tarjeta } from '../engines/study-engine/types';
import { escribir, leer } from '../services/storage/persist';

export type EtapaTimer = 'estudio' | 'prueba' | 'descanso';
export type Etapa = 'estudio' | 'prueba' | 'resultados' | 'repaso' | 'descanso' | 'fin-fase' | 'repaso-espaciado' | 'resultados-repaso';

/** Cronómetro basado en la hora real: sigue siendo exacto aunque se cambie de pantalla o la ventana se minimice. */
export interface Timer {
  etapa: EtapaTimer;
  duracionMs: number;
  /** Momento (Date.now) en que termina si está corriendo. */
  endsAt?: number;
  /** Tiempo restante cuando está en pausa. */
  restanteMs: number;
  /** Ya se notificó el final de esta etapa. */
  terminado: boolean;
  /** Momento en que empezó a correr (para contar minutos de estudio). */
  desde?: number;
}

export interface SesionActiva {
  cursoId: string;
  bloqueId?: string;
  etapa: Etapa;
  timer?: Timer;
  preguntas?: PreguntaMini[];
  respuestas?: Record<string, RespuestaUsuario>;
  resultado?: ResultadoPrueba;
  /** Repaso focalizado: claves de conceptos a reforzar. */
  reforzar?: string[];
}

export interface ProgresoCurso {
  bloques: Record<string, ProgresoBloque>;
  /** Minutos de estudio concentrado por día (clave: inicio del día). */
  minutosPorDia: Record<string, number>;
}

interface Persistido {
  cursos: Record<string, Curso>;
  progreso: Record<string, ProgresoCurso>;
  tarjetas: Record<string, Tarjeta>;
}

interface SmartState extends Persistido {
  sesion?: SesionActiva;
  crearCurso(doc: DocumentModel, plan: StudyPlan, config: ConfigEstudio): Curso;
  borrarCurso(id: string): void;
  iniciarBloque(cursoId: string, bloqueId: string): void;
  pausar(): void;
  reanudar(): void;
  sumarMinutos(min: number): void;
  marcarTerminado(): void;
  irAPrueba(): void;
  responder(preguntaId: string, r: RespuestaUsuario): void;
  entregar(): void;
  iniciarRepasoFocalizado(): void;
  terminarRepasoFocalizado(aciertos: Record<string, boolean>): void;
  avanzar(): void;
  saltarDescanso(): void;
  iniciarRepasoEspaciado(cursoId: string): void;
  salir(): void;
}

const KEY = 'ses.estudio-inteligente.v1';
const inicial: Persistido = leer<Persistido>(KEY, { cursos: {}, progreso: {}, tarjetas: {} });

export const tkey = (cursoId: string, conceptKey: string) => `${cursoId}:${conceptKey}`;

function nuevoTimer(etapa: EtapaTimer, minutos: number, corriendo = true): Timer {
  const ms = Math.max(1, minutos) * 60_000;
  const ahora = Date.now();
  return { etapa, duracionMs: ms, restanteMs: ms, endsAt: corriendo ? ahora + ms : undefined, terminado: false, desde: corriendo ? ahora : undefined };
}

export function restante(t: Timer, ahora = Date.now()) {
  return t.endsAt ? Math.max(0, t.endsAt - ahora) : t.restanteMs;
}

export function buscarBloque(c: Curso, bloqueId?: string): BloqueEstudio | undefined {
  for (const f of c.fases) for (const b of f.bloques) if (b.id === bloqueId) return b;
  return undefined;
}

export function bloquesEnOrden(c: Curso) {
  return c.fases.flatMap((f) => f.bloques);
}

/** Primer bloque no completado del curso. */
export function siguientePendiente(c: Curso, p?: ProgresoCurso) {
  return bloquesEnOrden(c).find((b) => p?.bloques[b.id]?.estado !== 'completado');
}

export function minutosHoy(p?: ProgresoCurso) {
  return Math.round(p?.minutosPorDia[String(inicioDia(Date.now()))] ?? 0);
}

export const useSmartStudy = create<SmartState>()((set, get) => {
  /** Suma al día de hoy el tiempo que el cronómetro de estudio estuvo corriendo. */
  const contabilizar = (s: SmartState): Partial<SmartState> => {
    const t = s.sesion?.timer;
    if (!s.sesion || !t || t.etapa !== 'estudio' || !t.desde) return {};
    const fin = t.endsAt ? Math.min(Date.now(), t.endsAt) : Date.now();
    const min = Math.max(0, fin - t.desde) / 60_000;
    const p = s.progreso[s.sesion.cursoId] ?? { bloques: {}, minutosPorDia: {} };
    const dia = String(inicioDia(Date.now()));
    return { progreso: { ...s.progreso, [s.sesion.cursoId]: { ...p, minutosPorDia: { ...p.minutosPorDia, [dia]: (p.minutosPorDia[dia] ?? 0) + min } } } };
  };
  const conProgreso = (s: SmartState, cursoId: string, bloqueId: string, f: (p: ProgresoBloque) => ProgresoBloque) => {
    const p = s.progreso[cursoId] ?? { bloques: {}, minutosPorDia: {} };
    const pb = p.bloques[bloqueId] ?? { estado: 'pendiente', intentos: [] };
    return { ...s.progreso, [cursoId]: { ...p, bloques: { ...p.bloques, [bloqueId]: f(pb) } } };
  };

  return {
    ...inicial,
    crearCurso: (doc, plan, config) => {
      const curso = construirCurso(doc, plan, config, cursoIdPara(doc));
      set((s) => {
        // conservar el progreso de bloques con el mismo id si se rehace el plan
        return { cursos: { ...s.cursos, [curso.id]: curso }, progreso: { ...s.progreso, [curso.id]: s.progreso[curso.id] ?? { bloques: {}, minutosPorDia: {} } }, sesion: undefined };
      });
      return curso;
    },
    borrarCurso: (id) =>
      set((s) => {
        const cursos = { ...s.cursos };
        const progreso = { ...s.progreso };
        delete cursos[id];
        delete progreso[id];
        const tarjetas = Object.fromEntries(Object.entries(s.tarjetas).filter(([, t]) => t.cursoId !== id));
        return { cursos, progreso, tarjetas, sesion: s.sesion?.cursoId === id ? undefined : s.sesion };
      }),
    iniciarBloque: (cursoId, bloqueId) => {
      const c = get().cursos[cursoId];
      const b = c && buscarBloque(c, bloqueId);
      if (!b) return;
      set((s) => ({
        sesion: { cursoId, bloqueId, etapa: 'estudio', timer: nuevoTimer('estudio', b.minutos.estudio) },
        progreso: conProgreso(s, cursoId, bloqueId, (p) => ({ ...p, estado: p.estado === 'completado' ? 'completado' : 'en-curso' })),
      }));
    },
    pausar: () =>
      set((s) => {
        const t = s.sesion?.timer;
        if (!s.sesion || !t?.endsAt) return {};
        return { ...contabilizar(s), sesion: { ...s.sesion, timer: { ...t, restanteMs: restante(t), endsAt: undefined, desde: undefined } } };
      }),
    reanudar: () =>
      set((s) => {
        const t = s.sesion?.timer;
        if (!s.sesion || !t || t.endsAt) return {};
        const ahora = Date.now();
        return { sesion: { ...s.sesion, timer: { ...t, endsAt: ahora + t.restanteMs, desde: ahora } } };
      }),
    sumarMinutos: (min) =>
      set((s) => {
        const t = s.sesion?.timer;
        if (!s.sesion || !t) return {};
        const extra = min * 60_000;
        return { sesion: { ...s.sesion, timer: { ...t, duracionMs: t.duracionMs + extra, restanteMs: t.restanteMs + extra, endsAt: t.endsAt ? Math.max(Date.now(), t.endsAt) + extra : undefined, terminado: false } } };
      }),
    marcarTerminado: () =>
      set((s) => {
        const t = s.sesion?.timer;
        if (!s.sesion || !t) return {};
        return { ...contabilizar(s), sesion: { ...s.sesion, timer: { ...t, terminado: true, restanteMs: 0, endsAt: undefined, desde: undefined } } };
      }),
    irAPrueba: () => {
      const s = get();
      const ses = s.sesion;
      const c = ses && s.cursos[ses.cursoId];
      const b = c && buscarBloque(c, ses.bloqueId);
      if (!ses || !b) return;
      const intento = (s.progreso[ses.cursoId]?.bloques[b.id]?.intentos.length ?? 0) + 1;
      const preguntas = generarMiniPrueba(b, intento);
      set({ ...contabilizar(s), sesion: { ...ses, etapa: 'prueba', preguntas, respuestas: {}, resultado: undefined, timer: nuevoTimer('prueba', b.minutos.prueba) } });
    },
    responder: (id, r) => set((s) => (s.sesion ? { sesion: { ...s.sesion, respuestas: { ...(s.sesion.respuestas ?? {}), [id]: r } } } : {})),
    entregar: () => {
      const s = get();
      const ses = s.sesion;
      if (!ses?.preguntas) return;
      const c = s.cursos[ses.cursoId];
      if (ses.etapa === 'repaso-espaciado') {
        // Corrección de repaso espaciado: actualizar cada tarjeta
        const pseudo = { id: 'repaso', conceptos: [], segmentos: [], palabras: 0 } as unknown as BloqueEstudio;
        const resultado = corregirPrueba(pseudo, ses.preguntas, ses.respuestas ?? {});
        const tarjetas = { ...s.tarjetas };
        ses.preguntas.forEach((q, i) => {
          const k = tkey(ses.cursoId, q.conceptKeys[0]);
          const t = tarjetas[k];
          if (!t) return;
          const ok = resultado.resultados[i].estado === 'correcta';
          tarjetas[k] = actualizarTarjeta(t, { key: t.key, nombre: t.nombre, definicion: t.definicion }, t.cursoId, t.bloqueId, ok);
        });
        resultado.reforzar = ses.preguntas
          .filter((_, i) => resultado.resultados[i].estado !== 'correcta')
          .map((q) => tarjetas[tkey(ses.cursoId, q.conceptKeys[0])])
          .filter(Boolean)
          .map((t) => ({ key: t.key, nombre: t.nombre, definicion: t.definicion }));
        set({ tarjetas, sesion: { ...ses, etapa: 'resultados-repaso', resultado, timer: undefined } });
        return;
      }
      const b = buscarBloque(c, ses.bloqueId);
      if (!b) return;
      const resultado = corregirPrueba(b, ses.preguntas, ses.respuestas ?? {});
      // Repetición espaciada: cada concepto evaluado crea o actualiza su tarjeta
      const tarjetas = { ...s.tarjetas };
      const evaluables = conceptosEvaluables(b);
      const acertados = new Set(resultado.resultados.flatMap((r) => r.acertados));
      const fallados = new Set(resultado.resultados.flatMap((r) => r.fallados));
      for (const cpt of evaluables) {
        if (!acertados.has(cpt.key) && !fallados.has(cpt.key)) continue;
        const k = tkey(ses.cursoId, cpt.key);
        tarjetas[k] = actualizarTarjeta(tarjetas[k], cpt, ses.cursoId, b.id, !fallados.has(cpt.key));
      }
      set((st) => ({
        tarjetas,
        progreso: conProgreso(st, ses.cursoId, b.id, (p) => ({ ...p, intentos: [...p.intentos, { fecha: Date.now(), nota: resultado.nota, fallados: resultado.reforzar.map((x) => x.key) }] })),
        sesion: { ...ses, etapa: 'resultados', resultado, timer: undefined },
      }));
    },
    iniciarRepasoFocalizado: () => set((s) => (s.sesion?.resultado ? { sesion: { ...s.sesion, etapa: 'repaso', reforzar: s.sesion.resultado.reforzar.map((c) => c.key) } } : {})),
    terminarRepasoFocalizado: (aciertos) =>
      set((s) => {
        const ses = s.sesion;
        const c = ses && s.cursos[ses.cursoId];
        const b = c && buscarBloque(c, ses.bloqueId);
        if (!ses || !b) return {};
        const tarjetas = { ...s.tarjetas };
        // En el repaso focalizado un acierto no sube de caja (el concepto se falló hace minutos): solo se registra.
        for (const [key, ok] of Object.entries(aciertos)) {
          const k = tkey(ses.cursoId, key);
          if (tarjetas[k] && ok) tarjetas[k] = { ...tarjetas[k], aciertos: tarjetas[k].aciertos + 1 };
        }
        return { tarjetas, sesion: { ...ses, etapa: 'resultados', reforzar: [], resultado: ses.resultado ? { ...ses.resultado, recomendacion: 'avanzar', mensaje: 'Repaso completado. Ya puedes avanzar; estos conceptos volverán en tus repasos espaciados.' } : undefined } };
      }),
    avanzar: () => {
      const s = get();
      const ses = s.sesion;
      const c = ses && s.cursos[ses.cursoId];
      const b = c && buscarBloque(c, ses.bloqueId);
      if (!ses || !c || !b) return;
      const progreso = conProgreso(s, ses.cursoId, b.id, (p) => ({ ...p, estado: 'completado' }));
      const fase = c.fases.find((f) => f.id === b.faseId)!;
      const sig = fase.bloques[b.indice + 1];
      if (sig) set({ progreso, sesion: { cursoId: ses.cursoId, bloqueId: sig.id, etapa: 'descanso', timer: nuevoTimer('descanso', b.minutos.descanso || 5) } });
      else set({ progreso, sesion: { cursoId: ses.cursoId, bloqueId: b.id, etapa: 'fin-fase' } });
    },
    saltarDescanso: () => {
      const ses = get().sesion;
      if (ses?.bloqueId) get().iniciarBloque(ses.cursoId, ses.bloqueId);
    },
    iniciarRepasoEspaciado: (cursoId) => {
      const s = get();
      const todas = Object.values(s.tarjetas).filter((t) => t.cursoId === cursoId);
      const due = pendientes(todas);
      if (!due.length) return;
      set({ sesion: { cursoId, etapa: 'repaso-espaciado', preguntas: preguntasDeRepaso(due, todas), respuestas: {} } });
    },
    salir: () => set((s) => ({ ...contabilizar(s), sesion: undefined })),
  };
});

// Guardar el progreso en este equipo cada vez que cambia
let ultimo = '';
useSmartStudy.subscribe((s) => {
  const v = JSON.stringify({ cursos: s.cursos, progreso: s.progreso, tarjetas: s.tarjetas });
  if (v !== ultimo) {
    ultimo = v;
    escribir(KEY, JSON.parse(v));
  }
});
