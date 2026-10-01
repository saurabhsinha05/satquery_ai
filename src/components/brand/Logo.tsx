import { cn } from '@/lib/utils';

/** The scanning-reticle mark from the product identity. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn('relative inline-flex', className)}>
      <span
        className="absolute inset-0 -z-10 rounded-xl bg-brand-500/25 blur-md"
        aria-hidden
      />
      <svg viewBox="0 0 32 32" className="h-full w-full" role="img" aria-label="SatQuery AI">
        <rect width="32" height="32" rx="9" fill="#07131A" />
        <rect
          x="0.6"
          y="0.6"
          width="30.8"
          height="30.8"
          rx="8.4"
          fill="none"
          stroke="rgba(42,203,147,0.35)"
          strokeWidth="1.2"
        />
        <circle cx="14.4" cy="14.4" r="7.1" fill="none" stroke="#12B981" strokeWidth="1.9" />
        <circle cx="14.4" cy="14.4" r="2.5" fill="#2ACB93" />
        <path
          d="M14.4 4.6v2.6M14.4 21.6v2.6M4.6 14.4h2.6M21.6 14.4h2.6"
          stroke="#38D9EE"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path d="M19.7 19.7l5.6 5.6" stroke="#12B981" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function Logo({
  className,
  tagline = true,
  size = 'md',
}: {
  className?: string;
  tagline?: boolean;
  size?: 'sm' | 'md';
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className={size === 'sm' ? 'h-7 w-7' : 'h-9 w-9'} />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            'font-semibold tracking-[0.02em] text-ink',
            size === 'sm' ? 'text-[13.5px]' : 'text-[15px]',
          )}
        >
          SATQUERY <span className="text-brand-400">AI</span>
        </span>
        {tagline && (
          <span className="mt-1 text-[10.5px] font-medium tracking-[0.04em] text-ink-dim">
            Ask Earth Anything.
          </span>
        )}
      </span>
    </span>
  );
}
