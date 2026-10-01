import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useReveal } from '@/hooks/useReveal';
import { StarField } from './EarthVisual';

const STARTERS = [
  'Show me urban expansion around Ranchi from 2021 to 2026.',
  'Where has vegetation decreased in Jharkhand?',
  'Detect water-body changes near Bengaluru.',
];

export function FinalCta() {
  const navigate = useNavigate();
  const revealRef = useReveal<HTMLDivElement>();

  return (
    <section id="about" className="relative scroll-mt-24 overflow-hidden py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <StarField className="absolute inset-0 h-full w-full opacity-40" />
        <div className="absolute inset-x-0 bottom-0 h-full bg-[radial-gradient(58%_58%_at_50%_62%,rgba(18,185,129,0.13),transparent_70%)]" />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-void to-transparent" />
      </div>

      <div
        ref={revealRef}
        data-reveal="armed"
        className="sq-reveal mx-auto w-full max-w-[1200px] px-5 text-center sm:px-8"
      >
        <p className="sq-eyebrow">Start here</p>

        <h2 className="mx-auto mt-5 max-w-[620px] text-[clamp(2rem,4.6vw,3.1rem)] font-bold leading-[1.08] tracking-[-0.03em] text-balance">
          Ask Your First Question.
        </h2>

        <p className="mx-auto mt-5 max-w-[600px] text-[15px] leading-[1.65] text-ink-mute text-pretty">
          Open the workspace and put a question to the planet in your own words. The agent plans the run, works through it in front of you, and comes back with a map, its parameters and a written read-out — all in one place.
        </p>

        <div className="mt-9 flex justify-center">
          <Button
            variant="primary"
            size="lg"
            onClick={() => navigate('/workspace')}
            rightIcon={<ArrowRight className="h-4 w-4" />}
          >
            Open Workspace
          </Button>
        </div>

        <div className="mt-10">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-faint">
            Or start with one of these
          </p>
          <ul className="mt-4 flex flex-wrap justify-center gap-2">
            {STARTERS.map((query) => (
              <li key={query}>
                <button
                  type="button"
                  onClick={() => navigate(`/workspace?q=${encodeURIComponent(query)}`)}
                  className="rounded-full border border-edge/70 bg-panel/50 px-4 py-2 text-[12.5px] text-ink-mute transition-all duration-200 ease-premium hover:-translate-y-px hover:border-brand-500/30 hover:bg-brand-500/[0.07] hover:text-brand-200"
                >
                  {query}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <p className="mx-auto mt-12 flex max-w-[560px] items-start gap-3 rounded-2xl border border-edge/60 bg-panel/40 px-5 py-4 text-left text-[12.5px] leading-[1.6] text-ink-mute">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" strokeWidth={1.7} />
          Built for researchers, planners, analysts and change-makers who need to see how an answer was reached — not just what it says.
        </p>
      </div>
    </section>
  );
}
