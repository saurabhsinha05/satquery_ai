import { getSpec } from '../../eo/registry.js';
import { computeAnalysis, renderChangeOverlay, renderEpochImagery } from '../../eo/runner.js';
import { legendFromClasses } from '../../eo/types.js';
import { bboxToPolygon, zoomForBBox, bboxCenter } from '../../lib/geo.js';
import type {
  MapAnalysisLayer,
  MapImagery,
  MapLegend,
  MapState,
} from '../../types/contract.js';
import { publish, step, activity, type RunRecord } from '../events.js';
import type { SatQueryStateType, SatQueryUpdate } from '../state.js';

/* ───────────────────────── earth_observation_processing ──────────────────── */

/**
 * Runs the pipeline: render each epoch, render the change overlay, then ask
 * the Statistics API for real numbers. Each piece can fail independently and
 * the failure is reported — the run never substitutes an invented result.
 */
export function makeEoProcessing(run: RunRecord) {
  return async (state: SatQueryStateType): Promise<SatQueryUpdate> => {
    const started = Date.now();
    const bbox = state.bbox;
    const spec = getSpec(state.analysisMethod);

    if (!bbox || !spec) {
      return {
        processingStatus: 'skipped',
        agentSteps: [
          step('eo_processing', 'Process imagery and run analysis', 'skipped', {
            detail: 'No area of interest or analysis plan.',
          }),
        ],
      };
    }

    publish(run, 'analysis.started', 'Processing imagery…');

    const imagery: MapImagery[] = [];
    const layers: MapAnalysisLayer[] = [];
    const warnings: string[] = [];

    /* Epoch imagery, both rendered against the same bbox and size. */
    if (state.mapPlan?.needsImagery !== false) {
      const windows = [state.epochs.before, state.epochs.after, state.epochs.single].filter(
        (w): w is NonNullable<typeof w> => w !== null,
      );

      for (const window of windows) {
        publish(run, 'analysis.progress', `Rendering ${window.label} imagery…`);
        const scene = state.selectedScenes.find((s) => s.epoch === window.epoch) ?? null;
        const { imagery: rendered, warning } = await renderEpochImagery(spec, bbox, window, scene);
        if (rendered) imagery.push(rendered);
        if (warning) warnings.push(warning);
      }
    }

    /* Change overlay from actual analysis output. */
    if (state.mapPlan?.needsOverlay && state.epochs.before && state.epochs.after) {
      publish(run, 'analysis.progress', 'Generating the change layer…');
      const { layer, warning } = await renderChangeOverlay(
        spec,
        bbox,
        state.epochs.before,
        state.epochs.after,
      );
      if (layer) layers.push(layer);
      if (warning) warnings.push(warning);
    }

    /* Real statistics. */
    publish(run, 'analysis.progress', 'Computing statistics from the imagery…');
    const analysisResult = await computeAnalysis(
      spec,
      bbox,
      state.epochs.before,
      state.epochs.after,
    );

    publish(
      run,
      'analysis.completed',
      analysisResult.status === 'completed'
        ? 'Analysis complete.'
        : analysisResult.status === 'partial'
          ? 'Analysis complete with caveats.'
          : analysisResult.message ?? 'Analysis could not be completed.',
      analysisResult,
    );

    return {
      processingStatus: analysisResult.status,
      mapImagery: imagery,
      mapLayers: layers,
      analysisResult,
      statistics: analysisResult.statistics,
      warnings,
      activity: [
        activity(
          analysisResult.status === 'completed' || analysisResult.status === 'partial'
            ? 'ANALYSIS_COMPLETED'
            : 'ANALYSIS_FAILED',
          `${spec.label} — ${analysisResult.status.replace(/_/g, ' ')}`,
          run.runId,
          { method: spec.method, status: analysisResult.status },
        ),
      ],
      agentSteps: [
        step('eo_processing', 'Process imagery and run analysis', 'completed', {
          detail: `${imagery.length} epoch render(s), ${layers.length} analysis layer(s), status ${analysisResult.status}.`,
          durationMs: Date.now() - started,
        }),
      ],
    };
  };
}

/* ─────────────────────────── map_generation ──────────────────────────────── */

/**
 * Assembles the map contract from what actually came back. The legend is built
 * from the measured class areas, so a category with no pixels never appears.
 */
export function makeMapGeneration(run: RunRecord) {
  return async (state: SatQueryStateType): Promise<SatQueryUpdate> => {
    const started = Date.now();
    const bbox = state.bbox;
    const spec = getSpec(state.analysisMethod);

    if (!bbox) {
      return {
        agentSteps: [step('map_generation', 'Build the map', 'skipped', { detail: 'No extent.' })],
      };
    }

    const before = state.mapImagery.find((i) => i.epoch === 'before');
    const after = state.mapImagery.find((i) => i.epoch === 'after');
    const comparisonPossible = Boolean(before && after);

    const legends: MapLegend[] = [];
    if (spec && spec.classes.length > 0 && state.analysisResult) {
      const areaByClass = new Map(
        state.analysisResult.classes.map((c) => [c.classId, { areaKm2: c.areaKm2, fraction: c.fraction }]),
      );
      const entries = legendFromClasses(spec.classes, areaByClass);
      if (entries.length > 0) {
        legends.push({
          id: spec.method,
          title: spec.legendTitle,
          entries,
          note: spec.legendNote,
        });
      }
    }

    const mapState: MapState = {
      center: bboxCenter(bbox),
      zoom: state.mapPlan?.zoom ?? zoomForBBox(bbox),
      bounds: bbox,
      baseLayer: { type: 'satellite', label: 'Satellite base map' },
      imagery: state.mapImagery,
      comparison: {
        enabled: comparisonPossible,
        mode: comparisonPossible ? 'split' : 'none',
        beforeLabel: before?.label ?? state.epochs.before?.label ?? '',
        afterLabel: after?.label ?? state.epochs.after?.label ?? '',
        beforeImageryId: before?.id,
        afterImageryId: after?.id,
      },
      analysisLayers: state.mapLayers,
      legend: legends,
      markers: state.location
        ? [
            {
              id: 'aoi-centre',
              coordinates: [state.location.longitude, state.location.latitude],
              label: state.location.placeName,
              description: state.location.country
                ? `${state.location.region ? `${state.location.region}, ` : ''}${state.location.country}`
                : undefined,
            },
          ]
        : [],
      boundaries: [
        {
          id: 'aoi',
          label: 'Area of interest',
          geojson: {
            type: 'Feature',
            properties: { name: state.location?.placeName ?? 'Area of interest' },
            geometry: bboxToPolygon(bbox),
          },
          color: '#2ACB93',
        },
      ],
      controls: {
        zoom: true,
        resetView: true,
        layerToggle: state.mapLayers.length > 0 || state.mapImagery.length > 1,
        baseMapToggle: true,
        opacity: state.mapLayers.length > 0,
        comparisonSlider: comparisonPossible,
        legend: legends.length > 0,
        fullscreen: true,
      },
      attribution: [
        'Contains modified Copernicus Sentinel data',
        '© Mapbox © OpenStreetMap',
      ],
      error:
        state.mapImagery.length === 0 && state.mapPlan?.needsImagery !== false
          ? 'Satellite imagery could not be retrieved for this area and time range. Nothing is shown in its place.'
          : undefined,
    };

    publish(
      run,
      'map.updated',
      mapState.error
        ? 'Map could not be built — no imagery was retrievable.'
        : `Map ready: ${mapState.imagery.length} imagery layer(s)${mapState.analysisLayers.length ? `, ${mapState.analysisLayers.length} analysis layer(s)` : ''}.`,
      mapState,
    );

    return {
      mapState,
      mapComparison: mapState.comparison,
      activity: mapState.error
        ? []
        : [activity('MAP_GENERATED', `Map generated for ${state.location?.placeName ?? 'the selected area'}`, run.runId)],
      agentSteps: [
        step('map_generation', 'Build the map', 'completed', {
          detail: mapState.error ?? `zoom ${mapState.zoom}, ${legends.length} legend(s).`,
          durationMs: Date.now() - started,
        }),
      ],
    };
  };
}
