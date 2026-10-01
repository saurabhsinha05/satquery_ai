import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { SceneCanvas } from '@/components/map/SceneCanvas';
import { getPalette } from '@/lib/demoAgent';
import { cn, prefersReducedMotion } from '@/lib/utils';
import { INITIAL_MAP_STATE } from '@/state/workspaceReducer';

const QUERY = 'Show me urban expansion around Ranchi from 2021 to 2026.';

const STEPS = [
  'Understand your query',
  'Find relevant satellite data',
  'Process imagery',
  'Run NDBI change detection',
];

const VISIBILITY = { change: true, target: true, baseline: false, basemap: true };

type Phase = 'typing' | 'planning' | 'rendering' | 'done';

/**
 * The hero's product proof: a scripted run of the real interaction —
 * question typed, agent plan ticking, result appearing. Driven by timers and
 * React state (not keyframes) so it always reaches its finished state, and it
 * jumps straight there when the visitor prefers reduced motion.
 */
export function HeroDemo() {
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const [phase, setPhase] = useState<Phase>(reduced ? 'done' : 'typing');
  const [typed, setTyped] = useState(reduced ? QUERY : '');
  const [stepIndex, setStepIndex] = useState(reduced ? STEPS.length : -1);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (reduced) return undefined;

    const at = (delay: number, fn: () => void) => {
      timers.current.push(window.setTimeout(fn, delay));
    };

    const run = () => {
      timers.current.forEach(window.clearTimeout);
      timers.current = [];
      setPhase('typing');
      setTyped('');
      setStepIndex(-1);

      const charDelay = 34;
      for (let i = 1; i <= QUERY.length; i += 1) {
        at(420 + i * charDelay, () => setTyped(QUERY.slice(0, i)));
      }

      const afterTyping = 420 + QUERY.length * charDelay + 420;
      at(afterTyping, () => {
        setPhase('planning');
        setStepIndex(0);
      });
      STEPS.forEach((_, i) => {
        at(afterTyping + 480 * (i + 1), () => setStepIndex(i + 1));
      });

      const afterPlan = afterTyping + 480 * (STEPS.length + 1);
      at(afterPlan, () => setPhase('rendering'));
      at(afterPlan + 900, () => setPhase('done'));
      at(afterPlan + 900 + 7000, run);
    };

    run();
    return () => {
      timers.current.forEach(window.clearTimeout);
      timers.current = [];
    };
  }, [reduced]);

  const showResult = phase === 'rendering' || phase === 'done';

  return (
    <div className="relative w-full max-w-[418px]">
      <span
        className="pointer-events-none absolute -inset-10 -z-10 rounded-[44px] bg-[radial-gradient(62%_58%_at_50%_50%,rgba(4,9,13,0.88),rgba(4,9,13,0.35)_66%,transparent_78%)]"
        aria-hidden
      />

      {/* Question */}
      <div className="relative z-20 ml-auto w-[min(340px,92%)]">
        <div className="flex items-start gap-3 rounded-2xl rounded-br-md border border-edge-strong/60 bg-[#08131B] px-4 py-3.5 shadow-lift">
          <span className="mt-[3px] flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-[10px] font-semibold text-ink-soft">
            You
          </span>
          <p className="min-h-[38px] text-[13px] leading-relaxed text-ink">
            {typed}
            {phase === 'typing' && (
              <span className="ml-0.5 inline-block h-[14px] w-[2px] translate-y-[2px] bg-brand-400 animate-pulse" />
            )}
          </p>
        </div>
      </div>

      {/* Agent card */}
      <div className="relative z-10 -mt-2.5 overflow-hidden rounded-2xl border border-edge-strong/55 bg-[#07121A] shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_40px_80px_-40px_rgba(0,0,0,0.95)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3 border-b border-edge/60 px-4 py-3">
          <span className="flex items-center gap-2 text-[12.5px] font-medium text-ink">
            <span className="relative flex h-6 w-6 items-center justify-center rounded-lg border border-brand-500/30 bg-brand-500/12 text-brand-300">
              <Sparkles className="h-3 w-3" strokeWidth={2} />
            </span>
            SatQuery Agent
          </span>
          <span
            className={cn(
              'rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-500',
              phase === 'done'
                ? 'border-brand-500/30 bg-brand-500/10 text-brand-300'
                : 'border-edge-strong/60 bg-white/[0.03] text-ink-dim',
            )}
          >
            {phase === 'done' ? 'Complete' : phase === 'typing' ? 'Listening' : 'Working'}
          </span>
        </div>

        <div className="relative min-h-[292px] px-4 py-4">
          {/* Plan */}
          <ul
            className={cn(
              'absolute inset-x-4 top-4 space-y-2.5 transition-all duration-500 ease-premium',
              showResult ? 'pointer-events-none -translate-y-1 opacity-0' : 'opacity-100',
            )}
          >
            {STEPS.map((label, i) => {
              const done = i < stepIndex;
              const active = i === stepIndex;
              return (
                <li key={label} className="flex items-center gap-2.5">
                  <span className="flex h-[15px] w-[15px] shrink-0 items-center justify-center">
                    {done ? (
                      <span className="flex h-[15px] w-[15px] items-center justify-center rounded-full border border-brand-500/45 bg-brand-500/15 text-brand-300">
                        <Check className="h-2 w-2" strokeWidth={3.4} />
                      </span>
                    ) : active ? (
                      <span className="relative flex h-[15px] w-[15px] items-center justify-center rounded-full border border-brand-400/60">
                        <span className="h-[5px] w-[5px] rounded-full bg-brand-400" />
                        <span className="absolute inset-[-2px] rounded-full border border-transparent border-t-brand-300 animate-spin-slow" />
                      </span>
                    ) : (
                      <span className="h-[9px] w-[9px] rounded-full border border-edge-strong/70" />
                    )}
                  </span>
                  <span
                    className={cn(
                      'text-[12.5px] transition-colors duration-300',
                      done ? 'text-ink-soft' : active ? 'font-medium text-ink' : 'text-ink-faint',
                    )}
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ul>

          {/* Result */}
          <div
            className={cn(
              'transition-all duration-700 ease-premium',
              showResult ? 'opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
            )}
          >
            <div className="relative h-[186px] overflow-hidden rounded-xl border border-edge/70">
              <SceneCanvas
                seed="urban-ranchi"
                kind="urban"
                palette={getPalette('urban')}
                visibility={VISIBILITY}
                mapState={{ ...INITIAL_MAP_STATE, zoom: 1.14 }}
                ariaLabel="Illustrative urban expansion visualization (demo, not real imagery)"
              />
              <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/[0.06]" />
              {phase === 'rendering' && (
                <span className="pointer-events-none absolute inset-x-0 h-20 bg-gradient-to-b from-transparent via-brand-400/20 to-transparent animate-sweep-y" />
              )}
              <span className="pointer-events-none absolute bottom-2 right-2 rounded border border-white/[0.08] bg-black/55 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint backdrop-blur">
                Demo visualization
              </span>
            </div>

            <ul className="mt-3 flex items-center gap-x-3.5 gap-y-1.5">
              {[
                ['High', '#FF4D3D'],
                ['Moderate', '#FF9F1C'],
                ['Low', '#F2E14C'],
              ].map(([label, color]) => (
                <li key={label} className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-[2px]"
                    style={{ backgroundColor: color }}
                    aria-hidden
                  />
                  <span className="text-[10.5px] text-ink-dim">{label}</span>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[13.5px] font-semibold text-ink">Urban Expansion Detected</p>
                <p className="mt-1.5 flex items-center gap-2 text-[11.5px] text-ink-mute">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
                  NDBI + Temporal Change Detection
                </p>
              </div>
              <span className="mt-0.5 shrink-0 rounded-md border border-edge-strong/60 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-dim">
                Demo
              </span>
            </div>

            <p className="mt-3 text-[10.5px] leading-relaxed text-ink-faint">
              Illustrative demo analysis, generated locally in your browser — not computed from live
              satellite imagery.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
