import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, RotateCw, Shuffle, Check, X } from 'lucide-react';
import type { StudyPlan } from '../../types/plan';
import type { DocumentModel } from '../../types/document';
import { Structure3D } from './Structure3D';
import { buildFlashcards, rng } from '../../engines/education-engine';
import { AfirmacionView } from '../../components/AfirmacionView';
import { Button, Empty, Progress } from '../../components/ui';

export function Flashcards({ plan, doc, temaId }: { plan: StudyPlan; doc: DocumentModel; temaId?: string }) {
  const base = useMemo(() => buildFlashcards(plan, temaId), [plan, temaId]);
  const [order, setOrder] = useState<number[]>(() => base.map((_, i) => i));
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [known, setKnown] = useState<Record<string, boolean>>({});
  if (!base.length) return <Empty title="No hay tarjetas para este tema">El documento no tiene términos con definición ni preguntas con respuesta en esta sección.</Empty>;
  const card = base[order[i] ?? 0];
  const go = (d: number) => {
    setFlip(false);
    setI((x) => (x + d + order.length) % order.length);
  };
  const k = Object.values(known).filter(Boolean).length;
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between text-[13px] text-mist-400">
        <span>
          Tarjeta {i + 1} de {base.length}
        </span>
        <span>
          {k} dominadas · {Object.values(known).filter((v) => !v).length} por repasar
        </span>
      </div>
      <Progress value={(i + 1) / base.length} />
      <div className="relative h-80 [perspective:1400px]">
        <AnimatePresence mode="wait">
          <motion.button
            key={card.id + String(flip)}
            initial={{ rotateY: flip ? -90 : 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: flip ? 90 : -90, opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={() => setFlip((f) => !f)}
            className="glass absolute inset-0 flex w-full flex-col items-center justify-center overflow-y-auto rounded-3xl p-8 text-center"
            aria-label={flip ? 'Mostrar el anverso' : 'Mostrar la respuesta'}
          >
            {!flip ? (
              <>
                <p className="mb-3 text-[11px] uppercase tracking-[0.16em] text-mist-400">{plan.temas.find((t) => t.id === card.temaId)?.titulo}</p>
                <p className="font-display text-2xl leading-snug text-white">{card.frente}</p>
                <p className="mt-6 inline-flex items-center gap-1.5 text-[12px] text-mist-400">
                  <RotateCw className="size-3.5" /> Toca para ver la respuesta
                </p>
              </>
            ) : (
              <div className="w-full text-left">
                <AfirmacionView a={card.reverso} />
              </div>
            )}
          </motion.button>
        </AnimatePresence>
      </div>
      {flip && <Structure3D conceptoId={card.conceptoId} plan={plan} doc={doc} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button variant="soft" icon={<ChevronLeft className="size-4" />} onClick={() => go(-1)}>
            Anterior
          </Button>
          <Button variant="soft" onClick={() => go(1)}>
            Siguiente <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="danger" icon={<X className="size-4" />} onClick={() => (setKnown((s) => ({ ...s, [card.id]: false })), go(1))}>
            Repasar
          </Button>
          <Button variant="primary" icon={<Check className="size-4" />} onClick={() => (setKnown((s) => ({ ...s, [card.id]: true })), go(1))}>
            La sé
          </Button>
          <Button
            variant="ghost"
            icon={<Shuffle className="size-4" />}
            onClick={() => {
              const r = rng(Date.now());
              setOrder((o) => [...o].sort(() => r() - 0.5));
              setI(0);
              setFlip(false);
            }}
          >
            Mezclar
          </Button>
        </div>
      </div>
    </div>
  );
}
