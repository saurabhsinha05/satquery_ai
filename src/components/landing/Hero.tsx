import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronRight, MessageSquare, PlayCircle, Satellite, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EarthGlobe, OrbitingSatellite } from './EarthGlobe';
import { StarField } from './EarthVisual';
import { HeroDemo } from './HeroDemo';

const PIPELINE = [
  { icon: MessageSquare, label: 'Natural language' },
  { icon: Sparkles, label: 'AI agent' },
  { icon: Satellite, label: 'Earth insight' },
];

export function Hero() {
  const navigate = useNavigate();

  return (
    <section className="relative isolate overflow-hidden pb-16 pt-[108px] sm:pb-24 sm:pt-[136px]">
      {/* Backdrop */}
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
        <StarField className="absolute inset-0 h-full w-full opacity-60" />

        {/* The planet itself */}
        <div className="absolute -right-[26%] top-[16%] h-[340px] w-[340px] sm:-right-[12%] sm:top-[14%] sm:h-[440px] sm:w-[440px] lg:-right-[6%] lg:top-[18%] lg:h-[540px] lg:w-[540px]">
          <EarthGlobe className="h-full w-full" />
          <OrbitingSatellite />
        </div>

        <div className="absolute inset-0 bg-[radial-gradient(110%_75%_at_16%_0%,rgba(18,185,129,0.07),transparent_54%)]" />
        {/* Scrim keeps the headline on near-black regardless of the globe. */}
        <div className="absolute inset-0 bg-[linear-gradient(100deg,#04090D_0%,rgba(4,9,13,0.96)_26%,rgba(4,9,13,0.68)_44%,rgba(4,9,13,0.12)_66%)]" />
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-void via-void/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-void via-void/80 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1200px] px-5 sm:px-8">
        {/* Mobile order: headline → CTA → demo → pipeline. */}
        <div className="flex flex-col gap-11 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:gap-x-12 lg:gap-y-9">
          <div className="order-1 max-w-[620px] lg:col-start-1 lg:row-start-1 lg:self-end">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/25 bg-brand-500/[0.06] px-3.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-brand-300 animate-fade-up">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
              Agentic GeoIntelligence Platform
            </span>

            <h1 className="mt-7 text-[clamp(2.35rem,5.4vw,3.95rem)] font-bold leading-[1.04] tracking-[-0.032em] animate-fade-up [animation-delay:60ms]">
              <span className="block">Ask Earth.</span>
              <span className="block">Get Answers.</span>
              <span className="block text-brand-400">
                <span className="sq-underline">See the Change.</span>
              </span>
            </h1>

            <p className="mt-6 max-w-[480px] text-[15px] leading-[1.68] text-ink-mute text-pretty animate-fade-up [animation-delay:120ms]">
              SatQuery AI is an agentic geospatial intelligence platform. Ask in plain language —
              the agent finds the right imagery, runs the analysis, and hands back an
              evidence-backed answer you can question further.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3 animate-fade-up [animation-delay:180ms]">
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate('/workspace')}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                Get Started
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => navigate('/workspace?demo=1')}
                leftIcon={<PlayCircle className="h-4 w-4 text-brand-400" />}
              >
                Try Live Demo
              </Button>
            </div>
          </div>

          {/* Live demo, floating over the planet */}
          <div className="order-2 flex justify-center animate-fade-up [animation-delay:300ms] sm:justify-start lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:justify-end lg:self-center">
            <HeroDemo />
          </div>

          {/* The whole product in one line */}
          <ol className="order-3 flex flex-wrap items-center gap-x-2 gap-y-3 animate-fade-up [animation-delay:240ms] lg:col-start-1 lg:row-start-2 lg:self-start">
            {PIPELINE.map(({ icon: Icon, label }, index) => (
              <li key={label} className="flex items-center gap-2">
                <span className="flex items-center gap-2 rounded-lg border border-edge-strong/50 bg-white/[0.025] px-2.5 py-1.5">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-brand-300" strokeWidth={1.9} />
                  <span className="text-[12px] font-medium text-ink-soft">{label}</span>
                </span>
                {index < PIPELINE.length - 1 && (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-edge-strong" aria-hidden />
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
