import { useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, BookOpen, Brain, CalendarClock, CheckCircle2, ChevronDown, Circle, CircleDot, Clock, Coffee, FlaskConical, Footprints, GlassWater, Lightbulb, LogOut, RefreshCw, Repeat, Sparkles, Target, Trash2, Trophy } from 'lucide-react';
import type { DocumentModel } from '../../types/document';
import type { StudyPlan } from '../../types/plan';
import { cursoIdPara } from '../../engines/study-engine/planner';
import { conceptosEvaluables, explicacionSencilla, generarMiniPrueba, corregirPregunta, pistas } from '../../engines/study-engine/quiz';
import { dominada, pendientes, proximaFecha } from '../../engines/study-engine/srs';
import { CONFIG_DEFECTO, type BloqueEstudio, type ConfigEstudio, type Curso, type PreguntaMini, type RespuestaUsuario, type ResultadoPregunta } from '../../engines/study-engine/types';
import { bloquesEnOrden, buscarBloque, minutosHoy, siguientePendiente, useSmartStudy, type ProgresoCurso } from '../../stores/smartStudy';
import { pedirPermisoNotificaciones } from '../../services/notify';
import { Badge, Button, Progress, cx } from '../../components/ui';
import { TimerCard } from './TimerCard';
import { PreguntaView, respondida } from './MiniQuiz';

const DIF = { baja: 'Baja', media: 'Media', alta: 'Alta' } as const;
const fechaCorta = (t: number) => new Date(t).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'short' });

export function SmartStudy({ doc, plan }: { doc: DocumentModel; plan: StudyPlan }) {
  const id = useMemo(() => cursoIdPara(doc), [doc]);
  const curso = useSmartStudy((s) => s.cursos[id]);
  const sesion = useSmartStudy((s) => (s.sesion?.cursoId === id ? s.sesion : undefined));
  const [rehacer, setRehacer] = useState(false);

  if (!curso || rehacer) return <Configurar doc={doc} plan={plan} previo={curso?.config} onListo={() => setRehacer(false)} onCancelar={curso ? () => setRehacer(false) : undefined} />;
  if (sesion) return <Sesion curso={curso} />;
  return <VistaPlan curso={curso} onRehacer={() => setRehacer(true)} />;
}

/* ------------------------------------------------------------------ */
/* Configuración                                                        */
/* ------------------------------------------------------------------ */

function Configurar({ doc, plan, previo, onListo, onCancelar }: { doc: DocumentModel; plan: StudyPlan; previo?: ConfigEstudio; onListo(): void; onCancelar?(): void }) {
  const [cfg, setCfg] = useState<ConfigEstudio>(previo ?? CONFIG_DEFECTO);
  const up = (p: Partial<ConfigEstudio>) => setCfg((c) => ({ ...c, ...p }));
  const crear = () => {
    useSmartStudy.getState().crearCurso(doc, plan, cfg);
    void pedirPermisoNotificaciones();
    onListo();
  };
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
      <section className="glass space-y-5 rounded-3xl p-5 sm:p-6">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl text-white">
            <Brain className="size-5 text-accent" /> Estudio inteligente
          </h2>
          <p className="mt-1 text-[13px] text-mist-300">Analizo «{doc.name}» y lo divido en fases y bloques cortos con cronómetro, mini pruebas, descansos y repasos espaciados.</p>
        </div>
        <Campo titulo="¿Cuánto tiempo puedes estudiar por sesión (día)?">
          <div className="flex flex-wrap gap-2">
            {[30, 45, 60, 90, 120].map((m) => (
              <Chip key={m} on={cfg.minutosSesion === m} onClick={() => up({ minutosSesion: m })}>
                {m < 60 ? `${m} min` : `${m / 60} h${m % 60 ? ` ${m % 60}` : ''}`}
              </Chip>
            ))}
            <label className="inline-flex items-center gap-1.5 text-[12px] text-mist-300">
              Otro
              <input type="number" min={15} max={240} value={cfg.minutosSesion} onChange={(e) => up({ minutosSesion: Math.max(15, Math.min(240, Number(e.target.value) || 60)) })} className="h-8 w-16 rounded-lg border border-white/10 bg-ink-950/60 px-2 text-white" />
            </label>
          </div>
        </Campo>
        <Campo titulo="¿Qué tanto conoces el tema?">
          <div className="flex flex-wrap gap-2">
            {(['principiante', 'intermedio', 'avanzado'] as const).map((n) => (
              <Chip key={n} on={cfg.nivel === n} onClick={() => up({ nivel: n })}>
                {n[0].toUpperCase() + n.slice(1)}
              </Chip>
            ))}
          </div>
        </Campo>
        <Campo titulo="Tiempos de estudio y descanso">
          <div className="flex flex-wrap gap-2">
            <Chip on={cfg.modoTiempos === 'auto'} onClick={() => up({ modoTiempos: 'auto' })}>
              Automáticos según el contenido (recomendado)
            </Chip>
            <Chip on={cfg.modoTiempos === 'manual'} onClick={() => up({ modoTiempos: 'manual' })}>
              Personalizados
            </Chip>
          </div>
          {cfg.modoTiempos === 'manual' && (
            <div className="mt-3 flex flex-wrap gap-4 text-[13px] text-mist-200">
              <label className="flex items-center gap-2">
                Estudio
                <input type="number" min={5} max={50} value={cfg.estudio} onChange={(e) => up({ estudio: Math.max(5, Math.min(50, Number(e.target.value) || 15)) })} className="h-9 w-16 rounded-lg border border-white/10 bg-ink-950/60 px-2 text-white" />
                min
              </label>
              <label className="flex items-center gap-2">
                Descanso
                <input type="number" min={2} max={30} value={cfg.descanso} onChange={(e) => up({ descanso: Math.max(2, Math.min(30, Number(e.target.value) || 10)) })} className="h-9 w-16 rounded-lg border border-white/10 bg-ink-950/60 px-2 text-white" />
                min
              </label>
            </div>
          )}
        </Campo>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="primary" icon={<Sparkles className="size-4" />} onClick={crear}>
            {previo ? 'Rehacer mi plan' : 'Crear mi plan de estudio'}
          </Button>
          {onCancelar && (
            <Button variant="ghost" onClick={onCancelar}>
              Cancelar
            </Button>
          )}
        </div>
        {previo && <p className="text-[12px] text-mist-400">Tus repasos espaciados se conservan. Los bloques que cambien de contenido empezarán como pendientes.</p>}
      </section>
      <Fundamentos />
    </div>
  );
}

function Fundamentos() {
  const items = [
    { icon: Brain, t: 'Práctica de recuperación', d: 'Recordar sin mirar fortalece la memoria más que releer. Por eso cada bloque termina con una mini prueba.' },
    { icon: CalendarClock, t: 'Repetición espaciada', d: 'Cada concepto vuelve en intervalos crecientes (1, 3, 7, 14, 30 días). Si lo fallas, vuelve antes.' },
    { icon: Target, t: 'Estudio por bloques', d: 'Bloques cortos con máximo 6 conceptos nuevos para no saturar la memoria de trabajo.' },
    { icon: Repeat, t: 'Práctica intercalada', d: 'Los repasos mezclan conceptos de distintos bloques para aprender a distinguirlos.' },
    { icon: Coffee, t: 'Pausas estratégicas', d: 'Descansos breves entre bloques y uno largo cada tres; los temas extensos se reparten en varios días.' },
  ];
  return (
    <aside className="glass space-y-3 rounded-3xl p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mist-400">En qué se basa</p>
      {items.map(({ icon: I, t, d }) => (
        <div key={t} className="flex gap-3">
          <I className="mt-0.5 size-4 shrink-0 text-accent" />
          <div>
            <p className="text-[13px] text-white">{t}</p>
            <p className="text-[12px] leading-relaxed text-mist-400">{d}</p>
          </div>
        </div>
      ))}
      <p className="border-t border-white/6 pt-3 text-[11px] leading-relaxed text-mist-500">Dunlosky et al. (2013); Roediger y Karpicke (2006); Cepeda et al. (2008); Rohrer y Taylor (2007); Sweller (carga cognitiva); Albulescu et al. (2022).</p>
    </aside>
  );
}

function Campo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[13px] font-medium text-mist-100">{titulo}</p>
      {children}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick(): void; children: ReactNode }) {
  return (
    <button onClick={onClick} className={cx('rounded-full border px-3 py-1.5 text-[12px] transition', on ? 'border-accent/60 bg-accent/12 text-white' : 'border-white/10 text-mist-300 hover:text-white')}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Vista del plan                                                       */
/* ------------------------------------------------------------------ */

function VistaPlan({ curso, onRehacer }: { curso: Curso; onRehacer(): void }) {
  const progreso = useSmartStudy((s) => s.progreso[curso.id]);
  const todas = useSmartStudy((s) => s.tarjetas);
  const tarjetas = useMemo(() => Object.values(todas).filter((t) => t.cursoId === curso.id), [todas, curso.id]);
  const due = pendientes(tarjetas);
  const bloques = bloquesEnOrden(curso);
  const hechos = bloques.filter((b) => progreso?.bloques[b.id]?.estado === 'completado').length;
  const sig = siguientePendiente(curso, progreso);
  const hoy = minutosHoy(progreso);
  const excedido = hoy >= curso.config.minutosSesion;
  const prox = proximaFecha(tarjetas);
  const S = useSmartStudy.getState;
  const faseSig = sig && curso.fases.find((f) => f.id === sig.faseId);
  const terminoFaseHoy = faseSig && sig.indice === 0 && hoy > 0;

  return (
    <div className="space-y-5">
      <section className="glass rounded-3xl p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.14em] text-mist-400">Tu plan de estudio</p>
            <h2 className="font-display text-xl text-white">{curso.titulo}</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge>{curso.resumen.palabras.toLocaleString('es')} palabras</Badge>
              <Badge>{curso.resumen.conceptos} conceptos</Badge>
              <Badge tone={curso.resumen.dificultad === 'alta' ? 'warn' : curso.resumen.dificultad === 'media' ? 'accent' : 'doc'}>Dificultad {DIF[curso.resumen.dificultad].toLowerCase()}</Badge>
              <Badge>
                {curso.fases.length} fase{curso.fases.length > 1 ? 's' : ''} · {bloques.length} bloque{bloques.length > 1 ? 's' : ''}
              </Badge>
              <Badge>~{curso.resumen.minutosTotales} min en total</Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" icon={<RefreshCw className="size-3.5" />} onClick={onRehacer}>
              Ajustar plan
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<Trash2 className="size-3.5" />}
              onClick={() => {
                if (window.confirm('¿Borrar este plan, su progreso y sus repasos programados?')) S().borrarCurso(curso.id);
              }}
            >
              Borrar
            </Button>
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-[12px] text-mist-300">
            <span>Progreso general</span>
            <span>
              {hechos}/{bloques.length} bloques · {tarjetas.filter(dominada).length}/{tarjetas.length} conceptos dominados
            </span>
          </div>
          <Progress value={bloques.length ? hechos / bloques.length : 0} />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-accent/25 bg-accent/5 p-4">
            {sig ? (
              <>
                <p className="text-[12px] text-cyan-200">Siguiente: Fase {faseSig?.numero} · Bloque {sig.indice + 1}</p>
                <p className="mt-0.5 text-[14px] text-white">{sig.titulo}</p>
                <p className="mt-1 text-[12px] text-mist-400">
                  {sig.minutos.estudio} min de estudio + {sig.minutos.prueba} min de prueba
                </p>
                {(excedido || terminoFaseHoy) && (
                  <p className="mt-2 rounded-xl bg-amber-400/10 p-2 text-[12px] text-amber-200">
                    {excedido ? `Hoy ya estudiaste ${hoy} min, tu tiempo previsto.` : 'Ya completaste una fase hoy.'} Descansar consolida lo aprendido: lo ideal es seguir mañana.
                  </p>
                )}
                <Button className="mt-3" variant={excedido || terminoFaseHoy ? 'soft' : 'primary'} icon={<ArrowRight className="size-4" />} onClick={() => S().iniciarBloque(curso.id, sig.id)}>
                  {excedido || terminoFaseHoy ? 'Continuar de todos modos' : hechos ? 'Continuar' : 'Empezar'}
                </Button>
              </>
            ) : (
              <>
                <p className="flex items-center gap-2 text-[14px] text-white">
                  <Trophy className="size-4 text-amber-300" /> ¡Completaste todos los bloques!
                </p>
                <p className="mt-1 text-[12px] text-mist-400">Ahora toca mantenerlo: haz tus repasos espaciados cuando estén disponibles.</p>
              </>
            )}
          </div>
          <div className="rounded-2xl border border-violet/25 bg-violet/5 p-4">
            <p className="text-[12px] text-violet-200">Repaso espaciado</p>
            {due.length ? (
              <>
                <p className="mt-0.5 text-[14px] text-white">
                  {due.length} concepto{due.length > 1 ? 's' : ''} para repasar hoy
                </p>
                <p className="mt-1 text-[12px] text-mist-400">Unos {Math.max(2, Math.ceil(due.length * 0.6))} minutos. Mezcla conceptos de varios bloques.</p>
                <Button className="mt-3" variant="soft" icon={<Repeat className="size-4" />} onClick={() => S().iniciarRepasoEspaciado(curso.id)}>
                  Repasar ahora
                </Button>
              </>
            ) : (
              <>
                <p className="mt-0.5 text-[14px] text-white">Nada pendiente hoy</p>
                <p className="mt-1 text-[12px] text-mist-400">{prox ? `Próximo repaso: ${fechaCorta(prox)}.` : 'Los repasos aparecen después de tus primeras mini pruebas.'}</p>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {curso.fases.map((f) => (
          <FaseCard key={f.id} curso={curso} faseId={f.id} progreso={progreso} sigId={sig?.id} />
        ))}
      </section>
    </div>
  );
}

function FaseCard({ curso, faseId, progreso, sigId }: { curso: Curso; faseId: string; progreso?: ProgresoCurso; sigId?: string }) {
  const f = curso.fases.find((x) => x.id === faseId)!;
  const hechos = f.bloques.filter((b) => progreso?.bloques[b.id]?.estado === 'completado').length;
  const [abierta, setAbierta] = useState(hechos < f.bloques.length);
  return (
    <div className="glass rounded-3xl">
      <button onClick={() => setAbierta(!abierta)} className="flex w-full items-center gap-3 p-4 text-left">
        <span className={cx('grid size-9 shrink-0 place-items-center rounded-xl font-display text-[14px]', hechos === f.bloques.length ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/6 text-white')}>{hechos === f.bloques.length ? <CheckCircle2 className="size-4" /> : f.numero}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-mist-400">
            Fase {f.numero} · sesión de ~{f.minutos} min · {hechos}/{f.bloques.length} bloques
          </p>
          <p className="truncate text-[14px] text-white">{f.titulo}</p>
        </div>
        <ChevronDown className={cx('size-4 text-mist-400 transition', abierta && 'rotate-180')} />
      </button>
      {abierta && (
        <ol className="space-y-1 px-4 pb-4">
          {f.bloques.map((b) => {
            const p = progreso?.bloques[b.id];
            const nota = p?.intentos.length ? p.intentos[p.intentos.length - 1].nota : undefined;
            const Icon = p?.estado === 'completado' ? CheckCircle2 : b.id === sigId ? CircleDot : Circle;
            return (
              <li key={b.id} className={cx('flex items-start gap-3 rounded-2xl p-3', b.id === sigId && 'bg-accent/6')}>
                <Icon className={cx('mt-0.5 size-4 shrink-0', p?.estado === 'completado' ? 'text-emerald-300' : b.id === sigId ? 'text-accent' : 'text-mist-500')} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-white">
                    Bloque {b.indice + 1}: {b.titulo}
                  </p>
                  <p className="text-[12px] text-mist-400">{b.objetivo}</p>
                  <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-mist-500">
                    <span>
                      <Clock className="mr-1 inline size-3" />
                      {b.minutos.estudio} + {b.minutos.prueba} min{b.minutos.descanso ? ` · descanso ${b.minutos.descanso} min` : ''}
                    </span>
                    <span>{b.conceptos.length} conceptos</span>
                    <span>dificultad {DIF[b.dificultad].toLowerCase()}</span>
                    {nota !== undefined && <span className={nota >= 0.8 ? 'text-emerald-300' : 'text-amber-300'}>última prueba {Math.round(nota * 100)}%</span>}
                  </p>
                </div>
                <button onClick={() => useSmartStudy.getState().iniciarBloque(curso.id, b.id)} className="shrink-0 rounded-lg px-2 py-1 text-[12px] text-mist-300 hover:bg-white/6 hover:text-white">
                  {p?.estado === 'completado' ? 'Repetir' : 'Estudiar'}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sesión                                                               */
/* ------------------------------------------------------------------ */

function Sesion({ curso }: { curso: Curso }) {
  const ses = useSmartStudy((s) => s.sesion)!;
  const progreso = useSmartStudy((s) => s.progreso[curso.id]);
  const b = buscarBloque(curso, ses.bloqueId);
  const fase = b && curso.fases.find((f) => f.id === b.faseId);
  const bloques = bloquesEnOrden(curso);
  const hechos = bloques.filter((x) => progreso?.bloques[x.id]?.estado === 'completado').length;
  const S = useSmartStudy.getState;
  const espaciado = ses.etapa === 'repaso-espaciado' || ses.etapa === 'resultados-repaso';

  return (
    <div className="space-y-4">
      {/* Cabecera: tema, fase, bloque, objetivo, progreso */}
      <section className="glass rounded-3xl p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.14em] text-mist-400">{curso.titulo}</p>
            {espaciado ? (
              <h2 className="font-display text-lg text-white">Repaso espaciado</h2>
            ) : (
              <>
                <h2 className="font-display text-lg text-white">
                  Fase {fase?.numero} de {curso.fases.length} · Bloque {(b?.indice ?? 0) + 1} de {fase?.bloques.length}
                  {ses.etapa === 'descanso' && <span className="text-mist-400"> (siguiente)</span>}
                </h2>
                <p className="text-[13px] text-mist-200">{b?.titulo}</p>
                {b && (
                  <p className="mt-2 flex items-start gap-2 rounded-xl bg-white/4 p-2.5 text-[13px] text-mist-200">
                    <Target className="mt-0.5 size-4 shrink-0 text-accent" /> {b.objetivo}
                  </p>
                )}
              </>
            )}
            <div className="mt-3 flex items-center gap-3">
              <Progress value={bloques.length ? hechos / bloques.length : 0} className="max-w-xs" />
              <span className="text-[11px] text-mist-400">
                {hechos}/{bloques.length} bloques
              </span>
            </div>
          </div>
          {ses.timer && ses.etapa !== 'descanso' && <TimerCard timer={ses.timer} compact />}
          <Button size="sm" variant="ghost" icon={<LogOut className="size-3.5" />} onClick={() => S().salir()}>
            Salir
          </Button>
        </div>
        {!espaciado && <Etapas etapa={ses.etapa} />}
      </section>

      {ses.etapa === 'estudio' && b && <Estudio b={b} terminado={Boolean(ses.timer?.terminado)} />}
      {(ses.etapa === 'prueba' || ses.etapa === 'repaso-espaciado') && <Prueba />}
      {(ses.etapa === 'resultados' || ses.etapa === 'resultados-repaso') && <Resultados curso={curso} />}
      {ses.etapa === 'repaso' && b && <RepasoFocalizado b={b} claves={ses.reforzar ?? []} />}
      {ses.etapa === 'descanso' && b && <Descanso siguiente={b} terminado={Boolean(ses.timer?.terminado)} />}
      {ses.etapa === 'fin-fase' && <FinFase curso={curso} />}
    </div>
  );
}

function Etapas({ etapa }: { etapa: string }) {
  const pasos = [
    { k: ['estudio'], l: 'Estudio' },
    { k: ['prueba'], l: 'Mini prueba' },
    { k: ['resultados', 'repaso'], l: 'Resultados' },
    { k: ['descanso', 'fin-fase'], l: 'Descanso' },
  ];
  const i = pasos.findIndex((p) => p.k.includes(etapa));
  return (
    <ol className="mt-4 flex gap-1.5">
      {pasos.map((p, j) => (
        <li key={p.l} className="flex-1">
          <div className={cx('h-1 rounded-full', j < i ? 'bg-emerald-400/70' : j === i ? 'bg-accent' : 'bg-white/8')} />
          <p className={cx('mt-1 text-[11px]', j === i ? 'text-white' : 'text-mist-500')}>{p.l}</p>
        </li>
      ))}
    </ol>
  );
}

function Estudio({ b, terminado }: { b: BloqueEstudio; terminado: boolean }) {
  let seccion: string | undefined;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_17rem]">
      <article className="glass space-y-3 rounded-3xl p-5 text-[15px] leading-relaxed text-mist-100 sm:p-7">
        {b.segmentos.map((s, i) => {
          const head = s.seccion && s.seccion !== seccion ? s.seccion : undefined;
          seccion = s.seccion;
          return (
            <div key={i}>
              {head && <h3 className="mb-2 mt-3 font-display text-[17px] text-white first:mt-0">{head}</h3>}
              {s.tipo === 'table' && s.rows ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <tbody>
                      {s.rows.map((r, k) => (
                        <tr key={k} className={k === 0 ? 'font-semibold text-white' : ''}>
                          {r.map((c, j) => (
                            <td key={j} className="border-b border-white/8 py-1.5 pr-3 align-top">
                              {c}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : s.tipo === 'list-item' ? (
                <p className="pl-4 before:-ml-4 before:mr-2 before:text-accent before:content-['•']">{s.texto}</p>
              ) : s.tipo === 'note' ? (
                <p className="rounded-xl border-l-2 border-amber-300/50 bg-amber-300/5 px-3 py-2 text-[14px]">{s.texto}</p>
              ) : (
                <p>{s.texto}</p>
              )}
            </div>
          );
        })}
      </article>
      <aside className="space-y-3">
        {b.conceptos.length > 0 && (
          <div className="glass rounded-3xl p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-mist-400">Conceptos clave</p>
            <div className="flex flex-wrap gap-1.5">
              {b.conceptos.map((c) => (
                <span key={c.key} className="rounded-full bg-accent/10 px-2.5 py-1 text-[12px] text-cyan-100">
                  {c.nombre}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="glass space-y-2 rounded-3xl p-4 text-[12px] text-mist-300">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-mist-400">
            <Lightbulb className="size-3.5 text-amber-300" /> Cómo estudiar este bloque
          </p>
          <p>1. Lee con atención una sección.</p>
          <p>2. Aparta la vista y explícatela con tus palabras.</p>
          <p>3. Vuelve al texto solo para comprobar lo que olvidaste.</p>
        </div>
        <Button variant={terminado ? 'primary' : 'soft'} className="w-full" icon={<FlaskConical className="size-4" />} onClick={() => useSmartStudy.getState().irAPrueba()}>
          {terminado ? 'Hacer la mini prueba' : 'Ya lo estudié: mini prueba'}
        </Button>
        {terminado && <p className="text-center text-[12px] text-cyan-200">Tiempo de estudio terminado.</p>}
      </aside>
    </div>
  );
}

function Prueba() {
  const ses = useSmartStudy((s) => s.sesion)!;
  const qs = ses.preguntas ?? [];
  const r = ses.respuestas ?? {};
  const listas = qs.filter((q) => respondida(q, r[q.id])).length;
  const S = useSmartStudy.getState;
  return (
    <section className="space-y-3">
      <div className="glass flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3 text-[13px] text-mist-300">
        <span>{ses.etapa === 'repaso-espaciado' ? 'Recuerda sin mirar. Se mezclan conceptos de distintos bloques.' : 'Solo sobre lo que acabas de estudiar. Responde sin mirar el material: equivocarse también ayuda a aprender.'}</span>
        <span className="text-mist-400">
          {listas}/{qs.length} respondidas
        </span>
      </div>
      {qs.map((q, i) => (
        <PreguntaView key={q.id} q={q} n={i + 1} valor={r[q.id]} onChange={(v) => S().responder(q.id, v)} />
      ))}
      <div className="flex justify-end">
        <Button variant="primary" onClick={() => S().entregar()} disabled={listas === 0}>
          Ver resultados
        </Button>
      </div>
    </section>
  );
}

function Resultados({ curso }: { curso: Curso }) {
  const ses = useSmartStudy((s) => s.sesion)!;
  const res = ses.resultado!;
  const qs = ses.preguntas ?? [];
  const S = useSmartStudy.getState;
  const pct = Math.round(res.nota * 100);
  const espaciado = ses.etapa === 'resultados-repaso';
  const b = buscarBloque(curso, ses.bloqueId);
  const siguienteDescanso = b?.minutos.descanso;
  return (
    <section className="space-y-4">
      <div className="glass grid gap-4 rounded-3xl p-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className={cx('grid size-24 place-items-center rounded-full border-4 font-display text-2xl', pct >= 80 ? 'border-emerald-400/60 text-emerald-200' : pct >= 50 ? 'border-amber-400/60 text-amber-200' : 'border-rose-400/60 text-rose-200')}>{pct}%</div>
        <div>
          <p className="text-[15px] text-white">{espaciado ? (pct >= 80 ? '¡Excelente memoria!' : 'Repaso registrado') : res.mensaje}</p>
          <p className="mt-1 text-[12px] text-mist-400">
            {res.resultados.filter((x) => x.estado === 'correcta').length} correctas · {res.resultados.filter((x) => x.estado === 'parcial').length} parciales · {res.resultados.filter((x) => x.estado === 'incorrecta').length} incorrectas
          </p>
          {res.reforzar.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-[12px] text-mist-300">Conceptos para reforzar:</p>
              <div className="flex flex-wrap gap-1.5">
                {res.reforzar.map((c) => (
                  <span key={c.key} className="rounded-full bg-amber-400/12 px-2.5 py-1 text-[12px] text-amber-100">
                    {c.nombre}
                  </span>
                ))}
              </div>
            </div>
          )}
          {espaciado && <p className="mt-2 text-[12px] text-mist-400">Los conceptos acertados volverán dentro de más días; los fallados, mañana.</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {espaciado ? (
              <Button variant="primary" onClick={() => S().salir()}>
                Volver al plan
              </Button>
            ) : (
              <>
                {res.reforzar.length > 0 && res.recomendacion !== 'avanzar' && (
                  <Button variant="primary" icon={<Brain className="size-4" />} onClick={() => S().iniciarRepasoFocalizado()}>
                    Repaso focalizado ({res.reforzar.length})
                  </Button>
                )}
                <Button variant={res.recomendacion === 'avanzar' || !res.reforzar.length ? 'primary' : 'soft'} icon={<ArrowRight className="size-4" />} onClick={() => S().avanzar()}>
                  {siguienteDescanso ? `Avanzar · descanso de ${siguienteDescanso} min` : 'Terminar la fase'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {qs.map((q, i) => (
          <PreguntaView key={q.id} q={q} n={i + 1} valor={ses.respuestas?.[q.id]} onChange={() => {}} resultado={res.resultados[i]} />
        ))}
      </div>
    </section>
  );
}

/** Repaso focalizado: solo los conceptos fallados, con explicación sencilla y una pregunta nueva de otro tipo. */
function RepasoFocalizado({ b, claves }: { b: BloqueEstudio; claves: string[] }) {
  const cs = conceptosEvaluables(b).filter((c) => claves.includes(c.key));
  const [paso, setPaso] = useState(0);
  const [preguntas] = useState<PreguntaMini[]>(() => cs.flatMap((c, i) => generarMiniPrueba(b, 100 + i, 1, [c.key]).slice(0, 1)));
  const [resp, setResp] = useState<Record<string, RespuestaUsuario>>({});
  const [res, setRes] = useState<Record<string, ResultadoPregunta>>({});
  const [verPregunta, setVerPregunta] = useState(false);
  const c = cs[paso];
  const q = preguntas.find((x) => x.conceptKeys.includes(c?.key ?? ''));
  const S = useSmartStudy.getState;

  if (!c) {
    const aciertos = Object.fromEntries(cs.map((x) => [x.key, Object.values(res).some((r) => r.acertados.includes(x.key))]));
    return (
      <section className="glass rounded-3xl p-6 text-center">
        <CheckCircle2 className="mx-auto size-8 text-emerald-300" />
        <p className="mt-2 text-[15px] text-white">Repaso focalizado terminado</p>
        <p className="mt-1 text-[13px] text-mist-400">
          Recordaste {Object.values(aciertos).filter(Boolean).length} de {cs.length}. Estos conceptos volverán en tus repasos espaciados.
        </p>
        <Button className="mt-4" variant="primary" onClick={() => S().terminarRepasoFocalizado(aciertos)}>
          Continuar
        </Button>
      </section>
    );
  }
  return (
    <section className="glass space-y-4 rounded-3xl p-5 sm:p-6">
      <p className="text-[12px] text-mist-400">
        Repaso focalizado · concepto {paso + 1} de {cs.length}
      </p>
      <div>
        <h3 className="font-display text-xl text-white">{c.nombre}</h3>
        <p className="mt-2 rounded-2xl bg-accent/6 p-4 text-[15px] leading-relaxed text-mist-100">{explicacionSencilla(c)}</p>
        {pistas(c).length > 0 && (
          <p className="mt-2 text-[12px] text-mist-400">
            Palabras clave para recordarlo: <span className="text-mist-200">{pistas(c).join(' · ')}</span>
          </p>
        )}
      </div>
      {!verPregunta ? (
        <Button variant="soft" onClick={() => setVerPregunta(true)}>
          Lo entendí: comprobarlo
        </Button>
      ) : q ? (
        <>
          <PreguntaView q={q} n={1} valor={resp[q.id]} onChange={(v) => setResp({ ...resp, [q.id]: v })} resultado={res[q.id]} />
          {!res[q.id] ? (
            <Button variant="primary" disabled={!respondida(q, resp[q.id])} onClick={() => setRes({ ...res, [q.id]: corregirPregunta(q, resp[q.id]) })}>
              Comprobar
            </Button>
          ) : (
            <Button
              variant="primary"
              icon={<ArrowRight className="size-4" />}
              onClick={() => {
                setPaso(paso + 1);
                setVerPregunta(false);
              }}
            >
              Siguiente
            </Button>
          )}
        </>
      ) : (
        <Button
          variant="primary"
          onClick={() => {
            setRes({ ...res, [c.key]: { preguntaId: c.key, estado: 'correcta', explicacion: '', acertados: [c.key], fallados: [] } });
            setPaso(paso + 1);
            setVerPregunta(false);
          }}
        >
          Siguiente
        </Button>
      )}
    </section>
  );
}

function Descanso({ siguiente, terminado }: { siguiente: BloqueEstudio; terminado: boolean }) {
  const S = useSmartStudy.getState;
  const ses = useSmartStudy((s) => s.sesion)!;
  const largo = (ses.timer?.duracionMs ?? 0) >= 15 * 60_000;
  return (
    <section className="grid gap-4 md:grid-cols-[auto_1fr]">
      {ses.timer && <TimerCard timer={ses.timer} />}
      <div className="glass space-y-4 rounded-3xl p-5 sm:p-6">
        <div>
          <h3 className="flex items-center gap-2 font-display text-lg text-white">
            <Coffee className="size-5 text-emerald-300" /> {largo ? 'Descanso largo' : 'Descanso'}
          </h3>
          <p className="mt-1 text-[13px] text-mist-300">El descanso es parte del aprendizaje: ayuda a recuperar la atención para el siguiente bloque.</p>
        </div>
        <ul className="grid gap-2 text-[13px] text-mist-200 sm:grid-cols-3">
          <li className="flex items-center gap-2 rounded-xl bg-white/4 p-3">
            <Footprints className="size-4 text-emerald-300" /> Levántate y muévete
          </li>
          <li className="flex items-center gap-2 rounded-xl bg-white/4 p-3">
            <GlassWater className="size-4 text-emerald-300" /> Toma agua
          </li>
          <li className="flex items-center gap-2 rounded-xl bg-white/4 p-3">
            <BookOpen className="size-4 text-emerald-300" /> Evita pantallas y redes
          </li>
        </ul>
        <div className="rounded-2xl border border-white/8 p-4">
          <p className="text-[12px] text-mist-400">Siguiente bloque</p>
          <p className="text-[14px] text-white">{siguiente.titulo}</p>
          <p className="text-[12px] text-mist-400">{siguiente.objetivo}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={terminado ? 'primary' : 'soft'} icon={<ArrowRight className="size-4" />} onClick={() => S().saltarDescanso()}>
            {terminado ? 'Empezar el siguiente bloque' : 'Saltar descanso y empezar'}
          </Button>
          <Button variant="ghost" onClick={() => S().salir()}>
            Terminar por hoy
          </Button>
        </div>
      </div>
    </section>
  );
}

function FinFase({ curso }: { curso: Curso }) {
  const ses = useSmartStudy((s) => s.sesion)!;
  const progreso = useSmartStudy((s) => s.progreso[curso.id]);
  const b = buscarBloque(curso, ses.bloqueId);
  const fase = b && curso.fases.find((f) => f.id === b.faseId);
  const notas = fase?.bloques.map((x) => progreso?.bloques[x.id]?.intentos.at(-1)?.nota ?? 0) ?? [];
  const media = notas.length ? notas.reduce((a, x) => a + x, 0) / notas.length : 0;
  const sig = siguientePendiente(curso, progreso);
  return (
    <section className="glass space-y-3 rounded-3xl p-6 text-center">
      <Trophy className="mx-auto size-9 text-amber-300" />
      <h3 className="font-display text-xl text-white">¡Fase {fase?.numero} completada!</h3>
      <p className="text-[13px] text-mist-300">
        Promedio de tus mini pruebas: <span className="text-white">{Math.round(media * 100)}%</span> · Hoy estudiaste {minutosHoy(progreso)} min.
      </p>
      <p className="mx-auto max-w-lg text-[13px] text-mist-400">{sig ? 'Lo mejor ahora es parar: dormir y dejar pasar tiempo antes de la siguiente fase consolida la memoria. Mañana empieza con tu repaso espaciado y después continúa.' : 'Terminaste todo el plan. Mantén lo aprendido con los repasos espaciados de los próximos días.'}</p>
      <div className="flex justify-center gap-2 pt-2">
        <Button variant="primary" onClick={() => useSmartStudy.getState().salir()}>
          Volver al plan
        </Button>
      </div>
    </section>
  );
}
