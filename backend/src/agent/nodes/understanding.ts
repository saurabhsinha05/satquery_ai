import { z } from 'zod';
import { structured } from '../../config/llm.js';
import { hasLlm } from '../../config/env.js';
import { classifyByKeywords } from '../../eo/registry.js';
import { QUERY_INTENTS } from '../../types/contract.js';
import type { DateRange, QueryIntent } from '../../types/contract.js';
import { resolveLocation } from '../../services/geocode.js';
import { isValidBBox } from '../../lib/geo.js';
import { publish, step, activity, type RunRecord } from '../events.js';
import type { SatQueryStateType, SatQueryUpdate } from '../state.js';

/* ───────────────────────── query_understanding ───────────────────────────── */

const understandingSchema = z.object({
  intent: z.enum(QUERY_INTENTS).describe('The single best-matching intent for this query.'),
  locationText: z
    .string()
    .nullable()
    .describe(
      'The place name exactly as the user wrote it, or null if the query names no place. Never invent a place, and never output coordinates.',
    ),
  usesCurrentContext: z
    .boolean()
    .describe(
      'True when the query refers to "this location"/"this region"/"that area" and depends on a previous turn.',
    ),
  startYear: z.number().int().nullable().describe('Earliest year mentioned, or null.'),
  endYear: z.number().int().nullable().describe('Latest year mentioned, or null.'),
  monthHint: z
    .number()
    .int()
    .min(1)
    .max(12)
    .nullable()
    .describe('Month number if the query names a specific month or season, else null.'),
  relativeYears: z
    .number()
    .int()
    .nullable()
    .describe('Number of years when the query says e.g. "the last 5 years", else null.'),
  wantsComparison: z
    .boolean()
    .describe('True when the user asked to see two time periods side by side.'),
  reasoning: z.string().describe('One sentence explaining the classification.'),
});

const SYSTEM = `You classify Earth-observation queries for an agentic satellite analysis platform.

Rules you must follow:
- Never invent coordinates, statistics, dates that were not implied, or dataset names. You classify only.
- Extract the place name verbatim from the user's words. If no place is named, return null.
- If the query refers to "this location", "this region", "here", or "that area", set usesCurrentContext true.
- Distinguish carefully:
  * asking to SEE imagery for a place/year -> LOCATION_QUERY
  * asking to COMPARE two periods visually -> IMAGE_COMPARISON
  * asking what data EXISTS -> SATELLITE_IMAGE_SEARCH or DATASET_QUERY
  * vegetation / NDVI / forest / crops / deforestation -> VEGETATION_ANALYSIS
  * urban growth / built-up / construction / sprawl -> URBAN_EXPANSION
  * flooding / inundation / water bodies / lakes -> FLOOD_ANALYSIS
  * land use / land cover transitions -> LAND_COVER_CHANGE
  * open-ended "what changed" -> CHANGE_DETECTION
- If the query is too vague to act on and names no place, use CLARIFICATION_NEEDED.`;

function currentYear(): number {
  return new Date().getUTCFullYear();
}

/**
 * Builds two matched epochs. Both use the identical calendar window so the
 * composites are seasonally comparable — comparing a January mosaic against a
 * July one would show phenology, not change.
 */
export function buildDateRange(
  startYear: number | null,
  endYear: number | null,
  monthHint: number | null,
  relativeYears: number | null,
  wantsComparison: boolean,
): DateRange {
  const thisYear = currentYear();
  // Sentinel-2 cannot see the future; clamp the window to available archive.
  const clamp = (y: number) => Math.min(Math.max(y, 2016), thisYear);

  let from = startYear;
  let to = endYear;

  if (relativeYears && !from) {
    to = thisYear;
    from = thisYear - relativeYears;
  }
  if (from && !to) to = from;
  if (!from && to) from = to;
  if (!from || !to) {
    to = thisYear;
    from = thisYear - 5;
  }
  if (from > to) [from, to] = [to, from];

  const beforeYear = clamp(from);
  const afterYear = clamp(to);

  const window = (year: number): { from: string; to: string; label: string } => {
    if (monthHint) {
      // ±45 days around the named month, same in both epochs.
      const centre = Date.UTC(year, monthHint - 1, 15);
      const start = new Date(centre - 45 * 86_400_000);
      const end = new Date(centre + 45 * 86_400_000);
      return {
        from: start.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10),
        label: `${new Date(centre).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} ${year}`,
      };
    }
    const end = year === thisYear ? new Date().toISOString().slice(0, 10) : `${year}-12-31`;
    return { from: `${year}-01-01`, to: end, label: String(year) };
  };

  const beforeWindow = window(beforeYear);
  const afterWindow = window(afterYear);
  const distinct = beforeYear !== afterYear;

  return {
    from: beforeWindow.from,
    to: afterWindow.to,
    ...(distinct || wantsComparison
      ? {
          before: { ...beforeWindow },
          after: { ...afterWindow },
        }
      : {}),
  };
}

/** Deterministic extraction used when the LLM is unavailable. */
export function extractYears(query: string): { start: number | null; end: number | null; relative: number | null } {
  const years = Array.from(query.matchAll(/\b(19[89]\d|20[0-4]\d)\b/g)).map((m) => Number(m[1]));
  const relativeMatch = query.match(/last\s+(\d{1,2})\s+year/i);
  return {
    start: years.length > 0 ? Math.min(...years) : null,
    end: years.length > 0 ? Math.max(...years) : null,
    relative: relativeMatch ? Number(relativeMatch[1]) : null,
  };
}

/** Very small place extractor for the no-LLM path. */
export function extractPlace(query: string): string | null {
  const m =
    query.match(/\b(?:around|near|in|of|for|over|at)\s+([A-Z][\w'-]*(?:\s+[A-Z][\w'-]*){0,3})/) ??
    query.match(/\b([A-Z][\w'-]*(?:\s+[A-Z][\w'-]*){0,2})\b/);
  if (!m) return null;
  const candidate = m[1].trim();
  const stop = new Set(['Show', 'Find', 'Compare', 'Analyze', 'Analyse', 'What', 'Sentinel', 'NDVI']);
  if (stop.has(candidate.split(' ')[0])) return null;
  return candidate;
}

export function makeQueryUnderstanding(run: RunRecord) {
  return async (state: SatQueryStateType): Promise<SatQueryUpdate> => {
    const started = Date.now();
    publish(run, 'agent.started', 'Understanding your question…');

    let intent: QueryIntent;
    let locationText: string | null;
    let dateRange: DateRange;
    let usesContext = false;
    let reasoning = '';

    const parsed = hasLlm()
      ? await structured(
          understandingSchema,
          SYSTEM,
          [
            `Query: ${state.query}`,
            state.history.length > 0
              ? `Recent turns in this session (most recent first):\n${state.history
                  .map(
                    (h) =>
                      `- "${h.text}" (intent ${h.intent}${h.placeName ? `, place ${h.placeName}` : ''}${h.dateFrom ? `, ${h.dateFrom}→${h.dateTo}` : ''})`,
                  )
                  .join('\n')}`
              : 'No previous turns in this session.',
          ].join('\n\n'),
          'classify_earth_observation_query',
        )
      : null;

    if (parsed) {
      intent = parsed.intent;
      locationText = parsed.locationText;
      usesContext = parsed.usesCurrentContext;
      reasoning = parsed.reasoning;
      dateRange = buildDateRange(
        parsed.startYear,
        parsed.endYear,
        parsed.monthHint,
        parsed.relativeYears,
        parsed.wantsComparison,
      );
    } else {
      // Deterministic fallback — clearly labelled, never a fabricated result.
      intent = classifyByKeywords(state.query);
      locationText = extractPlace(state.query);
      const years = extractYears(state.query);
      dateRange = buildDateRange(
        years.start,
        years.end,
        null,
        years.relative,
        /compare|before and after/i.test(state.query),
      );
      reasoning = hasLlm()
        ? 'Classified by keyword rules after the language model call failed.'
        : 'Classified by keyword rules — no language model is configured on this backend.';
    }

    // A follow-up like "now compare that with 2020" inherits the last place.
    if ((usesContext || !locationText) && state.history.length > 0) {
      const lastPlace = state.history.find((h) => h.placeName)?.placeName ?? null;
      if (lastPlace) locationText = lastPlace;
    }

    const needsLocation = !state.suppliedBBox && !locationText;
    const clarification = needsLocation
      ? 'I need to know where to look. Name a place, draw an area on the map, or upload a boundary file.'
      : null;

    publish(run, 'query.understood', `Interpreted as ${intent.replace(/_/g, ' ').toLowerCase()}.`, {
      intent,
      locationText,
      dateRange,
      reasoning,
    });

    return {
      intent: clarification ? 'CLARIFICATION_NEEDED' : intent,
      locationQuery: locationText,
      dateRange,
      clarificationNeeded: clarification,
      agentSteps: [
        step('query_understanding', 'Understand your query', 'completed', {
          detail: reasoning,
          durationMs: Date.now() - started,
          finishedAt: new Date().toISOString(),
        }),
      ],
      activity: [activity('QUERY_STARTED', `Query received: "${state.query}"`, run.runId, { intent })],
    };
  };
}

/* ───────────────────────── location_resolution ───────────────────────────── */

export function makeLocationResolution(run: RunRecord) {
  return async (state: SatQueryStateType): Promise<SatQueryUpdate> => {
    const started = Date.now();

    // A drawn or uploaded AOI wins over a name — it is what the user meant.
    if (state.suppliedBBox && isValidBBox(state.suppliedBBox)) {
      const bbox = state.suppliedBBox;
      const location = {
        placeName: state.locationQuery ?? 'Selected area',
        latitude: (bbox[1] + bbox[3]) / 2,
        longitude: (bbox[0] + bbox[2]) / 2,
        bbox,
        source: 'user-supplied' as const,
      };
      publish(run, 'location.resolved', `Using the area you selected.`, location);
      return {
        location,
        bbox,
        agentSteps: [
          step('location_resolution', 'Resolve the area of interest', 'completed', {
            detail: 'Used the client-supplied bounding box.',
            durationMs: Date.now() - started,
          }),
        ],
      };
    }

    if (!state.locationQuery) {
      return {
        agentSteps: [
          step('location_resolution', 'Resolve the area of interest', 'failed', {
            error: 'No place name in the query.',
          }),
        ],
      };
    }

    publish(run, 'location.resolved', `Resolving ${state.locationQuery}…`);

    try {
      const location = await resolveLocation(state.locationQuery);
      publish(
        run,
        'location.resolved',
        `Resolved to ${location.placeName}.`,
        location,
      );
      return {
        location,
        bbox: location.bbox,
        warnings:
          location.candidates && location.candidates.length > 0
            ? [
                `"${state.locationQuery}" matched more than one place. Using ${location.placeName}; other matches were ${location.candidates
                  .map((c) => c.placeName)
                  .join(', ')}.`,
              ]
            : [],
        agentSteps: [
          step('location_resolution', 'Resolve the area of interest', 'completed', {
            detail: `${location.placeName} via ${location.source} geocoding.`,
            durationMs: Date.now() - started,
          }),
        ],
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Location could not be resolved.';
      publish(run, 'agent.error', message);
      return {
        clarificationNeeded: message,
        errors: [message],
        agentSteps: [
          step('location_resolution', 'Resolve the area of interest', 'failed', {
            error: message,
            durationMs: Date.now() - started,
          }),
        ],
      };
    }
  };
}
