import type { ReactNode } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { useWorkspace } from '@/state/WorkspaceContext';

/**
 * Shared empty state for the live views.
 *
 * When a backend is connected but has produced nothing yet, the honest answer
 * is "nothing here yet, ask a question" — not a screen of demo content.
 */
export function LiveEmpty({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  const { resetWorkspace } = useWorkspace();
  return (
    <EmptyState
      icon={icon}
      title={title}
      body={body}
      action={
        <Button variant="primary" onClick={resetWorkspace}>
          Ask a question
        </Button>
      }
    />
  );
}

/** Banner shown when persistence is off, so absent history is explained. */
export function PersistenceNotice({ persistence }: { persistence: boolean }) {
  if (persistence) return null;
  return (
    <p className="mb-4 rounded-xl border border-edge/60 bg-panel/40 px-4 py-3 text-[12px] leading-relaxed text-ink-dim">
      Persistence is off — <code className="font-mono text-[11px]">SUPABASE_URL</code> and{' '}
      <code className="font-mono text-[11px]">SUPABASE_SECRET_KEY</code> are not set on the backend,
      so nothing is stored between runs. Everything below is from the current session only.
    </p>
  );
}
