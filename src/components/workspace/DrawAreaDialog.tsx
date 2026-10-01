import { useEffect, useState } from 'react';
import { Check, PencilRuler, RotateCcw, Square } from 'lucide-react';
import { SceneCanvas, type DrawnRect } from '@/components/map/SceneCanvas';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { getPalette } from '@/lib/demoAgent';
import { INITIAL_MAP_STATE } from '@/state/workspaceReducer';

const VISIBILITY = { change: true, target: true, baseline: false, basemap: true };

/**
 * Frontend-only AOI drawing. Drag a rectangle over the simulated scene and
 * confirm it — nothing is projected, measured, or sent anywhere.
 */
export function DrawAreaDialog({
  open,
  onClose,
  onConfirm,
  seed,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (label: string) => void;
  seed: string;
}) {
  const [rect, setRect] = useState<DrawnRect | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!open) setRect(null);
  }, [open]);

  // Illustrative extent so the interaction has a readable read-out.
  const areaLabel = rect ? `~${Math.round(rect.w * rect.h * 4200).toLocaleString()} km²` : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Draw on map"
      description="Drag a rectangle to select an area of interest for your next question."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!rect}
            leftIcon={<Check className="h-4 w-4" />}
            onClick={() => {
              if (!rect) return;
              onConfirm(`Drawn area · ${areaLabel}`);
              onClose();
            }}
          >
            Use this area
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand" dot>
            Drawing mode
          </Badge>
          <Badge tone="neutral">Demo geometry — no projection applied</Badge>
          <button
            type="button"
            onClick={() => {
              setRect(null);
              setNonce((n) => n + 1);
            }}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] text-ink-mute transition-colors hover:bg-white/[0.05] hover:text-ink"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear
          </button>
        </div>

        <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-edge/70">
          <SceneCanvas
            key={nonce}
            seed={seed}
            kind="urban"
            palette={getPalette('urban')}
            visibility={VISIBILITY}
            mapState={INITIAL_MAP_STATE}
            interactive
            drawMode
            onDrawComplete={setRect}
            ariaLabel="Draw an area of interest on the simulated map"
          />
          {!rect && (
            <span className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full border border-edge-strong/50 bg-black/65 px-3 py-1.5 text-[11.5px] text-ink-mute backdrop-blur">
              <PencilRuler className="mr-1.5 inline h-3 w-3" />
              Click and drag to draw a rectangle
            </span>
          )}
        </div>

        <div
          className={
            rect
              ? 'flex items-center gap-2.5 rounded-xl border border-brand-500/25 bg-brand-500/[0.07] px-3.5 py-2.5'
              : 'flex items-center gap-2.5 rounded-xl border border-edge/60 bg-panel/40 px-3.5 py-2.5'
          }
          aria-live="polite"
        >
          <Square
            className={rect ? 'h-4 w-4 text-brand-300' : 'h-4 w-4 text-ink-faint'}
            strokeWidth={1.8}
          />
          {rect ? (
            <p className="text-[12.5px] text-brand-100">
              Area selected —{' '}
              <span className="font-mono text-brand-300">{areaLabel}</span>
              <span className="ml-2 text-ink-dim">(illustrative extent)</span>
            </p>
          ) : (
            <p className="text-[12.5px] text-ink-mute">No area selected yet.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
