import { useEffect, useState } from 'react';
import { Brain, BookA, Compass, Layers, ListChecks, NotebookText, Trophy, BookMarked, Target } from 'lucide-react';
import { useUI } from '../stores/ui';
import { Challenge3D } from '../modules/learning/Challenge3D';
import { useSession } from '../stores/session';
import { Tabs, Empty } from '../components/ui';
import { Flashcards } from '../modules/learning/Flashcards';
import { Quiz } from '../modules/learning/Quiz';
import { SmartStudy } from '../modules/smart-study/SmartStudy';
import { Glossary, Guided, SourcesList, Summaries } from '../modules/learning/Reading';

type Tab = 'inteligente' | 'reto' | 'guiado' | 'flashcards' | 'quiz' | 'evaluacion' | 'resumen' | 'glosario';

export function StudyPage() {
  const docId = useSession((s) => s.activeDocId);
  const allMaterials = useSession((s) => s.materials);
  const materials = allMaterials.filter((m) => m.status === 'listo' && m.docId);
  const plan = useSession((s) => (docId ? s.plans[docId] : undefined));
  const doc = useSession((s) => (docId ? s.documents[docId] : undefined));
  const allMarcadores = useSession((s) => s.marcadores);
  const marcadores = allMarcadores.filter((m) => m.docId === docId);
  const [tab, setTab] = useState<Tab>(() => {
    const t = useUI.getState().studyTab as Tab | undefined;
    useUI.getState().set({ studyTab: undefined });
    return t ?? 'inteligente';
  });
  const [retoEscena] = useState(() => {
    const e = useUI.getState().retoEscenaId;
    useUI.getState().set({ retoEscenaId: undefined });
    return e;
  });
  const pedido = useUI((s) => s.studyTab);
  useEffect(() => {
    if (!pedido) return;
    setTab(pedido as Tab);
    useUI.getState().set({ studyTab: undefined });
  }, [pedido]);
  const [temaId, setTemaId] = useState<string>('');
  if (!plan || !doc) return <Empty title="No hay ningún material abierto">Carga un documento en el inicio para generar actividades.</Empty>;
  const roots = plan.temas.filter((t) => t.nivel === 1);
  const scoped = tab === 'flashcards' || tab === 'quiz' || tab === 'evaluacion';
  const S = useSession.getState;
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-mist-400">{plan.dominio.materia}</p>
            <h1 className="font-display text-2xl text-white">{plan.dominio.tema}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {materials.length > 1 && (
              <select value={docId} onChange={(e) => S().openDoc(e.target.value, undefined, 'study')} className="h-9 rounded-xl border border-white/10 bg-ink-850 px-2 text-[13px] text-white" aria-label="Material">
                {materials.map((m) => (
                  <option key={m.id} value={m.docId}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
            {scoped && (
              <select value={temaId} onChange={(e) => setTemaId(e.target.value)} className="h-9 max-w-64 rounded-xl border border-white/10 bg-ink-850 px-2 text-[13px] text-white" aria-label="Tema">
                <option value="">Todo el documento</option>
                {roots.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.titulo}
                  </option>
                ))}
              </select>
            )}
          </div>
        </header>
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          items={[
            { value: 'inteligente', label: 'Estudio inteligente', icon: <Brain className="size-4" /> },
            { value: 'reto', label: 'Reto 3D', icon: <Target className="size-4" /> },
            { value: 'guiado', label: 'Aprendizaje guiado', icon: <Compass className="size-4" /> },
            { value: 'flashcards', label: 'Flashcards', icon: <Layers className="size-4" /> },
            { value: 'quiz', label: 'Cuestionario', icon: <ListChecks className="size-4" /> },
            { value: 'evaluacion', label: 'Evaluación', icon: <Trophy className="size-4" /> },
            { value: 'resumen', label: 'Resúmenes', icon: <NotebookText className="size-4" /> },
            { value: 'glosario', label: 'Glosario', icon: <BookA className="size-4" /> },
          ]}
        />
        <div>
          {tab === 'inteligente' && <SmartStudy key={docId} doc={doc} plan={plan} />}
          {tab === 'reto' && <Challenge3D key={docId} plan={plan} doc={doc} initialEscenaId={retoEscena} />}
          {tab === 'guiado' && (
            <div className="space-y-6">
              <Guided plan={plan} />
              {marcadores.length > 0 && (
                <section className="glass rounded-3xl p-5">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-[15px] text-white">
                    <BookMarked className="size-4 text-amber-300" /> Tus marcadores
                  </h3>
                  <ul className="flex flex-wrap gap-2">
                    {marcadores.map((m) => (
                      <li key={m.key}>
                        <button
                          onClick={() => {
                            S().openDoc(m.docId, m.temaId);
                            if (m.temaId && m.escenaId) S().openTema(m.temaId, m.escenaId);
                            if (m.partId) setTimeout(() => S().select(m.partId, m.key), 40);
                          }}
                          className="rounded-full border border-amber-300/25 bg-amber-300/8 px-3 py-1 text-[12px] text-amber-100 hover:border-amber-300/50"
                        >
                          {m.titulo}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <SourcesList plan={plan} />
            </div>
          )}
          {tab === 'flashcards' && <Flashcards key={`${docId}-${temaId}`} plan={plan} doc={doc} temaId={temaId || undefined} />}
          {tab === 'quiz' && <Quiz key={`q-${docId}-${temaId}`} plan={plan} doc={doc} temaId={temaId || undefined} mode="practica" />}
          {tab === 'evaluacion' && <Quiz key={`e-${docId}-${temaId}`} plan={plan} doc={doc} temaId={temaId || undefined} mode="evaluacion" />}
          {tab === 'resumen' && <Summaries plan={plan} doc={doc} />}
          {tab === 'glosario' && <Glossary plan={plan} />}
        </div>
      </div>
    </div>
  );
}
