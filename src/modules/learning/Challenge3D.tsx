import { lazy, Suspense, useMemo, useState } from 'react';
import { CheckCircle2, CircleX, Expand, Lightbulb, RefreshCcw, RotateCcw, SkipForward, Target, Trophy } from 'lucide-react';
import type { DocumentModel } from '../../types/document';
import type { StudyPlan } from '../../types/plan';
import type { PartDef } from '../../types/scene';
import { challengeModels } from '../../engines/interaction-engine/structures';
import { resolvePartInfo } from '../../engines/interaction-engine';
import { rng } from '../../engines/education-engine';
import { AfirmacionView } from '../../components/AfirmacionView';
import { Badge, Button, Empty, Progress, Spinner, cx } from '../../components/ui';
import { useViewer } from '../../stores/viewer';

const Viewer3D = lazy(() => import('../3d-viewer/Viewer3D').then((m) => ({ default: m.Viewer3D })));

type Estado = { fase: 'pregunta' } | { fase: 'acierto'; tocada: string } | { fase: 'fallo'; tocada: string; mostrar: boolean };

/** Reto 3D: se nombra una estructura y el estudiante debe tocarla en el modelo (sin etiquetas). */
export function Challenge3D({ plan, doc, initialEscenaId }: { plan: StudyPlan; doc: DocumentModel; initialEscenaId?: string }) {
  const modelos = useMemo(() => challengeModels(plan, doc), [plan, doc]);
  const [sel, setSel] = useState(() => Math.max(0, modelos.findIndex((m) => m.escena.id === initialEscenaId)));
  const [seed, setSeed] = useState(1);
  const cm = modelos[sel];
  // Preguntas: primero las estructuras que el documento menciona, en orden aleatorio
  const preguntas = useMemo(() => {
    if (!cm) return [];
    const r = rng(seed * 97 + sel);
    const conInfo = (p: PartDef) => !resolvePartInfo(p, cm.model, plan, doc).sinMenciones;
    const shuffle = <T,>(a: T[]) => a.map((x) => [r(), x] as const).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    return [...shuffle(cm.parts.filter(conInfo)), ...shuffle(cm.parts.filter((p) => !conInfo(p)))].slice(0, 8);
  }, [cm, seed, sel, plan, doc]);
  const [i, setI] = useState(0);
  const [aciertos, setAciertos] = useState(0);
  const [pista, setPista] = useState(false);
  const [estado, setEstado] = useState<Estado>({ fase: 'pregunta' });
  const escenaKey = cm ? `reto:${cm.escena.id}` : '';

  if (!modelos.length) return <Empty icon={<Target className="size-6" />} title="Este documento no tiene modelos 3D para el reto">El reto necesita un modelo con estructuras (por ejemplo, anatomía, célula, corazón o pelvis).</Empty>;

  const objetivo = preguntas[i];
  const terminado = i >= preguntas.length;
  const info = objetivo ? resolvePartInfo(objetivo, cm.model, plan, doc) : undefined;

  const reiniciar = (nuevoSel = sel) => {
    setSel(nuevoSel);
    setSeed((s) => s + 1);
    setI(0);
    setAciertos(0);
    setPista(false);
    setEstado({ fase: 'pregunta' });
    useViewer.getState().reset(`reto:${modelos[nuevoSel].escena.id}`);
  };
  const siguiente = () => {
    setI((x) => x + 1);
    setPista(false);
    setEstado({ fase: 'pregunta' });
  };
  const tocar = (p: PartDef) => {
    if (!objetivo || estado.fase !== 'pregunta') return;
    if (p.nombre === objetivo.nombre) {
      setAciertos((a) => a + (pista ? 0.5 : 1));
      setEstado({ fase: 'acierto', tocada: p.id });
    } else {
      setEstado({ fase: 'fallo', tocada: p.id, mostrar: false });
      setTimeout(() => setEstado((e) => (e.fase === 'fallo' ? { ...e, mostrar: true } : e)), 900);
    }
  };

  const seleccion = estado.fase === 'acierto' ? estado.tocada : estado.fase === 'fallo' ? (estado.mostrar ? objetivo?.id : estado.tocada) : pista ? objetivo?.id : undefined;
  const color = estado.fase === 'acierto' || (estado.fase === 'fallo' && estado.mostrar) ? '#4ade80' : estado.fase === 'fallo' ? '#f87171' : '#facc15';

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {modelos.map((m, k) => (
          <button key={m.escena.id} onClick={() => reiniciar(k)} className={cx('rounded-full border px-3 py-1.5 text-[12px] transition', k === sel ? 'border-accent/60 bg-accent/12 text-white' : 'border-white/10 text-mist-300 hover:text-white')}>
            {m.model.titulo}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="glass relative h-[52dvh] min-h-[320px] overflow-hidden rounded-3xl lg:h-[64vh]">
          <Suspense fallback={<div className="grid h-full place-items-center"><Spinner /></div>}>
            <Viewer3D model={cm.model} escenaId={escenaKey} seleccionId={seleccion} labels={false} highlight={color} effects onSelect={tocar} onDeselect={() => {}} />
          </Suspense>
          <MiniControles escenaKey={escenaKey} />
          {!terminado && objetivo && (
            <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
              <div className={cx('glass rounded-2xl px-4 py-2 text-center shadow-xl', estado.fase === 'acierto' && 'ring-1 ring-emerald-400/60', estado.fase === 'fallo' && 'ring-1 ring-rose-400/60')}>
                <p className="text-[11px] uppercase tracking-[0.14em] text-mist-400">Toca en el modelo</p>
                <p className="font-display text-lg text-white">{objetivo.nombre}</p>
              </div>
            </div>
          )}
        </div>

        <aside className="glass flex flex-col gap-4 rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <Badge tone="accent">
              <Target className="size-3" /> Reto 3D
            </Badge>
            <span className="text-[13px] tabular-nums text-mist-300">
              {Math.min(i + 1, preguntas.length)}/{preguntas.length} · {aciertos} pts
            </span>
          </div>
          <Progress value={Math.min(1, i / Math.max(1, preguntas.length))} />

          {terminado ? (
            <div className="space-y-3 text-center">
              <Trophy className="mx-auto size-10 text-amber-300" />
              <p className="font-display text-2xl text-white">
                {aciertos} / {preguntas.length}
              </p>
              <p className="text-[13px] text-mist-400">{aciertos >= preguntas.length * 0.8 ? '¡Excelente! Ubicas muy bien las estructuras.' : aciertos >= preguntas.length * 0.5 ? 'Buen trabajo. Repite el reto para afianzar las que fallaste.' : 'Sigue practicando: explora el modelo en el Explorador 3D y vuelve a intentarlo.'}</p>
              <Button variant="primary" icon={<RefreshCcw className="size-4" />} onClick={() => reiniciar()} className="w-full">
                Repetir con otro orden
              </Button>
            </div>
          ) : estado.fase === 'pregunta' ? (
            <div className="space-y-3">
              <p className="text-[13px] leading-relaxed text-mist-300">Gira el modelo, sepáralo con el control inferior o acércate, y toca la estructura <strong className="text-white">{objetivo?.nombre}</strong>.</p>
              {pista && info?.definiciones[0] && (
                <div className="rounded-2xl bg-amber-400/8 p-3">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-300">Pista (vale medio punto)</p>
                  <AfirmacionView a={info.definiciones[0]} compact hideQuote />
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="soft" icon={<Lightbulb className="size-4" />} disabled={pista} onClick={() => setPista(true)} className="flex-1">
                  Pista
                </Button>
                <Button variant="ghost" icon={<SkipForward className="size-4" />} onClick={siguiente} className="flex-1">
                  Saltar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className={cx('flex items-center gap-2 text-[15px] font-semibold', estado.fase === 'acierto' ? 'text-emerald-300' : 'text-rose-300')}>
                {estado.fase === 'acierto' ? <CheckCircle2 className="size-5" /> : <CircleX className="size-5" />}
                {estado.fase === 'acierto' ? '¡Correcto!' : `Tocaste «${cm.parts.find((p) => p.id === estado.tocada)?.nombre ?? cm.model.parts.find((p) => p.id === estado.tocada)?.nombre ?? 'otra estructura'}»`}
              </p>
              {estado.fase === 'fallo' && <p className="text-[13px] text-mist-300">La estructura correcta se ilumina en verde en el modelo.</p>}
              {info && info.definiciones.length > 0 ? (
                <AfirmacionView a={info.definiciones[0]} compact />
              ) : info?.menciones[0] ? (
                <p className="rounded-2xl bg-white/4 p-3 text-[13px] text-mist-200">{info.menciones[0].text.slice(0, 260)}</p>
              ) : (
                <p className="text-[12px] text-mist-400">El documento no describe esta estructura.</p>
              )}
              <Button variant="primary" onClick={siguiente} className="w-full">
                {i + 1 >= preguntas.length ? 'Ver resultado' : 'Siguiente'}
              </Button>
            </div>
          )}
          <p className="mt-auto text-[11px] text-mist-400">Las etiquetas están ocultas durante el reto. El resultado no se guarda al recargar.</p>
        </aside>
      </div>
    </div>
  );
}

/** Controles mínimos sobre el visor del reto: separar estructuras y volver a la vista inicial. */
function MiniControles({ escenaKey }: { escenaKey: string }) {
  const explode = useViewer((s) => s.views[escenaKey]?.explode ?? 0);
  return (
    <div className="glass absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-2xl px-3 py-1.5">
      <Expand className="size-4 text-mist-400" aria-hidden />
      <input type="range" min={0} max={1} step={0.01} value={explode} onChange={(e) => useViewer.getState().patch(escenaKey, { explode: Number(e.target.value) })} aria-label="Separar estructuras" className="w-24 accent-cyan-400" />
      <button onClick={() => useViewer.getState().reset(escenaKey)} aria-label="Restablecer la vista" title="Restablecer la vista" className="grid size-8 place-items-center rounded-xl text-mist-300 hover:bg-white/8 hover:text-white">
        <RotateCcw className="size-4" />
      </button>
    </div>
  );
}
