import { useMemo, useState } from 'react';
import { BookMarked, ChevronRight, Network, AlertTriangle } from 'lucide-react';
import { useSession } from '../../stores/session';
import { cx } from '../../components/ui';
import { DOC_TOPIC } from '../../engines/visualization-engine';
import { subtree } from '../../engines/visualization-engine/models/generic';
import type { StudyPlan, Tema } from '../../types/plan';
import { EMPTY_OBJ } from '../../utils/empty';

function topicProgress(plan: StudyPlan, tema: Tema, vistos: Record<string, true>) {
  const ids = subtree(tema.id, plan.temas);
  const cs = plan.conceptos.filter((c) => ids.has(c.temaId));
  const seen = cs.filter((c) => vistos[`c:${c.id}`]).length;
  return { seen, total: cs.length };
}

export function TopicNav() {
  const docId = useSession((s) => s.activeDocId)!;
  const plan = useSession((s) => s.plans[docId]);
  const materials = useSession((s) => s.materials);
  const activeTema = useSession((s) => s.activeTemaId);
  const activeEscena = useSession((s) => s.activeEscenaId);
  const vistos = useSession((s) => s.vistos[docId] ?? EMPTY_OBJ) as Record<string, true>;
  const visitados = useSession((s) => s.temasVisitados[docId] ?? EMPTY_OBJ) as Record<string, true>;
  const allMarcadores = useSession((s) => s.marcadores);
  const marcadores = allMarcadores.filter((m) => m.docId === docId);
  const openDoc = useSession((s) => s.openDoc);
  const openTema = useSession((s) => s.openTema);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const roots = useMemo(() => plan?.temas.filter((t) => t.nivel === 1) ?? [], [plan]);
  if (!plan) return null;
  const ready = materials.filter((m) => m.status === 'listo' && m.docId);

  return (
    <nav aria-label="Temas del documento" className="flex h-full flex-col gap-3 overflow-hidden">
      {ready.length > 1 && (
        <select value={docId} onChange={(e) => openDoc(e.target.value)} className="h-9 rounded-xl border border-white/10 bg-ink-850 px-2 text-[13px] text-white" aria-label="Material activo">
          {ready.map((m) => (
            <option key={m.id} value={m.docId}>
              {m.name}
            </option>
          ))}
        </select>
      )}
      <div className="px-1">
        <p className="text-[11px] uppercase tracking-[0.14em] text-mist-400">{plan.dominio.materia}</p>
        <h2 className="mt-1 font-display text-[17px] leading-snug text-white">{plan.dominio.tema}</h2>
        <p className="mt-1 text-[12px] text-mist-400">
          {Object.keys(visitados).filter((k) => k !== DOC_TOPIC).length}/{roots.length} temas visitados
        </p>
      </div>
      <div className="-mx-1 flex-1 space-y-0.5 overflow-y-auto px-1 pb-4">
        <button onClick={() => openTema(DOC_TOPIC)} className={cx('flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] transition', activeTema === DOC_TOPIC ? 'bg-accent/12 text-white ring-1 ring-accent/30' : 'text-mist-200 hover:bg-white/5')}>
          <Network className="size-4 text-accent" /> Vista general del documento
        </button>
        {roots.map((t) => {
          // solo los subtemas con una vista propia del modelo (aspectos secuenciales del tema)
          const subs = plan.escenas.filter((e) => e.temaId === t.id && typeof e.params.subtemaId === 'string').map((e) => ({ id: e.params.subtemaId as string, escenaId: e.id, titulo: e.titulo }));
          const p = topicProgress(plan, t, vistos);
          const active = activeTema === t.id;
          const hasAlert = plan.alertas.some((a) => a.blockId && subtree(t.id, plan.temas).size && plan.temas.filter((x) => subtree(t.id, plan.temas).has(x.id)).some((x) => x.blockIds.includes(a.blockId!)));
          return (
            <div key={t.id}>
              <div className={cx('group flex items-center rounded-xl transition', active ? 'bg-accent/12 ring-1 ring-accent/30' : 'hover:bg-white/5')}>
                <button onClick={() => openTema(t.id)} className="min-w-0 flex-1 px-3 py-2 text-left">
                  <span className={cx('block truncate text-[13px]', active ? 'text-white' : visitados[t.id] ? 'text-mist-200' : 'text-mist-300')}>
                    {hasAlert && <AlertTriangle className="mr-1 inline size-3 text-orange-300" aria-label="Contiene signos de alarma" />}
                    {t.titulo}
                  </span>
                  {p.total > 0 && (
                    <span className="mt-1 flex items-center gap-2">
                      <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/8">
                        <span className="block h-full rounded-full bg-accent/80" style={{ width: `${(p.seen / p.total) * 100}%` }} />
                      </span>
                      <span className="text-[10px] tabular-nums text-mist-400">
                        {p.seen}/{p.total}
                      </span>
                    </span>
                  )}
                </button>
                {subs.length > 0 && (
                  <button aria-label={open[t.id] ? 'Contraer subtemas' : 'Mostrar subtemas'} aria-expanded={!!open[t.id]} onClick={() => setOpen((o) => ({ ...o, [t.id]: !o[t.id] }))} className="mr-1 grid size-7 place-items-center rounded-lg text-mist-400 hover:bg-white/8 hover:text-white">
                    <ChevronRight className={cx('size-4 transition', open[t.id] && 'rotate-90')} />
                  </button>
                )}
              </div>
              {open[t.id] && (
                <div className="ml-4 border-l border-white/8 pl-2">
                  {subs.map((s) => (
                    <button key={s.id} onClick={() => openTema(t.id, s.escenaId)} className={cx('block w-full truncate rounded-lg px-2 py-1.5 text-left text-[12px] hover:bg-white/5 hover:text-white', activeEscena === s.escenaId ? 'bg-accent/10 text-white' : 'text-mist-400')}>
                      {s.titulo}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {marcadores.length > 0 && (
          <div className="mt-4 border-t border-white/8 pt-3">
            <p className="mb-1 flex items-center gap-1.5 px-3 text-[11px] uppercase tracking-[0.14em] text-mist-400">
              <BookMarked className="size-3.5" /> Marcadores
            </p>
            {marcadores.map((m) => (
              <button
                key={m.key}
                onClick={() => {
                  if (m.temaId) openTema(m.temaId, m.escenaId);
                  if (m.partId) setTimeout(() => useSession.getState().select(m.partId, m.key), 50);
                }}
                className="block w-full truncate rounded-lg px-3 py-1.5 text-left text-[12px] text-amber-200/90 hover:bg-white/5"
              >
                {m.titulo}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
