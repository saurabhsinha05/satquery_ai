import { getSpec, methodForIntent } from '../../eo/registry.js';
import { getCollection } from '../../services/copernicus/collections.js';
import { zoomForBBox, bboxCenter } from '../../lib/geo.js';
import type { EpochWindow } from '../../eo/runner.js';
import { publish, step, type RunRecord } from '../events.js';
import type { SatQueryStateType, SatQueryUpdate } from '../state.js';

/* ────────────────────────────── analysis_planner ─────────────────────────── */

/**
 * Decides what will actually run.
 *
 * Intent comes from the language model; the method comes from a lookup table
 * here. That separation is deliberate — the model is not allowed to name an
 * analysis the backend cannot perform, and it is never asked for a number.
 */
export function makeAnalysisPlanner(run: RunRecord) {
  return async (state: SatQueryStateType): Promise<SatQueryUpdate> => {
    const started = Date.now();
    const method = methodForIntent(state.intent);
    const spec = getSpec(method);

    if (!spec) {
      const message = 'This analysis type is not currently supported.';
      return {
        analysisMethod: 'NONE',
        requestedAnalysis: 'NONE',
        errors: [message],
        agentSteps: [
          step('analysis_planner', 'Plan the analysis', 'failed', { error: message }),
        ],
      };
    }

    const range = state.dateRange;
    let before: EpochWindow | null = null;
    let after: EpochWindow | null = null;
    let single: EpochWindow | null = null;

    if (range?.before && range?.after) {
      before = { ...range.before, epoch: 'before' };
      after = { ...range.after, epoch: 'after' };
    } else if (range) {
      single = { from: range.from, to: range.to, label: range.from.slice(0, 4), epoch: 'single' };
    }

    // A change method needs two epochs. If the query gave one, widen it into a
    // pair rather than silently reporting change from a single moment.
    if (spec.requiresTwoEpochs && (!before || !after) && range) {
      const endYear = Number(range.to.slice(0, 4));
      const startYear = Math.max(2016, endYear - 5);
      before = { from: `${startYear}-01-01`, to: `${startYear}-12-31`, label: String(startYear), epoch: 'before' };
      after = { from: `${endYear}-01-01`, to: range.to, label: String(endYear), epoch: 'after' };
      single = null;
    }

    const collections = [spec.collection];
    if (spec.fallbackCollection) collections.push(spec.fallbackCollection);

    const detail = `${spec.label} using ${collections
      .map((c) => getCollection(c).displayName)
      .join(' with fallback to ')}${spec.indices.length ? `, indices ${spec.indices.join(', ')}` : ''}.`;

    publish(run, 'map.planned', `Planned: ${spec.label}.`, {
      method,
      collections,
      indices: spec.indices,
      bands: spec.bands,
      before,
      after,
      single,
    });

    return {
      analysisMethod: method,
      requestedAnalysis: method,
      requiredDatasets: collections,
      epochs: { before, after, single },
      dateRange:
        before && after
          ? {
              from: before.from,
              to: after.to,
              before: { from: before.from, to: before.to, label: before.label },
              after: { from: after.from, to: after.to, label: after.label },
            }
          : state.dateRange,
      agentSteps: [
        step('analysis_planner', 'Plan the analysis', 'completed', {
          detail,
          durationMs: Date.now() - started,
        }),
      ],
    };
  };
}

/* ─────────────────────────────── map_planner ─────────────────────────────── */

/**
 * Decides what the map should show before any imagery is fetched, so the
 * pipeline renders exactly what the question asked to see — and renders both
 * epochs against one bounding box, which is what makes a comparison honest.
 */
export function makeMapPlanner(run: RunRecord) {
  return async (state: SatQueryStateType): Promise<SatQueryUpdate> => {
    const started = Date.now();
    const bbox = state.bbox;
    if (!bbox) {
      return {
        agentSteps: [
          step('map_planner', 'Plan the map', 'skipped', {
            detail: 'No area of interest was resolved.',
          }),
        ],
      };
    }

    const spec = getSpec(state.analysisMethod);
    const hasTwoEpochs = Boolean(state.epochs.before && state.epochs.after);
    const isCatalogueOnly = state.analysisMethod === 'DATASET_DISCOVERY';

    const comparisonMode: 'split' | 'toggle' | 'none' = hasTwoEpochs ? 'split' : 'none';
    const needsOverlay = Boolean(spec?.requiresTwoEpochs && spec.overlayEvalscript && hasTwoEpochs);
    const needsImagery = !isCatalogueOnly;

    const zoom = zoomForBBox(bbox);
    const center = bboxCenter(bbox);

    const description = [
      `Extent ${bbox.map((v) => v.toFixed(3)).join(', ')} at zoom ${zoom}`,
      hasTwoEpochs
        ? `split-screen comparison of ${state.epochs.before?.label} and ${state.epochs.after?.label}`
        : 'single-epoch view',
      needsOverlay ? 'with a change-detection overlay' : 'with no derived overlay',
    ].join('; ');

    publish(run, 'map.planned', `Map planned — ${description}.`, {
      comparisonMode,
      needsOverlay,
      needsImagery,
      zoom,
      center,
      bbox,
    });

    return {
      mapPlan: { comparisonMode, needsOverlay, needsImagery, zoom, center },
      agentSteps: [
        step('map_planner', 'Plan the map', 'completed', {
          detail: description,
          durationMs: Date.now() - started,
        }),
      ],
    };
  };
}
