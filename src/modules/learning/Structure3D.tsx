import { lazy, Suspense, useMemo } from 'react';
import { Box, ExternalLink } from 'lucide-react';
import type { DocumentModel } from '../../types/document';
import type { Concepto, StudyPlan } from '../../types/plan';
import { findStructure } from '../../engines/interaction-engine/structures';
import { useSession } from '../../stores/session';
import { goToConcept } from '../visual-engine/ConceptSearch';
import { Spinner } from '../../components/ui';

const Viewer3D = lazy(() => import('../3d-viewer/Viewer3D').then((m) => ({ default: m.Viewer3D })));

/** ¿Existe una estructura 3D para este concepto? */
export function useStructure(conceptoId: string | undefined, plan: StudyPlan, doc: DocumentModel) {
  return useMemo(() => {
    const c = conceptoId ? plan.conceptos.find((x) => x.id === conceptoId) : undefined;
    return c ? { concepto: c, hit: findStructure(c, plan, doc) } : undefined;
  }, [conceptoId, plan, doc]);
}

/** Abre el concepto en el Explorador 3D. */
export function openIn3D(c: Concepto, plan: StudyPlan) {
  useSession.getState().openDoc(plan.documentId);
  setTimeout(() => goToConcept(c), 40);
}

/** Vista 3D compacta con la estructura resaltada (flashcards, respuestas). */
export function Structure3D({ conceptoId, plan, doc, height = 'h-60' }: { conceptoId?: string; plan: StudyPlan; doc: DocumentModel; height?: string }) {
  const s = useStructure(conceptoId, plan, doc);
  if (!s?.hit) return null;
  const { hit, concepto } = s;
  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-ink-950/50">
      <div className={`relative ${height}`}>
        <Suspense fallback={<div className="grid h-full place-items-center"><Spinner /></div>}>
          <Viewer3D model={hit.model} escenaId={`mini:${hit.escena.id}`} seleccionId={hit.part.id} labels effects={false} onSelect={() => {}} onDeselect={() => {}} />
        </Suspense>
        <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[11px] text-cyan-200">
          <Box className="size-3" /> {hit.part.nombre} · {hit.model.titulo}
        </span>
      </div>
      <button onClick={() => openIn3D(concepto, plan)} className="flex w-full items-center justify-center gap-1.5 border-t border-white/8 py-2 text-[12px] text-accent hover:bg-white/4">
        Explorar en el modelo completo <ExternalLink className="size-3.5" />
      </button>
    </div>
  );
}
