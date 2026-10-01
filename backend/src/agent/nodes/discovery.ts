import { getSpec } from '../../eo/registry.js';
import { getCollection } from '../../services/copernicus/collections.js';
import { searchScenes, selectBestScene } from '../../services/copernicus/catalog.js';
import type { Dataset, SatelliteScene, TimelineEntry } from '../../types/contract.js';
import { publish, step, activity, type RunRecord } from '../events.js';
import type { SatQueryStateType, SatQueryUpdate } from '../state.js';

/* ───────────────────────────── dataset_discovery ─────────────────────────── */

/**
 * Catalogue search, driven entirely by the resolved query.
 *
 * The collections, the bbox, the time windows and the cloud ceiling all come
 * from the plan. Dataset cards in the UI are built from what this returns —
 * if the catalogue has nothing, the card says so rather than showing a name.
 */
export function makeDatasetDiscovery(run: RunRecord) {
  return async (state: SatQueryStateType): Promise<SatQueryUpdate> => {
    const started = Date.now();
    const bbox = state.bbox;
    const spec = getSpec(state.analysisMethod);

    if (!bbox || !spec) {
      return {
        agentSteps: [
          step('dataset_discovery', 'Find relevant satellite data', 'skipped', {
            detail: 'No area of interest or analysis plan.',
          }),
        ],
      };
    }

    publish(run, 'dataset.search.started', 'Searching the Copernicus catalogue…');

    const windows = [state.epochs.before, state.epochs.after, state.epochs.single].filter(
      (w): w is NonNullable<typeof w> => w !== null,
    );
    const searchFrom = windows[0]?.from ?? state.dateRange?.from ?? '';
    const searchTo = windows[windows.length - 1]?.to ?? state.dateRange?.to ?? '';

    const datasets: Dataset[] = [];
    const warnings: string[] = [];

    for (const collectionId of state.requiredDatasets) {
      const collection = getCollection(collectionId);
      try {
        const scenes = await searchScenes({
          collection: collectionId,
          bbox,
          from: searchFrom,
          to: searchTo,
          maxCloudCover: collection.hasCloudCover ? spec.maxCloudCover : undefined,
          limit: 60,
        });

        datasets.push({
          id: collectionId,
          name: collection.displayName,
          collection: collectionId,
          provider: collection.provider,
          purpose: spec.purpose,
          bands: spec.bands.length > 0 ? spec.bands : collection.bands,
          indices: spec.indices,
          temporalRange: { from: searchFrom, to: searchTo },
          spatialExtent: bbox,
          matchCount: scenes.length,
          scenes: scenes.slice(0, 40),
          status: scenes.length > 0 ? 'available' : 'no_matches',
          message:
            scenes.length === 0
              ? `No ${collection.displayName} products intersect this area between ${searchFrom} and ${searchTo}${collection.hasCloudCover ? ` under ${spec.maxCloudCover}% cloud` : ''}.`
              : undefined,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Catalogue search failed.';
        warnings.push(`${collection.displayName}: ${message}`);
        datasets.push({
          id: collectionId,
          name: collection.displayName,
          collection: collectionId,
          provider: collection.provider,
          purpose: spec.purpose,
          bands: collection.bands,
          indices: spec.indices,
          temporalRange: { from: searchFrom, to: searchTo },
          spatialExtent: bbox,
          matchCount: 0,
          scenes: [],
          status: 'error',
          message,
        });
      }
    }

    const total = datasets.reduce((sum, d) => sum + d.matchCount, 0);
    publish(
      run,
      'dataset.search.completed',
      total > 0
        ? `Found ${total} matching product${total === 1 ? '' : 's'} across ${datasets.length} collection${datasets.length === 1 ? '' : 's'}.`
        : 'No matching products were found in the catalogue for this area and time range.',
      { datasets },
    );

    return {
      discoveredDatasets: datasets,
      warnings,
      activity:
        total > 0
          ? [
              activity(
                'DATASET_FOUND',
                `${total} Copernicus products matched ${state.location?.placeName ?? 'the selected area'}`,
                run.runId,
                { collections: state.requiredDatasets, total },
              ),
            ]
          : [],
      agentSteps: [
        step('dataset_discovery', 'Find relevant satellite data', total > 0 ? 'completed' : 'completed', {
          detail:
            total > 0
              ? `${total} products across ${datasets.map((d) => d.name).join(', ')}.`
              : 'Catalogue returned no matches for this area and window.',
          durationMs: Date.now() - started,
        }),
      ],
    };
  };
}

/* ──────────────────────────── dataset_validation ─────────────────────────── */

/**
 * Scene selection.
 *
 * Not "the first result": the selector ranks on cloud cover, then on how
 * centred the acquisition is in its window, so the two epochs of a comparison
 * are as alike as the archive allows. Every choice carries its reason.
 */
export function makeDatasetValidation(run: RunRecord) {
  return async (state: SatQueryStateType): Promise<SatQueryUpdate> => {
    const started = Date.now();
    const primary = state.discoveredDatasets.find((d) => d.status === 'available');

    if (!primary) {
      const message =
        'No suitable satellite imagery was found for the selected location and time range.';
      publish(run, 'agent.error', message);
      return {
        warnings: [message],
        agentSteps: [
          step('dataset_validation', 'Select the best scenes', 'failed', {
            error: message,
            durationMs: Date.now() - started,
          }),
        ],
      };
    }

    const selected: SatelliteScene[] = [];
    const timeline: TimelineEntry[] = [];

    const windows = [
      state.epochs.before && { window: state.epochs.before, epoch: 'before' as const },
      state.epochs.after && { window: state.epochs.after, epoch: 'after' as const },
      state.epochs.single && { window: state.epochs.single, epoch: 'single' as const },
    ].filter((w): w is NonNullable<typeof w> => w !== null);

    for (const { window, epoch } of windows) {
      const inWindow = primary.scenes.filter(
        (s) =>
          s.acquisitionDate >= window.from &&
          s.acquisitionDate <= `${window.to}T23:59:59Z`,
      );
      const best = selectBestScene(inWindow, window, epoch);
      if (best) {
        selected.push(best);
        publish(
          run,
          'imagery.selected',
          `Selected ${window.label} imagery — ${best.acquisitionDate.slice(0, 10)}${
            best.cloudCover !== undefined ? `, ${best.cloudCover}% cloud` : ''
          }.`,
          best,
        );
      }
    }

    // Every scene in the searched window feeds the timeline panel.
    for (const scene of primary.scenes) {
      timeline.push({
        date: scene.acquisitionDate,
        label: scene.platform ?? primary.name,
        collection: primary.collection,
        cloudCover: scene.cloudCover,
        epoch: selected.find((s) => s.id === scene.id)?.epoch,
        sceneId: scene.id,
      });
    }
    timeline.sort((a, b) => a.date.localeCompare(b.date));

    const warnings: string[] = [];
    if (selected.length === 2) {
      const [b, a] = selected;
      const cloudGap = Math.abs((a.cloudCover ?? 0) - (b.cloudCover ?? 0));
      if (cloudGap > 25) {
        warnings.push(
          `The two epochs differ markedly in cloud cover (${b.cloudCover}% vs ${a.cloudCover}%). Treat the comparison with care.`,
        );
      }
      if ((a.cloudCover ?? 0) > 40 || (b.cloudCover ?? 0) > 40) {
        warnings.push(
          'At least one selected epoch is substantially cloudy. Cloudy pixels are masked out, so coverage in those areas is reduced.',
        );
      }
    }

    publish(run, 'dataset.selected', `Selected ${selected.length} scene(s) for processing.`, {
      selected,
    });

    return {
      selectedScenes: selected,
      timeline,
      warnings,
      activity:
        selected.length > 0
          ? [
              activity(
                'IMAGERY_SELECTED',
                `Selected ${selected.map((s) => `${s.epoch}: ${s.acquisitionDate.slice(0, 10)}`).join(', ')}`,
                run.runId,
              ),
            ]
          : [],
      agentSteps: [
        step('dataset_validation', 'Select the best scenes', 'completed', {
          detail:
            selected.length > 0
              ? selected
                  .map(
                    (s) =>
                      `${s.epoch}: ${s.acquisitionDate.slice(0, 10)}${s.cloudCover !== undefined ? ` (${s.cloudCover}% cloud)` : ''}`,
                  )
                  .join(' · ')
              : 'No scene met the selection criteria.',
          durationMs: Date.now() - started,
        }),
      ],
    };
  };
}
