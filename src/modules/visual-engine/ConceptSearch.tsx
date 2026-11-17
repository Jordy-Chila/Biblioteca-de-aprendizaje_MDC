import { useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { Concepto, StudyPlan } from '../../types/plan';
import { normalize } from '../../utils/normalize';
import { useSession } from '../../stores/session';
import { rootTopic } from '../../engines/document-engine/analysis/topics';
import { buildScene } from '../../engines/visualization-engine';
import { conceptForPart } from '../../engines/interaction-engine';
import { cx } from '../../components/ui';

/** Busca conceptos por nombre o alias: primero los que empiezan por la consulta. */
export function searchConcepts(plan: StudyPlan, q: string, max = 8): Concepto[] {
  const n = normalize(q);
  if (n.length < 2) return [];
  const scored = plan.conceptos
    .map((c) => {
      const names = [c.nombre, ...c.alias].map(normalize);
      const score = names.some((x) => x.startsWith(n)) ? 0 : names.some((x) => x.includes(n)) ? 1 : c.definicion.some((d) => normalize(d.texto).includes(n)) ? 2 : 9;
      return { c, score };
    })
    .filter((x) => x.score < 9)
    .sort((a, b) => a.score - b.score || a.c.nombre.length - b.c.nombre.length);
  return scored.slice(0, max).map((x) => x.c);
}

/** Abre el concepto en la mejor escena disponible: un modelo 3D con una pieza equivalente o el mapa de conceptos. */
export function goToConcept(c: Concepto) {
  const S = useSession.getState();
  const docId = S.activeDocId;
  if (!docId) return;
  const plan = S.plans[docId];
  const doc = S.documents[docId];
  const root = rootTopic(c.temaId, plan.temas);
  const temaId = root?.id ?? c.temaId;
  const escenas = plan.escenas.filter((e) => e.temaId === temaId);
  // 1) un modelo de dominio con una pieza que corresponda al concepto
  for (const e of escenas.filter((x) => !x.sceneTypeId.startsWith('generico.'))) {
    const model = buildScene(e, plan, doc);
    const part = model?.parts.find((p) => p.selectable !== false && conceptForPart(p, plan)?.id === c.id);
    if (part) {
      S.openTema(temaId, e.id);
      setTimeout(() => useSession.getState().select(part.id, `c:${c.id}`), 30);
      return;
    }
  }
  // 2) mapa de conceptos del tema
  const mapa = escenas.find((x) => x.sceneTypeId === 'generico.mapa-conceptos');
  S.openTema(temaId, mapa?.id);
  if (mapa) setTimeout(() => useSession.getState().select(c.id, `c:${c.id}`), 30);
}

export function ConceptSearch() {
  const docId = useSession((s) => s.activeDocId);
  const plan = useSession((s) => (docId ? s.plans[docId] : undefined));
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState(false);
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const results = useMemo(() => (plan ? searchConcepts(plan, q) : []), [plan, q]);
  const pick = (c: Concepto) => {
    goToConcept(c);
    setQ('');
    ref.current?.blur();
  };
  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mist-400" />
      <input
        ref={ref}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setIdx(0);
        }}
        onFocus={() => setFocus(true)}
        onBlur={() => setTimeout(() => setFocus(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setIdx((i) => Math.min(results.length - 1, i + 1));
          if (e.key === 'ArrowUp') setIdx((i) => Math.max(0, i - 1));
          if (e.key === 'Enter' && results[idx]) pick(results[idx]);
          if (e.key === 'Escape') setQ('');
        }}
        placeholder="Buscar concepto, estructura o término…"
        aria-label="Buscar conceptos"
        role="combobox"
        aria-expanded={focus && results.length > 0}
        className="glass h-10 w-full rounded-2xl pl-9 pr-3 text-sm text-white placeholder:text-mist-400 focus:border-accent/50 focus:outline-none"
      />
      {focus && q.length >= 2 && (
        <ul role="listbox" className="glass absolute left-0 right-0 top-12 z-30 max-h-80 overflow-y-auto rounded-2xl p-1.5 shadow-2xl">
          {results.length === 0 && <li className="px-3 py-2 text-[13px] text-mist-400">Sin coincidencias en el documento.</li>}
          {results.map((c, i) => (
            <li key={c.id} role="option" aria-selected={i === idx}>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => pick(c)} className={cx('w-full rounded-xl px-3 py-2 text-left', i === idx ? 'bg-accent/12' : 'hover:bg-white/5')}>
                <span className="block text-[13px] text-white">{c.nombre}</span>
                <span className="block truncate text-[11px] text-mist-400">{plan?.temas.find((t) => t.id === c.temaId)?.titulo}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
