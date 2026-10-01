import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function SectionHeading({
  eyebrow,
  title,
  body,
  align = 'left',
  className,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  body?: string;
  align?: 'left' | 'center';
  className?: string;
  children?: ReactNode;
}) {
  const centered = align === 'center';
  return (
    <div className={cn(centered ? 'mx-auto max-w-[780px] text-center' : 'max-w-[620px]', className)}>
      <p
        className={cn(
          'sq-eyebrow flex items-center gap-3',
          centered && 'justify-center',
        )}
      >
        <span className="h-px w-7 bg-gradient-to-r from-transparent to-brand-500/60" />
        {eyebrow}
        {centered && <span className="h-px w-7 bg-gradient-to-l from-transparent to-brand-500/60" />}
      </p>

      <h2 className="mt-5 text-[clamp(1.65rem,3.2vw,2.3rem)] font-bold leading-[1.15] tracking-[-0.025em] text-balance">
        {title}
      </h2>

      {body && (
        <p
          className={cn(
            'mt-4 text-[14.5px] leading-[1.65] text-ink-mute text-pretty',
            centered ? 'mx-auto max-w-[520px]' : 'max-w-[520px]',
          )}
        >
          {body}
        </p>
      )}

      {children}
    </div>
  );
}
