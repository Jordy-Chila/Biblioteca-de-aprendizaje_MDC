import { useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Box, GraduationCap, Home, Layers3, RotateCcw, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { useSession, type Page } from '../stores/session';
import { useAI } from '../stores/ai';
import { useUI } from '../stores/ui';
import { useViewer } from '../stores/viewer';
import { cx } from '../components/ui';
import { iaNombre } from '../stores/ai';

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
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-[70] -translate-x-1/2 md:bottom-6" aria-live="polite">
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

/** Barra de navegación inferior para teléfonos (al alcance del pulgar). */
function MobileNav({ hasDoc }: { hasDoc: boolean }) {
  const page = useSession((s) => s.page);
  const go = useSession((s) => s.goto);
  const tutorOpen = useUI((s) => s.tutorOpen);
  const items: { key: string; label: string; icon: typeof Home; on: boolean; disabled?: boolean; action(): void }[] = [
    { key: 'inicio', label: 'Inicio', icon: Home, on: page === 'dashboard' && !tutorOpen, action: () => (useUI.getState().set({ tutorOpen: false }), go('dashboard')) },
    { key: 'explorar', label: 'Explorar 3D', icon: Layers3, on: page === 'explorer' && !tutorOpen, disabled: !hasDoc, action: () => (useUI.getState().set({ tutorOpen: false }), go('explorer')) },
    { key: 'estudio', label: 'Estudio', icon: GraduationCap, on: page === 'study' && !tutorOpen, disabled: !hasDoc, action: () => (useUI.getState().set({ tutorOpen: false }), go('study')) },
    { key: 'tutor', label: 'Tutor', icon: Bot, on: tutorOpen, disabled: !hasDoc, action: () => (tutorOpen ? useUI.getState().set({ tutorOpen: false }) : useUI.getState().openTutor()) },
  ];
  return (
    <nav className="z-[57] flex shrink-0 border-t border-white/8 bg-ink-900/95 backdrop-blur-xl md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} aria-label="Secciones">
      {items.map(({ key, label, icon: Icon, on, disabled, action }) => (
        <button key={key} disabled={disabled} onClick={action} aria-current={on ? 'page' : undefined} className={cx('flex h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] transition disabled:opacity-30', on ? 'text-accent' : 'text-mist-300')}>
          <span className={cx('grid h-7 w-12 place-items-center rounded-full transition', on && 'bg-accent/15')}>
            <Icon className="size-[18px]" />
          </span>
          {label}
        </button>
      ))}
    </nav>
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
      <header data-dim={dimHeader} className="focus-dim z-40 flex h-12 shrink-0 items-center gap-2 border-b border-white/6 bg-ink-900/85 px-3 backdrop-blur-xl sm:px-5 md:h-14" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <button onClick={() => useSession.getState().goto('dashboard')} className="mr-2 flex items-center gap-2" aria-label="Ir al inicio">
          <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-accent to-violet text-ink-950 shadow-[0_0_20px_-4px_rgba(34,211,238,0.7)]">
            <Box className="size-4" />
          </span>
          <span className="font-display text-[15px] tracking-tight text-white">
            SES <span className="text-mist-400">· Lab 3D</span>
          </span>
        </button>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Secciones">
          <NavItem page="dashboard" icon={Home} label="Inicio" />
          <NavItem page="explorer" icon={Layers3} label="Explorador 3D" disabled={!hasDoc} />
          <NavItem page="study" icon={GraduationCap} label="Estudio" disabled={!hasDoc} />
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => useUI.getState().set({ aiSettings: true })} className={cx('inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-[12px] transition', aiStatus === 'conectado' ? 'border-purple-300/30 bg-purple-400/10 text-purple-200' : 'border-white/10 text-mist-300 hover:text-white')}>
            <Sparkles className="size-3.5" />
            <span className="hidden sm:inline">{aiStatus === 'conectado' ? `${iaNombre()} conectado` : aiStatus === 'verificando' ? 'Verificando…' : 'IA: modo local'}</span>
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
      <MobileNav hasDoc={hasDoc} />
      <Toast />
    </div>
  );
}
