import { randomUUID } from 'node:crypto';
import { complete, modelName } from '../../config/llm.js';
import { hasLlm, hasSupabase } from '../../config/env.js';
import { getSpec } from '../../eo/registry.js';
import { getCollection } from '../../services/copernicus/collections.js';
import {
  recordActivity,
  recordAgentSteps,
  recordAnalysis,
  recordAgentRun,
  recordDatasets,
  recordQuery,
} from '../../services/supabase.js';
import type { Evidence, WorkspaceInsight, WorkspaceState } from '../../types/contract.js';
import { publish, step, activity, type RunRecord } from '../events.js';
import type { SatQueryStateType, SatQueryUpdate } from '../state.js';

/* ──────────────────────────── result_validation ──────────────────────────── */

/**
 * Sanity pass before anything is presented. It cannot make a bad result good;
 * its job is to make sure a thin result is *labelled* thin.
 */
export function makeResultValidation(run: RunRecord) {
  return async (state: SatQueryStateType): Promise<SatQueryUpdate> => {
    const started = Date.now();
    publish(run, 'analysis.progress', 'Checking the result for integrity problems…');
    const warnings: string[] = [];
    const result = state.analysisResult;

    if (result?.status === 'partial') {
      warnings.push('Some parts of this analysis could not be completed — see the caveats below.');
    }

    for (const stat of state.statistics) {
      if (stat.sampleCoverage !== undefined && stat.sampleCoverage < 0.4) {
        warnings.push(
          `${stat.label} is based on only ${Math.round(stat.sampleCoverage * 100)}% of the area — cloud and shadow masked the rest.`,
        );
      }
    }

    if (result && result.classes.length > 0 && result.analysedAreaKm2) {
      const totalChanged = result.classes.reduce((sum, c) => sum + c.fraction, 0);
      if (totalChanged > 0.85) {
        warnings.push(
          'Almost the whole area is classified as changed, which usually means the two epochs are not comparable (different season, heavy cloud, or a sensor change) rather than that everything changed.',
        );
      }
    }

    const imageryCount = state.mapImagery.length;
    if (state.mapPlan?.comparisonMode === 'split' && imageryCount < 2) {
      warnings.push(
        'A before/after comparison was requested but only one epoch could be rendered, so the split view is unavailable.',
      );
    }

    return {
      warnings,
      agentSteps: [
        step('result_validation', 'Validate the result', 'completed', {
          detail:
            warnings.length > 0
              ? `${warnings.length} caveat(s) recorded.`
              : 'No integrity problems detected.',
          durationMs: Date.now() - started,
        }),
      ],
    };
  };
}

/* ─────────────────────────── evidence_generation ─────────────────────────── */

/**
 * Evidence, separated by kind: what the satellite observed, what was
 * calculated, what the model inferred, and what remains uncertain. Keeping
 * those apart is the whole point — a reader can see which is which.
 */
export function makeEvidenceGeneration(run: RunRecord) {
  return async (state: SatQueryStateType): Promise<SatQueryUpdate> => {
    const started = Date.now();
    const evidence: Evidence[] = [];
    const spec = getSpec(state.analysisMethod);

    const add = (
      kind: Evidence['kind'],
      title: string,
      body: string,
      origin: string,
      url?: string,
    ) => evidence.push({ id: randomUUID(), kind, title, body, origin, url });

    /* Sources */
    if (state.location) {
      add(
        'source',
        'Area of interest',
        `${state.location.placeName} — centre ${state.location.latitude.toFixed(4)}, ${state.location.longitude.toFixed(4)}; extent ${state.location.bbox.map((v) => v.toFixed(3)).join(', ')}.`,
        state.location.source === 'user-supplied'
          ? 'Area supplied by the user'
          : `${state.location.source} geocoding`,
      );
    }

    for (const dataset of state.discoveredDatasets) {
      const collection = getCollection(dataset.collection);
      add(
        'source',
        dataset.name,
        dataset.status === 'available'
          ? `${dataset.matchCount} products intersecting the area between ${dataset.temporalRange.from} and ${dataset.temporalRange.to}. ${collection.description}`
          : (dataset.message ?? 'No matching products.'),
        `${dataset.provider} — Copernicus Data Space catalogue`,
        'https://dataspace.copernicus.eu/',
      );
    }

    /* Observations — what the imagery is. */
    for (const img of state.mapImagery) {
      add(
        'observation',
        `${img.label} imagery`,
        [
          `${img.source} composite over ${img.acquisitionWindow?.from} → ${img.acquisitionWindow?.to}.`,
          img.acquisitionDate
            ? `Representative acquisition ${img.acquisitionDate.slice(0, 10)}.`
            : '',
          img.cloudCover !== undefined
            ? `Cloud cover on that scene: ${img.cloudCover}%.`
            : 'Cloud cover not reported for this sensor.',
          `Rendered at ${img.resolution}.`,
        ]
          .filter(Boolean)
          .join(' '),
        img.attribution,
      );
    }

    /* Computations — what was measured, and by what. */
    if (state.analysisResult && spec) {
      add(
        'computation',
        'Method',
        spec.methodDescription,
        state.analysisResult.computedBy,
      );

      for (const stat of state.statistics) {
        if (stat.mean === undefined) continue;
        add(
          'computation',
          stat.label,
          [
            `Mean ${stat.mean}`,
            stat.min !== undefined ? `min ${stat.min}` : '',
            stat.max !== undefined ? `max ${stat.max}` : '',
            stat.stDev !== undefined ? `standard deviation ${stat.stDev}` : '',
            stat.sampleCoverage !== undefined
              ? `over ${Math.round(stat.sampleCoverage * 100)}% valid samples`
              : '',
          ]
            .filter(Boolean)
            .join(', ') + '.',
          'Copernicus Sentinel Hub Statistics API',
        );
      }

      for (const cls of state.analysisResult.classes) {
        add(
          'computation',
          cls.label,
          `${cls.areaKm2} km² (${(cls.fraction * 100).toFixed(2)}% of the valid analysed area).`,
          'Copernicus Sentinel Hub Statistics API',
        );
      }
    }

    /* Uncertainty */
    for (const warning of state.warnings) {
      add('uncertainty', 'Caveat', warning, 'SatQuery result validation');
    }
    if (state.analysisResult?.status === 'data_available_processing_required') {
      add(
        'uncertainty',
        'Processing unavailable',
        state.analysisResult.message ?? 'The processing pipeline could not run.',
        'SatQuery backend configuration',
      );
    }
    if (!hasLlm()) {
      add(
        'uncertainty',
        'No language model configured',
        'Intent classification fell back to deterministic keyword rules, and the written summary is templated rather than model-generated.',
        'SatQuery backend configuration',
      );
    }

    publish(run, 'evidence.generated', `Compiled ${evidence.length} pieces of evidence.`, {
      count: evidence.length,
    });

    return {
      evidence,
      agentSteps: [
        step('evidence_generation', 'Generate evidence', 'completed', {
          detail: `${evidence.length} entries across sources, observations, computations and caveats.`,
          durationMs: Date.now() - started,
        }),
      ],
    };
  };
}

/* ──────────────────────────── answer_generation ──────────────────────────── */

const ANSWER_SYSTEM = `You write the summary for an Earth-observation analysis platform.

Absolute rules:
- Use ONLY the numbers given to you. Never state a figure that is not in the supplied facts.
- If a value is missing, say it is unavailable. Do not estimate, round up from nothing, or infer a magnitude.
- Clearly separate what the satellite data shows, what was calculated, and what you are inferring.
- Mention the imagery dates and cloud cover when they matter to how much trust the result deserves.
- Be concise: 3-5 short paragraphs at most, plain prose, no headings, no bullet lists, no markdown.
- Write for an analyst who will be asked to defend the result.`;

function templatedAnswer(state: SatQueryStateType): string {
  const spec = getSpec(state.analysisMethod);
  const place = state.location?.placeName ?? 'the selected area';
  const result = state.analysisResult;
  const parts: string[] = [];

  parts.push(
    `Query interpreted as ${state.intent.replace(/_/g, ' ').toLowerCase()} over ${place}${
      state.dateRange ? `, ${state.dateRange.from} to ${state.dateRange.to}` : ''
    }.`,
  );

  if (state.mapImagery.length > 0) {
    parts.push(
      `Imagery: ${state.mapImagery
        .map(
          (i) =>
            `${i.label} from ${i.source}${i.cloudCover !== undefined ? ` (${i.cloudCover}% cloud)` : ''}`,
        )
        .join('; ')}.`,
    );
  } else {
    parts.push('No satellite imagery could be rendered for this area and time range.');
  }

  if (result && result.classes.length > 0) {
    parts.push(
      `Measured classes: ${result.classes
        .map((c) => `${c.label} ${c.areaKm2} km² (${(c.fraction * 100).toFixed(1)}%)`)
        .join('; ')}. Computed by ${result.computedBy}.`,
    );
  } else if (result && result.status !== 'completed') {
    parts.push(result.message ?? 'No statistics could be computed.');
  }

  if (spec) parts.push(`Method: ${spec.methodDescription}`);
  if (state.warnings.length > 0) parts.push(`Caveats: ${state.warnings.join(' ')}`);

  return parts.join('\n\n');
}

export function makeAnswerGeneration(run: RunRecord) {
  return async (state: SatQueryStateType): Promise<SatQueryUpdate> => {
    const started = Date.now();
    const spec = getSpec(state.analysisMethod);

    if (state.clarificationNeeded) {
      return {
        finalAnswer: state.clarificationNeeded,
        agentSteps: [
          step('answer_generation', 'Write the answer', 'completed', {
            detail: 'Returned a clarification request.',
            durationMs: Date.now() - started,
          }),
        ],
      };
    }

    const facts = {
      query: state.query,
      intent: state.intent,
      location: state.location
        ? {
            placeName: state.location.placeName,
            centre: [state.location.longitude, state.location.latitude],
            bbox: state.location.bbox,
            source: state.location.source,
          }
        : null,
      dateRange: state.dateRange,
      method: spec ? { name: spec.label, description: spec.methodDescription, indices: spec.indices } : null,
      datasets: state.discoveredDatasets.map((d) => ({
        name: d.name,
        matchCount: d.matchCount,
        status: d.status,
        message: d.message,
      })),
      imagery: state.mapImagery.map((i) => ({
        label: i.label,
        source: i.source,
        acquisitionDate: i.acquisitionDate,
        acquisitionWindow: i.acquisitionWindow,
        cloudCover: i.cloudCover,
        resolution: i.resolution,
      })),
      analysisStatus: state.analysisResult?.status,
      analysisMessage: state.analysisResult?.message,
      statistics: state.statistics,
      classes: state.analysisResult?.classes ?? [],
      analysedAreaKm2: state.analysisResult?.analysedAreaKm2,
      warnings: state.warnings,
      errors: state.errors,
    };

    const generated = hasLlm()
      ? await complete(
          ANSWER_SYSTEM,
          `Write the summary for this run. These are the only facts available:\n\n${JSON.stringify(facts, null, 2)}`,
        )
      : null;

    const finalAnswer = generated ?? templatedAnswer(state);

    publish(run, 'workspace.updated', 'Answer ready.', { answer: finalAnswer });

    return {
      finalAnswer,
      agentSteps: [
        step('answer_generation', 'Write the answer', 'completed', {
          detail: generated
            ? `Generated with ${modelName()} from the measured facts only.`
            : 'Templated from the measured facts — no language model available.',
          durationMs: Date.now() - started,
        }),
      ],
    };
  };
}

/* ──────────────────────────────── persist ────────────────────────────────── */

export function buildWorkspace(state: SatQueryStateType): WorkspaceState {
  const insights: WorkspaceInsight[] = [];
  const result = state.analysisResult;
  const spec = getSpec(state.analysisMethod);

  if (result && result.classes.length > 0) {
    const ranked = [...result.classes].sort((a, b) => b.areaKm2 - a.areaKm2);
    for (const cls of ranked.slice(0, 4)) {
      insights.push({
        id: `class:${cls.classId}`,
        title: cls.label,
        body: `${cls.areaKm2} km², ${(cls.fraction * 100).toFixed(2)}% of the valid analysed area.`,
        basis: 'measured',
      });
    }
  }

  const delta = state.statistics.find((s) => s.epoch === 'delta');
  if (delta?.mean !== undefined) {
    insights.push({
      id: 'delta',
      title: delta.label,
      body: `Mean change of ${delta.mean} across the area of interest.`,
      basis: 'derived',
    });
  }

  if (insights.length === 0 && result) {
    insights.push({
      id: 'status',
      title: 'No measurements available',
      body:
        result.message ??
        'The processing pipeline produced no statistics for this area and time range.',
      basis: 'measured',
    });
  }

  if (spec && state.mapImagery.length > 0) {
    insights.push({
      id: 'method',
      title: 'How this was produced',
      body: spec.methodDescription,
      basis: 'derived',
    });
  }

  return {
    datasets: state.discoveredDatasets,
    insights,
    activity: state.activity,
    statistics: state.statistics,
    timeline: state.timeline,
    evidence: state.evidence,
  };
}

export function makePersist(run: RunRecord) {
  return async (state: SatQueryStateType): Promise<SatQueryUpdate> => {
    const started = Date.now();
    const workspace = buildWorkspace(state);

    publish(run, 'workspace.updated', 'Workspace updated.', workspace);

    if (!hasSupabase()) {
      return {
        workspaceState: workspace,
        agentSteps: [
          step('persist', 'Persist the analysis', 'skipped', {
            detail: 'Supabase is not configured, so this run was not saved.',
            durationMs: Date.now() - started,
          }),
        ],
      };
    }

    try {
      await recordQuery({
        runId: run.runId,
        sessionId: state.sessionId,
        userId: state.userId,
        text: state.query,
        intent: state.intent,
      });
      await recordAgentRun({
        runId: run.runId,
        sessionId: state.sessionId,
        userId: state.userId,
        status: 'completed',
        durationMs: Date.now() - run.startedAt,
      });
      await recordAgentSteps(run.runId, state.agentSteps);
      await recordDatasets(run.runId, state.userId, state.discoveredDatasets);
      await recordActivity(
        [...state.activity, activity('QUERY_COMPLETED', `Completed: "${state.query}"`, run.runId)],
        state.sessionId,
        state.userId,
      );
      return {
        workspaceState: workspace,
        agentSteps: [
          step('persist', 'Persist the analysis', 'completed', {
            detail: 'Run, steps, datasets and activity written to Supabase.',
            durationMs: Date.now() - started,
          }),
        ],
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Persistence failed.';
      return {
        workspaceState: workspace,
        warnings: [`This run could not be saved: ${message}`],
        agentSteps: [
          step('persist', 'Persist the analysis', 'failed', {
            error: message,
            durationMs: Date.now() - started,
          }),
        ],
      };
    }
  };
}

export { recordAnalysis };
