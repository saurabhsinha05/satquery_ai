import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'brand' | 'neutral' | 'amber' | 'red' | 'cyan' | 'violet';

const TONES: Record<Tone, string> = {
  brand: 'border-brand-500/30 bg-brand-500/12 text-brand-300',
  neutral: 'border-edge-strong/60 bg-white/[0.04] text-ink-mute',
  amber: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
  red: 'border-red-400/25 bg-red-400/10 text-red-300',
  cyan: 'border-aqua-400/25 bg-aqua-400/10 text-aqua-300',
  violet: 'border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-300',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
  dot,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium leading-5',
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** Used anywhere output could otherwise be mistaken for a real measurement. */
export function DemoBadge({ className, label = 'Demo' }: { className?: string; label?: string }) {
  return (
    <Badge tone="neutral" className={cn('font-mono uppercase tracking-wider', className)}>
      {label}
    </Badge>
  );
}

export function StatusDot({
  tone = 'brand',
  pulse = true,
  className,
}: {
  tone?: 'brand' | 'amber' | 'red' | 'mute';
  pulse?: boolean;
  className?: string;
}) {
  const color =
    tone === 'brand'
      ? 'bg-brand-400'
      : tone === 'amber'
        ? 'bg-amber-400'
        : tone === 'red'
          ? 'bg-red-400'
          : 'bg-ink-dim';
  return (
    <span className={cn('relative inline-flex h-2 w-2', className)}>
      {pulse && (
        <span
          className={cn('absolute inset-0 rounded-full opacity-60 animate-pulse-ring', color)}
          aria-hidden
        />
      )}
      <span className={cn('relative h-2 w-2 rounded-full', color)} />
    </span>
  );
}
