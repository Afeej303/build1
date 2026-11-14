import React, { useEffect, useState, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes } from 'react';
import { AnimatePresence, motion, animate, useMotionValue, useTransform } from 'motion/react';
import { cn } from '../../lib/utils';
import type { Status } from '../../lib/hqms';
import { ArrowRight, Loader2 } from 'lucide-react';

export const ease = [0.22, 1, 0.36, 1] as const;

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold tracking-tight', className)}>
      <span className="grid size-6 place-items-center rounded-[7px] bg-ink text-ink-foreground">
        <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor">
          <path d="M6.5 2h3v4.5H14v3H9.5V14h-3V9.5H2v-3h4.5z" />
        </svg>
      </span>
      HQMS
    </span>
  );
}

/**
 * Dedicated Header for a single role.
 * NEVER renders switcher links to other roles!
 */
export function Header({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <header className="glass sticky top-0 z-40 border-b border-border/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Logo className="text-[15px]" />
          <span className="h-4 w-px bg-border hidden sm:block" />
          <div className="hidden sm:block">
            <span className="text-sm font-medium text-foreground">{title}</span>
            {subtitle && <span className="ml-2 text-xs text-muted-foreground">{subtitle}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">{right}</div>
      </div>
    </header>
  );
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease }}
      className={cn('mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12', className)}
    >
      {children}
    </motion.main>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ink' | 'ghost' | 'soft' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
};

export function Btn({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  disabled,
  ...p
}: BtnProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'press inline-flex items-center justify-center gap-2 rounded-full font-medium outline-none focus-visible:ring-4 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
        {
          sm: 'h-8 px-3.5 text-[13px]',
          md: 'h-10 px-5 text-sm',
          lg: 'h-12 px-6 text-[15px]',
        }[size],
        {
          primary: 'bg-primary text-primary-foreground hover:brightness-110 shadow-sm',
          ink: 'bg-ink text-ink-foreground hover:opacity-90 shadow-sm',
          ghost: 'text-primary hover:bg-accent',
          soft: 'bg-muted text-foreground hover:bg-border/70',
          danger: 'bg-destructive/10 text-destructive hover:bg-destructive/15',
        }[variant],
        className
      )}
      {...p}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : children}
    </button>
  );
}

export function Field({
  label,
  className,
  ...p
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-[12px] font-medium text-muted-foreground">{label}</span>
      <input
        className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-[15px] outline-none transition-[box-shadow,border-color] duration-200 placeholder:text-muted-foreground/60 focus:border-primary focus:ring-4 focus:ring-ring"
        {...p}
      />
    </label>
  );
}

const statusStyle: Record<Status, string> = {
  waiting: 'bg-muted text-muted-foreground',
  called: 'bg-accent text-accent-foreground',
  done: 'bg-success-soft text-success',
};

const statusLabel: Record<Status, string> = {
  waiting: 'Waiting',
  called: 'Called',
  done: 'Completed',
};

export function StatusPill({ status, className }: { status: Status; className?: string }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={status}
        initial={{ opacity: 0, scale: 0.85, filter: 'blur(4px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, scale: 0.85, filter: 'blur(4px)' }}
        transition={{ duration: 0.22, ease }}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium',
          statusStyle[status],
          className
        )}
      >
        <span className={cn('size-1.5 rounded-full bg-current', status === 'called' && 'pulse-dot')} />
        {statusLabel[status]}
      </motion.span>
    </AnimatePresence>
  );
}

export function SwapText({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cn('relative inline-flex overflow-hidden', className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
          transition={{ duration: 0.35, ease }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function CountUp({ value, className }: { value: number; className?: string }) {
  const mv = useMotionValue(value);
  const r = useTransform(mv, (v) => Math.round(v).toString());
  const [txt, setTxt] = useState(String(value));
  useEffect(() => r.on('change', setTxt), [r]);
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.5, ease });
    return () => c.stop();
  }, [value, mv]);
  return <span className={cn('tabular-nums', className)}>{txt}</span>;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('surface p-5', className)}>{children}</div>;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground', className)}>
      {children}
    </p>
  );
}

export function SignIn({
  role,
  hint,
  onDone,
}: {
  role: string;
  hint: string;
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  return (
    <div className="grid min-h-[70vh] place-items-center px-4">
      <motion.form
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease }}
        onSubmit={(e) => {
          e.preventDefault();
          setLoading(true);
          setTimeout(onDone, 600);
        }}
        className="w-full max-w-sm"
      >
        <Logo className="mb-8 text-base" />
        <h1 className="text-3xl font-semibold tracking-tight">{role}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
        <div className="mt-8 space-y-3">
          <Field label="Staff ID" placeholder="Enter Staff ID" required />
          <Field label="Password" type="password" placeholder="••••••••" required />
        </div>
        <Btn type="submit" variant="ink" size="lg" loading={loading} className="mt-6 w-full">
          Sign In <ArrowRight className="size-4" />
        </Btn>
      </motion.form>
    </div>
  );
}

export function useSession(key: string) {
  const [on, setOn] = useState(true); // default authenticated for seamless development review
  useEffect(() => {
    const val = sessionStorage.getItem(key);
    if (val !== null) {
      setOn(val === '1');
    }
  }, [key]);
  return [
    on,
    (v: boolean) => {
      sessionStorage.setItem(key, v ? '1' : '0');
      setOn(v);
    },
  ] as const;
}

export function minutesAgo(t: number) {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  return m === 0 ? 'just now' : `${m} min ago`;
}
