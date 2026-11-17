import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Bookmark, BookmarkCheck, ChevronDown, FileSearch, Info, MessageCircleQuestion, Sparkles, X, Link2 } from 'lucide-react';
import type { ModelDef, PartDef } from '../../types/scene';
import type { DocumentModel } from '../../types/document';
import type { StudyPlan } from '../../types/plan';
import { resolvePartInfo } from '../../engines/interaction-engine';
import { AfirmacionView, OrigenLegend } from '../../components/AfirmacionView';
import { Highlight } from '../../components/Highlight';
import { ReferenceCard } from '../../components/ReferenceCard';
import { Button, IconButton, Spinner, cx } from '../../components/ui';
import { useSession } from '../../stores/session';
import { useAI } from '../../stores/ai';
import { useUI } from '../../stores/ui';
import { useDocRefs } from '../../hooks/useDocRefs';
import { goToConcept } from '../visual-engine/ConceptSearch';
import { partKey } from './partKey';

function Section({ title, children, defaultOpen = true, badge }: { title: string; children: React.ReactNode; defaultOpen?: boolean; badge?: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-t border-white/6 py-3 first:border-t-0">
      <button className="flex w-full items-center justify-between gap-2 text-left" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <h4 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-mist-300">
          {title} {badge}
        </h4>
        <ChevronDown className={cx('size-4 text-mist-400 transition', open && 'rotate-180')} />
      </button>
      {open && <div className="mt-2.5 space-y-3">{children}</div>}
    </section>
  );
}

export function InfoPanel({ part, model, plan, doc, onClose }: { part: PartDef; model: ModelDef; plan: StudyPlan; doc: DocumentModel; onClose(): void }) {
  const info = useMemo(() => resolvePartInfo(part, model, plan, doc), [part, model, plan, doc]);
  const docId = useSession((s) => s.activeDocId)!;
  const temaId = useSession((s) => s.activeTemaId);
  const escenaId = useSession((s) => s.activeEscenaId);
  const key = partKey(part, model);
  const marcado = useSession((s) => s.marcadores.some((m) => m.docId === docId && m.key === key));
  const aiOn = useAI((s) => s.status === 'conectado');
  const fichaKey = `${docId}:${model.id}:${part.id}`;
  const fichaIA = useAI((s) => s.fichas[fichaKey]);
  const { openRef } = useDocRefs();
  const isStructure = !part.ref || part.ref.type === 'estructura';
  const wikiTitle = isStructure && part.wiki !== null ? (part.wiki ?? part.nombre.replace(/\s*\(.*?\)\s*/g, ' ').trim()) : undefined;

  const scope = { tipo: 'pieza' as const, titulo: info.titulo, temaId: temaId === '__doc__' ? undefined : temaId, conceptoId: info.concepto?.id, nombres: info.nombres };

  const pedirFicha = async () => {
    const ai = useAI.getState();
    if (!ai.claude) return;
    ai.setFichas(fichaKey, { loading: true });
    try {
      const fichas = await ai.claude.explain(doc, plan, info.nombres, `la visualización «${model.titulo}»`);
      useAI.getState().setFichas(fichaKey, { loading: false, fichas });
    } catch (e) {
      useAI.getState().setFichas(fichaKey, { loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <motion.aside
      key={part.id}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      className="glass pointer-events-auto flex max-h-full w-full flex-col overflow-hidden rounded-3xl shadow-2xl lg:w-[400px]"
      aria-label={`Información de ${info.titulo}`}
    >
      <header className="flex items-start gap-3 border-b border-white/6 p-5 pb-4">
        <span className="mt-1.5 size-3 shrink-0 rounded-full shadow-[0_0_14px_currentColor]" style={{ background: part.color, color: part.color }} aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl leading-tight text-white">{info.titulo}</h3>
          {info.subtitulo && <p className="mt-1 text-[12px] text-mist-400">{info.subtitulo}</p>}
        </div>
        <IconButton label={marcado ? 'Quitar marcador' : 'Marcar como importante'} active={marcado} onClick={() => useSession.getState().toggleMarcador({ docId, key, titulo: info.titulo, temaId, escenaId, partId: part.id })}>
          {marcado ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
        </IconButton>
        <IconButton label="Cerrar panel" onClick={onClose}>
          <X className="size-4" />
        </IconButton>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {wikiTitle && (
          <Section title="Cómo es en realidad">
            <ReferenceCard title={wikiTitle} />
          </Section>
        )}
        {info.definiciones.length > 0 && (
          <Section title={info.concepto ? 'Descripción' : part.ref?.type === 'columna' ? 'Contenido' : 'Según el documento'}>
            {info.definiciones.map((a, i) => (
              <AfirmacionView key={i} a={a} />
            ))}
          </Section>
        )}

        {info.fichas.map((f, i) => (
          <Section key={`f${i}`} title={f.titulo}>
            {f.afirmaciones.map((a, j) => (
              <AfirmacionView key={j} a={a} compact />
            ))}
          </Section>
        ))}

        {fichaIA?.fichas?.map((f, i) => (
          <Section key={`ia${i}`} title={f.titulo} badge={<Sparkles className="size-3 text-purple-300" aria-label="Elaborado con IA" />}>
            {f.afirmaciones.map((a, j) => (
              <AfirmacionView key={j} a={a} compact />
            ))}
          </Section>
        ))}

        {info.menciones.length > 0 && (
          <Section title="Aparece en el documento" defaultOpen={info.definiciones.length === 0}>
            {info.menciones.map((b) => (
              <div key={b.id} className="rounded-2xl bg-white/3 p-3">
                <p className="text-[13px] leading-relaxed text-mist-200">
                  <Highlight text={b.text.length > 420 ? b.text.slice(0, 420) + '…' : b.text} plan={plan} onConcept={goToConcept} exclude={info.concepto?.id} />
                </p>
                <button onClick={() => openRef(b.id)} className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-mist-400 hover:text-accent">
                  <FileSearch className="size-3" /> Ver en contexto{b.page ? ` · pág. ${b.page}` : ''}
                </button>
              </div>
            ))}
          </Section>
        )}

        {info.sinMenciones && (
          <div className="mt-3 flex items-start gap-2 rounded-2xl bg-white/4 p-3 text-[13px] text-mist-300">
            <Info className="mt-0.5 size-4 shrink-0 text-mist-400" />
            <p>El documento no menciona esta estructura. Se muestra en el modelo para dar contexto espacial{aiOn ? '; puedes pedir información complementaria a Claude.' : '.'}</p>
          </div>
        )}

        {info.relacionados.length > 0 && (
          <Section title="Relacionado con">
            <div className="flex flex-wrap gap-1.5">
              {info.relacionados.map((r) => (
                <button key={r.concepto.id} onClick={() => goToConcept(r.concepto)} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/4 px-2.5 py-1 text-[12px] text-mist-200 hover:border-accent/40 hover:text-white" title={r.tipo}>
                  <Link2 className="size-3 text-accent" /> {r.concepto.nombre}
                </button>
              ))}
            </div>
          </Section>
        )}

        <div className="mt-4 space-y-2 border-t border-white/6 pt-4">
          {aiOn && !fichaIA?.fichas && (
            <Button variant="outline" className="w-full" loading={fichaIA?.loading} icon={<Sparkles className="size-4 text-purple-300" />} onClick={pedirFicha}>
              {fichaIA?.loading ? 'Claude está elaborando la ficha…' : 'Ficha completa con Claude'}
            </Button>
          )}
          {fichaIA?.error && <p className="text-[12px] text-rose-300">{fichaIA.error}</p>}
          <p className="pt-1 text-[11px] uppercase tracking-[0.12em] text-mist-400">Preguntar sobre «{info.titulo}»</p>
          <div className="flex flex-wrap gap-1.5">
            {['¿Qué es y para qué sirve?', '¿Qué sucede si deja de funcionar correctamente?', '¿Con qué otros elementos se relaciona?'].map((q) => (
              <button key={q} onClick={() => useUI.getState().openTutor(scope, q)} className="rounded-full border border-white/10 px-2.5 py-1 text-left text-[12px] text-mist-300 hover:border-purple-300/40 hover:text-white">
                {q}
              </button>
            ))}
          </div>
          <Button variant="soft" className="w-full" icon={<MessageCircleQuestion className="size-4" />} onClick={() => useUI.getState().openTutor(scope)}>
            Preguntar al tutor
          </Button>
          {!aiOn && (
            <p className="text-[11px] leading-relaxed text-mist-400">
              Sin IA conectada, el tutor responde mostrando los fragmentos del documento más relacionados.{' '}
              <button className="text-accent hover:underline" onClick={() => useUI.getState().set({ aiSettings: true })}>
                Conectar Claude
              </button>
            </p>
          )}
          {fichaIA?.loading && (
            <p className="flex items-center gap-2 text-[12px] text-mist-400">
              <Spinner /> Consultando a Claude…
            </p>
          )}
        </div>
        <div className="mt-4">
          <OrigenLegend />
        </div>
      </div>
    </motion.aside>
  );
}
