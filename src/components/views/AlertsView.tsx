import { Bell, BellRing, CheckCheck } from 'lucide-react';
import { Badge, StatusDot } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useSimulatedLoad } from '@/hooks/useSimulatedLoad';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/state/WorkspaceContext';
import { ViewShell } from './ViewShell';
import { LiveEmpty, PersistenceNotice } from './LiveEmpty';

const SEVERITY = {
  high: { tone: 'red', label: 'High', dot: 'red' },
  medium: { tone: 'amber', label: 'Medium', dot: 'amber' },
  low: { tone: 'neutral', label: 'Low', dot: 'mute' },
} as const;

export function AlertsView() {
  const { state, dispatch, submitQuery, resetWorkspace, refreshActivity } = useWorkspace();
  const loading = useSimulatedLoad(380);
  const unread = state.alerts.filter((a) => a.unread).length;

  // Connected: this panel is the real activity feed, read from Supabase.
  if (state.backend.mode === 'live') {
    const events = state.backend.activity;
    return (
      <ViewShell
        title="Activity"
        description="Everything the agent has done for this account, recorded as it happened."
        demoNote={false}
        actions={
          <Button variant="ghost" size="sm" onClick={() => void refreshActivity()}>
            Refresh
          </Button>
        }
      >
        <PersistenceNotice persistence={state.backend.persistence} />
        {events.length === 0 ? (
          <LiveEmpty
            icon={<Bell className="h-6 w-6" strokeWidth={1.6} />}
            title="No activity yet."
            body="Run an analysis and every step the agent records — datasets found, imagery selected, maps generated — appears here."
          />
        ) : (
          <ul className="space-y-2">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex items-start gap-4 rounded-2xl border border-edge/60 bg-panel/40 p-4"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/[0.09] text-brand-300">
                  <BellRing className="h-4 w-4" strokeWidth={1.7} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[13px] font-medium text-ink-soft">
                      {event.type.replace(/_/g, ' ').toLowerCase()}
                    </h3>
                    <span className="ml-auto text-[11.5px] text-ink-faint">
                      {new Date(event.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-mute">
                    {event.message}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ViewShell>
    );
  }

  return (
    <ViewShell
      title="Alerts"
      description="Monitoring notifications from your saved areas. In a backed build these would fire when new imagery crosses a threshold you set."
      actions={
        unread > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<CheckCheck className="h-3.5 w-3.5" />}
            onClick={() => dispatch({ type: 'read-all-alerts' })}
          >
            Mark all read
          </Button>
        ) : undefined
      }
    >
      {loading ? (
        <SkeletonRows count={4} />
      ) : state.alerts.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-6 w-6" strokeWidth={1.6} />}
          title="No alerts yet."
          body="Set an area of interest to monitoring and new detections will appear here."
          action={
            <Button variant="primary" onClick={resetWorkspace}>
              Go to workspace
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {state.alerts.map((alert) => {
            const severity = SEVERITY[alert.severity];
            return (
              <li
                key={alert.id}
                className={cn(
                  'group flex items-start gap-4 rounded-2xl border bg-panel/40 p-4 transition-all duration-200 ease-premium hover:border-brand-500/25 hover:bg-panel-raised/50',
                  alert.unread ? 'border-brand-500/20' : 'border-edge/60',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                    alert.unread
                      ? 'bg-brand-500/[0.1] text-brand-300'
                      : 'bg-white/[0.03] text-ink-dim',
                  )}
                >
                  {alert.unread ? (
                    <BellRing className="h-4 w-4" strokeWidth={1.7} />
                  ) : (
                    <Bell className="h-4 w-4" strokeWidth={1.7} />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3
                      className={cn(
                        'text-[13.5px]',
                        alert.unread ? 'font-semibold text-ink' : 'font-medium text-ink-soft',
                      )}
                    >
                      {alert.title}
                    </h3>
                    <Badge tone={severity.tone}>{severity.label}</Badge>
                    {alert.unread && <StatusDot tone="brand" pulse={false} className="ml-0.5" />}
                  </div>

                  <p className="mt-1 text-[12.5px] text-ink-mute">{alert.region}</p>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-ink-dim text-pretty">
                    {alert.detail}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        dispatch({ type: 'read-alert', id: alert.id });
                        submitQuery(alertQuery(alert.kind));
                      }}
                    >
                      Investigate
                    </Button>
                    {alert.unread && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => dispatch({ type: 'read-alert', id: alert.id })}
                      >
                        Mark read
                      </Button>
                    )}
                    <span className="ml-auto text-[11.5px] text-ink-faint">{alert.time}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </ViewShell>
  );
}

function alertQuery(kind: string): string {
  switch (kind) {
    case 'urban':
      return 'Show me urban expansion around Ranchi from 2021 to 2026.';
    case 'vegetation':
      return 'Where has vegetation decreased in Jharkhand?';
    case 'water':
      return 'Detect water-body changes near Bengaluru.';
    default:
      return 'Compare land-use change in this region over the last 5 years.';
  }
}
