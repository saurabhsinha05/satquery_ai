import { Check, CircleDashed } from 'lucide-react';
import type { AgentStep as AgentStepModel } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * One row of the agent plan. PENDING → ACTIVE → COMPLETE, with the restraint
 * of a status list rather than a loading spectacle.
 */
export function AgentStep({ step, index }: { step: AgentStepModel; index: number }) {
  const { status, label } = step;

  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-lg px-2.5 py-2 transition-all duration-300 ease-premium',
        status === 'active' && 'bg-brand-500/[0.06]',
      )}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <span className="relative flex h-[18px] w-[18px] shrink-0 items-center justify-center">
        {status === 'complete' && (
          <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-brand-500/45 bg-brand-500/15 text-brand-300">
            <Check className="h-2.5 w-2.5" strokeWidth={3.2} />
          </span>
        )}

        {status === 'active' && (
          <>
            <span
              className="absolute inset-0 rounded-full bg-brand-400/30 blur-[5px]"
              aria-hidden
            />
            <span className="relative flex h-[18px] w-[18px] items-center justify-center rounded-full border border-brand-400/60">
              <span className="h-[7px] w-[7px] rounded-full bg-brand-400" />
              <span
                className="absolute inset-[-2px] rounded-full border border-transparent border-t-brand-300 animate-spin-slow"
                aria-hidden
              />
            </span>
          </>
        )}

        {status === 'pending' && (
          <CircleDashed className="h-[18px] w-[18px] text-ink-faint" strokeWidth={1.6} />
        )}
      </span>

      <span
        className={cn(
          'flex-1 text-[13px] leading-snug transition-colors duration-300',
          status === 'complete' && 'text-ink-soft',
          status === 'active' && 'font-medium text-ink',
          status === 'pending' && 'text-ink-faint',
        )}
      >
        {label}
      </span>

      <span className="shrink-0" aria-hidden>
        {status === 'complete' && <Check className="h-3.5 w-3.5 text-brand-400/80" strokeWidth={2.6} />}
        {status === 'active' && (
          <span className="flex items-center gap-[3px]">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1 w-1 rounded-full bg-brand-300"
                style={{ animation: `dot-bounce 1.1s ${i * 0.14}s infinite ease-in-out` }}
              />
            ))}
          </span>
        )}
      </span>

      <span className="sr-only">
        {status === 'complete' ? 'completed' : status === 'active' ? 'in progress' : 'pending'}
      </span>
    </li>
  );
}
