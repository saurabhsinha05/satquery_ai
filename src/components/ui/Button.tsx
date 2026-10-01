import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'subtle' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-sheen text-[#04120C] font-semibold shadow-[0_10px_30px_-14px_rgba(18,185,129,0.75)] hover:brightness-110 active:brightness-95',
  secondary:
    'border border-edge-strong/70 bg-panel-raised/60 text-ink hover:border-brand-500/60 hover:bg-panel-high/70',
  ghost: 'text-ink-soft hover:text-ink hover:bg-white/[0.04]',
  subtle: 'bg-white/[0.04] text-ink-soft hover:bg-white/[0.07] hover:text-ink',
  danger: 'border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/16',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] rounded-lg gap-1.5',
  md: 'h-10 px-4 text-sm rounded-xl gap-2',
  lg: 'h-12 px-6 text-[15px] rounded-xl gap-2.5',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', leftIcon, rightIcon, block, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap',
        'transition-all duration-200 ease-premium',
        'disabled:pointer-events-none disabled:opacity-45',
        'active:translate-y-px',
        SIZES[size],
        VARIANTS[variant],
        block && 'w-full',
        className,
      )}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: 'sm' | 'md';
  active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = 'md', active, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cn(
        'inline-flex items-center justify-center rounded-lg text-ink-mute',
        'transition-all duration-200 ease-premium',
        'hover:bg-white/[0.06] hover:text-ink',
        'disabled:pointer-events-none disabled:opacity-40',
        size === 'sm' ? 'h-7 w-7' : 'h-9 w-9',
        active && 'bg-brand-500/14 text-brand-300',
        className,
      )}
    >
      {children}
    </button>
  );
});
