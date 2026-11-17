import { useState } from 'react';
import { CheckCircle2, CircleX, RefreshCcw, Sparkles, Timer, Trophy, CircleHelp } from 'lucide-react';
import type { DocumentModel } from '../../types/document';
import type { StudyPlan } from '../../types/plan';
import type { GeneratedQuestion, OpenGrade } from '../../services/ai/types';
import { buildLocalQuiz, gradeOpenLocal } from '../../engines/education-engine';
import { useAI } from '../../stores/ai';
import { AfirmacionView } from '../../components/AfirmacionView';
import { Badge, Button, Empty, Progress, cx } from '../../components/ui';

type Answer = { choice?: number; text?: string; grade?: OpenGrade; grading?: boolean };

export function Quiz({ plan, doc, temaId, mode }: { plan: StudyPlan; doc: DocumentModel; temaId?: string; mode: 'practica' | 'evaluacion' }) {
  const aiOn = useAI((s) => s.status === 'conectado');
  const [qs, setQs] = useState<GeneratedQuestion[] | null>(null);
  const [origin, setOrigin] = useState<'local' | 'claude'>('local');
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [finished, setFinished] = useState(false);
  const [started, setStarted] = useState<number>(0);
  const count = mode === 'evaluacion' ? 12 : 8;

  const start = async (useAI_: boolean) => {
    setError(undefined);
    setAnswers({});
    setFinished(false);
    setStarted(Date.now());
    if (useAI_) {
      setLoading(true);
      try {
        const r = await useAI.getState().claude!.generateQuestions(doc, plan, temaId, count);
        setQs(r);
        setOrigin('claude');
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    } else {
      setQs(buildLocalQuiz(plan, temaId, count, Date.now() % 100000));
      setOrigin('local');
    }
  };

  const grade = async (idx: number) => {
    const q = qs![idx];
    const a = answers[idx];
    if (!a?.text?.trim()) return;
    if (aiOn) {
      setAnswers((s) => ({ ...s, [idx]: { ...a, grading: true } }));
      try {
        const g = await useAI.getState().claude!.gradeOpen(q.pregunta, q.respuestaModelo.texto, a.text);
        setAnswers((s) => ({ ...s, [idx]: { ...a, grading: false, grade: g } }));
      } catch (e) {
        setAnswers((s) => ({ ...s, [idx]: { ...a, grading: false, grade: { ...gradeOpenLocal(q.respuestaModelo.texto, a.text!), comentario: `No se pudo usar la IA (${e instanceof Error ? e.message : e}). Evaluación aproximada por palabras clave.` } } }));
      }
    } else setAnswers((s) => ({ ...s, [idx]: { ...a, grade: gradeOpenLocal(q.respuestaModelo.texto, a.text!) } }));
  };

  if (!qs)
    return (
      <div className="glass mx-auto max-w-2xl rounded-3xl p-8 text-center">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-accent/10 text-accent">{mode === 'evaluacion' ? <Trophy className="size-7" /> : <CircleHelp className="size-7" />}</div>
        <h3 className="font-display text-xl text-white">{mode === 'evaluacion' ? 'Evaluación' : 'Cuestionario de práctica'}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-mist-400">
          {mode === 'evaluacion' ? `${count} preguntas con puntuación final y tiempo. Las respuestas se revisan al terminar.` : `${count} preguntas con corrección inmediata.`} Opción múltiple, verdadero/falso y preguntas abiertas generadas a partir del material.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button variant={aiOn ? 'soft' : 'primary'} onClick={() => start(false)}>
            Generar con el texto del documento
          </Button>
          {aiOn && (
            <Button variant="primary" loading={loading} icon={<Sparkles className="size-4" />} onClick={() => start(true)}>
              Generar con Claude
            </Button>
          )}
        </div>
        {error && <p className="mt-4 text-[13px] text-rose-300">{error}</p>}
      </div>
    );

  if (!qs.length) return <Empty title="No hay suficiente material para generar preguntas">El tema seleccionado no contiene definiciones ni preguntas en el documento.</Empty>;

  const reveal = (i: number) => (mode === 'practica' ? answers[i]?.choice !== undefined || answers[i]?.grade : finished);
  const isCorrect = (i: number) => {
    const q = qs[i], a = answers[i];
    if (!a) return false;
    if (q.tipo === 'abierta') return a.grade?.resultado === 'correcta' ? 1 : a.grade?.resultado === 'parcial' ? 0.5 : 0;
    return a.choice === q.correcta ? 1 : 0;
  };
  const score = qs.reduce((s, _, i) => s + Number(isCorrect(i)), 0);
  const answered = qs.filter((q, i) => (q.tipo === 'abierta' ? answers[i]?.grade : answers[i]?.choice !== undefined)).length;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="glass sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <Badge tone={origin === 'claude' ? 'gen' : 'doc'}>{origin === 'claude' ? 'Preguntas generadas por Claude' : 'Preguntas construidas con el texto del documento'}</Badge>
        <span className="text-[13px] text-mist-300">
          {answered}/{qs.length} respondidas
        </span>
        <div className="min-w-24 flex-1">
          <Progress value={answered / qs.length} />
        </div>
        {mode === 'evaluacion' && !finished && (
          <Button size="sm" variant="primary" onClick={() => setFinished(true)}>
            Terminar y calificar
          </Button>
        )}
        <Button size="sm" variant="ghost" icon={<RefreshCcw className="size-3.5" />} onClick={() => setQs(null)}>
          Nuevo
        </Button>
      </div>

      {(finished || (mode === 'practica' && answered === qs.length)) && (
        <div className="glass flex items-center gap-4 rounded-3xl p-5">
          <Trophy className="size-8 text-amber-300" />
          <div>
            <p className="font-display text-2xl text-white">
              {score.toFixed(score % 1 ? 1 : 0)} / {qs.length} · {Math.round((score / qs.length) * 100)}%
            </p>
            <p className="flex items-center gap-1.5 text-[13px] text-mist-400">
              <Timer className="size-3.5" /> {Math.round((Date.now() - started) / 60000)} min · resultado no guardado: se pierde al recargar la página
            </p>
          </div>
        </div>
      )}

      {qs.map((q, i) => {
        const a = answers[i] ?? {};
        const shown = reveal(i);
        return (
          <article key={i} className="glass rounded-3xl p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-white/6 text-[12px] font-semibold text-mist-200">{i + 1}</span>
              <Badge>{q.tipo === 'opcion-multiple' ? 'Opción múltiple' : q.tipo === 'verdadero-falso' ? 'Verdadero o falso' : 'Pregunta abierta'}</Badge>
            </div>
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-white">{q.pregunta}</p>
            {q.opciones && (
              <div className="mt-4 grid gap-2">
                {q.opciones.map((o, j) => {
                  const chosen = a.choice === j;
                  const right = shown && j === q.correcta;
                  const wrong = shown && chosen && j !== q.correcta;
                  return (
                    <button
                      key={j}
                      disabled={mode === 'practica' ? a.choice !== undefined : finished}
                      onClick={() => setAnswers((s) => ({ ...s, [i]: { choice: j } }))}
                      className={cx(
                        'flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-[14px] transition',
                        right ? 'border-emerald-400/50 bg-emerald-400/10 text-white' : wrong ? 'border-rose-400/50 bg-rose-400/10 text-white' : chosen ? 'border-accent/60 bg-accent/10 text-white' : 'border-white/8 text-mist-200 hover:border-white/20',
                      )}
                    >
                      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-white/6 text-[12px]">{String.fromCharCode(65 + j)}</span>
                      <span className="flex-1">{o}</span>
                      {right && <CheckCircle2 className="size-4 text-emerald-300" />}
                      {wrong && <CircleX className="size-4 text-rose-300" />}
                    </button>
                  );
                })}
              </div>
            )}
            {q.tipo === 'abierta' && (
              <div className="mt-4 space-y-2">
                <textarea value={a.text ?? ''} onChange={(e) => setAnswers((s) => ({ ...s, [i]: { ...a, text: e.target.value } }))} disabled={Boolean(a.grade)} rows={3} placeholder="Escribe tu respuesta…" className="w-full rounded-2xl border border-white/10 bg-ink-950/60 p-3 text-sm text-white placeholder:text-mist-400 focus:border-accent/50 focus:outline-none" aria-label={`Respuesta a la pregunta ${i + 1}`} />
                {!a.grade && (
                  <Button size="sm" variant="soft" loading={a.grading} disabled={!a.text?.trim()} onClick={() => grade(i)}>
                    {aiOn ? 'Corregir con Claude' : 'Corregir'}
                  </Button>
                )}
                {a.grade && (
                  <p className={cx('rounded-xl p-3 text-[13px]', a.grade.resultado === 'correcta' ? 'bg-emerald-400/10 text-emerald-200' : a.grade.resultado === 'parcial' ? 'bg-amber-400/10 text-amber-200' : 'bg-rose-400/10 text-rose-200')}>
                    <strong className="capitalize">{a.grade.resultado}.</strong> {a.grade.comentario}
                    {!aiOn && <span className="block pt-1 text-[11px] opacity-70">Corrección automática aproximada (coincidencia de palabras clave).</span>}
                  </p>
                )}
              </div>
            )}
            {shown && (
              <div className="mt-4 rounded-2xl bg-white/3 p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-mist-400">Respuesta</p>
                <AfirmacionView a={q.respuestaModelo} compact />
                {q.explicacion && <p className="mt-2 text-[13px] text-mist-300">{q.explicacion}</p>}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
