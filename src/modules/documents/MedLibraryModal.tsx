import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Bookmark, BookmarkCheck, ExternalLink, Library, Search, Stethoscope, X } from 'lucide-react';
import { useUI } from '../../stores/ui';
import { IconButton, Spinner, cx } from '../../components/ui';
import { bibliotecaBase, buscarLocal, buscarMedicina, guardados, guardar, leerArticulo, quitar, secciones, type MedArticle, type MedResult } from '../../services/wiki/medLibrary';

const SUGERENCIAS = ['Corazón', 'Útero', 'Diabetes mellitus', 'Hipertensión arterial', 'Sistema nervioso', 'Neumonía', 'Pelvis', 'Insulina'];

/** Biblioteca de referencia médica (Wikipedia en español) con artículos guardados para uso sin conexión. */
export function MedLibraryModal() {
  const open = useUI((s) => s.medLibrary);
  const close = () => useUI.getState().set({ medLibrary: false });
  const [tab, setTab] = useState<'buscar' | 'base' | 'guardados'>('buscar');
  const [base, setBase] = useState<MedArticle[]>([]);
  const [locales, setLocales] = useState<MedResult[]>([]);
  useEffect(() => {
    if (open) void bibliotecaBase().then(setBase);
  }, [open]);
  const [term, setTerm] = useState('');
  const [solo, setSolo] = useState(true);
  const [res, setRes] = useState<MedResult[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string>();
  const [art, setArt] = useState<MedArticle | null>(null);
  const [saved, setSaved] = useState<MedArticle[]>(() => guardados());

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (art) setArt(null);
      else close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, art]);

  const buscar = async (t = term, s = solo) => {
    if (!t.trim()) return;
    setTerm(t);
    setTab('buscar');
    setArt(null);
    setCargando(true);
    setError(undefined);
    const loc = await buscarLocal(t);
    setLocales(loc);
    try {
      const idsLoc = new Set(loc.map((x) => x.pageid));
      setRes((await buscarMedicina(t, s)).filter((x) => !idsLoc.has(x.pageid)));
    } catch {
      setError(loc.length ? 'Sin conexión: se muestran solo los resultados de tu biblioteca descargada.' : 'Sin conexión y sin resultados en tu biblioteca descargada.');
      setRes([]);
    } finally {
      setCargando(false);
    }
  };

  const abrir = async (pageid: number) => {
    setCargando(true);
    setError(undefined);
    try {
      setArt(await leerArticulo(pageid));
    } catch {
      setError('No se pudo abrir el artículo (sin conexión y no está guardado).');
    } finally {
      setCargando(false);
    }
  };

  const isSaved = art ? saved.some((a) => a.pageid === art.pageid) : false;
  const toggleSave = () => {
    if (!art) return;
    try {
      if (isSaved) quitar(art.pageid);
      else guardar(art);
      setSaved(guardados());
      useUI.getState().notify(isSaved ? 'Quitado de tu biblioteca.' : 'Guardado: disponible sin conexión.');
    } catch (e) {
      useUI.getState().notify((e as Error).message, 'error');
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    buscar();
  };

  const secs = useMemo(() => (art ? secciones(art.texto) : []), [art]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-3 backdrop-blur-sm sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <motion.div role="dialog" aria-modal aria-label="Biblioteca médica" className="glass flex h-[88vh] w-full max-w-4xl flex-col rounded-3xl" initial={{ y: 16 }} animate={{ y: 0 }}>
            <header className="flex items-center gap-3 border-b border-white/6 p-4">
              {art ? (
                <IconButton label="Volver" onClick={() => setArt(null)}>
                  <ArrowLeft className="size-4" />
                </IconButton>
              ) : (
                <Stethoscope className="size-5 text-emerald-300" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[15px] text-white">{art ? art.titulo : 'Biblioteca médica'}</p>
                <p className="truncate text-[12px] text-mist-400">Referencia de apoyo · Wikipedia en español (CC BY-SA)</p>
              </div>
              {art && (
                <>
                  <IconButton label={isSaved ? 'Quitar de guardados' : 'Guardar para leer sin conexión'} active={isSaved} onClick={toggleSave}>
                    {isSaved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
                  </IconButton>
                  <IconButton label="Abrir en Wikipedia" onClick={() => window.open(art.url, '_blank')}>
                    <ExternalLink className="size-4" />
                  </IconButton>
                </>
              )}
              <IconButton label="Cerrar" onClick={close}>
                <X className="size-4" />
              </IconButton>
            </header>

            {!art && (
              <div className="space-y-3 border-b border-white/6 p-4">
                <form onSubmit={onSubmit} className="flex gap-2">
                  <label className="flex h-10 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 focus-within:border-accent/50">
                    <Search className="size-4 text-mist-400" />
                    <input autoFocus value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Busca una enfermedad, órgano, fármaco…" className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-mist-500" />
                  </label>
                  <button type="submit" className="h-10 rounded-xl bg-accent px-4 text-[13px] font-medium text-ink-950">
                    Buscar
                  </button>
                </form>
                <div className="flex flex-wrap items-center gap-2 text-[12px]">
                  <button onClick={() => setTab('buscar')} className={cx('rounded-lg px-2.5 py-1', tab === 'buscar' ? 'bg-white/10 text-white' : 'text-mist-300')}>
                    Buscar
                  </button>
                  <button onClick={() => setTab('base')} className={cx('inline-flex items-center gap-1 rounded-lg px-2.5 py-1', tab === 'base' ? 'bg-white/10 text-white' : 'text-mist-300')}>
                    <Stethoscope className="size-3.5" /> Biblioteca descargada ({base.length})
                  </button>
                  <button onClick={() => setTab('guardados')} className={cx('inline-flex items-center gap-1 rounded-lg px-2.5 py-1', tab === 'guardados' ? 'bg-white/10 text-white' : 'text-mist-300')}>
                    <Library className="size-3.5" /> Mis guardados ({saved.length})
                  </button>
                  <label className="ml-auto inline-flex items-center gap-1.5 text-mist-300">
                    <input
                      type="checkbox"
                      checked={solo}
                      onChange={(e) => {
                        setSolo(e.target.checked);
                        if (res) buscar(term, e.target.checked);
                      }}
                    />
                    Solo temas de medicina
                  </label>
                </div>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {error && <p className="mb-3 rounded-xl bg-rose-400/10 px-3 py-2 text-[13px] text-rose-200">{error}</p>}
              {cargando ? (
                <div className="grid h-40 place-items-center text-mist-400">
                  <Spinner />
                </div>
              ) : art ? (
                <article className="mx-auto max-w-2xl space-y-4 text-[14px] leading-relaxed text-mist-200">
                  {art.imagen && <img src={art.imagen} alt={art.titulo} className="mx-auto max-h-72 rounded-2xl bg-white object-contain" />}
                  {secs.map((s, i) => (
                    <section key={i} className="space-y-2">
                      {s.titulo && <h3 className={cx('font-display text-white', s.nivel <= 2 ? 'pt-2 text-[17px]' : 'text-[15px]')}>{s.titulo}</h3>}
                      {s.parrafos.map((p, k) => (
                        <p key={k}>{p}</p>
                      ))}
                    </section>
                  ))}
                  <p className="border-t border-white/6 pt-3 text-[11px] text-mist-500">Contenido de Wikipedia bajo licencia CC BY-SA 4.0. Material de estudio: no sustituye la consulta con un profesional de la salud.</p>
                </article>
              ) : tab === 'base' ? (
                base.length ? (
                  <List items={base.map((a) => ({ pageid: a.pageid, titulo: a.titulo, extracto: a.texto.slice(0, 180).replace(/\s+/g, ' ') + '…', imagen: a.imagen, medico: true }))} onOpen={abrir} />
                ) : (
                  <p className="py-10 text-center text-[13px] text-mist-400">La biblioteca descargada no está disponible en esta versión.</p>
                )
              ) : tab === 'guardados' ? (
                saved.length ? (
                  <List items={saved.map((a) => ({ pageid: a.pageid, titulo: a.titulo, extracto: a.texto.slice(0, 180) + '…', imagen: a.imagen, medico: true }))} onOpen={abrir} />
                ) : (
                  <p className="py-10 text-center text-[13px] text-mist-400">Aún no guardas artículos. Abre uno y pulsa el marcador para tenerlo sin conexión.</p>
                )
              ) : res ? (
                res.length || locales.length ? (
                  <div className="space-y-4">
                    {locales.length > 0 && (
                      <div>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-300">En tu biblioteca (sin conexión)</p>
                        <List items={locales} onOpen={abrir} />
                      </div>
                    )}
                    {res.length > 0 && (
                      <div>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-mist-400">En Wikipedia (en línea)</p>
                        <List items={res} onOpen={abrir} />
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="py-10 text-center text-[13px] text-mist-400">Sin resultados médicos. Prueba otro término o desmarca «Solo temas de medicina».</p>
                )
              ) : (
                <div className="py-6 text-center">
                  <p className="mb-3 text-[13px] text-mist-400">Consulta artículos de referencia médica como apoyo a tu material.</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {SUGERENCIAS.map((s) => (
                      <button key={s} onClick={() => buscar(s)} className="rounded-full border border-white/10 px-3 py-1 text-[12px] text-mist-200 hover:border-accent/50 hover:text-white">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function List({ items, onOpen }: { items: MedResult[]; onOpen(id: number): void }) {
  return (
    <ul className="space-y-2">
      {items.map((r) => (
        <li key={r.pageid}>
          <button onClick={() => onOpen(r.pageid)} className="flex w-full gap-3 rounded-2xl border border-white/6 p-3 text-left transition hover:border-accent/40 hover:bg-white/5">
            {r.imagen ? (
              <img src={r.imagen} alt="" className="size-14 shrink-0 rounded-xl bg-white object-cover" />
            ) : (
              <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-white/5">
                <Stethoscope className="size-5 text-mist-500" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[14px] text-white">{r.titulo}</p>
              <p className="line-clamp-2 text-[12px] text-mist-400">{r.extracto}</p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
