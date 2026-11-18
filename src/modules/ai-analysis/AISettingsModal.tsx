import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { KeyRound, ShieldCheck, Sparkles, X, CheckCircle2, AlertCircle, ExternalLink, ChevronDown } from 'lucide-react';
import { useAI, type ProveedorExterno } from '../../stores/ai';
import { useUI } from '../../stores/ui';
import { useSession } from '../../stores/session';
import { DEFAULT_MODEL, MODELOS } from '../../services/ai/claudeProvider';
import { OPENAI_DEFAULT_MODEL, OPENAI_MODELOS } from '../../services/ai/openaiProvider';
import { enrichWithAI } from '../../services/document/pipeline';
import { Button, IconButton, cx } from '../../components/ui';

const PROVEEDORES: Record<ProveedorExterno, { nombre: string; empresa: string; placeholder: string; modelos: { id: string; nombre: string }[]; porDefecto: string; consola: string; pasos: string[]; api: string }> = {
  claude: {
    nombre: 'Claude',
    empresa: 'Anthropic',
    placeholder: 'sk-ant-…',
    modelos: MODELOS,
    porDefecto: DEFAULT_MODEL,
    consola: 'https://console.anthropic.com/settings/keys',
    api: 'api.anthropic.com',
    pasos: [
      'Entra en console.anthropic.com y crea una cuenta (es distinta de la suscripción de claude.ai).',
      'En «Billing» añade un método de pago o compra créditos: la API se cobra por uso.',
      'En «API Keys» pulsa «Create Key», ponle un nombre y copia la clave (empieza por sk-ant-).',
      'Pégala aquí y pulsa «Conectar».',
    ],
  },
  openai: {
    nombre: 'ChatGPT',
    empresa: 'OpenAI',
    placeholder: 'sk-…',
    modelos: OPENAI_MODELOS,
    porDefecto: OPENAI_DEFAULT_MODEL,
    consola: 'https://platform.openai.com/api-keys',
    api: 'api.openai.com',
    pasos: [
      'Entra en platform.openai.com e inicia sesión (la suscripción ChatGPT Plus no incluye la API).',
      'En «Settings → Billing» añade un método de pago o crédito: la API se cobra por uso.',
      'En «API keys» pulsa «Create new secret key» y copia la clave (empieza por sk-).',
      'Pégala aquí y pulsa «Conectar».',
    ],
  },
};

export function AISettingsModal() {
  const open = useUI((s) => s.aiSettings);
  const close = () => useUI.getState().set({ aiSettings: false });
  const { status, error, model, ia, connect, disconnect } = useAI();
  const [prov, setProv] = useState<ProveedorExterno>('claude');
  const [key, setKey] = useState('');
  const [mdl, setMdl] = useState(model);
  const [ayuda, setAyuda] = useState(false);
  const P = PROVEEDORES[prov];

  const elegir = (p: ProveedorExterno) => {
    setProv(p);
    setMdl(PROVEEDORES[p].porDefecto);
    setKey('');
  };

  const onConnect = async () => {
    const ok = await connect(key, mdl, prov);
    if (ok) {
      setKey('');
      useUI.getState().notify(`${P.nombre} conectado. Las funciones de IA ya están disponibles.`);
      // Mejorar los materiales ya cargados
      for (const m of useSession.getState().materials) if (m.status === 'listo' && m.docId && useSession.getState().plans[m.docId]?.proveedor === 'local') void enrichWithAI(m.id);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] grid place-items-end bg-black/60 backdrop-blur-sm sm:place-items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <motion.div role="dialog" aria-modal aria-labelledby="ai-title" className="glass max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl sm:p-6" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }} initial={{ y: 40, opacity: 0.6 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-2xl bg-purple-400/15 text-purple-300">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <h2 id="ai-title" className="font-display text-lg text-white">
                    Configuración de IA
                  </h2>
                  <p className="text-[13px] text-mist-400">Proveedor actual: {status === 'conectado' && ia ? ia.nombre : 'Análisis local (sin IA externa)'}</p>
                </div>
              </div>
              <IconButton label="Cerrar" onClick={close}>
                <X className="size-4" />
              </IconButton>
            </div>

            <p className="mt-4 rounded-2xl bg-white/4 p-3 text-[13px] leading-relaxed text-mist-300">
              Sin IA externa ya funcionan el análisis, los modelos 3D y las actividades. Con Claude o ChatGPT se añaden: el <strong className="text-white">tutor con respuestas redactadas</strong>, fichas completas por estructura, preguntas generadas y corrección de respuestas abiertas.
            </p>

            {status === 'conectado' && ia ? (
              <div className="mt-5 space-y-4">
                <p className="flex items-center gap-2 text-sm text-emerald-300">
                  <CheckCircle2 className="size-4" /> Conectado con {ia.nombre} · {model}
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
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Proveedor de IA">
                  {(Object.keys(PROVEEDORES) as ProveedorExterno[]).map((p) => (
                    <button key={p} type="button" role="radio" aria-checked={prov === p} onClick={() => elegir(p)} className={cx('rounded-2xl border p-3 text-left transition', prov === p ? 'border-accent/60 bg-accent/10' : 'border-white/10 hover:border-white/25')}>
                      <span className="block text-[14px] font-semibold text-white">{PROVEEDORES[p].nombre}</span>
                      <span className="block text-[12px] text-mist-400">{PROVEEDORES[p].empresa}</span>
                    </button>
                  ))}
                </div>

                <div className="rounded-2xl border border-white/8">
                  <button type="button" onClick={() => setAyuda((a) => !a)} className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[13px] text-cyan-200" aria-expanded={ayuda}>
                    ¿Cómo consigo la clave de {P.nombre}?
                    <ChevronDown className={cx('size-4 transition', ayuda && 'rotate-180')} />
                  </button>
                  {ayuda && (
                    <div className="space-y-2 border-t border-white/8 px-3 py-3">
                      <ol className="list-decimal space-y-1.5 pl-5 text-[13px] text-mist-300">
                        {P.pasos.map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ol>
                      <a href={P.consola} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-[13px] text-accent hover:underline">
                        Abrir la página de claves de {P.empresa} <ExternalLink className="size-3.5" />
                      </a>
                      <p className="text-[12px] text-orange-200/90">No compartas la clave ni la muestres en una presentación: quien la tenga puede gastar tu saldo. Si se expone, revócala en esa misma página.</p>
                    </div>
                  )}
                </div>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-2 text-[13px] text-mist-200">
                    <KeyRound className="size-3.5" /> Clave de API de {P.empresa}
                  </span>
                  <input
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder={P.placeholder}
                    className="h-11 w-full rounded-xl border border-white/10 bg-ink-950/60 px-3 font-mono text-sm text-white placeholder:text-mist-400/60 focus:border-accent/60 focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[13px] text-mist-200">Modelo</span>
                  <select value={P.modelos.some((m) => m.id === mdl) ? mdl : P.porDefecto} onChange={(e) => setMdl(e.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-ink-950/60 px-3 text-sm text-white focus:border-accent/60 focus:outline-none">
                    {P.modelos.map((m) => (
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
                  {status === 'verificando' ? 'Verificando la clave…' : `Conectar con ${P.nombre}`}
                </Button>
              </form>
            )}

            <p className="mt-5 flex items-start gap-2 text-[12px] leading-relaxed text-mist-400">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" />
              La clave se guarda solo en la memoria de esta pestaña y se envía únicamente a {status === 'conectado' && ia ? (ia.id === 'openai' ? 'api.openai.com' : 'api.anthropic.com') : P.api}, junto con el texto del documento. Al recargar o cerrar la página se borra. El uso se factura a tu cuenta.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
