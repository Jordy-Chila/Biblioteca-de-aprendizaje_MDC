import { Eye, EyeOff, Droplet, X } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ModelDef, PartDef } from '../../types/scene';
import { useViewer } from '../../stores/viewer';
import { useSession } from '../../stores/session';
import { IconButton, cx } from '../../components/ui';
import { partKey } from './partKey';

/** Leyenda: lista de componentes con color, visibilidad y transparencia; capas del modelo. */
export function LegendPanel({ model, escenaId, onClose, embedded = false }: { model: ModelDef; escenaId: string; onClose(): void; embedded?: boolean }) {
  const view = useViewer((s) => s.views[escenaId]) ?? useViewer.getState().view(escenaId);
  const selection = useSession((s) => s.selection);
  const V = useViewer.getState;
  const seen = new Set<string>();
  const parts: PartDef[] = model.parts.filter((p) => {
    if (p.selectable === false || seen.has(p.nombre)) return false;
    seen.add(p.nombre);
    return true;
  });
  return (
    <motion.aside initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className={embedded ? "flex flex-col" : "pointer-events-auto glass flex max-h-[60vh] w-64 flex-col rounded-3xl p-3 shadow-2xl"} aria-label="Componentes del modelo">
      <div className={cx("mb-2 items-center justify-between px-1", embedded ? "hidden" : "flex")}>
        <p className="text-[11px] uppercase tracking-[0.14em] text-mist-400">Componentes ({parts.length})</p>
        <IconButton label="Cerrar" className="size-7" onClick={onClose}>
          <X className="size-3.5" />
        </IconButton>
      </div>
      {model.capas && model.capas.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5 px-1">
          {model.capas.map((c) => {
            const off = view.capasOcultas.includes(c.id);
            return (
              <button key={c.id} onClick={() => V().toggleIn(escenaId, 'capasOcultas', c.id)} aria-pressed={!off} className={cx('rounded-full border px-2.5 py-1 text-[11px] transition', off ? 'border-white/10 text-mist-400 line-through' : 'border-accent/30 bg-accent/10 text-cyan-200')}>
                {c.nombre}
              </button>
            );
          })}
        </div>
      )}
      <ul className="-mx-1 flex-1 space-y-0.5 overflow-y-auto px-1">
        {parts.map((p) => {
          const hidden = view.ocultos.includes(p.id) || Boolean(p.capa && view.capasOcultas.includes(p.capa));
          const transp = view.transparentes.includes(p.id);
          const active = selection?.escenaId === escenaId && selection.partId === p.id;
          return (
            <li key={p.id} className={cx('group flex items-center gap-2 rounded-xl px-2 py-1.5', active ? 'bg-accent/12' : 'hover:bg-white/5')}>
              <span className="size-2.5 shrink-0 rounded-full ring-2 ring-white/10" style={{ background: p.color }} aria-hidden />
              <button className={cx('min-w-0 flex-1 truncate text-left text-[13px]', hidden ? 'text-mist-400 line-through' : 'text-mist-100')} onClick={() => useSession.getState().select(p.id, partKey(p, model))}>
                {p.nombre}
              </button>
              <IconButton label={transp ? 'Opaco' : 'Transparente'} active={transp} className="size-7" onClick={() => V().toggleIn(escenaId, 'transparentes', p.id)}>
                <Droplet className="size-3.5" />
              </IconButton>
              <IconButton label={hidden ? 'Mostrar' : 'Ocultar'} className="size-7" onClick={() => V().toggleIn(escenaId, 'ocultos', p.id)}>
                {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </IconButton>
            </li>
          );
        })}
      </ul>
    </motion.aside>
  );
}
