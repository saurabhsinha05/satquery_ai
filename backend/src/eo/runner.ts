import { hasCopernicus } from '../config/env.js';
import { logger } from '../lib/logger.js';
import type { BBox } from '../lib/geo.js';
import { bboxAreaKm2, rasterSizeFor } from '../lib/geo.js';
import { authHeader } from '../services/copernicus/auth.js';
import { getCollection } from '../services/copernicus/collections.js';
import {
  RADAR_COMPOSITE_S1,
  TRUE_COLOUR_S2,
  classFractionScript,
  indexStatsScript,
} from '../services/copernicus/evalscripts.js';
import { looksEmpty, renderImage } from '../services/copernicus/process.js';
import { bandKey, fetchStatistics } from '../services/copernicus/statistics.js';
import { imageUrl, putImage } from '../services/imageryStore.js';
import type {
  AnalysisClassArea,
  AnalysisResult,
  MapAnalysisLayer,
  MapImagery,
  SatelliteScene,
  StatisticBand,
} from '../types/contract.js';
import type { AnalysisSpec } from './types.js';

/**
 * Executes an analysis spec against Copernicus.
 *
 * Everything this module returns is either a real rendered raster, a real
 * statistic from the Statistics API, or null. There is no branch that produces
 * a plausible-looking number when the upstream call fails.
 */

export interface EpochWindow {
  from: string;
  to: string;
  label: string;
  epoch: 'before' | 'after' | 'single';
}

const ATTRIBUTION = 'Contains modified Copernicus Sentinel data, processed by SatQuery AI';

/* ───────────────────────────── True-colour imagery ───────────────────────── */

export async function renderEpochImagery(
  spec: AnalysisSpec,
  bbox: BBox,
  window: EpochWindow,
  scene: SatelliteScene | null,
): Promise<{ imagery: MapImagery | null; warning?: string }> {
  if (!hasCopernicus()) {
    return {
      imagery: null,
      warning:
        'Satellite imagery could not be rendered: Copernicus credentials are not configured on the backend.',
    };
  }

  const attempts: Array<{ collection: string; evalscript: string }> = [
    { collection: spec.collection, evalscript: TRUE_COLOUR_S2 },
  ];
  if (spec.fallbackCollection === 'sentinel-1-grd') {
    attempts.push({ collection: 'sentinel-1-grd', evalscript: RADAR_COMPOSITE_S1 });
  }

  let lastWarning: string | undefined;

  for (const attempt of attempts) {
    const collectionSpec = getCollection(attempt.collection);
    try {
      const auth = await authHeader();
      const result = await renderImage(
        {
          bbox,
          evalscript: attempt.evalscript,
          inputs: [
            {
              collection: attempt.collection,
              from: window.from,
              to: window.to,
              maxCloudCoverage: collectionSpec.hasCloudCover ? spec.maxCloudCover : undefined,
            },
          ],
          targetResolutionM: Math.max(spec.targetResolutionM, collectionSpec.resolutionMeters),
        },
        auth,
      );

      if (looksEmpty(result.png)) {
        lastWarning = `No usable ${collectionSpec.displayName} imagery was found for ${window.label} over this area — every observation in the window was cloudy or outside coverage.`;
        continue;
      }

      const stored = putImage(result.png, bbox, result.width, result.height, {
        collection: attempt.collection,
        window,
        sceneId: scene?.id,
      });

      return {
        imagery: {
          id: stored.id,
          label: window.label,
          epoch: window.epoch,
          year: Number(window.label.match(/\d{4}/)?.[0]) || undefined,
          source: collectionSpec.displayName,
          collection: attempt.collection,
          acquisitionDate: scene?.acquisitionDate,
          acquisitionWindow: { from: window.from, to: window.to },
          cloudCover: scene?.cloudCover,
          resolution: collectionSpec.resolution,
          layerUrl: imageUrl(stored.id),
          bbox,
          sceneIds: scene ? [scene.id] : [],
          attribution: ATTRIBUTION,
        },
        warning: lastWarning,
      };
    } catch (e) {
      lastWarning = e instanceof Error ? e.message : 'Imagery rendering failed.';
      logger.warn('epoch imagery render failed', {
        collection: attempt.collection,
        label: window.label,
        reason: lastWarning,
      });
    }
  }

  return { imagery: null, warning: lastWarning };
}

/* ─────────────────────────── Change overlay raster ───────────────────────── */

export async function renderChangeOverlay(
  spec: AnalysisSpec,
  bbox: BBox,
  before: EpochWindow,
  after: EpochWindow,
): Promise<{ layer: MapAnalysisLayer | null; warning?: string }> {
  if (!spec.overlayEvalscript || !spec.requiresTwoEpochs) return { layer: null };
  if (!hasCopernicus()) {
    return {
      layer: null,
      warning: 'Change layer could not be generated: Copernicus credentials are not configured.',
    };
  }

  try {
    const auth = await authHeader();
    const result = await renderImage(
      {
        bbox,
        evalscript: spec.overlayEvalscript,
        inputs: [
          {
            collection: spec.collection,
            from: before.from,
            to: before.to,
            maxCloudCoverage: spec.maxCloudCover,
            id: 'before',
          },
          {
            collection: spec.collection,
            from: after.from,
            to: after.to,
            maxCloudCoverage: spec.maxCloudCover,
            id: 'after',
          },
        ],
        targetResolutionM: spec.targetResolutionM,
      },
      auth,
    );

    if (looksEmpty(result.png)) {
      return {
        layer: null,
        warning:
          'The change detection ran but found no pixels above the change threshold, or had no cloud-free observations in one of the epochs.',
      };
    }

    const stored = putImage(result.png, bbox, result.width, result.height, {
      method: spec.method,
      before,
      after,
    });

    return {
      layer: {
        id: stored.id,
        label: spec.legendTitle || spec.label,
        type: 'image',
        layerUrl: imageUrl(stored.id),
        bbox,
        opacity: 0.85,
        visible: true,
        legendId: spec.method,
        description: spec.methodDescription,
      },
    };
  } catch (e) {
    const warning = e instanceof Error ? e.message : 'Change layer rendering failed.';
    logger.warn('change overlay render failed', { method: spec.method, reason: warning });
    return { layer: null, warning };
  }
}

/* ──────────────────────────── Real statistics ────────────────────────────── */

async function indexStatsForEpoch(
  spec: AnalysisSpec,
  bbox: BBox,
  window: EpochWindow,
  index: 'NDVI' | 'NDBI' | 'NDWI',
  auth: Record<string, string>,
): Promise<StatisticBand | null> {
  const stats = await fetchStatistics(
    {
      bbox,
      evalscript: indexStatsScript(index),
      inputs: [
        {
          collection: spec.collection,
          from: window.from,
          to: window.to,
          maxCloudCoverage: spec.maxCloudCover,
        },
      ],
      aggregation: { from: window.from, to: window.to },
      outputId: 'index',
      resolutionMeters: Math.max(20, spec.targetResolutionM * 2),
    },
    auth,
  );

  if (!stats || stats.coverage === 0) return null;
  const band = stats.bands[0];
  if (!band || band.mean === undefined) return null;

  return {
    label: `${index} — ${window.label}`,
    index,
    epoch: window.epoch === 'single' ? 'before' : window.epoch,
    mean: round(band.mean, 4),
    min: round(band.min, 4),
    max: round(band.max, 4),
    stDev: round(band.stDev, 4),
    sampleCoverage: round(stats.coverage, 4),
    sampleCount: band.sampleCount,
  };
}

function round(v: number | undefined, dp: number): number | undefined {
  if (v === undefined || !Number.isFinite(v)) return undefined;
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}

export async function computeAnalysis(
  spec: AnalysisSpec,
  bbox: BBox,
  before: EpochWindow | null,
  after: EpochWindow | null,
): Promise<AnalysisResult> {
  const analysedAreaKm2 = Math.round(bboxAreaKm2(bbox) * 100) / 100;
  const { pixelSizeMeters } = rasterSizeFor(bbox, spec.targetResolutionM);

  const base: AnalysisResult = {
    method: spec.method,
    status: 'no_data',
    computedBy: 'Copernicus Data Space — Sentinel Hub Statistics API',
    statistics: [],
    classes: [],
    pixelSizeMeters: Math.round(pixelSizeMeters * 10) / 10,
    analysedAreaKm2,
  };

  // Imagery-only and catalogue-only methods produce no measurements by design.
  if (spec.statisticsMethod === null) {
    return {
      ...base,
      status: 'completed',
      computedBy: 'No derived analysis — this query asked to see imagery, not to measure it.',
      message:
        'This result is imagery only. No index was computed, so no statistics or change classes are reported.',
    };
  }

  if (!hasCopernicus()) {
    return {
      ...base,
      status: 'data_available_processing_required',
      computedBy: 'Not computed',
      message:
        'Copernicus credentials are not configured on the backend, so the processing pipeline could not run. Catalogue discovery is still available.',
    };
  }

  if (!before || !after) {
    return {
      ...base,
      status: 'unsupported',
      computedBy: 'Not computed',
      message:
        'This analysis compares two epochs, but the query did not resolve to two distinct time windows.',
    };
  }

  const auth = await authHeader();
  const warnings: string[] = [];

  /* Per-epoch index means — genuine values from the Statistics API. */
  const statistics: StatisticBand[] = [];
  const primaryIndex = (spec.indices[0] as 'NDVI' | 'NDBI' | 'NDWI') ?? null;

  if (primaryIndex) {
    for (const window of [before, after]) {
      try {
        const stat = await indexStatsForEpoch(spec, bbox, window, primaryIndex, auth);
        if (stat) statistics.push(stat);
        else
          warnings.push(
            `No valid ${primaryIndex} samples for ${window.label} — every observation in that window was masked out.`,
          );
      } catch (e) {
        warnings.push(
          `${primaryIndex} statistics for ${window.label} failed: ${e instanceof Error ? e.message : 'unknown error'}`,
        );
      }
    }

    // Delta is arithmetic on two measured values, not an estimate.
    const b = statistics.find((s) => s.epoch === 'before');
    const a = statistics.find((s) => s.epoch === 'after');
    if (b?.mean !== undefined && a?.mean !== undefined) {
      statistics.push({
        label: `${primaryIndex} change (${after.label} − ${before.label})`,
        index: primaryIndex,
        epoch: 'delta',
        mean: round(a.mean - b.mean, 4),
        sampleCoverage: Math.min(a.sampleCoverage ?? 1, b.sampleCoverage ?? 1),
      });
    }
  }

  /* Class areas — each band's mean is the fraction of valid pixels in class. */
  const classes: AnalysisClassArea[] = [];
  try {
    const { script, classes: classSpecs } = classFractionScript(spec.statisticsMethod);
    const stats = await fetchStatistics(
      {
        bbox,
        evalscript: script,
        inputs: [
          {
            collection: spec.collection,
            from: before.from,
            to: before.to,
            maxCloudCoverage: spec.maxCloudCover,
            id: 'before',
          },
          {
            collection: spec.collection,
            from: after.from,
            to: after.to,
            maxCloudCoverage: spec.maxCloudCover,
            id: 'after',
          },
        ],
        aggregation: { from: before.from, to: after.to },
        outputId: 'classes',
        resolutionMeters: Math.max(20, spec.targetResolutionM * 2),
      },
      auth,
    );

    if (stats && stats.coverage > 0) {
      classSpecs.forEach((cls, index) => {
        const band = stats.bands.find((b) => b.band === bandKey(index));
        if (!band || band.mean === undefined) return;
        const fraction = Math.max(0, Math.min(1, band.mean));
        if (fraction <= 0) return;
        // Area of valid samples only — never the full bbox when coverage is partial.
        const validArea = analysedAreaKm2 * stats.coverage;
        classes.push({
          classId: cls.id,
          label: cls.label,
          color: cls.color,
          areaKm2: Math.round(fraction * validArea * 100) / 100,
          fraction: round(fraction, 4) as number,
          pixelCount: Math.round(fraction * (band.sampleCount ?? 0)),
        });
      });
    } else {
      warnings.push(
        'The change statistics returned no valid samples — the two epochs had no overlapping cloud-free observations over this area.',
      );
    }
  } catch (e) {
    warnings.push(
      `Change-class statistics failed: ${e instanceof Error ? e.message : 'unknown error'}`,
    );
  }

  const haveSomething = statistics.length > 0 || classes.length > 0;
  const status: AnalysisResult['status'] = !haveSomething
    ? 'no_data'
    : warnings.length > 0
      ? 'partial'
      : 'completed';

  return {
    ...base,
    status,
    statistics,
    classes,
    message:
      warnings.length > 0
        ? warnings.join(' ')
        : haveSomething
          ? undefined
          : 'No valid satellite observations were available for this area and time range.',
  };
}
