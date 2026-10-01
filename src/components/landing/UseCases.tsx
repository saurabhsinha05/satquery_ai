import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Building2, Droplets, Route, Siren, Sprout, TreePine } from 'lucide-react';
import { useReveal } from '@/hooks/useReveal';
import { SectionHeading } from './SectionHeading';
import { SpaceBackdrop } from './SpaceBackdrop';

const CASES = [
  {
    icon: Building2,
    title: 'Urban planning',
    body: 'See where a city is actually growing rather than where the master plan said it would, and how that growth follows the corridors.',
    outcome: 'Built-up change by direction and intensity',
    query: 'Show me urban expansion around Ranchi from 2021 to 2026.',
  },
  {
    icon: TreePine,
    title: 'Forest & vegetation',
    body: 'Track canopy loss and regrowth across a whole state without stitching scenes by hand or arguing about which season to compare.',
    outcome: 'Loss clusters ranked by severity',
    query: 'Where has vegetation decreased in Jharkhand?',
  },
  {
    icon: Droplets,
    title: 'Water resources',
    body: 'Follow lakes, tanks and reservoirs through the seasons and separate the permanent water from the part that disappears every summer.',
    outcome: 'Permanent vs seasonal extent',
    query: 'Detect water-body changes near Bengaluru.',
  },
  {
    icon: Siren,
    title: 'Disaster response',
    body: 'Ask what the ground looked like before and after an event and get an annotated answer instead of a raw archive to sift through.',
    outcome: 'Before / after land-cover comparison',
    query: 'Compare land cover in this region before and after the event.',
  },
  {
    icon: Sprout,
    title: 'Agriculture',
    body: 'Compare cropping patterns season over season across districts, and spot where the pattern broke from the years around it.',
    outcome: 'Season-over-season crop cover',
    query: 'Compare crop cover across these districts this season.',
  },
  {
    icon: Route,
    title: 'Infrastructure',
    body: 'Check how a corridor reshapes the land around it over five- and ten-year windows, and where the second-order growth landed.',
    outcome: 'Corridor-adjacent built-up gain',
    query: 'How much built-up area has grown along this corridor?',
  },
];

export function UseCases() {
  const navigate = useNavigate();
  const revealRef = useReveal<HTMLDivElement>();

  return (
    <section id="use-cases" className="relative scroll-mt-24 py-24 sm:py-32">
      <SpaceBackdrop variant="c" stars={false} />

      <div
        ref={revealRef}
        data-reveal="armed"
        className="sq-reveal mx-auto w-full max-w-[1200px] px-5 sm:px-8"
      >
        <SectionHeading
          align="center"
          eyebrow="Where it helps"
          title="Built for the questions people ask of a planet."
          body="Every card below is a real starting point, not a brochure item. Click one and the workspace opens with that question already asked and the agent already working."
        />

        <div className="mt-14 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {CASES.map(({ icon: Icon, title, body, outcome, query }, index) => (
            <button
              key={title}
              type="button"
              onClick={() => navigate(`/workspace?q=${encodeURIComponent(query)}`)}
              style={{ transitionDelay: `${index * 55}ms` }}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-edge/60 bg-panel/45 p-5 text-left backdrop-blur-sm transition-all duration-300 ease-premium hover:-translate-y-[3px] hover:border-brand-500/30 hover:bg-panel-raised/60"
            >
              <span
                className="pointer-events-none absolute inset-x-0 top-0 h-px scale-x-0 bg-gradient-to-r from-transparent via-brand-400/60 to-transparent transition-transform duration-500 ease-premium group-hover:scale-x-100"
                aria-hidden
              />

              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/[0.09] text-brand-300 transition-transform duration-300 ease-premium group-hover:scale-105">
                  <Icon className="h-[17px] w-[17px]" strokeWidth={1.7} />
                </span>
                <h3 className="flex-1 text-[14px] font-semibold text-ink">{title}</h3>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-faint transition-all duration-300 ease-premium group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-300" />
              </div>

              <p className="mt-3 text-[12.5px] leading-[1.62] text-ink-mute text-pretty">{body}</p>

              <p className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                <span className="h-1 w-1 rounded-full bg-brand-400/70" aria-hidden />
                {outcome}
              </p>

              <span className="mt-4 flex flex-1 items-start gap-2 rounded-xl border border-edge/50 bg-black/25 px-3 py-2.5 transition-colors duration-300 group-hover:border-brand-500/25 group-hover:bg-brand-500/[0.05]">
                <span className="mt-[3px] font-mono text-[10px] text-brand-400/70 transition-colors group-hover:text-brand-300">
                  &gt;
                </span>
                <span className="text-[11.5px] leading-[1.5] text-ink-mute transition-colors duration-300 group-hover:text-ink-soft">
                  {query}
                </span>
              </span>

              <span className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-medium text-ink-faint transition-colors duration-300 group-hover:text-brand-300">
                Open this in the workspace
                <ArrowUpRight className="h-3 w-3" />
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
