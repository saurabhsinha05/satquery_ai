import { useEffect, useRef, useState } from 'react';
import { BarChart3, CloudDownload, FileText, MessageSquare, Satellite } from 'lucide-react';
import { useInView, useReveal } from '@/hooks/useReveal';
import { cn, prefersReducedMotion } from '@/lib/utils';
import { SectionHeading } from './SectionHeading';
import { SpaceBackdrop } from './SpaceBackdrop';

const STEPS = [
  {
    icon: MessageSquare,
    title: 'Understand Query',
    short: 'Reads the question, works out the intent.',
    detail:
      'Your sentence is parsed into the things an Earth-observation job actually needs: the phenomenon you care about, the area of interest, and the time window. Ambiguity is resolved in conversation rather than in a form.',
    trace: 'intent → urban expansion · area → Ranchi · window → 2021–2026',
    tags: ['Intent', 'Area of interest', 'Time window'],
  },
  {
    icon: Satellite,
    title: 'Find Satellite Data',
    short: 'Picks the right sources for that question.',
    detail:
      'Different questions want different sensors. Built-up change leans on optical multispectral; monsoon-season work leans on radar that sees through cloud. The agent chooses the source and the acquisition windows either side of your period.',
    trace: 'source → Sentinel-2 L2A · low-cloud windows either side',
    tags: ['Sensor choice', 'Scene search', 'Cloud filtering'],
  },
  {
    icon: CloudDownload,
    title: 'Process Imagery',
    short: 'Cloud masking, filtering, compositing.',
    detail:
      'Raw scenes are never directly comparable. Clouds and shadows are masked out, and the remaining observations are composited into two clean epochs that can be measured against each other without season or haze doing the talking.',
    trace: 'cloud mask → median composite → two comparable epochs',
    tags: ['Cloud mask', 'Median composite', 'Harmonisation'],
  },
  {
    icon: BarChart3,
    title: 'Run Analysis',
    short: 'Index maths and change detection.',
    detail:
      'The driving index is computed per epoch — NDBI for built-up, NDVI for vegetation, NDWI for water — then differenced and binned into intensity classes, so the output is a map of magnitude rather than a single number.',
    trace: 'NDBI per epoch → difference → intensity classes',
    tags: ['NDBI / NDVI / NDWI', 'Differencing', 'Class binning'],
  },
  {
    icon: FileText,
    title: 'Deliver Insights',
    short: 'A map, its parameters, and a written read-out.',
    detail:
      'You get the visualization, the legend, the parameters it was produced under, and a plain-language summary — and the conversation stays open, so the next question refines the same result instead of starting over.',
    trace: 'map + legend + parameters + a summary you can question further',
    tags: ['Visualization', 'Parameters', 'Follow-up ready'],
  },
];

const AUTOPLAY_MS = 4200;

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const [pinned, setPinned] = useState(false);
  const [playing, setPlaying] = useState(false);
  const revealRef = useReveal<HTMLDivElement>();
  const timer = useRef<number | undefined>(undefined);
  const viewRef = useInView<HTMLDivElement>((inView) => setPlaying(inView));

  useEffect(() => {
    window.clearInterval(timer.current);
    if (!playing || pinned || prefersReducedMotion()) return undefined;
    timer.current = window.setInterval(() => setActive((i) => (i + 1) % STEPS.length), AUTOPLAY_MS);
    return () => window.clearInterval(timer.current);
  }, [playing, pinned]);

  const progress = (active / (STEPS.length - 1)) * 100;
  const step = STEPS[active];

  return (
    <section
      id="how-it-works"
      ref={viewRef}
      className="relative scroll-mt-24 py-24 sm:py-32"
      aria-label="How SatQuery AI works"
    >
      <SpaceBackdrop variant="a" scan />

      <div
        ref={revealRef}
        data-reveal="armed"
        className="sq-reveal mx-auto w-full max-w-[1200px] px-5 sm:px-8"
      >
        <SectionHeading
          align="center"
          eyebrow="How the agent works"
          title={
            <>
              <span className="block">One Question.</span>
              <span className="block">End-to-End Earth Intelligence.</span>
            </>
          }
          body="Earth observation is normally five tools and a week of glue work. The agent runs the whole chain for you — and narrates every step, so the answer is something you can defend rather than something you have to trust."
        />

        <div className="relative mt-16" onMouseLeave={() => setPinned(false)}>
          {/* Connector */}
          <div className="absolute left-[10%] right-[10%] top-[31px] hidden h-px bg-edge/70 lg:block" aria-hidden>
            <div
              className="h-full bg-gradient-to-r from-brand-500 to-aqua-400 transition-[width] duration-700 ease-premium"
              style={{ width: `${progress}%` }}
            />
            <span className="sq-travel absolute -top-[2px] h-[5px] w-[5px] rounded-full bg-aqua-300 shadow-[0_0_10px_2px_rgba(56,217,238,0.55)]" />
          </div>
          <div className="absolute bottom-8 left-[31px] top-8 w-px bg-edge/70 lg:hidden" aria-hidden>
            <div
              className="w-full bg-gradient-to-b from-brand-500 to-aqua-400 transition-[height] duration-700 ease-premium"
              style={{ height: `${progress}%` }}
            />
          </div>

          <ol className="relative grid gap-6 lg:grid-cols-5 lg:gap-3">
            {STEPS.map((s, index) => {
              const Icon = s.icon;
              const isActive = index === active;
              const isPast = index < active;
              return (
                <li key={s.title} className="lg:text-center">
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
                    aria-current={isActive ? 'step' : undefined}
                    className="group flex w-full items-start gap-4 rounded-2xl px-1 py-1 text-left lg:flex-col lg:items-center lg:gap-0 lg:text-center"
                  >
                    <span className="relative flex h-16 w-16 shrink-0 items-center justify-center lg:h-[62px] lg:w-[62px]">
                      <span className="absolute inset-0 rounded-full bg-void" aria-hidden />
                      <span
                        className={cn(
                          'absolute inset-0 rounded-full transition-all duration-500 ease-premium',
                          isActive
                            ? 'scale-105 bg-brand-500/12 shadow-[0_0_0_1px_rgba(18,185,129,0.45),0_10px_34px_-14px_rgba(18,185,129,0.6)]'
                            : isPast
                              ? 'bg-white/[0.03] shadow-[0_0_0_1px_rgba(31,74,86,0.75)]'
                              : 'bg-white/[0.015] shadow-[0_0_0_1px_rgba(22,48,59,0.9)]',
                        )}
                      />
                      <Icon
                        className={cn(
                          'relative h-[22px] w-[22px] transition-colors duration-500',
                          isActive ? 'text-brand-300' : isPast ? 'text-ink-mute' : 'text-ink-dim',
                        )}
                        strokeWidth={1.6}
                      />
                      <span
                        className={cn(
                          'absolute -bottom-1.5 flex h-[19px] w-[19px] items-center justify-center rounded-full border bg-[#070F15] font-mono text-[10px] transition-colors duration-500',
                          isActive
                            ? 'border-brand-500/50 text-brand-300'
                            : 'border-edge-strong/70 text-ink-dim',
                        )}
                      >
                        {index + 1}
                      </span>
                    </span>

                    <span className="min-w-0 flex-1 lg:mt-6 lg:flex-none">
                      <span
                        className={cn(
                          'block text-[13.5px] font-semibold transition-colors duration-300',
                          isActive ? 'text-ink' : 'text-ink-soft',
                        )}
                      >
                        {s.title}
                      </span>
                      <span
                        className={cn(
                          'mt-1.5 block text-[12px] leading-[1.5] text-pretty transition-colors duration-300 lg:mx-auto lg:max-w-[170px]',
                          isActive ? 'text-ink-mute' : 'text-ink-dim',
                        )}
                      >
                        {s.short}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Active step, expanded */}
        <div className="mx-auto mt-14 max-w-[840px]">
          <div className="relative overflow-hidden rounded-2xl border border-edge/60 bg-panel/50 p-6 backdrop-blur-sm sm:p-7">
            <span
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-400/45 to-transparent"
              aria-hidden
            />

            <div key={active} className="animate-fade-in">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="rounded-md border border-brand-500/30 bg-brand-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-brand-300">
                  Step {active + 1} / {STEPS.length}
                </span>
                <h3 className="text-[15px] font-semibold text-ink">{step.title}</h3>
              </div>

              <p className="mt-3.5 max-w-[68ch] text-[13.5px] leading-[1.7] text-ink-mute text-pretty">
                {step.detail}
              </p>

              <ul className="mt-5 flex flex-wrap gap-2">
                {step.tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-lg border border-edge-strong/45 bg-white/[0.025] px-2.5 py-1 text-[11.5px] text-ink-soft"
                  >
                    {tag}
                  </li>
                ))}
              </ul>

              <div className="mt-5 flex items-center gap-3 rounded-xl border border-edge/60 bg-black/30 px-3.5 py-2.5">
                <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint sm:block">
                  Agent trace
                </span>
                <span className="hidden h-4 w-px shrink-0 bg-edge/70 sm:block" aria-hidden />
                <p className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-brand-300/90" title={step.trace}>
                  {step.trace}
                  <span className="ml-1 inline-block motion-safe:animate-[sq-caret_1.1s_steps(1)_infinite]">▍</span>
                </p>
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-[11px] text-ink-faint">
            Illustrative walkthrough of the workflow — this build runs it locally with demo data.
          </p>
        </div>
      </div>
    </section>
  );
}
