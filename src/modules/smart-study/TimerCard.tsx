import { useEffect, useState } from 'react';
import { Coffee, Pause, Play, Plus, BookOpen, PenLine } from 'lucide-react';
import { restante, useSmartStudy, type Timer } from '../../stores/smartStudy';
import { avisar } from '../../services/notify';
import { useUI } from '../../stores/ui';
import { useSession } from '../../stores/session';
import { cx } from '../../components/ui';

export const ETAPA_INFO = {
  estudio: { label: 'Estudiando', color: '#22d3ee', ring: 'text-cyan-300', bg: 'bg-cyan-400/10 border-cyan-300/30 text-cyan-200', icon: BookOpen },
  prueba: { label: 'Mini prueba', color: '#a78bfa', ring: 'text-violet-300', bg: 'bg-violet-400/10 border-violet-300/30 text-violet-200', icon: PenLine },
  descanso: { label: 'Descansando', color: '#34d399', ring: 'text-emerald-300', bg: 'bg-emerald-400/10 border-emerald-300/30 text-emerald-200', icon: Coffee },
} as const;

const AVISOS = {
  estudio: ['Tiempo de estudio terminado', 'Cierra el material e intenta recordar: es hora de la mini prueba.'],
  prueba: ['Tiempo sugerido de la prueba terminado', 'Puedes terminar con calma; no es un examen.'],
  descanso: ['Descanso terminado', 'Cuando quieras, empieza el siguiente bloque.'],
} as const;

export function fmt(ms: number) {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Se vuelve a dibujar cada 250 ms; el tiempo se calcula con la hora real, así que no se desfasa al cambiar de pantalla. */
function useAhora(activo: boolean) {
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => {
    if (!activo) return;
    const id = setInterval(() => setAhora(Date.now()), 250);
    const vis = () => setAhora(Date.now());
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [activo]);
  return ahora;
}

/**
 * Vigila el cronómetro desde cualquier pantalla (está montado en App):
 * notifica el final de cada etapa aunque el usuario esté en otra sección o con la ventana minimizada.
 */
export function StudyTimerWatcher() {
  const timer = useSmartStudy((s) => s.sesion?.timer);
  useEffect(() => {
    if (!timer?.endsAt || timer.terminado) return;
    const check = () => {
      const t = useSmartStudy.getState().sesion?.timer;
      if (!t?.endsAt || t.terminado || restante(t) > 0) return;
      useSmartStudy.getState().marcarTerminado();
      const [titulo, cuerpo] = AVISOS[t.etapa];
      avisar(titulo, cuerpo);
      useUI.getState().notify(titulo);
    };
    const id = setInterval(check, 500);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, [timer?.endsAt, timer?.terminado]);
  return null;
}

export function TimerCard({ timer, compact }: { timer: Timer; compact?: boolean }) {
  const corriendo = Boolean(timer.endsAt);
  const ahora = useAhora(corriendo);
  const rest = restante(timer, ahora);
  const info = ETAPA_INFO[timer.etapa];
  const S = useSmartStudy.getState;

  // Título de la ventana con el tiempo restante (visible desde la barra de tareas)
  useEffect(() => {
    const prev = document.title;
    document.title = `${timer.terminado ? '✔' : fmt(rest)} · ${info.label} — SES`;
    return () => {
      document.title = prev;
    };
  }, [Math.ceil(rest / 1000), timer.terminado, info.label]);

  const frac = timer.duracionMs ? 1 - rest / timer.duracionMs : 1;
  const R = compact ? 34 : 62;
  const C = 2 * Math.PI * R;
  const size = (R + 10) * 2;
  const Icon = info.icon;

  return (
    <div className={cx('glass flex items-center gap-4 rounded-3xl', compact ? 'p-3' : 'flex-col p-5')} aria-live="polite">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={compact ? 6 : 9} />
          <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke={info.color} strokeWidth={compact ? 6 : 9} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} style={{ transition: 'stroke-dashoffset 0.25s linear' }} />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className={cx('font-display tabular-nums text-white', compact ? 'text-lg' : 'text-4xl')} role="timer">
              {timer.terminado ? '00:00' : fmt(rest)}
            </p>
            {!compact && <p className="text-[11px] text-mist-400">{corriendo ? 'restante' : timer.terminado ? 'terminado' : 'en pausa'}</p>}
          </div>
        </div>
      </div>
      <div className={cx('flex flex-col gap-2', compact ? '' : 'items-center')}>
        <span className={cx('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium', info.bg)}>
          <Icon className="size-3.5" /> {info.label}
        </span>
        <div className="flex gap-1.5">
          {!timer.terminado &&
            (corriendo ? (
              <button onClick={() => S().pausar()} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/8 px-3 text-[13px] text-white hover:bg-white/12">
                <Pause className="size-4" /> Pausar
              </button>
            ) : (
              <button onClick={() => S().reanudar()} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3 text-[13px] font-medium text-ink-950">
                <Play className="size-4" /> {timer.restanteMs < timer.duracionMs ? 'Reanudar' : 'Iniciar'}
              </button>
            ))}
          <button onClick={() => S().sumarMinutos(5)} title="Añadir 5 minutos" className="inline-flex h-9 items-center gap-1 rounded-xl px-2.5 text-[13px] text-mist-300 hover:bg-white/8 hover:text-white">
            <Plus className="size-4" /> 5 min
          </button>
        </div>
      </div>
    </div>
  );
}

/** Indicador compacto en la barra superior mientras hay una sesión con cronómetro. */
export function TimerPill() {
  const timer = useSmartStudy((s) => s.sesion?.timer);
  const ahora = useAhora(Boolean(timer?.endsAt));
  if (!timer) return null;
  const info = ETAPA_INFO[timer.etapa];
  const Icon = info.icon;
  return (
    <button
      onClick={() => {
        useUI.getState().set({ studyTab: 'inteligente' });
        useSession.getState().goto('study');
      }}
      title="Ir a la sesión de estudio"
      className={cx('inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-[12px] tabular-nums', info.bg)}
    >
      <Icon className="size-3.5" />
      {timer.terminado ? '¡Listo!' : fmt(restante(timer, ahora))}
      {!timer.endsAt && !timer.terminado && <Pause className="size-3" />}
    </button>
  );
}
