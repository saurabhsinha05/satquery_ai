import { Bookmark, Trash2 } from 'lucide-react';
import { ResultThumbnail } from '@/components/map/ResultThumbnail';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { useSimulatedLoad } from '@/hooks/useSimulatedLoad';
import { useWorkspace } from '@/state/WorkspaceContext';
import { ViewShell } from './ViewShell';
import { LiveEmpty, PersistenceNotice } from './LiveEmpty';

export function SavedResultsView() {
  const { state, dispatch, openSavedResult, resetWorkspace, refreshSaved } = useWorkspace();
  const loading = useSimulatedLoad(420);

  if (state.backend.mode === 'live') {
    const saved = state.backend.saved;
    return (
      <ViewShell
        title="Saved Results"
        description="Analyses you kept, restored exactly as the agent produced them."
        demoNote={false}
        actions={
          <Button variant="ghost" size="sm" onClick={() => void refreshSaved()}>
            Refresh
          </Button>
        }
      >
        <PersistenceNotice persistence={state.backend.persistence} />
        {saved.length === 0 ? (
          <LiveEmpty
            icon={<Bookmark className="h-6 w-6" strokeWidth={1.6} />}
            title="No saved results yet."
            body="Run an analysis and use the bookmark button in the result panel to keep it."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {saved.map((entry) => (
              <article
                key={entry.id}
                className="flex flex-col rounded-2xl border border-edge/60 bg-panel/40 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[13.5px] font-semibold leading-snug text-ink">
                    {entry.title}
                  </h3>
                  <Badge tone="neutral" className="shrink-0 font-mono text-[9.5px] uppercase">
                    {entry.analysisMethod.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <p className="mt-1.5 text-[11.5px] text-ink-dim">
                  {new Date(entry.createdAt).toLocaleString()}
                </p>
                <p className="mt-2.5 flex-1 text-[12.5px] leading-relaxed text-ink-mute">
                  {entry.query}
                </p>
                {entry.location && (
                  <p className="mt-2 font-mono text-[10.5px] text-ink-faint">
                    {entry.location.placeName}
                  </p>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-4 self-start"
                  onClick={() =>
                    dispatch({ type: 'backend-response', response: entry.response })
                  }
                >
                  Open
                </Button>
              </article>
            ))}
          </div>
        )}
      </ViewShell>
    );
  }

  return (
    <ViewShell
      title="Saved Results"
      description="Analyses you kept. Opening one restores its conversation and result panel exactly as it was."
    >
      {loading ? (
        <SkeletonCards count={3} />
      ) : state.savedResults.length === 0 ? (
        <EmptyState
          icon={<Bookmark className="h-6 w-6" strokeWidth={1.6} />}
          title="No saved results yet."
          body="Run an analysis and use “Save to Saved Results” in the result panel menu to keep it here."
          action={
            <Button variant="primary" onClick={resetWorkspace}>
              Go to workspace
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {state.savedResults.map((entry) => (
            <article
              key={entry.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-edge/60 bg-panel/40 transition-all duration-200 ease-premium hover:-translate-y-0.5 hover:border-brand-500/25 hover:bg-panel-raised/50"
            >
              <div className="p-3 pb-0">
                <ResultThumbnail scenarioId={entry.scenarioId} kind={entry.kind} className="h-32" />
              </div>

              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[13.5px] font-semibold leading-snug text-ink">
                    {entry.title}
                  </h3>
                  <Badge tone="neutral" className="shrink-0 font-mono">
                    {entry.tag}
                  </Badge>
                </div>

                <p className="mt-1.5 text-[11.5px] text-ink-dim">{entry.date}</p>
                <p className="mt-2.5 flex-1 text-[12.5px] leading-relaxed text-ink-mute text-pretty">
                  {entry.description}
                </p>

                <div className="mt-4 flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => openSavedResult(entry.id)}>
                    Open
                  </Button>
                  <IconButton
                    label={`Remove ${entry.title}`}
                    size="sm"
                    className="ml-auto opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                    onClick={() => dispatch({ type: 'remove-saved', id: entry.id })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </ViewShell>
  );
}
