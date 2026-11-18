import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Target, Box, ChevronDown, GitBranch, Info, ListTree, Network, Clock3, Columns3, PanelLeft, MessageCircleQuestion } from 'lucide-react';
import { useSession } from '../stores/session';
import { useViewer } from '../stores/viewer';
import { useUI } from '../stores/ui';
import { buildScene, DOC_TOPIC, getEntry } from '../engines/visualization-engine';
import { subtree } from '../engines/visualization-engine/models/generic';
import { conceptForPart } from '../engines/interaction-engine';
import { Viewer3D } from '../modules/3d-viewer/Viewer3D';
import { ViewerToolbar, StepControls } from '../modules/3d-viewer/ViewerToolbar';
import { LegendPanel } from '../modules/3d-viewer/LegendPanel';
import { InfoPanel } from '../modules/3d-viewer/InfoPanel';
import { partKey } from '../modules/3d-viewer/partKey';
import { TopicNav } from '../modules/visual-engine/TopicNav';
import { ConceptSearch } from '../modules/visual-engine/ConceptSearch';
import { AfirmacionView } from '../components/AfirmacionView';
import { Empty, IconButton, cx } from '../components/ui';
import { BottomSheet } from '../components/BottomSheet';
import { useIsMobile } from '../hooks/useIsMobile';
import type { PartDef } from '../types/scene';

const TIPO_ICON = { modelo: Box, simulacion: Box, capas: Box, proceso: GitBranch, mapa: Network, 'linea-tiempo': Clock3, comparacion: Columns3, jerarquia: ListTree } as const;

export function ExplorerPage() {
  const docId = useSession((s) => s.activeDocId);
  const plan = useSession((s) => (docId ? s.plans[docId] : undefined));
  const doc = useSession((s) => (docId ? s.documents[docId] : undefined));
  const temaId = useSession((s) => s.activeTemaId);
  const escenaId = useSession((s) => s.activeEscenaId);
  const selection = useSession((s) => s.selection);
  const sidebarOpen = useUI((s) => s.sidebarOpen);
  const [legend, setLegend] = useState(false);
  const [resumenOpen, setResumenOpen] = useState(true);
  const [resumenSheet, setResumenSheet] = useState(false);
  const isMobile = useIsMobile();
  // En el teléfono, elegir un tema cierra la hoja de temas
  useEffect(() => {
    if (isMobile) useUI.getState().set({ sidebarOpen: false });
  }, [temaId, escenaId, isMobile]);

  const escenas = useMemo(() => plan?.escenas.filter((e) => e.temaId === temaId) ?? [], [plan, temaId]);
  const escena = escenas.find((e) => e.id === escenaId) ?? escenas[0];
  const model = useMemo(() => (escena && plan && doc ? buildScene(escena, plan, doc) : null), [escena, plan, doc]);
  const selPart = model && selection && selection.escenaId === escena?.id ? model.parts.find((p) => p.id === selection.partId) : undefined;
  // si la vista es un aspecto (subtema), el resumen corresponde a ese subtema
  const subtemaId = typeof escena?.params.subtemaId === 'string' ? (escena.params.subtemaId as string) : undefined;
  const tema = plan?.temas.find((t) => t.id === (subtemaId ?? temaId)) ?? plan?.temas.find((t) => t.id === temaId);
  const view = useViewer((s) => (escena ? s.views[escena.id] : undefined));

  // Reproducción automática de procesos / líneas de tiempo
  useEffect(() => {
    if (!escena || !model?.pasos?.length || !view?.reproduciendo) return;
    const t = setInterval(() => {
      const v = useViewer.getState().view(escena.id);
      const next = v.paso + 1;
      if (next >= model.pasos!.length) {
        useViewer.getState().patch(escena.id, { reproduciendo: false });
        return;
      }
      useViewer.getState().patch(escena.id, { paso: next });
      const part = model.parts.find((p) => p.id === model.pasos![next]);
      if (part) useSession.getState().select(part.id, partKey(part, model));
      useViewer.getState().requestCamera({ escenaId: escena.id, focusPartId: model.pasos![next] });
    }, 2800);
    return () => clearInterval(t);
  }, [escena, model, view?.reproduciendo]);

  // Esc cierra el panel
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && useSession.getState().select(undefined);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  if (!plan || !doc) return <Empty title="No hay ningún material abierto">Carga un documento en el inicio para explorarlo.</Empty>;

  const onSelect = (p: PartDef) => {
    if (!model) return;
    const c = !p.ref || p.ref.type === 'estructura' ? conceptForPart(p, plan) : undefined;
    useSession.getState().select(p.id, partKey(p, model));
    if (c) useSession.getState().markSeen(`c:${c.id}`);
  };

  const temaIds = temaId && temaId !== DOC_TOPIC ? subtree(temaId, plan.temas) : null;
  const resumenIds = new Set(tema?.resumen.map((r) => r.blockId));
  const vistas = new Set<string>();
  // alertas del tema sin repetir el resumen ni entre sí
  const alertas = (temaIds ? plan.alertas.filter((a) => plan.temas.some((t) => temaIds.has(t.id) && a.blockId && t.blockIds.includes(a.blockId))) : []).filter((a) => !resumenIds.has(a.blockId) && !vistas.has(a.texto) && Boolean(vistas.add(a.texto)));
  const dim = Boolean(selPart);

  return (
    <div className="relative flex h-full min-h-0">
      {/* Barra lateral de temas */}
      {isMobile ? (
        <BottomSheet open={sidebarOpen} onClose={() => useUI.getState().set({ sidebarOpen: false })} title="Temas del documento" height="80dvh">
          <div className="h-[68dvh]">
            <TopicNav />
          </div>
        </BottomSheet>
      ) : (
        <aside data-dim={dim} className={cx('focus-dim glass z-30 w-72 shrink-0 flex-col border-y-0 border-l-0 p-4', 'absolute inset-y-0 left-0 lg:static lg:flex', sidebarOpen ? 'flex' : 'hidden')}>
          <TopicNav />
        </aside>
      )}

      <section className="relative min-w-0 flex-1">
        {/* Lienzo 3D */}
        <div className="absolute inset-0">
          {model && escena ? (
            <Viewer3D model={model} escenaId={escena.id} seleccionId={selPart?.id} onSelect={onSelect} onDeselect={() => useSession.getState().select(undefined)} />
          ) : (
            <div className="grid-bg grid h-full place-items-center">
              <Empty icon={<Info className="size-6" />} title="Este tema no tiene una representación visual">
                No se identificaron estructuras, procesos ni conceptos suficientes para visualizarlo sin inventar contenido. Consulta su resumen o pregunta al tutor.
              </Empty>
            </div>
          )}
          {/* viñeta y foco */}
          <div className={cx('pointer-events-none absolute inset-0 transition-opacity duration-500', dim ? 'opacity-100' : 'opacity-0')} style={{ background: 'radial-gradient(ellipse at 45% 50%, transparent 35%, rgba(3,6,10,0.75) 100%)' }} />
        </div>

        {/* Cabecera: búsqueda y escenas */}
        <div data-dim={dim} className="focus-dim pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3 md:gap-3 md:p-4">
          {isMobile && (
            <div className="pointer-events-auto flex items-center gap-2">
              <button onClick={() => useUI.getState().set({ sidebarOpen: true })} className="glass flex h-10 min-w-0 flex-1 items-center gap-2 rounded-2xl px-3 text-left">
                <ListTree className="size-4 shrink-0 text-accent" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-white">{tema?.titulo ?? plan.dominio.tema}</span>
                <ChevronDown className="size-4 shrink-0 text-mist-400" />
              </button>
              {tema && (
                <IconButton label="Resumen del tema" className="glass size-10 rounded-2xl" onClick={() => setResumenSheet(true)}>
                  <Info className="size-4" />
                </IconButton>
              )}
            </div>
          )}
          <div className="pointer-events-auto flex items-center gap-2">
            {!isMobile && (
              <IconButton label="Temas" className="glass lg:hidden" onClick={() => useUI.getState().set({ sidebarOpen: !sidebarOpen })}>
                <PanelLeft className="size-4" />
              </IconButton>
            )}
            <ConceptSearch />
            {escena && !escena.sceneTypeId.startsWith('generico.') && (
              <button onClick={() => (useUI.getState().set({ studyTab: 'reto', retoEscenaId: escena.id }), useSession.getState().goto('study'))} className="glass inline-flex h-10 shrink-0 items-center gap-2 rounded-2xl px-3 text-[13px] text-mist-200 hover:text-white" title="Reto 3D: toca la estructura que se nombra">
                <Target className="size-4 text-amber-300" /> <span className="hidden sm:inline">Ponte a prueba</span>
              </button>
            )}
            <button onClick={() => useUI.getState().openTutor({ tipo: temaId && temaId !== DOC_TOPIC ? 'tema' : 'documento', titulo: tema?.titulo ?? plan.dominio.tema, temaId: temaId !== DOC_TOPIC ? temaId : undefined })} className="glass hidden h-10 items-center gap-2 rounded-2xl px-3 text-[13px] text-mist-200 hover:text-white sm:inline-flex">
              <MessageCircleQuestion className="size-4 text-purple-300" /> Tutor
            </button>
          </div>
          {escenas.length > 0 && (
            <div className="pointer-events-auto flex max-w-full gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Visualizaciones del tema">
              {escenas.map((e) => {
                const Icon = TIPO_ICON[getEntry(e.sceneTypeId)?.tipo ?? 'mapa'];
                const on = e.id === escena?.id;
                return (
                  <button key={e.id} role="tab" aria-selected={on} onClick={() => useSession.getState().openEscena(e.id)} className={cx('glass inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-1.5 text-[12px] transition', on ? 'border-accent/50 text-white shadow-[0_0_20px_-6px_rgba(34,211,238,0.6)]' : 'text-mist-300 hover:text-white')}>
                    <Icon className={cx('size-3.5', on ? 'text-accent' : 'text-mist-400')} />
                    {e.titulo}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Resumen del tema y alertas */}
        {tema && !selPart && (
          <div className="pointer-events-none absolute left-4 top-[7.5rem] z-10 hidden w-80 md:block">
            <div className="glass pointer-events-auto rounded-2xl p-4">
              <button className="flex w-full items-center justify-between text-left" onClick={() => setResumenOpen((o) => !o)} aria-expanded={resumenOpen}>
                <span className="font-display text-[14px] text-white">{tema.titulo}</span>
                <ChevronDown className={cx('size-4 text-mist-400 transition', resumenOpen && 'rotate-180')} />
              </button>
              {resumenOpen && (
                <div className="mt-2 max-h-[calc(100vh-17rem)] space-y-2 overflow-y-auto pr-1">
                  {tema.resumen.map((a, i) => (
                    <AfirmacionView key={i} a={a} compact hideQuote />
                  ))}
                  {alertas.slice(0, 3).map((a, i) => (
                    <div key={`al${i}`} className="rounded-xl border border-orange-400/25 bg-orange-400/8 p-2.5">
                      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-orange-300">
                        <AlertTriangle className="size-3.5" /> Atención
                      </p>
                      <AfirmacionView a={a} compact hideQuote />
                    </div>
                  ))}
                  {model && <p className="text-[11px] italic text-mist-400">{model.nota}</p>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Leyenda */}
        {isMobile ? (
          <BottomSheet open={legend && Boolean(model && escena)} onClose={() => setLegend(false)} title="Capas y componentes" height="65dvh" backdrop={false}>
            {model && escena && <LegendPanel model={model} escenaId={escena.id} onClose={() => setLegend(false)} embedded />}
          </BottomSheet>
        ) : (
          <div className="pointer-events-none absolute bottom-20 left-4 z-20">
            <AnimatePresence>{legend && model && escena && <LegendPanel model={model} escenaId={escena.id} onClose={() => setLegend(false)} />}</AnimatePresence>
          </div>
        )}

        {/* Controles inferiores (en el teléfono se ocultan mientras la ficha está abierta) */}
        {model && escena && !(isMobile && selPart) && (
          <div data-dim={false} className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 p-2 md:p-4">
            {isMobile && !view?.reproduciendo && <p className="pointer-events-none rounded-full bg-black/40 px-3 py-1 text-[11px] text-mist-300">Toca una estructura · arrastra para girar · pellizca para acercar</p>}
            <StepControls model={model} escenaId={escena.id} />
            <ViewerToolbar model={model} escenaId={escena.id} legendOpen={legend} onToggleLegend={() => setLegend((l) => !l)} />
          </div>
        )}

        {/* Panel de información: lateral en escritorio, hoja inferior en el teléfono */}
        <div className={cx('pointer-events-none absolute z-30 flex', isMobile ? 'inset-x-0 bottom-0 top-[42%] items-end' : 'inset-x-2 bottom-[9.5rem] top-[34%] justify-end lg:inset-x-auto lg:right-4 lg:top-4 lg:bottom-4')}>
          <AnimatePresence mode="wait">{selPart && model && <InfoPanel key={selPart.id} part={selPart} model={model} plan={plan} doc={doc} sheet={isMobile} onClose={() => useSession.getState().select(undefined)} />}</AnimatePresence>
        </div>

        {/* Resumen del tema en el teléfono */}
        {isMobile && tema && (
          <BottomSheet open={resumenSheet} onClose={() => setResumenSheet(false)} title={tema.titulo} height="70dvh">
            <div className="space-y-3">
              {tema.resumen.map((a, i) => (
                <AfirmacionView key={i} a={a} compact hideQuote />
              ))}
              {alertas.slice(0, 3).map((a, i) => (
                <div key={`al${i}`} className="rounded-xl border border-orange-400/25 bg-orange-400/8 p-2.5">
                  <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-orange-300">
                    <AlertTriangle className="size-3.5" /> Atención
                  </p>
                  <AfirmacionView a={a} compact hideQuote />
                </div>
              ))}
              {model && <p className="text-[11px] italic text-mist-400">{model.nota}</p>}
            </div>
          </BottomSheet>
        )}
        {!selPart && model && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pointer-events-none absolute right-5 top-[7.5rem] z-10 hidden max-w-[220px] text-right text-[12px] text-mist-400 lg:block">
            Haz clic en un elemento para ver su información. Arrastra para rotar, rueda para acercar, clic derecho para desplazar.
          </motion.p>
        )}
      </section>
    </div>
  );
}
