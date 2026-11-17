import { useMemo, useState } from 'react';
import { BookOpenText, Compass, ArrowRight, Sparkles, Search } from 'lucide-react';
import type { DocumentModel } from '../../types/document';
import type { Afirmacion, StudyPlan } from '../../types/plan';
import { buildGuidedRoute, summarizeLocal } from '../../engines/education-engine';
import { AfirmacionView } from '../../components/AfirmacionView';
import { Button, Empty, Spinner, cx } from '../../components/ui';
import { useAI } from '../../stores/ai';
import { useSession } from '../../stores/session';
import { normalize } from '../../utils/normalize';
import { goToConcept } from '../visual-engine/ConceptSearch';
import { EMPTY_OBJ } from '../../utils/empty';

export function Summaries({ plan, doc }: { plan: StudyPlan; doc: DocumentModel }) {
  const aiOn = useAI((s) => s.status === 'conectado');
  const [ai, setAi] = useState<Record<string, { loading?: boolean; puntos?: Afirmacion[]; error?: string }>>({});
  const roots = plan.temas.filter((t) => t.nivel === 1);
  const local = useMemo(() => Object.fromEntries(roots.map((t) => [t.id, summarizeLocal(doc, plan, t.id)])), [doc, plan]); // eslint-disable-line react-hooks/exhaustive-deps
  const pedir = async (temaId: string) => {
    setAi((s) => ({ ...s, [temaId]: { loading: true } }));
    try {
      const puntos = await useAI.getState().claude!.summarize(doc, plan, temaId);
      setAi((s) => ({ ...s, [temaId]: { puntos } }));
    } catch (e) {
      setAi((s) => ({ ...s, [temaId]: { error: e instanceof Error ? e.message : String(e) } }));
    }
  };
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <p className="text-[13px] text-mist-400">Resumen extractivo: oraciones clave tomadas literalmente de cada sección.{aiOn ? ' También puedes pedir a Claude un resumen redactado (marcado como generado por IA).' : ''}</p>
      {roots.map((t) => (
        <article key={t.id} className="glass rounded-3xl p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-[16px] text-white">{t.titulo}</h3>
            {aiOn && !ai[t.id]?.puntos && (
              <Button size="sm" variant="outline" loading={ai[t.id]?.loading} icon={<Sparkles className="size-3.5 text-purple-300" />} onClick={() => pedir(t.id)}>
                Resumen con Claude
              </Button>
            )}
          </div>
          <div className="space-y-3">
            {(ai[t.id]?.puntos ?? local[t.id]).map((a, i) => (
              <AfirmacionView key={i} a={a} compact hideQuote={a.origen === 'documento'} />
            ))}
            {!local[t.id].length && !ai[t.id]?.puntos && <p className="text-[13px] text-mist-400">Esta sección no tiene texto para resumir.</p>}
            {ai[t.id]?.error && <p className="text-[12px] text-rose-300">{ai[t.id]!.error}</p>}
          </div>
        </article>
      ))}
    </div>
  );
}

export function Glossary({ plan }: { plan: StudyPlan }) {
  const [q, setQ] = useState('');
  const items = useMemo(
    () =>
      [...plan.conceptos]
        .filter((c) => c.definicion.length)
        .filter((c) => !q || normalize(c.nombre).includes(normalize(q)))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [plan, q],
  );
  const openDoc = useSession((s) => s.openDoc);
  if (!plan.conceptos.length) return <Empty title="No se identificaron términos">El documento no contiene pares término–definición reconocibles.</Empty>;
  let letter = '';
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mist-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar el glosario…" aria-label="Filtrar el glosario" className="glass h-10 w-full rounded-2xl pl-9 pr-3 text-sm text-white placeholder:text-mist-400 focus:outline-none" />
      </div>
      <p className="text-[12px] text-mist-400">{items.length} términos</p>
      <dl className="space-y-1">
        {items.map((c) => {
          const L = normalize(c.nombre)[0]?.toUpperCase() ?? '';
          const head = L !== letter;
          letter = L;
          return (
            <div key={c.id}>
              {head && <p className="mt-4 font-display text-lg text-accent">{L}</p>}
              <div className="glass rounded-2xl p-4">
                <dt className="flex items-center justify-between gap-2">
                  <span className="font-medium text-white">{c.nombre}</span>
                  <button
                    onClick={() => {
                      openDoc(plan.documentId);
                      setTimeout(() => goToConcept(c), 40);
                    }}
                    className="text-[12px] text-accent hover:underline"
                  >
                    Ver en 3D
                  </button>
                </dt>
                <dd className="mt-2 space-y-2">
                  {c.definicion.slice(0, 2).map((a, i) => (
                    <AfirmacionView key={i} a={a} compact hideQuote />
                  ))}
                </dd>
              </div>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

export function Guided({ plan }: { plan: StudyPlan }) {
  const route = useMemo(() => buildGuidedRoute(plan), [plan]);
  const visitados = useSession((s) => s.temasVisitados[plan.documentId] ?? EMPTY_OBJ) as Record<string, true>;
  const vistos = useSession((s) => s.vistos[plan.documentId] ?? EMPTY_OBJ) as Record<string, true>;
  const openDoc = useSession((s) => s.openDoc);
  const next = route.findIndex((s) => !visitados[s.temaId]);
  if (!route.length) return <Empty title="No hay temas para recorrer" />;
  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-5 flex items-center gap-2 text-[13px] text-mist-400">
        <Compass className="size-4 text-accent" /> Recorre el material en el orden del documento: abre cada tema en el explorador, consulta sus elementos y avanza al siguiente.
      </p>
      <ol className="relative space-y-3 border-l border-white/10 pl-6">
        {route.map((s, i) => {
          const done = visitados[s.temaId];
          const seen = s.conceptoIds.filter((id) => vistos[`c:${id}`]).length;
          return (
            <li key={s.temaId} className="relative">
              <span className={cx('absolute -left-[33px] top-4 grid size-5 place-items-center rounded-full text-[10px] font-bold', done ? 'bg-accent text-ink-950' : i === next ? 'bg-white text-ink-950 ring-4 ring-accent/30' : 'bg-ink-600 text-mist-300')}>{i + 1}</span>
              <div className={cx('glass flex flex-wrap items-center gap-3 rounded-2xl p-4', i === next && 'ring-1 ring-accent/40')}>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] text-white">{s.titulo}</p>
                  <p className="text-[12px] text-mist-400">
                    {s.conceptoIds.length ? `${seen}/${s.conceptoIds.length} conceptos consultados` : 'Sin conceptos identificados'}
                    {done ? ' · visitado' : ''}
                  </p>
                </div>
                <Button size="sm" variant={i === next ? 'primary' : 'soft'} onClick={() => openDoc(plan.documentId, s.temaId)}>
                  {done ? 'Repasar' : i === next ? 'Comenzar' : 'Abrir'} <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function SourcesList({ plan }: { plan: StudyPlan }) {
  if (!plan.fuentes.length) return null;
  return (
    <section className="glass rounded-3xl p-5">
      <h3 className="mb-3 flex items-center gap-2 font-display text-[15px] text-white">
        <BookOpenText className="size-4 text-emerald-300" /> Bibliografía del documento
      </h3>
      <ul className="space-y-2">
        {plan.fuentes.map((f, i) => (
          <li key={i} className="text-[13px] text-mist-300">
            {f.texto}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function LoadingLine({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 text-[13px] text-mist-400">
      <Spinner /> {text}
    </p>
  );
}
