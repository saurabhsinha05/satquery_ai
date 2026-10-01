import { Component, type ErrorInfo, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Frontend-only failure surface. There is no server in this build, so this
 * catches render/runtime faults and offers a way back into the product.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Kept local — nothing is reported anywhere.
    console.error('[SatQuery] render error', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-full items-center justify-center bg-void px-6 py-24">
        <div className="sq-panel w-full max-w-md p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-400/10 text-amber-300">
            <TriangleAlert className="h-5 w-5" />
          </span>
          <h1 className="mt-5 text-lg font-semibold text-ink">Something went wrong.</h1>
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-mute">
            The interface hit an unexpected state. Nothing was sent anywhere — this build runs
            entirely in your browser.
          </p>
          {error.message && (
            <p className="mt-4 truncate rounded-lg border border-edge/70 bg-black/30 px-3 py-2 font-mono text-[11.5px] text-ink-dim">
              {error.message}
            </p>
          )}
          <div className="mt-7 flex justify-center gap-2.5">
            <Button variant="primary" onClick={() => this.setState({ error: null })}>
              Try again
            </Button>
            <Button variant="secondary" onClick={() => window.location.assign('/workspace')}>
              Return to workspace
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
