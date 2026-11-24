import { useMemo } from 'react';
import { CheckCircle2, CircleAlert, XCircle } from 'lucide-react';
import type { PreguntaMini, RespuestaUsuario, ResultadoPregunta } from '../../engines/study-engine/types';
import { rng } from '../../engines/education-engine';
import { cx } from '../../components/ui';

const TIPO: Record<PreguntaMini['tipo'], string> = {
  'opcion-multiple': 'Opción múltiple',
  'verdadero-falso': 'Verdadero o falso',
  completar: 'Completar',
  relacionar: 'Relacionar',
  corta: 'Respuesta corta',
};

export function PreguntaView({ q, n, valor, onChange, resultado }: { q: PreguntaMini; n: number; valor: RespuestaUsuario; onChange(v: RespuestaUsuario): void; resultado?: ResultadoPregunta }) {
  const bloqueado = Boolean(resultado);
  const defsMezcladas = useMemo(() => {
    if (!q.pares) return [];
    const r = rng(q.id.length * 31 + q.pares.length);
    return [...q.pares].sort(() => r() - 0.5);
  }, [q]);
  const [enunciado, cita] = q.enunciado.split('\n');
  return (
    <div className={cx('rounded-2xl border p-4', resultado ? (resultado.estado === 'correcta' ? 'border-emerald-400/30 bg-emerald-400/5' : resultado.estado === 'parcial' ? 'border-amber-400/30 bg-amber-400/5' : 'border-rose-400/30 bg-rose-400/5') : 'border-white/8 bg-white/3')}>
      <p className="mb-1 text-[11px] uppercase tracking-[0.12em] text-mist-400">
        {n}. {TIPO[q.tipo]}
      </p>
      <p className="text-[14px] text-white">{enunciado}</p>
      {cita && <p className="mt-1.5 rounded-xl bg-white/4 p-2.5 text-[13px] leading-relaxed text-mist-200">{cita}</p>}

      <div className="mt-3">
        {(q.tipo === 'opcion-multiple' || q.tipo === 'verdadero-falso') && (
          <div className={cx('grid gap-2', q.tipo === 'verdadero-falso' ? 'grid-cols-2' : 'sm:grid-cols-2')}>
            {q.opciones!.map((o, i) => {
              const sel = valor === i;
              const correcta = resultado && i === q.correcta;
              return (
                <button key={i} disabled={bloqueado} onClick={() => onChange(i)} className={cx('rounded-xl border px-3 py-2 text-left text-[13px] transition', correcta ? 'border-emerald-400/60 bg-emerald-400/15 text-white' : sel ? (resultado ? 'border-rose-400/60 bg-rose-400/10 text-white' : 'border-accent/60 bg-accent/10 text-white') : 'border-white/10 text-mist-200 hover:border-white/25')}>
                  {o}
                </button>
              );
            })}
          </div>
        )}
        {q.tipo === 'completar' && <input disabled={bloqueado} value={(valor as string) ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="Escribe el término que falta" className="h-10 w-full rounded-xl border border-white/10 bg-ink-950/60 px-3 text-[14px] text-white outline-none focus:border-accent/50" />}
        {q.tipo === 'corta' && <textarea disabled={bloqueado} value={(valor as string) ?? ''} onChange={(e) => onChange(e.target.value)} rows={3} placeholder="Responde con tus palabras, sin mirar el material" className="w-full resize-none rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2 text-[14px] text-white outline-none focus:border-accent/50" />}
        {q.tipo === 'relacionar' && (
          <div className="space-y-2">
            {q.pares!.map((p) => {
              const m = (valor ?? {}) as Record<string, string>;
              return (
                <div key={p.key} className="grid items-center gap-2 sm:grid-cols-[minmax(0,10rem)_1fr]">
                  <span className="text-[13px] font-medium text-white">{p.termino}</span>
                  <select disabled={bloqueado} value={m[p.key] ?? ''} onChange={(e) => onChange({ ...m, [p.key]: e.target.value })} className="h-10 w-full min-w-0 rounded-xl border border-white/10 bg-ink-850 px-2 text-[12px] text-white">
                    <option value="">Elige la descripción…</option>
                    {defsMezcladas.map((d) => (
                      <option key={d.key} value={d.key}>
                        {d.definicion.length > 110 ? `${d.definicion.slice(0, 107)}…` : d.definicion}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {resultado && (
        <div className="mt-3 flex items-start gap-2 text-[13px]">
          {resultado.estado === 'correcta' ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" /> : resultado.estado === 'parcial' ? <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-rose-300" />}
          <p className="whitespace-pre-line text-mist-200">{resultado.explicacion}</p>
        </div>
      )}
    </div>
  );
}

export function respondida(q: PreguntaMini, v: RespuestaUsuario) {
  if (q.tipo === 'relacionar') return Object.values((v ?? {}) as Record<string, string>).filter(Boolean).length === q.pares!.length;
  if (typeof v === 'string') return v.trim().length > 0;
  return v !== undefined;
}
