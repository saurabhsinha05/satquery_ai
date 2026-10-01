import { useState } from 'react';
import { MapPin, Plus, Trash2 } from 'lucide-react';
import { ResultThumbnail } from '@/components/map/ResultThumbnail';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { useSimulatedLoad } from '@/hooks/useSimulatedLoad';
import type { AoiEntry } from '@/lib/types';
import { formatDay, uid } from '@/lib/utils';
import { useWorkspace } from '@/state/WorkspaceContext';
import { DrawAreaDialog } from '@/components/workspace/DrawAreaDialog';
import { ViewShell } from './ViewShell';

const STATUS_TONE = {
  Monitoring: 'brand',
  Idle: 'neutral',
  Draft: 'amber',
} as const;

export function AoiView() {
  const { state, dispatch, showToast, submitQuery } = useWorkspace();
  const loading = useSimulatedLoad(400);
  const [drawing, setDrawing] = useState(false);

  const addAoi = (label: string) => {
    const entry: AoiEntry = {
      id: uid('aoi'),
      name: label.replace('Drawn area · ', 'Drawn AOI · '),
      area: label.split('· ')[1] ?? 'Illustrative extent',
      lastAnalyzed: 'Not analyzed yet',
      status: 'Draft',
      kind: 'landuse',
      bbox: 'Drawn on map',
      seed: 'landuse-region',
    };
    dispatch({ type: 'add-aoi', entry });
    showToast('New area of interest saved', 'success');
  };

  return (
    <ViewShell
      title="Areas of Interest"
      description="Areas you monitor. Ask a new question of one at any time — the agent scopes the analysis to that boundary."
      actions={
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="h-3.5 w-3.5" />}
          onClick={() => setDrawing(true)}
        >
          New AOI
        </Button>
      }
    >
      {loading ? (
        <SkeletonCards count={4} />
      ) : state.aois.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-6 w-6" strokeWidth={1.6} />}
          title="No custom areas yet."
          body="Draw a boundary on the map or attach a KML/GeoJSON file to create your first area of interest."
          action={
            <Button variant="primary" onClick={() => setDrawing(true)}>
              Draw an area
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {state.aois.map((aoi) => (
            <article
              key={aoi.id}
              className="group flex gap-4 rounded-2xl border border-edge/60 bg-panel/40 p-4 transition-all duration-200 ease-premium hover:-translate-y-0.5 hover:border-brand-500/25 hover:bg-panel-raised/50"
            >
              <ResultThumbnail
                scenarioId={aoi.seed}
                kind={aoi.kind}
                className="h-[92px] w-[112px] shrink-0"
              />

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="truncate text-[13.5px] font-semibold text-ink">{aoi.name}</h3>
                  <Badge tone={STATUS_TONE[aoi.status]} dot={aoi.status === 'Monitoring'}>
                    {aoi.status}
                  </Badge>
                </div>

                <dl className="mt-2 space-y-1 text-[11.5px]">
                  <div className="flex gap-2">
                    <dt className="text-ink-faint">Area</dt>
                    <dd className="text-ink-mute">{aoi.area}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-ink-faint">Last analyzed</dt>
                    <dd className="text-ink-mute">{aoi.lastAnalyzed}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-ink-faint">Extent</dt>
                    <dd className="truncate font-mono text-[10.5px] text-ink-dim" title={aoi.bbox}>
                      {aoi.bbox}
                    </dd>
                  </div>
                </dl>

                <div className="mt-auto flex items-center gap-2 pt-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      dispatch({ type: 'set-aoi-label', label: aoi.name });
                      dispatch({ type: 'set-view', view: 'workspace' });
                      submitQuery(`Compare land-use change in ${aoi.name} over the last 5 years.`);
                    }}
                  >
                    Analyze
                  </Button>
                  <IconButton
                    label={`Remove ${aoi.name}`}
                    size="sm"
                    className="ml-auto opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                    onClick={() => dispatch({ type: 'remove-aoi', id: aoi.id })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="mt-6 text-[11.5px] leading-relaxed text-ink-faint">
        Extents shown here are illustrative placeholders. This build performs no projection,
        geometry validation, or area computation.
      </p>

      <DrawAreaDialog
        open={drawing}
        onClose={() => setDrawing(false)}
        onConfirm={addAoi}
        seed={`aoi-draw-${formatDay(new Date())}`}
      />
    </ViewShell>
  );
}
