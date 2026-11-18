import { Eye, EyeOff, Focus, Layers, Minus, Pause, Play, Plus, RotateCcw, Rotate3d, SkipBack, SkipForward, Tags, Expand, Camera, Film } from 'lucide-react';
import { useState } from 'react';
import type { ModelDef } from '../../types/scene';
import { useViewer } from '../../stores/viewer';
import { useSession } from '../../stores/session';
import { IconButton, cx } from '../../components/ui';

export function ViewerToolbar({ model, escenaId, onToggleLegend, legendOpen }: { model: ModelDef; escenaId: string; onToggleLegend(): void; legendOpen: boolean }) {
  const view = useViewer((s) => s.views[escenaId]) ?? useViewer.getState().view(escenaId);
  const { etiquetas, autoRotar, animar, zoomPct } = useViewer();
  const V = useViewer.getState;
  const selection = useSession((s) => s.selection);
  const [vistasOpen, setVistasOpen] = useState(false);
  const sel = selection?.escenaId === escenaId ? selection.partId : undefined;
  const hasAnim = model.parts.some((p) => p.anim);

  return (
    <div className="pointer-events-auto flex max-w-full flex-nowrap items-center gap-0.5 rounded-2xl glass p-1 shadow-xl md:flex-wrap md:gap-1 md:p-1.5" role="toolbar" aria-label="Controles del modelo 3D">
      <IconButton label="Capas y componentes" active={legendOpen} onClick={onToggleLegend}>
        <Layers className="size-4" />
      </IconButton>
      <IconButton label={sel ? (view.ocultos.includes(sel) ? 'Mostrar la pieza seleccionada' : 'Ocultar la pieza seleccionada') : 'Selecciona una pieza para ocultarla'} disabled={!sel} onClick={() => sel && V().toggleIn(escenaId, 'ocultos', sel)}>
        {sel && view.ocultos.includes(sel) ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
      </IconButton>
      <IconButton label="Aislar la pieza seleccionada" disabled={!sel} active={view.aislado} onClick={() => V().patch(escenaId, { aislado: !view.aislado })}>
        <Focus className="size-4" />
      </IconButton>
      <div className="flex items-center gap-2 px-2" title="Separar estructuras">
        <Expand className="size-4 text-mist-400" aria-hidden />
        <input type="range" min={0} max={1} step={0.01} value={view.explode} onChange={(e) => V().patch(escenaId, { explode: Number(e.target.value) })} aria-label="Separar estructuras" className="w-16 accent-cyan-400 sm:w-24" />
      </div>
      <span className="mx-1 h-6 w-px bg-white/10" aria-hidden />
      <div className="relative">
        <IconButton label="Cambiar perspectiva" active={vistasOpen} onClick={() => setVistasOpen((v) => !v)}>
          <Camera className="size-4" />
        </IconButton>
        {vistasOpen && (
          <div className="glass absolute bottom-12 left-0 z-20 w-44 rounded-2xl p-1.5 shadow-2xl">
            {[{ nombre: 'Vista inicial', position: model.camera.position }, ...(model.vistas ?? [])].map((v) => (
              <button
                key={v.nombre}
                onClick={() => {
                  V().requestCamera({ escenaId, position: v.position, target: model.camera.target });
                  setVistasOpen(false);
                }}
                className="block w-full rounded-xl px-3 py-1.5 text-left text-[13px] text-mist-200 hover:bg-white/8"
              >
                {v.nombre}
              </button>
            ))}
            {sel && (
              <button onClick={() => (V().requestCamera({ escenaId, focusPartId: sel }), setVistasOpen(false))} className="block w-full rounded-xl px-3 py-1.5 text-left text-[13px] text-accent hover:bg-white/8">
                Enfocar la selección
              </button>
            )}
          </div>
        )}
      </div>
      <span className="hidden md:contents"><IconButton label="Rotación automática" active={autoRotar} onClick={() => V().set({ autoRotar: !autoRotar })}>
        <Rotate3d className="size-4" />
      </IconButton></span>
      <IconButton label="Etiquetas" active={etiquetas} onClick={() => V().set({ etiquetas: !etiquetas })}>
        <Tags className="size-4" />
      </IconButton>
      {hasAnim && (
        <IconButton label={animar ? 'Pausar animación' : 'Reanudar animación'} active={animar} onClick={() => V().set({ animar: !animar })}>
          <Film className="size-4" />
        </IconButton>
      )}
      <IconButton label="Restablecer la vista" onClick={() => (V().reset(escenaId), useSession.getState().select(undefined))}>
        <RotateCcw className="size-4" />
      </IconButton>
      <span className="hidden md:contents"><span className="mx-1 h-6 w-px bg-white/10" aria-hidden />
      <IconButton label="Alejar" onClick={() => V().zoom(1.25)}>
        <Minus className="size-4" />
      </IconButton>
      <span className="w-12 text-center md:inline text-[12px] tabular-nums text-mist-300" aria-live="polite">
        {zoomPct}%
      </span>
      <IconButton label="Acercar" onClick={() => V().zoom(0.8)}>
        <Plus className="size-4" />
      </IconButton></span>
    </div>
  );
}

/** Controles de reproducción de procesos y líneas de tiempo. */
export function StepControls({ model, escenaId }: { model: ModelDef; escenaId: string }) {
  const view = useViewer((s) => s.views[escenaId]) ?? useViewer.getState().view(escenaId);
  const pasos = model.pasos ?? [];
  if (!pasos.length) return null;
  const go = (i: number) => {
    const idx = Math.max(0, Math.min(pasos.length - 1, i));
    useViewer.getState().patch(escenaId, { paso: idx });
    const part = model.parts.find((p) => p.id === pasos[idx]);
    const key = part?.ref?.type === 'paso' ? `p:${part.ref.procesoId}:${part.ref.index}` : part?.ref?.type === 'evento' ? `e:${part.ref.id}` : undefined;
    useSession.getState().select(pasos[idx], key);
    useViewer.getState().requestCamera({ escenaId, focusPartId: pasos[idx] });
  };
  return (
    <div className="pointer-events-auto glass flex items-center gap-1 rounded-2xl p-1.5 shadow-xl" role="group" aria-label="Reproducción paso a paso">
      <IconButton label="Paso anterior" disabled={view.paso <= 0} onClick={() => go(view.paso - 1)}>
        <SkipBack className="size-4" />
      </IconButton>
      <IconButton label={view.reproduciendo ? 'Pausar recorrido' : 'Reproducir recorrido'} active={view.reproduciendo} onClick={() => {
        const play = !view.reproduciendo;
        useViewer.getState().patch(escenaId, { reproduciendo: play });
        if (play && (view.paso < 0 || view.paso >= pasos.length - 1)) go(0);
      }}>
        {view.reproduciendo ? <Pause className="size-4" /> : <Play className="size-4" />}
      </IconButton>
      <IconButton label="Paso siguiente" disabled={view.paso >= pasos.length - 1} onClick={() => go(view.paso + 1)}>
        <SkipForward className="size-4" />
      </IconButton>
      <span className="px-2 text-[12px] tabular-nums text-mist-300">
        {view.paso < 0 ? '—' : view.paso + 1} / {pasos.length}
      </span>
      <div className="hidden gap-1 pr-1 sm:flex">
        {pasos.map((_, i) => (
          <button key={i} aria-label={`Ir al paso ${i + 1}`} onClick={() => go(i)} className={cx('h-1.5 w-4 rounded-full transition', i === view.paso ? 'bg-accent' : i < view.paso ? 'bg-accent/40' : 'bg-white/15')} />
        ))}
      </div>
    </div>
  );
}
