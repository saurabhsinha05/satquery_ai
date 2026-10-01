import type { AnalysisMethod, MapLegendEntry } from '../types/contract.js';

/**
 * The analysis abstraction layer.
 *
 * An "analysis" is a declarative spec: which collection it needs, which index
 * it is built on, which evalscript renders it, which classes it produces, and
 * how it should be described. Adding a new algorithm means adding a spec — the
 * runner, the agent graph and the map builder need no changes.
 */

export interface AnalysisClassSpec {
  id: string;
  label: string;
  color: string;
  description: string;
}

export interface AnalysisSpec {
  method: AnalysisMethod;
  label: string;
  /** Shown to the user as the method line under a result. */
  methodDescription: string;
  /** Sentinel Hub collection this analysis reads. */
  collection: string;
  /** Fallback collection when the primary has no usable scenes (e.g. cloud). */
  fallbackCollection?: string;
  indices: string[];
  bands: string[];
  /** True when the analysis compares two epochs. */
  requiresTwoEpochs: boolean;
  /** Evalscript that renders the overlay PNG. */
  overlayEvalscript: string;
  /** Statistics evalscript key, or null when the method produces no classes. */
  statisticsMethod:
    | 'NDVI_CHANGE'
    | 'BUILT_UP_CHANGE'
    | 'FLOOD_CHANGE'
    | 'LAND_COVER_CHANGE'
    | 'TEMPORAL_CHANGE'
    | null;
  classes: AnalysisClassSpec[];
  legendTitle: string;
  legendNote?: string;
  /** Cloud-cover ceiling applied when searching and compositing. */
  maxCloudCover: number;
  /** Ground resolution used for the overlay render. */
  targetResolutionM: number;
  /** Analysis purpose shown on the dataset card. */
  purpose: string;
}

export function legendFromClasses(
  classes: AnalysisClassSpec[],
  areas: Map<string, { areaKm2: number; fraction: number }>,
): MapLegendEntry[] {
  // Only classes the analysis actually produced end up in the legend.
  return classes
    .filter((c) => {
      const hit = areas.get(c.id);
      return hit !== undefined && hit.fraction > 0;
    })
    .map((c) => {
      const hit = areas.get(c.id);
      return {
        label: c.label,
        color: c.color,
        areaKm2: hit ? Math.round(hit.areaKm2 * 100) / 100 : undefined,
        fraction: hit ? Math.round(hit.fraction * 10000) / 10000 : undefined,
      };
    });
}
