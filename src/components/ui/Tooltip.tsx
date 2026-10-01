import { useId, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Minimal hover/focus tooltip. Deliberately CSS-positioned rather than
 * portal-based — the product never needs one near a viewport edge.
 */
export function Tooltip({
  label,
  children,
  side = 'top',
  className,
}: {
  label: string;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  const position = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }[side];

  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined} className="inline-flex">
        {children}
      </span>
      <span
        id={id}
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 whitespace-nowrap rounded-lg border border-edge-strong/70',
          'bg-[#0B1720]/95 px-2.5 py-1.5 text-[11.5px] font-medium text-ink-soft shadow-lift backdrop-blur',
          'transition-all duration-150 ease-premium',
          position,
          open ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 translate-y-1',
        )}
      >
        {label}
      </span>
    </span>
  );
}
