import { SceneCanvas } from '@/components/map/SceneCanvas';
import { getPalette, getScenarioById } from '@/lib/demoAgent';
import type { AnalysisKind } from '@/lib/types';
import { cn } from '@/lib/utils';
import { INITIAL_MAP_STATE } from '@/state/workspaceReducer';

const VISIBILITY = { change: true, target: true, baseline: false, basemap: true };

/** Small, non-interactive preview rendered at reduced quality. */
export function ResultThumbnail({
  scenarioId,
  kind,
  className,
}: {
  scenarioId: string;
  kind?: AnalysisKind;
  className?: string;
}) {
  const scenario = getScenarioById(scenarioId);
  const resolved = kind ?? scenario.kind;

  return (
    <div className={cn('relative overflow-hidden rounded-xl border border-edge/60', className)}>
      <SceneCanvas
        seed={scenario.id}
        kind={resolved}
        palette={getPalette(resolved)}
        visibility={VISIBILITY}
        mapState={{ ...INITIAL_MAP_STATE, zoom: 1.25 }}
        quality={0.42}
        showBoundary={false}
        ariaLabel={`${scenario.title} preview — illustrative demo visualization`}
      />
      <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/[0.04]" />
      <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded border border-white/[0.07] bg-black/50 px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.14em] text-ink-faint">
        Demo
      </span>
    </div>
  );
}
