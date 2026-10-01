import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Layers, Lightbulb, Map as MapIcon } from 'lucide-react';
import { SceneCanvas } from '@/components/map/SceneCanvas';
import { useInView, useReveal } from '@/hooks/useReveal';
import { getPalette } from '@/lib/demoAgent';
import { cn, prefersReducedMotion } from '@/lib/utils';
import { INITIAL_MAP_STATE } from '@/state/workspaceReducer';
import { SectionHeading } from './SectionHeading';
import { SpaceBackdrop } from './SpaceBackdrop';

const VISIBILITY = { change: true, target: true, baseline: false, basemap: true };

const PANELS = [
  {
    id: 'map',
    icon: MapIcon,
    label: 'The visualization',
    title: 'A map you can interrogate, not a screenshot',
    body: 'The result opens as an interactive change-detection view. Pan it, zoom it, take it fullscreen, reset it — and ask the agent in the same breath to filter to the strongest class or focus on one compass direction. The picture responds to the conversation.',
  },
  {
    id: 'layers',
    icon: Layers,
    label: 'Layers & legend',
    title: 'Every layer is yours to switch on and off',
    body: 'The change layer, each epoch’s footprint and the base map are separate and individually toggleable, with a compact intensity legend beside them. Turning something off actually re-renders the scene, so you can see exactly what each layer contributes.',
  },
  {
    id: 'insights',
    icon: Lightbulb,
    label: 'Insights & parameters',
    title: 'The reasoning ships with the result',
    body: 'Under the map sit the parameters the run used — area, driving index, period, resolution — and a written read-out of what the pattern suggests, with a full report a click away. Nothing is presented as a measurement without saying how it was produced.',
  },
];

const LAYERS = [
  { name: 'Urban Expansion (2021 – 2026)', color: '#FF4D3D', on: true },
  { name: 'Built-up Area (2026)', color: '#FF9F1C', on: true },
  { name: 'Built-up Area (2021)', color: '#8098A5', on: false },
  { name: 'Base Map (Sentinel-2)', color: '#2ACB93', on: true },
];

const META = [
  ['Area Analyzed', '~1,256 km²'],
  ['Primary Index', 'NDBI'],
  ['Time Period', '2021 – 2026'],
  ['Resolution', '10 m / pixel'],
];

export function ResultShowcase() {
  const [active, setActive] = useState(0);
  const [pinned, setPinned] = useState(false);
  const [playing, setPlaying] = useState(false);
  const revealRef = useReveal<HTMLDivElement>();
  const timer = useRef<number | undefined>(undefined);
  const viewRef = useInView<HTMLDivElement>((inView) => setPlaying(inView));

  useEffect(() => {
    window.clearInterval(timer.current);
    if (!playing || pinned || prefersReducedMotion()) return undefined;
    timer.current = window.setInterval(() => setActive((i) => (i + 1) % PANELS.length), 5200);
    return () => window.clearInterval(timer.current);
  }, [playing, pinned]);

  const panel = PANELS[active];

  return (
    <section ref={viewRef} className="relative scroll-mt-24 py-24 sm:py-32" aria-label="What a result looks like">
      <SpaceBackdrop variant="b" scan />

      <div
        ref={revealRef}
        data-reveal="armed"
        className="sq-reveal mx-auto w-full max-w-[1200px] px-5 sm:px-8"
      >
        <SectionHeading
          align="center"
          eyebrow="What comes back"
          title="An answer with its working shown."
          body="A SatQuery result is four things at once: a visualization, the layers behind it, the parameters it was produced under, and a plain-language read-out. All four are on screen together, because an Earth-observation answer nobody can check is not much of an answer."
        />

        <div className="mt-14 grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:gap-12">
          {/* Copy + tabs */}
          <div>
            <div key={active} className="animate-fade-in">
              <h3 className="text-[19px] font-semibold leading-snug tracking-[-0.015em] text-ink text-balance">
                {panel.title}
              </h3>
              <p className="mt-3.5 max-w-[56ch] text-[13.5px] leading-[1.7] text-ink-mute text-pretty">
                {panel.body}
              </p>
            </div>

            <ul className="mt-7 flex flex-col gap-2" onMouseLeave={() => setPinned(false)}>
              {PANELS.map((p, index) => {
                const Icon = p.icon;
                const isActive = index === active;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onMouseEnter={() => {
                        setPinned(true);
                        setActive(index);
                      }}
                      onFocus={() => {
                        setPinned(true);
                        setActive(index);
                      }}
                      onClick={() => {
                        setPinned(true);
                        setActive(index);
                      }}
                      aria-pressed={isActive}
                      className={cn(
                        'group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border px-3.5 py-3 text-left transition-all duration-300 ease-premium',
                        isActive
                          ? 'border-brand-500/30 bg-brand-500/[0.07]'
                          : 'border-edge/60 bg-panel/40 hover:border-edge-strong/70 hover:bg-panel-raised/50',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-300',
                          isActive ? 'bg-brand-500/15 text-brand-300' : 'bg-white/[0.03] text-ink-dim',
                        )}
                      >
                        <Icon className="h-4 w-4" strokeWidth={1.7} />
                      </span>
                      <span
                        className={cn(
                          'flex-1 text-[13px] font-medium transition-colors duration-300',
                          isActive ? 'text-ink' : 'text-ink-mute',
                        )}
                      >
                        {p.label}
                      </span>
                      {isActive && !pinned && !prefersReducedMotion() && (
                        <span className="absolute inset-x-0 bottom-0 h-[2px] bg-edge/60">
                          <span className="block h-full w-full origin-left bg-gradient-to-r from-brand-500 to-aqua-400 motion-safe:animate-[sq-travel_5.2s_linear]" />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Mock result panel */}
          <div className="relative">
            <span
              className="pointer-events-none absolute -inset-6 -z-10 rounded-[36px] bg-[radial-gradient(60%_55%_at_55%_45%,rgba(18,185,129,0.13),transparent_74%)]"
              aria-hidden
            />
            <div className="overflow-hidden rounded-2xl border border-edge-strong/55 bg-[#07121A] shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_40px_80px_-40px_rgba(0,0,0,0.95)]">
              <div className="flex items-center gap-2 border-b border-edge/60 px-4 py-3">
                <span className="text-[13px] font-semibold text-ink">Result</span>
                <span className="rounded-md border border-edge-strong/60 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-dim">
                  Demo
                </span>
                <span className="ml-auto flex gap-1.5" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-1.5 w-1.5 rounded-full bg-edge-strong/80" />
                  ))}
                </span>
              </div>

              <div className="p-4">
                <p className="text-[13.5px] font-semibold text-ink">Urban Expansion (2021 – 2026)</p>

                <div
                  className={cn(
                    'relative mt-3 overflow-hidden rounded-xl border border-edge/70 transition-all duration-500 ease-premium',
                    active === 0 ? 'h-[228px]' : 'h-[150px]',
                  )}
                >
                  <SceneCanvas
                    seed="urban-ranchi"
                    kind="urban"
                    palette={getPalette('urban')}
                    visibility={VISIBILITY}
                    mapState={{ ...INITIAL_MAP_STATE, zoom: active === 0 ? 1.24 : 1.05 }}
                    ariaLabel="Illustrative urban expansion visualization (demo, not real imagery)"
                  />
                  <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/[0.06]" />
                  {active === 0 && (
                    <span className="pointer-events-none absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-brand-400/[0.14] to-transparent motion-safe:animate-[sq-scan_6s_linear_infinite]" />
                  )}
                  <span className="pointer-events-none absolute bottom-2 right-2 rounded border border-white/[0.08] bg-black/55 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint backdrop-blur">
                    Demo visualization
                  </span>
                </div>

                {/* Legend */}
                <ul className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
                  {[
                    ['High Expansion', '#FF4D3D'],
                    ['Moderate Expansion', '#FF9F1C'],
                    ['Low Expansion', '#F2E14C'],
                  ].map(([label, color]) => (
                    <li key={label} className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: color }} aria-hidden />
                      <span className="text-[10.5px] text-ink-dim">{label}</span>
                    </li>
                  ))}
                </ul>

                {/* Layers */}
                <div
                  className={cn(
                    'overflow-hidden transition-all duration-500 ease-premium',
                    active === 1 ? 'mt-4 max-h-[220px] opacity-100' : 'max-h-0 opacity-0',
                  )}
                >
                  <p className="mb-2 text-[12px] font-semibold text-ink">Layers</p>
                  <ul className="space-y-1">
                    {LAYERS.map((l) => (
                      <li
                        key={l.name}
                        className="flex items-center gap-2.5 rounded-lg border border-edge/50 bg-panel/40 px-2.5 py-1.5"
                      >
                        {l.on ? (
                          <Eye className="h-3.5 w-3.5 shrink-0 text-brand-300" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
                        )}
                        <span
                          className="h-2 w-2 shrink-0 rounded-sm"
                          style={{ backgroundColor: l.color, opacity: l.on ? 1 : 0.3 }}
                          aria-hidden
                        />
                        <span
                          className={cn(
                            'truncate text-[11.5px]',
                            l.on ? 'text-ink-soft' : 'text-ink-faint',
                          )}
                        >
                          {l.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Insights */}
                <div
                  className={cn(
                    'overflow-hidden transition-all duration-500 ease-premium',
                    active === 2 ? 'mt-4 max-h-[260px] opacity-100' : 'max-h-0 opacity-0',
                  )}
                >
                  <dl className="grid grid-cols-2 gap-2">
                    {META.map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-edge/60 bg-panel/40 px-3 py-2">
                        <dt className="text-[10px] text-ink-faint">{label}</dt>
                        <dd className="mt-0.5 text-[12px] font-medium text-ink-soft">{value}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-2.5 rounded-xl border border-edge/60 bg-panel/40 p-3.5">
                    <p className="flex items-center gap-2 text-[12px] font-semibold text-ink">
                      <Lightbulb className="h-3.5 w-3.5 text-brand-300" strokeWidth={1.8} />
                      Insights
                      <span className="rounded border border-edge-strong/50 px-1.5 font-mono text-[9px] uppercase tracking-wider text-ink-dim">
                        Demo
                      </span>
                    </p>
                    <p className="mt-2 text-[11.5px] leading-[1.6] text-ink-mute">
                      Significant urban expansion detected, especially towards the east and
                      southeast of Ranchi.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
