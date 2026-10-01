import { cn } from '@/lib/utils';

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        'flex items-start justify-between gap-6 py-3',
        disabled && 'cursor-not-allowed opacity-55',
      )}
    >
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-ink-soft">{label}</span>
        {description && (
          <span className="mt-1 block text-[12px] leading-relaxed text-ink-dim">{description}</span>
        )}
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-[22px] w-[38px] shrink-0 rounded-full border transition-colors duration-200 ease-premium',
          checked
            ? 'border-brand-500/50 bg-brand-500/30'
            : 'border-edge-strong/60 bg-white/[0.04]',
        )}
      >
        <span
          className={cn(
            'absolute top-1/2 h-[15px] w-[15px] -translate-y-1/2 rounded-full transition-all duration-200 ease-premium',
            checked ? 'left-[19px] bg-brand-300' : 'left-[3px] bg-ink-dim',
          )}
        />
      </button>
    </label>
  );
}
