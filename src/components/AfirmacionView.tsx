import { FileText, Sparkles, Globe2, AlertTriangle } from 'lucide-react';
import type { Afirmacion } from '../types/plan';
import { cx } from './ui';
import { useSession } from '../stores/session';
import { useDocRefs } from '../hooks/useDocRefs';

const ORIGEN = {
  documento: { label: 'Del documento', icon: FileText, cls: 'text-emerald-300', bar: 'bg-emerald-400/70' },
  complementario: { label: 'Complementario', icon: Globe2, cls: 'text-amber-300', bar: 'bg-amber-400/70' },
  generado: { label: 'Generado por IA', icon: Sparkles, cls: 'text-purple-300', bar: 'bg-purple-400/70' },
} as const;

/** Muestra una afirmación con su procedencia y, si es del documento, su cita y página. */
export function AfirmacionView({ a, compact, hideQuote }: { a: Afirmacion; compact?: boolean; hideQuote?: boolean }) {
  const o = ORIGEN[a.origen];
  const Icon = o.icon;
  const { openRef } = useDocRefs();
  const showQuote = !hideQuote && a.origen !== 'complementario' && a.cita && a.cita !== a.texto && a.verificada;
  return (
    <div className="relative pl-3">
      <span className={cx('absolute left-0 top-1 bottom-1 w-[2px] rounded-full', o.bar)} aria-hidden />
      <p className={cx('text-mist-100', compact ? 'text-[13px] leading-relaxed' : 'text-sm leading-relaxed')}>{a.texto}</p>
      {showQuote && <p className="mt-1 border-l border-white/10 pl-2 text-[12px] italic text-mist-400">«{a.cita}»</p>}
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        <span className={cx('inline-flex items-center gap-1 font-medium', o.cls)}>
          <Icon className="size-3" aria-hidden />
          {o.label}
        </span>
        {a.verificada === false && (
          <span className="inline-flex items-center gap-1 text-orange-300">
            <AlertTriangle className="size-3" /> no verificada en el documento
          </span>
        )}
        {a.blockId && a.verificada && (
          <button className="text-mist-400 underline-offset-2 hover:text-accent hover:underline" onClick={() => openRef(a.blockId!)}>
            Ver en el documento{a.pagina ? ` · pág. ${a.pagina}` : ''}
          </button>
        )}
        {a.fuentes?.map((f, i) =>
          f.url ? (
            <a key={i} href={f.url} target="_blank" rel="noreferrer noopener" className="text-amber-200/80 hover:underline">
              {f.titulo}
            </a>
          ) : (
            <span key={i} className="text-amber-200/80">
              {f.titulo}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

/** Leyenda de procedencias. */
export function OrigenLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-[11px] text-mist-400">
      {Object.entries(ORIGEN).map(([k, o]) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <span className={cx('size-2 rounded-full', o.bar)} /> {o.label}
        </span>
      ))}
    </div>
  );
}

export function useActivePlan() {
  const docId = useSession((s) => s.activeDocId);
  const plan = useSession((s) => (docId ? s.plans[docId] : undefined));
  const doc = useSession((s) => (docId ? s.documents[docId] : undefined));
  return { docId, plan, doc };
}
