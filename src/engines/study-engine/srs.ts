import type { ConceptoBloque, Tarjeta } from './types';

/**
 * Repetición espaciada con cajas de Leitner. Los intervalos crecen de forma progresiva
 * (práctica distribuida, Cepeda et al. 2008): un acierto sube de caja, un fallo vuelve a la primera.
 */
export const INTERVALOS_DIAS = [1, 3, 7, 14, 30, 60];
const DIA = 86_400_000;
/** Máximo de repasos por día para no sobrecargar. */
export const MAX_REPASOS_DIA = 15;

export function actualizarTarjeta(prev: Tarjeta | undefined, c: ConceptoBloque, cursoId: string, bloqueId: string, acierto: boolean, ahora = Date.now()): Tarjeta {
  const base: Tarjeta = prev ?? { key: c.key, cursoId, bloqueId, nombre: c.nombre, definicion: c.definicion, caja: 0, proxima: ahora, aciertos: 0, fallos: 0 };
  const caja = acierto ? Math.min(base.caja + 1, INTERVALOS_DIAS.length) : 0;
  const dias = acierto ? INTERVALOS_DIAS[caja - 1] : 1; // fallo: repasar mañana (el repaso inmediato ya ocurre en la sesión)
  return { ...base, nombre: c.nombre, definicion: c.definicion, caja, proxima: inicioDia(ahora) + dias * DIA, aciertos: base.aciertos + (acierto ? 1 : 0), fallos: base.fallos + (acierto ? 0 : 1) };
}

export function inicioDia(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function pendientes(tarjetas: Tarjeta[], ahora = Date.now()) {
  return tarjetas
    .filter((t) => t.proxima <= ahora)
    .sort((a, b) => a.caja - b.caja || a.proxima - b.proxima)
    .slice(0, MAX_REPASOS_DIA);
}

/** Tarjeta dominada: llegó a la caja 3 (≥ 1 semana de intervalo). */
export const dominada = (t: Tarjeta) => t.caja >= 3;

export function proximaFecha(tarjetas: Tarjeta[]) {
  const fut = tarjetas.map((t) => t.proxima).filter((x) => x > Date.now());
  return fut.length ? Math.min(...fut) : undefined;
}
