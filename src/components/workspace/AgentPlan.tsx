import type { AgentStep as AgentStepModel } from '@/lib/types';
import { AgentStep } from './AgentStep';

export function AgentPlan({ title, steps }: { title?: string; steps: AgentStepModel[] }) {
  const done = steps.filter((s) => s.status === 'complete').length;
  const running = steps.some((s) => s.status === 'active');

  return (
    <div className="mt-3.5">
      {title && <p className="mb-2.5 text-[13px] text-ink-soft">{title}</p>}

      <div className="overflow-hidden rounded-xl border border-edge/70 bg-black/20">
        <div className="flex items-center justify-between gap-3 border-b border-edge/50 px-3 py-2">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-dim">
            Plan
          </span>
          <span
            className="font-mono text-[10.5px] text-ink-dim"
            aria-live="polite"
            aria-atomic="true"
          >
            {done}/{steps.length}
          </span>
        </div>

        <ol className="space-y-0.5 p-1.5">
          {steps.map((step, index) => (
            <AgentStep key={step.id} step={step} index={index} />
          ))}
        </ol>

        <div className="h-[2px] w-full bg-black/40" aria-hidden>
          <div
            className="h-full bg-gradient-to-r from-brand-500 to-aqua-400 transition-[width] duration-500 ease-premium"
            style={{ width: `${(done / steps.length) * 100}%`, opacity: running ? 1 : 0.7 }}
          />
        </div>
      </div>
    </div>
  );
}
