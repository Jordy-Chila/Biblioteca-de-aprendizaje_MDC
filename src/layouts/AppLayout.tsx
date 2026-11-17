import { useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Box, GraduationCap, Home, Layers3, RotateCcw, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { useSession, type Page } from '../stores/session';
import { useAI } from '../stores/ai';
import { useUI } from '../stores/ui';
import { useViewer } from '../stores/viewer';
import { cx } from '../components/ui';

function NavItem({ page, icon: Icon, label, disabled }: { page: Page; icon: typeof Home; label: string; disabled?: boolean }) {
  const current = useSession((s) => s.page);
  const go = useSession((s) => s.goto);
  const on = current === page;
  return (
    <button disabled={disabled} onClick={() => go(page)} aria-current={on ? 'page' : undefined} className={cx('inline-flex h-9 items-center gap-2 rounded-xl px-3 text-[13px] transition disabled:cursor-not-allowed disabled:opacity-35', on ? 'bg-white/8 text-white' : 'text-mist-300 hover:text-white')}>
      <Icon className={cx('size-4', on && 'text-accent')} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function Toast() {
  const toast = useUI((s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => useUI.getState().set({ toast: undefined }), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[70] -translate-x-1/2" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div key={toast.nonce} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className={cx('glass flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[13px] shadow-2xl', toast.tone === 'error' ? 'text-rose-200' : 'text-white')}>
            {toast.tone === 'error' ? <AlertCircle className="size-4 text-rose-300" /> : <CheckCircle2 className="size-4 text-emerald-300" />}
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const hasDoc = useSession((s) => Boolean(s.activeDocId));
  const hasMaterials = useSession((s) => s.materials.length > 0);
  const aiStatus = useAI((s) => s.status);
  const dimHeader = useSession((s) => s.page === 'explorer' && Boolean(s.selection));

  const resetSession = () => {
    if (!window.confirm('¿Empezar una sesión nueva? Se borrarán los materiales, análisis, conversaciones y el progreso de esta sesión.')) return;
    useSession.getState().reset();
    useViewer.getState().clearAll();
    useAI.setState({ tutor: {}, fichas: {} });
    useUI.getState().notify('Sesión reiniciada.');
  };

  return (
    <div className="flex h-full flex-col">
      <header data-dim={dimHeader} className="focus-dim z-40 flex h-14 shrink-0 items-center gap-2 border-b border-white/6 bg-ink-900/85 px-3 backdrop-blur-xl sm:px-5">
        <button onClick={() => useSession.getState().goto('dashboard')} className="mr-2 flex items-center gap-2" aria-label="Ir al inicio">
          <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-accent to-violet text-ink-950 shadow-[0_0_20px_-4px_rgba(34,211,238,0.7)]">
            <Box className="size-4" />
          </span>
          <span className="hidden font-display text-[15px] tracking-tight text-white md:inline">
            SES <span className="text-mist-400">· Lab 3D</span>
          </span>
        </button>
        <nav className="flex items-center gap-1" aria-label="Secciones">
          <NavItem page="dashboard" icon={Home} label="Inicio" />
          <NavItem page="explorer" icon={Layers3} label="Explorador 3D" disabled={!hasDoc} />
          <NavItem page="study" icon={GraduationCap} label="Estudio" disabled={!hasDoc} />
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => useUI.getState().set({ aiSettings: true })} className={cx('inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-[12px] transition', aiStatus === 'conectado' ? 'border-purple-300/30 bg-purple-400/10 text-purple-200' : 'border-white/10 text-mist-300 hover:text-white')}>
            <Sparkles className="size-3.5" />
            <span className="hidden sm:inline">{aiStatus === 'conectado' ? 'Claude conectado' : aiStatus === 'verificando' ? 'Verificando…' : 'IA: modo local'}</span>
          </button>
          {hasMaterials && (
            <button onClick={resetSession} className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-[12px] text-mist-300 hover:bg-white/5 hover:text-white" title="Borrar todo y empezar de nuevo">
              <RotateCcw className="size-3.5" />
              <span className="hidden sm:inline">Nueva sesión</span>
            </button>
          )}
        </div>
      </header>
      <main className="min-h-0 flex-1">{children}</main>
      <Toast />
    </div>
  );
}
