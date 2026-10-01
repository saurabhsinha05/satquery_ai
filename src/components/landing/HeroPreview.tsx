import { Bot, Check, RefreshCw } from 'lucide-react';
import { SceneCanvas } from '@/components/map/SceneCanvas';
import { DemoBadge } from '@/components/ui/Badge';
import { getPalette } from '@/lib/demoAgent';
import { INITIAL_MAP_STATE } from '@/state/workspaceReducer';

const VISIBILITY = { change: true, target: true, baseline: false, basemap: true };

/**
 * The two floating cards over the hero Earth: the question the user asks, and
 * the analysis card that answers it. Static, non-interactive, clearly demo.
 */
export function HeroPreview() {
  return (
    <div className="relative w-full max-w-[430px]">
      {/* Query bubble */}
      <div className="relative z-20 ml-auto w-[min(340px,88%)] animate-fade-up [animation-delay:220ms]">
        <div className="sq-glass flex items-start gap-3 rounded-2xl border border-edge-strong/60 p-3.5 shadow-lift">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-brand-500/25 bg-brand-500/12 text-brand-300">
            <Bot className="h-3.5 w-3.5" />
          </span>
          <p className="text-[13px] leading-relaxed text-ink-soft">
            Show me urban expansion around Ranchi from 2021 to 2026.
          </p>
        </div>
      </div>

      {/* Analysis card */}
      <div className="relative z-10 -mt-3 animate-fade-up [animation-delay:380ms]">
        <div className="sq-glass overflow-hidden rounded-2xl border border-edge-strong/60 shadow-lift">
          <div className="flex items-center justify-between gap-3 border-b border-edge/60 px-4 py-3">
            <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500/15 text-brand-300">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              Analysis Complete
            </span>
            <DemoBadge label="Demo Result" />
          </div>

          <div className="px-4 pb-4 pt-4">
            <div className="relative h-[190px] overflow-hidden rounded-xl border border-edge/70">
              <SceneCanvas
                seed="urban-ranchi"
                kind="urban"
                palette={getPalette('urban')}
                visibility={VISIBILITY}
                mapState={{ ...INITIAL_MAP_STATE, zoom: 1.12 }}
                ariaLabel="Illustrative urban expansion visualization for the demo (not real imagery)"
              />
              <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/[0.05]" />
            </div>

            <div className="mt-3.5">
              <p className="text-[13.5px] font-semibold text-ink">Urban Expansion Detected</p>
              <p className="mt-1.5 flex items-center gap-2 text-[11.5px] text-ink-mute">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
                NDBI + Temporal Change Detection
              </p>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-lg border border-edge/60 bg-black/25 px-2.5 py-2 text-[11px] text-ink-dim">
              <RefreshCw className="h-3 w-3 shrink-0" />
              <span>Illustrative demo analysis — generated locally, not from live imagery.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
