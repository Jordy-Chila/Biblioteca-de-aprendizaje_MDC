import { AnimatePresence, motion } from 'framer-motion';
import { Box, Brain, FlaskConical, Atom, Globe2, Cpu, Shapes, Clock3, ShieldCheck, Sparkles, KeyRound } from 'lucide-react';
import { useSession } from '../stores/session';
import { useAI } from '../stores/ai';
import { useUI } from '../stores/ui';
import { UploadZone } from '../modules/documents/UploadZone';
import { MaterialCard } from '../modules/documents/MaterialCard';

const CAPACIDADES = [
  { icon: Brain, t: 'Anatomía', d: 'Cerebro, corazón, pelvis, útero gestante' },
  { icon: FlaskConical, t: 'Biología', d: 'Célula eucariota, doble hélice de ADN' },
  { icon: Atom, t: 'Química y física', d: 'Átomos, moléculas, fuerzas, circuitos' },
  { icon: Globe2, t: 'Tierra y espacio', d: 'Capas terrestres, sistema solar' },
  { icon: Cpu, t: 'Informática', d: 'Componentes de PC, redes' },
  { icon: Shapes, t: 'Matemáticas', d: 'Cuerpos geométricos y superficies' },
  { icon: Clock3, t: 'Cualquier materia', d: 'Procesos animados, líneas de tiempo, mapas de conceptos y comparaciones' },
];

export function DashboardPage() {
  const materials = useSession((s) => s.materials);
  const aiStatus = useAI((s) => s.status);
  const empty = materials.length === 0;
  return (
    <div className="grid-bg h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <AnimatePresence mode="popLayout">
          {empty && (
            <motion.header key="hero" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-10 max-w-3xl">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/8 px-3 py-1 text-[12px] text-cyan-200">
                <Box className="size-3.5" /> Laboratorio de estudio 3D
              </p>
              <h1 className="font-display text-4xl leading-[1.08] text-white sm:text-5xl">
                No solo leas lo que estudias.
                <br />
                <span className="bg-gradient-to-r from-accent to-violet bg-clip-text text-transparent">Explóralo.</span>
              </h1>
              <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-mist-300">
                Adjunta tu material y la plataforma identifica sus temas, estructuras, procesos y conceptos para convertirlos en modelos 3D, animaciones paso a paso, mapas y actividades de estudio. Cada dato indica si viene de tu documento o es información complementaria.
              </p>
            </motion.header>
          )}
        </AnimatePresence>

        <section aria-label="Nueva sesión de estudio" className="mb-8">
          <UploadZone compact={!empty} />
        </section>

        {!empty && (
          <section aria-label="Materiales de la sesión">
            <div className="mb-4">
              <h2 className="font-display text-xl text-white">Materiales de esta sesión</h2>
              <p className="text-[13px] text-mist-400">Se conservan solo mientras la pestaña esté abierta.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <AnimatePresence>
                {materials.map((m) => (
                  <MaterialCard key={m.id} m={m} />
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}

        {empty && (
          <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="glass rounded-3xl p-6">
              <h2 className="mb-4 font-display text-lg text-white">Representaciones disponibles</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {CAPACIDADES.map(({ icon: Icon, t, d }) => (
                  <li key={t} className="flex gap-3 rounded-2xl bg-white/3 p-3">
                    <Icon className="mt-0.5 size-5 shrink-0 text-accent" />
                    <div>
                      <p className="text-[14px] text-white">{t}</p>
                      <p className="text-[12px] text-mist-400">{d}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[12px] text-mist-400">Si un tema no corresponde a ningún modelo, se usa una representación alternativa (proceso, mapa de conceptos o estructura) en lugar de forzar un modelo incorrecto.</p>
            </div>
            <div className="space-y-4">
              <div className="glass rounded-3xl p-6">
                <h2 className="mb-2 flex items-center gap-2 font-display text-lg text-white">
                  <ShieldCheck className="size-5 text-emerald-300" /> Privacidad
                </h2>
                <p className="text-[13px] leading-relaxed text-mist-300">Los documentos se leen y analizan dentro de tu navegador. No hay servidor, cuentas ni almacenamiento: al recargar o cerrar la pestaña todo se borra.</p>
              </div>
              <div className="glass rounded-3xl p-6">
                <h2 className="mb-2 flex items-center gap-2 font-display text-lg text-white">
                  <Sparkles className="size-5 text-purple-300" /> IA opcional
                </h2>
                <p className="text-[13px] leading-relaxed text-mist-300">El análisis básico funciona sin servicios de IA. Para fichas detalladas, tutor con respuestas redactadas y preguntas generadas, conecta Claude con tu propia clave.</p>
                <button onClick={() => useUI.getState().set({ aiSettings: true })} className="mt-3 inline-flex items-center gap-2 text-[13px] text-accent hover:underline">
                  <KeyRound className="size-3.5" /> {aiStatus === 'conectado' ? 'Claude conectado' : 'Configurar IA'}
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
