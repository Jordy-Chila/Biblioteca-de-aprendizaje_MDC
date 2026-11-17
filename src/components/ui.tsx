import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'ghost' | 'soft' | 'danger' | 'outline';
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-ink-950 hover:bg-cyan-300 font-semibold shadow-[0_0_24px_-6px_rgba(34,211,238,0.6)]',
  ghost: 'text-mist-200 hover:bg-white/5 hover:text-white',
  soft: 'bg-white/5 text-mist-100 hover:bg-white/10 border border-white/5',
  outline: 'border border-white/15 text-mist-100 hover:border-accent/60 hover:text-white',
  danger: 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-500/20',
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; loading?: boolean; icon?: ReactNode }>(
  ({ variant = 'soft', size = 'md', loading, icon, className, children, disabled, ...rest }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed select-none',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm',
        variants[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

export function IconButton({ label, active, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cx(
        'inline-flex size-9 items-center justify-center rounded-xl transition-colors disabled:opacity-30',
        active ? 'bg-accent/15 text-accent ring-1 ring-accent/40' : 'text-mist-300 hover:bg-white/8 hover:text-white',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Badge({ tone = 'default', children, className }: { tone?: 'default' | 'accent' | 'doc' | 'extra' | 'gen' | 'warn' | 'danger'; children: ReactNode; className?: string }) {
  const tones = {
    default: 'bg-white/6 text-mist-300 border-white/8',
    accent: 'bg-accent/12 text-cyan-200 border-accent/25',
    doc: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/25',
    extra: 'bg-amber-400/10 text-amber-300 border-amber-400/25',
    gen: 'bg-purple-400/10 text-purple-300 border-purple-400/25',
    warn: 'bg-orange-400/10 text-orange-300 border-orange-400/25',
    danger: 'bg-rose-500/10 text-rose-300 border-rose-500/25',
  };
  return <span className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide', tones[tone], className)}>{children}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('size-4 animate-spin text-accent', className)} />;
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cx('h-1.5 w-full overflow-hidden rounded-full bg-white/8', className)} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-gradient-to-r from-accent to-violet transition-[width] duration-300" style={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange(v: T): void; items: { value: T; label: ReactNode; icon?: ReactNode }[]; className?: string }) {
  return (
    <div role="tablist" className={cx('flex gap-1 overflow-x-auto rounded-2xl bg-white/4 p-1', className)}>
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cx('inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-1.5 text-[13px] transition-colors', value === it.value ? 'bg-ink-600 text-white shadow' : 'text-mist-300 hover:text-white')}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      {icon && <div className="text-mist-400">{icon}</div>}
      <p className="font-display text-base text-mist-100">{title}</p>
      {children && <div className="max-w-md text-sm text-mist-400">{children}</div>}
    </div>
  );
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
