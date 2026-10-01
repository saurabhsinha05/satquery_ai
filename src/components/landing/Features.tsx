import { Blocks, Compass, MessagesSquare, ScanSearch, ShieldCheck, Workflow } from 'lucide-react';
import { useReveal } from '@/hooks/useReveal';
import { SectionHeading } from './SectionHeading';
import { SpaceBackdrop } from './SpaceBackdrop';

const CAPABILITIES = [
  {
    icon: MessagesSquare,
    title: 'Natural-language querying',
    body: 'Ask the way you would ask a colleague. No band maths, no scene IDs, no console — the agent turns the sentence into a job.',
    chip: 'No band maths',
  },
  {
    icon: Workflow,
    title: 'Agentic workflow',
    body: 'The agent writes its plan before it runs, then ticks each step off in front of you, so you always know what it did and in what order.',
    chip: 'Visible reasoning',
  },
  {
    icon: Blocks,
    title: 'Multi-source satellite data',
    body: 'Optical, radar and elevation sources sit behind one interface instead of five portals, and the agent picks whichever suits the question.',
    chip: 'Optical · radar · DEM',
  },
  {
    icon: ScanSearch,
    title: 'Change detection first',
    body: 'Built around the question people actually put to satellites: what changed here, in which direction, and how strongly.',
    chip: 'What changed, where',
  },
  {
    icon: ShieldCheck,
    title: 'Traceable by design',
    body: 'Every result carries its method, driving index, time period and resolution next to the picture — so a reviewer can check the reasoning, not just the output.',
    chip: 'Method travels with the map',
  },
  {
    icon: Compass,
    title: 'Areas of interest',
    body: 'Save a boundary once — drawn on the map or uploaded as KML/GeoJSON — then ask new questions of it whenever fresh imagery lands.',
    chip: 'Save once, reuse',
  },
];

export function Features() {
  const revealRef = useReveal<HTMLDivElement>();

  return (
    <section id="features" className="relative scroll-mt-24 py-24 sm:py-32">
      <SpaceBackdrop variant="b" grid={false} />

      <div
        ref={revealRef}
        data-reveal="armed"
        className="sq-reveal mx-auto w-full max-w-[1200px] px-5 sm:px-8"
      >
        <SectionHeading
          align="center"
          eyebrow="What it does"
          title="An Earth-observation workflow that answers back."
          body="A sentence goes in; data discovery, preprocessing, analysis, visualization and a written read-out come out — with the reasoning left visible at every stage."
        />

        <div className="mt-14 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map(({ icon: Icon, title, body, chip }, index) => (
            <article
              key={title}
              style={{ transitionDelay: `${index * 55}ms` }}
              className="group relative overflow-hidden rounded-2xl border border-edge/60 bg-panel/45 p-5 backdrop-blur-sm transition-all duration-300 ease-premium hover:-translate-y-[3px] hover:border-brand-500/30 hover:bg-panel-raised/60"
            >
              <span
                className="pointer-events-none absolute -right-14 -top-14 h-28 w-28 rounded-full bg-brand-500/[0.09] opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
                aria-hidden
              />
              <span
                className="pointer-events-none absolute inset-x-0 top-0 h-px scale-x-0 bg-gradient-to-r from-transparent via-brand-400/60 to-transparent transition-transform duration-500 ease-premium group-hover:scale-x-100"
                aria-hidden
              />

              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-edge-strong/50 bg-white/[0.03] text-brand-300 transition-transform duration-300 ease-premium group-hover:scale-105">
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
                </span>
                <span className="rounded-md border border-edge-strong/45 bg-white/[0.02] px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-faint transition-colors duration-300 group-hover:border-brand-500/25 group-hover:text-brand-300/85">
                  {chip}
                </span>
              </div>

              <h3 className="mt-4 text-[14.5px] font-semibold leading-snug text-ink">{title}</h3>
              <p className="mt-2 text-[12.5px] leading-[1.62] text-ink-mute text-pretty">{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
