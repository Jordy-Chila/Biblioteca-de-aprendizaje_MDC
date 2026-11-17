import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { KeyRound, ShieldCheck, Sparkles, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAI } from '../../stores/ai';
import { useUI } from '../../stores/ui';
import { useSession } from '../../stores/session';
import { MODELOS } from '../../services/ai/claudeProvider';
import { enrichWithAI } from '../../services/document/pipeline';
import { Button, IconButton } from '../../components/ui';

export function AISettingsModal() {
  const open = useUI((s) => s.aiSettings);
  const close = () => useUI.getState().set({ aiSettings: false });
  const { status, error, model, connect, disconnect } = useAI();
  const [key, setKey] = useState('');
  const [mdl, setMdl] = useState(model);

  const onConnect = async () => {
    const ok = await connect(key, mdl);
    if (ok) {
      setKey('');
      useUI.getState().notify('Claude conectado. Las funciones de IA ya están disponibles.');
      // Mejorar los materiales ya cargados
      for (const m of useSession.getState().materials) if (m.status === 'listo' && m.docId && useSession.getState().plans[m.docId]?.proveedor === 'local') void enrichWithAI(m.id);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <motion.div role="dialog" aria-modal aria-labelledby="ai-title" className="glass w-full max-w-lg rounded-3xl p-6" initial={{ y: 20, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 10, opacity: 0 }}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-2xl bg-purple-400/15 text-purple-300">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <h2 id="ai-title" className="font-display text-lg text-white">
                    Configuración de IA
                  </h2>
                  <p className="text-[13px] text-mist-400">Proveedor actual: {status === 'conectado' ? 'Claude (Anthropic)' : 'Análisis local (sin IA externa)'}</p>
                </div>
              </div>
              <IconButton label="Cerrar" onClick={close}>
                <X className="size-4" />
              </IconButton>
            </div>

            <div className="mt-5 space-y-3 rounded-2xl bg-white/4 p-4 text-[13px] text-mist-300">
              <p>
                <strong className="text-white">Sin IA externa</strong> la plataforma ya extrae temas, conceptos, procesos, tablas, preguntas y genera las visualizaciones y actividades a partir del texto literal del documento.
              </p>
              <p>
                <strong className="text-white">Con Claude</strong> se añaden: clasificación de la materia, fichas detalladas por estructura, relaciones entre conceptos, el tutor que redacta respuestas, preguntas generadas, resúmenes y corrección de respuestas abiertas.
              </p>
            </div>

            {status === 'conectado' ? (
              <div className="mt-5 space-y-4">
                <p className="flex items-center gap-2 text-sm text-emerald-300">
                  <CheckCircle2 className="size-4" /> Conectado con {MODELOS.find((m) => m.id === model)?.nombre ?? model}
                </p>
                <Button variant="danger" onClick={disconnect}>
                  Desconectar y borrar la clave
                </Button>
              </div>
            ) : (
              <form
                className="mt-5 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void onConnect();
                }}
              >
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-2 text-[13px] text-mist-200">
                    <KeyRound className="size-3.5" /> Clave de API de Anthropic
                  </span>
                  <input
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="sk-ant-…"
                    className="h-11 w-full rounded-xl border border-white/10 bg-ink-950/60 px-3 font-mono text-sm text-white placeholder:text-mist-400/60 focus:border-accent/60 focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[13px] text-mist-200">Modelo</span>
                  <select value={mdl} onChange={(e) => setMdl(e.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-ink-950/60 px-3 text-sm text-white focus:border-accent/60 focus:outline-none">
                    {MODELOS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                {status === 'error' && error && (
                  <p className="flex items-start gap-2 text-[13px] text-rose-300">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
                  </p>
                )}
                <Button type="submit" variant="primary" loading={status === 'verificando'} className="w-full">
                  {status === 'verificando' ? 'Verificando la clave…' : 'Conectar con Claude'}
                </Button>
              </form>
            )}

            <p className="mt-5 flex items-start gap-2 text-[12px] leading-relaxed text-mist-400">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" />
              La clave se guarda solo en la memoria de esta pestaña y se envía únicamente a la API de Anthropic (api.anthropic.com) junto con el texto del documento. Al recargar o cerrar la página se borra. El uso se factura a tu cuenta de Anthropic. Consigue una clave en console.anthropic.com.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
