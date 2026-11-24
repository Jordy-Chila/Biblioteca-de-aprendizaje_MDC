import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Send, Trash2, X, FileSearch, Info, Stethoscope, BookOpen, Microscope, ShieldCheck } from 'lucide-react';
import { useUI } from '../../stores/ui';
import { useAI, type TutorEntry } from '../../stores/ai';
import { useSession } from '../../stores/session';
import { AfirmacionView } from '../../components/AfirmacionView';
import { Button, IconButton, Spinner, cx } from '../../components/ui';
import type { TutorAnswer, TutorScope } from '../../services/ai/types';
import type { Afirmacion } from '../../types/plan';
import { localProvider } from '../../services/ai/localProvider';
import { buscarPasajes } from '../../services/wiki/medLibrary';
import { consultarFuentes, type Articulo, type ConsultaEnLinea } from '../../services/medical/sources';
import { EMPTY_ARR } from '../../utils/empty';

let seq = 0;

/** Clave de conversación cuando no hay ningún material abierto (solo biblioteca). */
export const SIN_DOC = '__biblioteca__';

/**
 * Tutor sin IA.
 * - Con internet: responde con MedlinePlus (explicación), PubMed (investigaciones) y Cochrane (evidencia sobre tratamientos).
 * - Wikipedia / biblioteca descargada: opcional para datos específicos, o como respaldo si no hay conexión o no hay resultados.
 * - Siempre muestra primero lo que dice tu documento, si hay uno abierto.
 */
export async function askTutor(docId: string | undefined, scope: TutorScope, question: string) {
  const S = useSession.getState();
  const doc = docId ? S.documents[docId] : undefined;
  const plan = docId ? S.plans[docId] : undefined;
  const key = docId ?? SIN_DOC;
  const ai = useAI.getState();
  const uid = `t${++seq}`;
  const aid = `t${++seq}`;
  ai.pushTutor(key, { id: uid, role: 'user', text: question, scope, proveedor: 'local' });
  ai.pushTutor(key, { id: aid, role: 'assistant', text: '', scope, pending: true, proveedor: 'local' });
  try {
    const base = doc && plan ? await localProvider.ask(doc, plan, scope, question, []) : { documento: [], adicional: [], insuficiente: false };
    const contexto = `${scope.nombres?.join(' ') ?? ''} ${scope.tipo === 'concepto' || scope.tipo === 'pieza' ? scope.titulo : ''}`.trim();
    const online = navigator.onLine;
    let enLinea: ConsultaEnLinea | undefined;
    if (online) {
      try {
        enLinea = await consultarFuentes(question, contexto);
      } catch {
        enLinea = undefined;
      }
    }
    const sinFuentes = !enLinea || (!enLinea.medline.length && !enLinea.pubmed.length && !enLinea.cochrane.length);
    const usarWiki = useUI.getState().tutorWikipedia || !online || sinFuentes;
    const adicional: Afirmacion[] = [];
    if (usarWiki) {
      const pasajes = await buscarPasajes(`${question} ${contexto}`, 2);
      adicional.push(...pasajes.map((p) => ({ texto: p.texto, origen: 'complementario' as const, fuentes: [{ titulo: `Wikipedia (descargada) · ${p.articulo.titulo}${p.seccion ? ` › ${p.seccion}` : ''}`, url: p.articulo.url }] })));
    }
    const nota = !online
      ? 'Sin conexión: no se pudo consultar MedlinePlus, PubMed ni Cochrane. Se muestra tu documento y la biblioteca descargada.'
      : enLinea?.errores.length
        ? `No respondió: ${enLinea.errores.join(', ')}. Se muestran las demás fuentes.`
        : 'Información educativa: no sustituye la consulta con un profesional de la salud.';
    const answer: TutorAnswer = { documento: base.documento, adicional, enLinea, insuficiente: !base.documento.length && !adicional.length && sinFuentes, nota };
    useAI.getState().patchTutor(key, aid, { pending: false, answer });
  } catch (e) {
    useAI.getState().patchTutor(key, aid, { pending: false, error: e instanceof Error ? e.message : String(e) });
  }
}

function ArticuloView({ a }: { a: Articulo }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <li className="rounded-xl bg-white/4 p-2.5">
      <a href={a.url} target="_blank" rel="noreferrer" className="text-[13px] text-white hover:text-accent hover:underline">
        {a.titulo}
      </a>
      <p className="text-[11px] text-mist-400">
        {a.revista} · {a.anio} · PMID {a.pmid}
      </p>
      {a.resumen && (
        <>
          <button onClick={() => setAbierto(!abierto)} className="mt-1 text-[11px] text-accent hover:underline">
            {abierto ? 'Ocultar resumen' : 'Ver resumen (en inglés)'}
          </button>
          {abierto && <p className="mt-1 text-[12px] leading-relaxed text-mist-300">{a.resumen}</p>}
        </>
      )}
    </li>
  );
}

function FuentesEnLinea({ c }: { c: ConsultaEnLinea }) {
  return (
    <>
      {c.medline.length > 0 && (
        <div className="space-y-2.5 rounded-2xl border border-sky-400/25 bg-sky-400/5 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-300">
            <BookOpen className="size-3.5" /> Para comprender · MedlinePlus
          </p>
          {c.medline.slice(0, 1).map((m) => (
            <div key={m.url} className="space-y-1.5">
              <p className="text-[13px] font-medium text-white">{m.titulo}</p>
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-mist-200">{m.fragmento}</p>
              <a href={m.url} target="_blank" rel="noreferrer" className="inline-block text-[11px] text-sky-300 hover:underline">
                Leer completo en MedlinePlus →
              </a>
            </div>
          ))}
          {c.medline.length > 1 && (
            <p className="text-[11px] text-mist-400">
              También:{' '}
              {c.medline.slice(1).map((m) => (
                <a key={m.url} href={m.url} target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">
                  {m.titulo}
                </a>
              ))}
            </p>
          )}
        </div>
      )}
      {c.pubmed.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-violet-400/25 bg-violet-400/5 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-300">
            <Microscope className="size-3.5" /> Investigaciones que lo respaldan · PubMed
          </p>
          <ul className="space-y-2">
            {c.pubmed.map((a) => (
              <ArticuloView key={a.pmid} a={a} />
            ))}
          </ul>
        </div>
      )}
      {c.cochrane.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-amber-400/25 bg-amber-400/5 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-300">
            <ShieldCheck className="size-3.5" /> Evidencia sobre tratamientos · Cochrane
          </p>
          <ul className="space-y-2">
            {c.cochrane.map((a) => (
              <ArticuloView key={a.pmid} a={a} />
            ))}
          </ul>
        </div>
      )}
      {c.terminoEn && (c.pubmed.length > 0 || c.cochrane.length > 0) && <p className="text-[11px] text-mist-500">Búsqueda científica con el término «{c.terminoEn}».</p>}
    </>
  );
}

function Answer({ e }: { e: TutorEntry }) {
  if (e.pending)
    return (
      <p className="flex items-center gap-2 text-[13px] text-mist-400">
        <Spinner /> Consultando MedlinePlus, PubMed y Cochrane…
      </p>
    );
  if (e.error) return <p className="text-[13px] text-rose-300">{e.error}</p>;
  const a = e.answer!;
  return (
    <div className="space-y-3">
      {a.documento.length > 0 && (
        <div className="space-y-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
            <FileSearch className="size-3.5" /> Según tu documento
          </p>
          {a.documento.map((x, i) => (
            <AfirmacionView key={i} a={x} compact />
          ))}
        </div>
      )}
      {a.enLinea && <FuentesEnLinea c={a.enLinea} />}
      {a.insuficiente && (
        <p className="flex items-start gap-2 rounded-xl bg-orange-400/10 p-2.5 text-[13px] text-orange-200">
          <Info className="mt-0.5 size-4 shrink-0" /> No encontré información sobre esto. Prueba con otras palabras (por ejemplo, el nombre de la enfermedad o del órgano).
        </p>
      )}
      {a.adicional.length > 0 && (
        <div className="space-y-2.5 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
            <Stethoscope className="size-3.5" /> Datos específicos · Wikipedia
          </p>
          {a.adicional.map((x, i) => (
            <AfirmacionView key={i} a={x} compact />
          ))}
        </div>
      )}
      {a.nota && <p className="text-[11px] italic text-mist-400">{a.nota}</p>}
    </div>
  );
}

export function TutorDrawer() {
  const open = useUI((s) => s.tutorOpen);
  const scope = useUI((s) => s.tutorScope);
  const draft = useUI((s) => s.tutorDraft);
  const docId = useSession((s) => s.activeDocId);
  const plan = useSession((s) => (docId ? s.plans[docId] : undefined));
  const key = docId ?? SIN_DOC;
  const entries = useAI((s) => s.tutor[key] ?? EMPTY_ARR);
  const [q, setQ] = useState('');
  const wiki = useUI((s) => s.tutorWikipedia);
  const list = useRef<HTMLDivElement>(null);
  const effScope: TutorScope = scope ?? { tipo: 'documento', titulo: plan?.dominio.tema ?? 'Biblioteca médica' };

  useEffect(() => {
    if (draft) setQ(draft);
  }, [draft, open]);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' });
  }, [entries.length, entries[entries.length - 1]?.pending]);

  const send = () => {
    if (!q.trim()) return;
    void askTutor(docId, effScope, q.trim());
    setQ('');
    useUI.getState().set({ tutorDraft: undefined });
  };

  const scopes: TutorScope[] = [{ tipo: 'documento', titulo: plan?.dominio.tema ?? 'Biblioteca médica' }];
  if (scope && scope.tipo !== 'documento') scopes.unshift(scope);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 34 }} className="glass fixed top-0 right-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-50 flex w-full max-w-md flex-col md:bottom-0 border-y-0 border-r-0 shadow-2xl" aria-label="Tutor inteligente">
          <header className="flex items-center gap-3 border-b border-white/6 p-4">
            <div className="grid size-9 place-items-center rounded-xl bg-purple-400/15 text-purple-300">
              <Bot className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-[15px] text-white">Tutor</h2>
              <p className="truncate text-[12px] text-mist-400">MedlinePlus · PubMed · Cochrane (requiere internet)</p>
            </div>
            {entries.length > 0 && (
              <IconButton label="Borrar conversación" onClick={() => useAI.getState().clearTutor(key)}>
                <Trash2 className="size-4" />
              </IconButton>
            )}
            <IconButton label="Cerrar tutor" onClick={() => useUI.getState().set({ tutorOpen: false })}>
              <X className="size-4" />
            </IconButton>
          </header>

          <div ref={list} className="flex-1 space-y-4 overflow-y-auto p-4">
            {entries.length === 0 && (
              <div className="space-y-3 text-[13px] text-mist-300">
                <p>{docId ? 'Pregunta sobre tu material o sobre cualquier tema de salud.' : 'Pregunta sobre cualquier tema de salud.'} Con internet, el tutor consulta:</p>
                <ul className="space-y-1.5 rounded-xl bg-white/4 p-3 text-[12px]">
                  <li><span className="text-sky-300">MedlinePlus</span>: para aprender y comprender el tema.</li>
                  <li><span className="text-violet-300">PubMed</span>: investigaciones científicas que respaldan la información.</li>
                  <li><span className="text-amber-300">Cochrane</span>: revisiones de evidencia sobre tratamientos.</li>
                </ul>
                <p className="text-[12px] text-mist-400">{docId ? 'Primero verás lo que dice tu documento. ' : ''}Wikipedia es opcional para datos específicos (actívala abajo) y se usa automáticamente si no hay conexión.</p>
              </div>
            )}
            {entries.map((e) =>
              e.role === 'user' ? (
                <div key={e.id} className="ml-8 rounded-2xl rounded-tr-md bg-accent/12 p-3 text-[13px] text-white">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-cyan-300/70">Sobre: {e.scope.titulo}</p>
                  {e.text}
                </div>
              ) : (
                <div key={e.id} className="mr-4 rounded-2xl rounded-tl-md bg-white/4 p-3">
                  <Answer e={e} />
                </div>
              ),
            )}
          </div>

          <footer className="border-t border-white/6 p-3">
            <label className="mb-2 flex items-center gap-2 text-[11px] text-mist-400">
              <input type="checkbox" checked={wiki} onChange={(e) => useUI.getState().set({ tutorWikipedia: e.target.checked })} />
              Incluir Wikipedia (datos específicos)
            </label>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {scopes.map((s, i) => (
                <button key={i} onClick={() => useUI.getState().set({ tutorScope: s })} className={cx('rounded-full border px-2.5 py-1 text-[11px] transition', effScope.titulo === s.titulo && effScope.tipo === s.tipo ? 'border-purple-300/50 bg-purple-400/10 text-purple-200' : 'border-white/10 text-mist-400 hover:text-white')}>
                  {s.tipo === 'documento' ? 'Todo el documento' : s.tipo === 'tema' ? `Tema: ${s.titulo}` : s.titulo}
                </button>
              ))}
            </div>
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <textarea
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={2}
                placeholder="Escribe tu pregunta…"
                aria-label="Pregunta para el tutor"
                className="min-h-[44px] flex-1 resize-none rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2.5 text-sm text-white placeholder:text-mist-400 focus:border-purple-300/50 focus:outline-none"
              />
              <Button type="submit" variant="primary" disabled={!q.trim()} className="h-11 w-11 px-0" aria-label="Enviar pregunta">
                <Send className="size-4" />
              </Button>
            </form>
          </footer>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
