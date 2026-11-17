import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Send, Sparkles, Trash2, X, FileSearch, Info } from 'lucide-react';
import { useUI } from '../../stores/ui';
import { useAI, type TutorEntry } from '../../stores/ai';
import { useSession } from '../../stores/session';
import { AfirmacionView } from '../../components/AfirmacionView';
import { Button, IconButton, Spinner, cx } from '../../components/ui';
import type { TutorScope } from '../../services/ai/types';
import { EMPTY_ARR } from '../../utils/empty';

let seq = 0;

export async function askTutor(docId: string, scope: TutorScope, question: string) {
  const S = useSession.getState();
  const doc = S.documents[docId];
  const plan = S.plans[docId];
  if (!doc || !plan) return;
  const ai = useAI.getState();
  const provider = ai.provider();
  const history = (ai.tutor[docId] ?? []).filter((e) => !e.pending && !e.error).map((e) => ({ role: e.role, text: e.role === 'user' ? e.text : (e.answer?.documento.map((a) => a.texto).join(' ') ?? '') }));
  const uid = `t${++seq}`;
  const aid = `t${++seq}`;
  ai.pushTutor(docId, { id: uid, role: 'user', text: question, scope, proveedor: provider.id });
  ai.pushTutor(docId, { id: aid, role: 'assistant', text: '', scope, pending: true, proveedor: provider.id });
  try {
    const answer = await provider.ask(doc, plan, scope, question, history);
    useAI.getState().patchTutor(docId, aid, { pending: false, answer });
  } catch (e) {
    useAI.getState().patchTutor(docId, aid, { pending: false, error: e instanceof Error ? e.message : String(e) });
  }
}

function Answer({ e }: { e: TutorEntry }) {
  if (e.pending)
    return (
      <p className="flex items-center gap-2 text-[13px] text-mist-400">
        <Spinner /> {e.proveedor === 'claude' ? 'Claude está consultando el documento…' : 'Buscando en el documento…'}
      </p>
    );
  if (e.error) return <p className="text-[13px] text-rose-300">{e.error}</p>;
  const a = e.answer!;
  return (
    <div className="space-y-3">
      {a.documento.length > 0 && (
        <div className="space-y-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
            <FileSearch className="size-3.5" /> {e.proveedor === 'claude' ? 'Según el documento' : 'Fragmentos relacionados del documento'}
          </p>
          {a.documento.map((x, i) => (
            <AfirmacionView key={i} a={x} compact />
          ))}
        </div>
      )}
      {a.insuficiente && (
        <p className="flex items-start gap-2 rounded-xl bg-orange-400/10 p-2.5 text-[13px] text-orange-200">
          <Info className="mt-0.5 size-4 shrink-0" /> El documento no contiene información suficiente para responder esta pregunta.
        </p>
      )}
      {a.adicional.length > 0 && (
        <div className="space-y-2.5 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-300">Información adicional (no está en el documento)</p>
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
  const entries = useAI((s) => (docId ? s.tutor[docId] ?? EMPTY_ARR : EMPTY_ARR));
  const aiOn = useAI((s) => s.status === 'conectado');
  const [q, setQ] = useState('');
  const list = useRef<HTMLDivElement>(null);
  const effScope: TutorScope = scope ?? { tipo: 'documento', titulo: plan?.dominio.tema ?? 'Documento' };

  useEffect(() => {
    if (draft) setQ(draft);
  }, [draft, open]);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' });
  }, [entries.length, entries[entries.length - 1]?.pending]);

  const send = () => {
    if (!docId || !q.trim()) return;
    void askTutor(docId, effScope, q.trim());
    setQ('');
    useUI.getState().set({ tutorDraft: undefined });
  };

  const scopes: TutorScope[] = [{ tipo: 'documento', titulo: plan?.dominio.tema ?? 'Documento' }];
  if (scope && scope.tipo !== 'documento') scopes.unshift(scope);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 34 }} className="glass fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-y-0 border-r-0 shadow-2xl" aria-label="Tutor inteligente">
          <header className="flex items-center gap-3 border-b border-white/6 p-4">
            <div className="grid size-9 place-items-center rounded-xl bg-purple-400/15 text-purple-300">
              <Bot className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-[15px] text-white">Tutor</h2>
              <p className="truncate text-[12px] text-mist-400">{aiOn ? 'Claude · responde basándose en tu documento' : 'Modo local · muestra fragmentos del documento'}</p>
            </div>
            {docId && entries.length > 0 && (
              <IconButton label="Borrar conversación" onClick={() => useAI.getState().clearTutor(docId)}>
                <Trash2 className="size-4" />
              </IconButton>
            )}
            <IconButton label="Cerrar tutor" onClick={() => useUI.getState().set({ tutorOpen: false })}>
              <X className="size-4" />
            </IconButton>
          </header>

          <div ref={list} className="flex-1 space-y-4 overflow-y-auto p-4">
            {!docId && <p className="text-sm text-mist-400">Abre un material para hacer preguntas.</p>}
            {docId && entries.length === 0 && (
              <div className="space-y-3 text-[13px] text-mist-300">
                <p>Pregunta sobre el documento completo, un tema, un concepto o la estructura que tengas seleccionada. Las respuestas se basan primero en tu material y separan claramente la información adicional.</p>
                {!aiOn && (
                  <p className="rounded-xl bg-white/4 p-3 text-mist-400">
                    Ahora mismo no hay IA externa: verás los fragmentos del documento que mejor responden a tu pregunta.{' '}
                    <button className="text-accent hover:underline" onClick={() => useUI.getState().set({ aiSettings: true })}>
                      Conectar Claude
                    </button>
                  </p>
                )}
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
              <Button type="submit" variant="primary" disabled={!q.trim() || !docId} className="h-11 w-11 px-0" aria-label="Enviar pregunta">
                {aiOn ? <Sparkles className="size-4" /> : <Send className="size-4" />}
              </Button>
            </form>
          </footer>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
