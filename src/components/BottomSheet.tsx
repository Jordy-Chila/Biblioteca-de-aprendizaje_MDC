import { type ReactNode } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { X } from 'lucide-react';
import { cx } from './ui';

/** Hoja inferior para teléfonos: se desliza desde abajo y se cierra arrastrándola hacia abajo o tocando el fondo. */
export function BottomSheet({ open, onClose, title, children, height = '75dvh', backdrop = true }: { open: boolean; onClose(): void; title?: ReactNode; children: ReactNode; height?: string; backdrop?: boolean }) {
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 90 || info.velocity.y > 500) onClose();
  };
  return (
    <AnimatePresence>
      {open && (
        <>
          {backdrop && <motion.div className="fixed inset-0 z-[55] bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />}
          <motion.div
            role="dialog"
            aria-modal={backdrop}
            className={cx('glass fixed inset-x-0 bottom-0 z-[56] flex flex-col rounded-t-3xl border-b-0 shadow-2xl')}
            style={{ maxHeight: height, paddingBottom: 'env(safe-area-inset-bottom)' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
          >
            <div className="flex shrink-0 cursor-grab items-center gap-3 px-5 pb-2 pt-3">
              <span className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/25" aria-hidden />
              {title && <div className="mt-2 min-w-0 flex-1 truncate font-display text-[15px] text-white">{title}</div>}
              <button onClick={onClose} aria-label="Cerrar" className="mt-2 ml-auto grid size-8 place-items-center rounded-xl text-mist-300 hover:bg-white/8">
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4" onPointerDownCapture={(e) => e.stopPropagation()}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
