import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('sq-skeleton', className)} aria-hidden />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-3', i === lines - 1 ? 'w-2/3' : i % 2 === 0 ? 'w-full' : 'w-11/12')}
        />
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-3', className)} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="sq-card overflow-hidden p-4">
          <Skeleton className="mb-4 h-28 w-full rounded-xl" />
          <Skeleton className="mb-2 h-3.5 w-2/3" />
          <Skeleton className="mb-2 h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonRows({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="sq-card flex items-center gap-4 p-4">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-7 w-20 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/** Placeholder used while the result panel is preparing its canvas. */
export function SkeletonMap({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-edge/70 bg-[#060F15]',
        className,
      )}
      aria-hidden
    >
      <div className="absolute inset-0 bg-grid-fine bg-grid-fine opacity-40" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-400/50 to-transparent animate-sweep-y" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-24 w-24 rounded-full border border-brand-500/20 bg-brand-500/[0.06] blur-[2px]" />
      </div>
    </div>
  );
}
