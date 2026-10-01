import { useEffect, useRef } from 'react';
import { TEX_H, TEX_W, buildEarthTextures } from '@/lib/earthTexture';
import { cn, prefersReducedMotion } from '@/lib/utils';

/** Internal render resolution — upscaled to whatever the layout gives it. */
const SIZE = 400;
/** Seconds for one full rotation. */
const PERIOD = 120;
const TILT = (16 * Math.PI) / 180;

interface Precomputed {
  inside: Uint8Array;
  rowBase: Int32Array;
  uBase: Int32Array;
  lambert: Uint8Array;
  rim: Uint8Array;
  spec: Uint8Array;
}

let precomputed: Precomputed | null = null;

function precompute(): Precomputed {
  if (precomputed) return precomputed;

  const n = SIZE * SIZE;
  const inside = new Uint8Array(n);
  const rowBase = new Int32Array(n);
  const uBase = new Int32Array(n);
  const lambert = new Uint8Array(n);
  const rim = new Uint8Array(n);
  const spec = new Uint8Array(n);

  // Sun from the upper left, slightly in front.
  const lx = -0.52;
  const ly = -0.42;
  const lz = 0.74;
  const ll = Math.hypot(lx, ly, lz);
  const sunX = lx / ll;
  const sunY = ly / ll;
  const sunZ = lz / ll;

  const r = SIZE / 2;
  const cosT = Math.cos(TILT);
  const sinT = Math.sin(TILT);

  for (let y = 0; y < SIZE; y += 1) {
    const ny = (y + 0.5) / r - 1;
    for (let x = 0; x < SIZE; x += 1) {
      const i = y * SIZE + x;
      const nx = (x + 0.5) / r - 1;
      const d2 = nx * nx + ny * ny;
      if (d2 >= 1) continue;

      const nz = Math.sqrt(1 - d2);
      inside[i] = 1;

      // Tilt the sphere so the poles read correctly.
      const ty = ny * cosT - nz * sinT;
      const tz = ny * sinT + nz * cosT;

      const lat = Math.asin(Math.max(-1, Math.min(1, ty)));
      const lon = Math.atan2(nx, tz);

      const v = Math.min(TEX_H - 1, Math.max(0, Math.floor((0.5 - lat / Math.PI) * TEX_H)));
      const u = Math.min(TEX_W - 1, Math.max(0, Math.floor((lon / (2 * Math.PI) + 0.5) * TEX_W)));

      rowBase[i] = v * TEX_W;
      uBase[i] = u;

      const lam = nx * sunX + ny * sunY + nz * sunZ;
      lambert[i] = Math.max(0, Math.min(255, Math.round(lam * 255)));
      rim[i] = Math.round(Math.pow(1 - nz, 3) * 255);

      // Broad specular sheen on the ocean side of the terminator.
      const s = Math.max(0, lam) ** 12;
      spec[i] = Math.round(Math.min(1, s) * 255);
    }
  }

  precomputed = { inside, rowBase, uBase, lambert, rim, spec };
  return precomputed;
}

/**
 * A rotating Earth drawn per-pixel from a real coastline mask plus procedural
 * biome, cloud and night-light layers. No imagery, no tiles, no network.
 */
export function EarthGlobe({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return undefined;

    canvas.width = SIZE;
    canvas.height = SIZE;

    const { day, lights, clouds } = buildEarthTextures();
    const geo = precompute();
    const image = ctx.createImageData(SIZE, SIZE);
    const data = image.data;

    const reduced = prefersReducedMotion();
    let raf = 0;
    let last = 0;

    const draw = (spin: number) => {
      const off = Math.floor(spin * TEX_W) % TEX_W;
      const cloudOff = Math.floor(spin * 1.35 * TEX_W) % TEX_W;

      for (let i = 0; i < SIZE * SIZE; i += 1) {
        const p = i * 4;
        if (!geo.inside[i]) {
          data[p + 3] = 0;
          continue;
        }

        const row = geo.rowBase[i];
        const u = geo.uBase[i];
        const t = row + ((u + off) % TEX_W);
        const t3 = t * 3;

        let r = day[t3];
        let g = day[t3 + 1];
        let b = day[t3 + 2];

        // Clouds drift a touch faster than the surface.
        const cl = clouds[row + ((u + cloudOff) % TEX_W)] / 255;
        if (cl > 0) {
          const a = cl * 0.82;
          r += (236 - r) * a;
          g += (244 - g) * a;
          b += (248 - b) * a;
        }

        // Soft terminator.
        const lam = geo.lambert[i] / 255;
        const shade = lam <= 0 ? 0 : lam >= 0.3 ? 1 : (lam / 0.3) ** 0.85;
        const litR = r * (0.05 + 0.95 * shade);
        const litG = g * (0.06 + 0.94 * shade);
        const litB = b * (0.1 + 0.9 * shade);

        // Night-side city lights.
        const nightMix = 1 - shade;
        const lt = nightMix > 0.15 ? (lights[t] / 255) * nightMix : 0;

        // Ocean sheen.
        const sp = (geo.spec[i] / 255) * 0.16;

        // Atmosphere rim, teal at the edge.
        const rm = geo.rim[i] / 255;
        const rimAmt = rm * (0.25 + 0.75 * shade);

        data[p] = Math.min(255, litR + lt * 255 + sp * 120 + rimAmt * 40);
        data[p + 1] = Math.min(255, litG + lt * 214 + sp * 150 + rimAmt * 150);
        data[p + 2] = Math.min(255, litB + lt * 150 + sp * 170 + rimAmt * 160);
        data[p + 3] = 255;
      }

      ctx.putImageData(image, 0, 0);
    };

    if (reduced) {
      draw(0.18);
      return undefined;
    }

    const start = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      // ~30fps is plenty for a slow rotation and halves the CPU cost.
      if (now - last < 33) return;
      last = now;
      draw(((now - start) / 1000 / PERIOD + 0.18) % 1);
    };
    raf = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={cn('relative', className)} aria-hidden>
      {/* Atmosphere bloom behind the disc */}
      <span className="absolute inset-[-9%] rounded-full bg-[radial-gradient(circle,rgba(42,203,147,0.22)_58%,rgba(56,217,238,0.16)_70%,transparent_74%)] blur-xl" />
      <canvas
        ref={canvasRef}
        className="relative block h-full w-full rounded-full"
        style={{ filter: 'saturate(1.06) contrast(1.03)' }}
      />
      {/* Crisp limb */}
      <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-brand-300/25" />
      <span className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_60px_-18px_rgba(0,0,0,0.9)]" />
    </div>
  );
}

/** Satellite tracing an orbit around the globe, with a downlink beam. */
export function OrbitingSatellite({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute inset-0', className)} aria-hidden>
      <div className="absolute inset-[-7%] motion-safe:animate-[spin-slow_44s_linear_infinite]">
        <svg viewBox="0 0 200 200" className="h-full w-full">
          <ellipse
            cx="100"
            cy="100"
            rx="98"
            ry="98"
            fill="none"
            stroke="rgba(90,170,190,0.18)"
            strokeWidth="0.6"
            strokeDasharray="3 6"
          />
          <g transform="translate(100 2)">
            <g stroke="rgba(170,230,244,0.8)" strokeWidth="1.6" fill="#08202B">
              <rect x="-5" y="-5" width="10" height="10" rx="2" />
              <rect x="-22" y="-3.5" width="14" height="7" rx="1" fill="#0C2C3A" />
              <rect x="8" y="-3.5" width="14" height="7" rx="1" fill="#0C2C3A" />
            </g>
            <circle cx="0" cy="7" r="2" fill="#2ACB93" />
          </g>
        </svg>
      </div>
    </div>
  );
}
