import { CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Toast as ToastModel } from '@/state/workspaceReducer';

export function ToastHost({ toast }: { toast: ToastModel | null }) {
  if (!toast) return null;

  const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'warn' ? TriangleAlert : Info;
  const accent =
    toast.tone === 'success'
      ? 'text-brand-300'
      : toast.tone === 'warn'
        ? 'text-amber-300'
        : 'text-aqua-300';

  return (
    <div
      className="pointer-events-none fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 px-4"
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          'pointer-events-auto flex items-center gap-2.5 rounded-xl border border-edge-strong/70',
          'bg-[#0A1720]/95 px-4 py-2.5 text-[13px] text-ink-soft shadow-lift backdrop-blur-xl',
          'animate-fade-up',
        )}
      >
        <Icon className={cn('h-4 w-4 shrink-0', accent)} />
        <span>{toast.text}</span>
      </div>
    </div>
  );
}
