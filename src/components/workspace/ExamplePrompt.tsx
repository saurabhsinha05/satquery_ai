import { ArrowUpRight, Building2, Droplets, Layers3, TreePine } from 'lucide-react';
import type { AnalysisKind } from '@/lib/types';
import { cn } from '@/lib/utils';

const ICONS: Record<AnalysisKind, typeof Building2> = {
  urban: Building2,
  vegetation: TreePine,
  water: Droplets,
  landuse: Layers3,
  generic: Layers3,
};

export function ExamplePrompt({
  label,
  hint,
  kind,
  onSelect,
  className,
  index = 0,
}: {
  label: string;
  hint?: string;
  kind: AnalysisKind;
  onSelect: (label: string) => void;
  className?: string;
  index?: number;
}) {
  const Icon = ICONS[kind];

  return (
    <button
      type="button"
      onClick={() => onSelect(label)}
      style={{ animationDelay: `${120 + index * 60}ms` }}
      className={cn(
        'group flex w-full items-start gap-3 rounded-xl border border-edge/60 bg-panel/40 p-3.5 text-left',
        'transition-all duration-200 ease-premium animate-fade-up',
        'hover:-translate-y-0.5 hover:border-brand-500/30 hover:bg-panel-raised/60',
        className,
      )}
    >
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-500/[0.09] text-brand-300">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[13px] leading-snug text-ink-soft group-hover:text-ink">
          {label}
        </span>
        {hint && (
          <span className="mt-1 block font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">
            {hint}
          </span>
        )}
      </span>

      <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint transition-all duration-200 ease-premium group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-300" />
    </button>
  );
}
