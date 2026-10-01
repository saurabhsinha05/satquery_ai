import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-edge-strong/50',
        'bg-panel/40 px-8 py-14 text-center',
        className,
      )}
    >
      <div className="relative mb-5">
        <div className="absolute inset-0 -z-10 rounded-full bg-brand-500/10 blur-2xl" aria-hidden />
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-edge-strong/60 bg-panel-high/70 text-brand-300">
          {icon}
        </div>
      </div>
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-ink-mute text-pretty">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
