import { LogoMark } from '@/components/brand/Logo';

/** Shown while a route chunk loads — never a blank screen. */
export function RouteFallback() {
  return (
    <div className="flex min-h-full items-center justify-center bg-void">
      <div className="flex flex-col items-center gap-5" role="status" aria-live="polite">
        <div className="relative">
          <span className="absolute inset-0 rounded-2xl bg-brand-500/20 blur-xl animate-pulse" aria-hidden />
          <LogoMark className="relative h-11 w-11" />
        </div>
        <div className="h-[3px] w-40 overflow-hidden rounded-full bg-panel-high">
          <span className="block h-full w-1/3 rounded-full bg-gradient-to-r from-brand-500 to-aqua-400 animate-[shimmer_1.2s_ease-in-out_infinite]" />
        </div>
        <span className="text-[12px] text-ink-dim">Preparing your workspace…</span>
      </div>
    </div>
  );
}
