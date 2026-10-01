import { useState } from 'react';
import { Globe2, Layers, Radar, Satellite } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { useSimulatedLoad } from '@/hooks/useSimulatedLoad';
import { DATASETS } from '@/lib/demoData';
import { useWorkspace } from '@/state/WorkspaceContext';
import { LiveEmpty } from './LiveEmpty';
import type { DatasetEntry } from '@/lib/types';
import { ViewShell } from './ViewShell';

const ICONS = {
  layers: Layers,
  satellite: Satellite,
  radar: Radar,
  globe: Globe2,
} as const;

const STATUS_TONE = {
  Available: 'brand',
  Indexing: 'amber',
  Limited: 'neutral',
} as const;

export function DatasetsView() {
  const loading = useSimulatedLoad(460);
  const [active, setActive] = useState<DatasetEntry | null>(null);
  const { state } = useWorkspace();

  // With a backend connected, the only datasets shown are the ones the
  // Copernicus catalogue actually returned for the current query.
  if (state.backend.mode === 'live') {
    const discovered = state.backend.response?.datasets ?? [];
    return (
      <ViewShell
        title="Datasets"
        description="Copernicus Data Space products returned by the catalogue for your most recent query."
        demoNote={false}
      >
        {discovered.length === 0 ? (
          <LiveEmpty
            icon={<Layers className="h-6 w-6" strokeWidth={1.6} />}
            title="No datasets discovered yet."
            body="Ask a question about a place and a time range — the agent searches the Copernicus catalogue and the matching products appear here."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {discovered.map((dataset) => (
              <article
                key={dataset.id}
                className="flex flex-col rounded-2xl border border-edge/60 bg-panel/40 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-edge-strong/50 bg-white/[0.03] text-brand-300">
                    <Satellite className="h-[18px] w-[18px]" strokeWidth={1.7} />
                  </span>
                  <Badge
                    tone={
                      dataset.status === 'available'
                        ? 'brand'
                        : dataset.status === 'error'
                          ? 'red'
                          : 'amber'
                    }
                    dot={dataset.status === 'available'}
                  >
                    {dataset.status === 'available'
                      ? `${dataset.matchCount} products`
                      : dataset.status.replace('_', ' ')}
                  </Badge>
                </div>

                <h3 className="mt-4 text-[14px] font-semibold text-ink">{dataset.name}</h3>
                <p className="mt-0.5 text-[11.5px] text-ink-dim">{dataset.provider}</p>
                <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-mute">
                  {dataset.purpose}
                </p>

                <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-edge/50 pt-3.5 text-[11.5px]">
                  <div>
                    <dt className="text-ink-faint">Window</dt>
                    <dd className="mt-0.5 text-ink-soft">
                      {dataset.temporalRange.from} → {dataset.temporalRange.to}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-faint">Indices</dt>
                    <dd className="mt-0.5 text-ink-soft">
                      {dataset.indices.length > 0 ? dataset.indices.join(', ') : '—'}
                    </dd>
                  </div>
                </dl>

                {dataset.message && (
                  <p className="mt-3 text-[11.5px] leading-relaxed text-amber-300/80">
                    {dataset.message}
                  </p>
                )}

                {dataset.scenes.length > 0 && (
                  <ul className="sq-scroll mt-3 max-h-32 space-y-1 overflow-y-auto pr-1">
                    {dataset.scenes.slice(0, 12).map((scene) => (
                      <li
                        key={scene.id}
                        className="flex items-center gap-2 rounded-md bg-black/20 px-2 py-1 text-[10.5px] text-ink-dim"
                      >
                        <span className="font-mono">{scene.acquisitionDate.slice(0, 10)}</span>
                        <span className="flex-1 truncate">{scene.id}</span>
                        {scene.cloudCover !== undefined && (
                          <span className="font-mono">{scene.cloudCover}%</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        )}
      </ViewShell>
    );
  }

  return (
    <ViewShell
      title="Datasets"
      description="The sources a backed build would search. Listings here are static reference cards — this prototype does not connect to any archive."
    >
      {loading ? (
        <SkeletonCards count={6} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {DATASETS.map((dataset) => {
            const Icon = ICONS[dataset.icon];
            return (
              <article
                key={dataset.id}
                className="group flex flex-col rounded-2xl border border-edge/60 bg-panel/40 p-5 transition-all duration-200 ease-premium hover:-translate-y-0.5 hover:border-brand-500/25 hover:bg-panel-raised/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-edge-strong/50"
                    style={{ backgroundColor: `${dataset.accent}14`, color: dataset.accent }}
                  >
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
                  </span>
                  <Badge tone={STATUS_TONE[dataset.status]} dot={dataset.status === 'Available'}>
                    {dataset.status}
                  </Badge>
                </div>

                <h3 className="mt-4 text-[14px] font-semibold text-ink">{dataset.name}</h3>
                <p className="mt-0.5 text-[11.5px] text-ink-dim">{dataset.provider}</p>
                <p className="mt-2.5 flex-1 text-[12.5px] leading-relaxed text-ink-mute text-pretty">
                  {dataset.summary}
                </p>

                <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-edge/50 pt-3.5 text-[11.5px]">
                  <div>
                    <dt className="text-ink-faint">Resolution</dt>
                    <dd className="mt-0.5 text-ink-soft">{dataset.resolution}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-faint">Revisit</dt>
                    <dd className="mt-0.5 text-ink-soft">{dataset.revisit}</dd>
                  </div>
                </dl>

                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-4 self-start px-0 text-brand-300 hover:bg-transparent hover:text-brand-200"
                  onClick={() => setActive(dataset)}
                >
                  View details →
                </Button>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={active?.name ?? ''}
        description={active?.provider}
      >
        {active && (
          <div className="space-y-5">
            <p className="text-[13.5px] leading-relaxed text-ink-soft text-pretty">
              {active.summary}
            </p>

            <dl className="grid grid-cols-2 gap-3">
              {[
                ['Resolution', active.resolution],
                ['Revisit', active.revisit],
                ['Bands', active.bands],
                ['Coverage', active.coverage],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-edge/60 bg-panel/40 px-3.5 py-3">
                  <dt className="text-[11px] text-ink-faint">{label}</dt>
                  <dd className="mt-1 text-[12.5px] text-ink-soft">{value}</dd>
                </div>
              ))}
            </dl>

            <p className="rounded-xl border border-edge/70 bg-black/25 px-4 py-3 text-[11.5px] leading-relaxed text-ink-dim">
              Reference information only. This prototype has no data connection — nothing is
              searched, downloaded, or processed.
            </p>
          </div>
        )}
      </Modal>
    </ViewShell>
  );
}
