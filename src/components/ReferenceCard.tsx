import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ExternalLink, Globe2, ImageOff, X, ZoomIn } from 'lucide-react';
import { wikiSummary, type WikiSummary } from '../services/visualization/wikipedia';
import { Spinner, cx } from './ui';

/** Imagen de referencia real y resumen de Wikipedia, marcados como información complementaria. */
export function ReferenceCard({ title, compact, showExtract = true }: { title: string; compact?: boolean; showExtract?: boolean }) {
  const [state, setState] = useState<{ loading: boolean; data?: WikiSummary | null }>({ loading: true });
  const [zoom, setZoom] = useState(false);
  const [imgError, setImgError] = useState(false);
  useEffect(() => {
    let alive = true;
    setState({ loading: true });
    setImgError(false);
    wikiSummary(title).then((data) => alive && setState({ loading: false, data }));
    return () => {
      alive = false;
    };
  }, [title]);

  if (state.loading)
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-white/3 p-3 text-[12px] text-mist-400">
        <Spinner className="size-3.5" /> Buscando imagen de referencia…
      </div>
    );
  const d = state.data;
  if (!d)
    return (
      <p className="flex items-center gap-2 text-[11px] text-mist-400">
        <ImageOff className="size-3.5" /> No hay imagen de referencia disponible (sin conexión o sin artículo).
      </p>
    );
  return (
    <div className="overflow-hidden rounded-2xl border border-amber-400/15 bg-amber-400/[0.03]">
      {d.imagen && !imgError && (
        <button onClick={() => setZoom(true)} className="group relative block w-full bg-white" aria-label={`Ampliar imagen de referencia: ${d.titulo}`}>
          <img src={d.imagen} alt={`Ilustración de referencia: ${d.titulo}`} loading="lazy" referrerPolicy="no-referrer" onError={() => setImgError(true)} className={cx('mx-auto w-full object-contain', compact ? 'max-h-40' : 'max-h-56')} />
          <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-lg bg-black/55 text-white opacity-0 transition group-hover:opacity-100">
            <ZoomIn className="size-4" />
          </span>
        </button>
      )}
      <div className="space-y-2 p-3">
        {showExtract && <p className={cx('text-mist-200', compact ? 'line-clamp-3 text-[12px]' : 'line-clamp-5 text-[13px] leading-relaxed')}>{d.extracto}</p>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          <span className="inline-flex items-center gap-1 font-medium text-amber-300">
            <Globe2 className="size-3" /> Complementario · no proviene de tu documento
          </span>
          <a href={d.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-amber-200/80 hover:underline">
            Fuente: Wikipedia, «{d.titulo}» <ExternalLink className="size-3" />
          </a>
        </div>
      </div>
      <AnimatePresence>
        {zoom && d.imagenGrande && (
          <motion.div className="fixed inset-0 z-[80] grid place-items-center bg-black/80 p-6 backdrop-blur" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setZoom(false)}>
            <figure className="max-h-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
              <img src={d.imagenGrande} alt={`Ilustración de referencia: ${d.titulo}`} referrerPolicy="no-referrer" className="max-h-[80vh] rounded-2xl bg-white object-contain" />
              <figcaption className="mt-2 text-center text-[12px] text-mist-300">
                {d.titulo} · Imagen de Wikimedia Commons (consulta su licencia en{' '}
                <a href={d.url} target="_blank" rel="noreferrer noopener" className="text-accent hover:underline">
                  Wikipedia
                </a>
                )
              </figcaption>
            </figure>
            <button className="absolute right-5 top-5 grid size-10 place-items-center rounded-xl bg-white/10 text-white" aria-label="Cerrar">
              <X className="size-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
