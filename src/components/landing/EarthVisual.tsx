import { useMemo } from 'react';
import { hashSeed, makeRng } from '@/lib/utils';

/**
 * Decorative hero backdrop, split into three layers so the hero can place
 * each one independently: starfield, limb-lit Earth with a downlink beam, and
 * a ridge silhouette. Pure SVG — no assets, no data.
 */

export function StarField({ className }: { className?: string }) {
  const stars = useMemo(() => {
    const rng = makeRng(hashSeed('satquery-stars'));
    return Array.from({ length: 150 }, () => ({
      x: rng() * 1000,
      y: rng() * 620,
      r: 0.35 + rng() * 1.15,
      o: 0.12 + rng() * 0.55,
    }));
  }, []);

  return (
    <svg
      viewBox="0 0 1000 620"
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#CFE8EE" opacity={s.o} />
      ))}
    </svg>
  );
}

export function EarthVisual({ className }: { className?: string }) {
  const lights = useMemo(() => {
    const rng = makeRng(hashSeed('satquery-earth-lights'));
    const pts: Array<{ x: number; y: number; r: number; o: number }> = [];
    for (let c = 0; c < 18; c += 1) {
      const ang = rng() * Math.PI * 2;
      const dist = Math.pow(rng(), 0.55) * 300;
      const cx = 500 + Math.cos(ang) * dist;
      const cy = 760 + Math.sin(ang) * dist * 0.9;
      const n = 4 + Math.floor(rng() * 10);
      for (let i = 0; i < n; i += 1) {
        pts.push({
          x: cx + (rng() - 0.5) * 80,
          y: cy + (rng() - 0.5) * 62,
          r: 0.6 + rng() * 1.5,
          o: 0.2 + rng() * 0.6,
        });
      }
    }
    return pts;
  }, []);

  return (
    <svg
      viewBox="0 0 1000 1000"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id="sq-earth-body" cx="40%" cy="24%" r="80%">
          <stop offset="0%" stopColor="#0D2C3C" />
          <stop offset="40%" stopColor="#07202E" />
          <stop offset="76%" stopColor="#04121B" />
          <stop offset="100%" stopColor="#02080C" />
        </radialGradient>
        <radialGradient id="sq-atmo" cx="50%" cy="50%" r="50%">
          <stop offset="84%" stopColor="rgba(42,203,147,0)" />
          <stop offset="94%" stopColor="rgba(42,203,147,0.28)" />
          <stop offset="100%" stopColor="rgba(56,217,238,0)" />
        </radialGradient>
        <clipPath id="sq-globe-clip">
          <circle cx="500" cy="760" r="372" />
        </clipPath>
        <filter id="sq-soft" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>

      {/* Orbital rings */}
      <g opacity="0.2" stroke="rgba(90,150,170,0.45)" fill="none">
        <ellipse cx="500" cy="760" rx="470" ry="168" strokeWidth="1" />
        <ellipse cx="500" cy="760" rx="540" ry="208" strokeWidth="1" strokeDasharray="5 10" />
      </g>

      <circle cx="500" cy="760" r="418" fill="url(#sq-atmo)" />

      <circle cx="500" cy="760" r="372" fill="url(#sq-earth-body)" />
      <g clipPath="url(#sq-globe-clip)">
        <g opacity="0.34" fill="#0E2F37">
          <ellipse cx="400" cy="480" rx="170" ry="66" />
          <ellipse cx="640" cy="530" rx="140" ry="56" />
          <ellipse cx="500" cy="630" rx="240" ry="90" />
          <ellipse cx="290" cy="628" rx="104" ry="50" />
        </g>
        <g>
          {lights.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={p.r} fill="#FFC98A" opacity={p.o} />
          ))}
        </g>
        <ellipse cx="740" cy="880" rx="470" ry="370" fill="#02070A" opacity="0.62" />
      </g>

      {/* Limb light */}
      <circle cx="500" cy="760" r="372" fill="none" stroke="rgba(120,232,202,0.5)" strokeWidth="1.5" />
      <circle
        cx="500"
        cy="760"
        r="372"
        fill="none"
        stroke="rgba(56,217,238,0.22)"
        strokeWidth="6"
        filter="url(#sq-soft)"
      />

    </svg>
  );
}

export function RidgeSilhouette({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 220"
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="sq-ridge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0A1A22" />
          <stop offset="100%" stopColor="#04090D" />
        </linearGradient>
      </defs>
      <path
        d="M0 132 L140 78 L232 112 L340 44 L436 104 L520 70 L640 126 L760 58 L880 110 L1010 66 L1200 122 L1200 220 L0 220 Z"
        fill="url(#sq-ridge)"
      />
    </svg>
  );
}
