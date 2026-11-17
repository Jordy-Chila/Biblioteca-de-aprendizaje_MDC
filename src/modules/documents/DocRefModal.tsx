import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileText, X } from 'lucide-react';
import { useUI } from '../../stores/ui';
import { useSession } from '../../stores/session';
import { IconButton, cx } from '../../components/ui';

/** Muestra un fragmento del documento original en su contexto (bloques vecinos). */
export function DocRefModal() {
  const ref = useUI((s) => s.docRef);
  const doc = useSession((s) => (ref ? s.documents[ref.docId] : undefined));
  const target = useRef<HTMLDivElement>(null);
  const close = () => useUI.getState().set({ docRef: undefined });
  useEffect(() => {
    target.current?.scrollIntoView({ block: 'center' });
  }, [ref]);
  const idx = doc && ref ? doc.blocks.findIndex((b) => b.id === ref.blockId) : -1;
  const slice = doc && idx >= 0 ? doc.blocks.slice(Math.max(0, idx - 6), idx + 7) : [];
  const head = doc && idx >= 0 ? doc.blocks.find((b) => b.id === doc.blocks[idx].parentHeadingId) : undefined;
  return (
    <AnimatePresence>
      {ref && doc && (
        <motion.div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <motion.div role="dialog" aria-modal aria-label="Referencia en el documento" className="glass flex max-h-[80vh] w-full max-w-2xl flex-col rounded-3xl" initial={{ y: 16 }} animate={{ y: 0 }}>
            <header className="flex items-center gap-3 border-b border-white/6 p-4">
              <FileText className="size-5 text-emerald-300" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-white">{doc.name}</p>
                <p className="truncate text-[12px] text-mist-400">
                  {head?.text ?? 'Documento'}
                  {doc.blocks[idx]?.page ? ` · página ${doc.blocks[idx].page}` : ''}
                </p>
              </div>
              <IconButton label="Cerrar" onClick={close}>
                <X className="size-4" />
              </IconButton>
            </header>
            <div className="space-y-2 overflow-y-auto p-5">
              {slice.map((b) => {
                const on = b.id === ref.blockId;
                return (
                  <div key={b.id} ref={on ? target : undefined} className={cx('rounded-xl px-3 py-2 text-[13px] leading-relaxed', on ? 'bg-emerald-400/10 text-white ring-1 ring-emerald-400/40' : 'text-mist-400')}>
                    {b.type === 'heading' ? (
                      <p className="font-display text-[14px] text-mist-200">{b.text}</p>
                    ) : b.type === 'table' && b.rows ? (
                      <table className="w-full text-left text-[12px]">
                        <tbody>
                          {b.rows.map((r, i) => (
                            <tr key={i} className={i === 0 ? 'font-semibold text-mist-200' : ''}>
                              {r.map((c, j) => (
                                <td key={j} className="border-b border-white/6 py-1 pr-3 align-top">
                                  {c}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p>
                        {b.type === 'list-item' ? '• ' : ''}
                        {b.text}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
