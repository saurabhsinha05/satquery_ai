import { useMemo, useState } from 'react';
import { Clock, MessageSquare, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useSimulatedLoad } from '@/hooks/useSimulatedLoad';
import { useWorkspace } from '@/state/WorkspaceContext';
import { ViewShell } from './ViewShell';

export function HistoryView() {
  const { state, dispatch, restoreHistory, resetWorkspace } = useWorkspace();
  const loading = useSimulatedLoad(380);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return state.history;
    return state.history.filter(
      (h) => h.title.toLowerCase().includes(q) || h.query.toLowerCase().includes(q),
    );
  }, [query, state.history]);

  return (
    <ViewShell
      title="History"
      description="Every question you have asked in this session, plus a few seeded examples. Open one to restore its conversation and result."
      actions={
        state.history.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Trash2 className="h-3.5 w-3.5" />}
            onClick={() => dispatch({ type: 'clear-history' })}
          >
            Clear
          </Button>
        ) : undefined
      }
    >
      {loading ? (
        <SkeletonRows count={4} />
      ) : state.history.length === 0 ? (
        <EmptyState
          icon={<Clock className="h-6 w-6" strokeWidth={1.6} />}
          title="No previous queries."
          body="Questions you ask in the workspace show up here so you can pick them back up later."
          action={
            <Button variant="primary" onClick={resetWorkspace}>
              Ask your first question
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <label className="relative block max-w-sm">
            <span className="sr-only">Search history</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your questions…"
              className="w-full rounded-xl border border-edge/70 bg-panel/40 py-2.5 pl-9 pr-3 text-[13px] text-ink placeholder:text-ink-faint transition-colors focus:border-brand-500/40 focus:outline-none"
            />
          </label>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Search className="h-6 w-6" strokeWidth={1.6} />}
              title="Nothing matches that."
              body="Try a shorter search, or clear the box to see every question again."
            />
          ) : (
            <ul className="space-y-2">
              {filtered.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => restoreHistory(entry.id)}
                    className="group flex w-full items-center gap-4 rounded-2xl border border-edge/60 bg-panel/40 p-4 text-left transition-all duration-200 ease-premium hover:-translate-y-0.5 hover:border-brand-500/25 hover:bg-panel-raised/60"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/[0.09] text-brand-300">
                      <MessageSquare className="h-4 w-4" strokeWidth={1.7} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink">
                        {entry.title}
                      </span>
                      <span className="mt-1 block truncate text-[12.5px] text-ink-mute">
                        {entry.query}
                      </span>
                    </span>

                    <span className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                      <span className="text-[12px] text-ink-dim">{entry.date}</span>
                      <span className="text-[11px] text-ink-faint">
                        {entry.messageCount} messages
                      </span>
                    </span>

                    <span className="shrink-0 rounded-lg border border-edge-strong/50 px-2.5 py-1.5 text-[12px] text-ink-mute transition-colors duration-200 group-hover:border-brand-500/35 group-hover:text-brand-200">
                      Open
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </ViewShell>
  );
}
