import { cn } from '@/lib/utils';
import { StarField } from './EarthVisual';

/**
 * Ambient section backdrop: drifting grid, slow aurora blobs, orbit arcs and a
 * scanning sweep. Pure CSS motion layered behind content — cheap, and it keeps
 * the long-form sections from reading as flat walls of text.
 */
export function SpaceBackdrop({
  variant = 'a',
  stars = true,
  grid = true,
  scan = false,
  className,
}: {
  variant?: 'a' | 'b' | 'c';
  stars?: boolean;
  grid?: boolean;
  scan?: boolean;
  className?: string;
}) {
  const auroraTint =
    variant === 'b'
      ? ['rgba(56,217,238,0.10)', 'rgba(18,185,129,0.09)']
      : variant === 'c'
        ? ['rgba(18,185,129,0.11)', 'rgba(84,221,174,0.07)']
        : ['rgba(18,185,129,0.10)', 'rgba(56,217,238,0.08)'];

  return (
    <div className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden', className)} aria-hidden>
      {stars && <StarField className="absolute inset-0 h-full w-full opacity-45" />}

      {grid && (
        <div
          className="absolute inset-0 bg-grid-fine bg-grid-fine opacity-[0.55] motion-safe:animate-[sq-grid-pan_22s_linear_infinite]"
          style={{
            maskImage: 'radial-gradient(75% 60% at 50% 45%, #000 30%, transparent 78%)',
            WebkitMaskImage: 'radial-gradient(75% 60% at 50% 45%, #000 30%, transparent 78%)',
          }}
        />
      )}

      {/* Slow aurora blooms */}
      <div
        className="absolute left-[6%] top-[12%] h-[320px] w-[320px] rounded-full blur-3xl motion-safe:animate-[sq-float-a_18s_ease-in-out_infinite]"
        style={{ background: `radial-gradient(circle, ${auroraTint[0]}, transparent 68%)` }}
      />
      <div
        className="absolute right-[4%] bottom-[8%] h-[380px] w-[380px] rounded-full blur-3xl motion-safe:animate-[sq-float-b_23s_ease-in-out_infinite]"
        style={{ background: `radial-gradient(circle, ${auroraTint[1]}, transparent 70%)` }}
      />

      {/* Orbit arcs */}
      <svg
        viewBox="0 0 1200 600"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full opacity-[0.35]"
      >
        <g fill="none" stroke="rgba(90,160,180,0.22)" strokeWidth="0.8">
          <ellipse cx="600" cy="300" rx="560" ry="190" strokeDasharray="4 10" />
          <ellipse cx="600" cy="300" rx="420" ry="300" strokeDasharray="2 12" opacity="0.6" />
        </g>
      </svg>

      {scan && (
        <div className="absolute inset-x-0 top-0 h-full">
          <span className="absolute inset-x-0 h-28 bg-gradient-to-b from-transparent via-brand-400/[0.055] to-transparent motion-safe:animate-[sq-scan_9s_linear_infinite]" />
        </div>
      )}
    </div>
  );
}
