import type { AnalysisMethod, QueryIntent } from '../types/contract.js';
import { TEMPORAL_CHANGE_SPEC } from './changeDetection.js';
import { FLOOD_CHANGE_SPEC } from './floodAnalysis.js';
import { DATASET_DISCOVERY_SPEC, IMAGE_COMPARISON_SPEC } from './imageryComparison.js';
import { LAND_COVER_CHANGE_SPEC } from './landCover.js';
import { NDVI_CHANGE_SPEC } from './ndvi.js';
import { BUILT_UP_CHANGE_SPEC, URBAN_EXPANSION_SPEC } from './urbanExpansion.js';
import type { AnalysisSpec } from './types.js';

/**
 * Method registry. One lookup table, so routing a new intent to a new
 * algorithm is a one-line change.
 */
const REGISTRY: Record<AnalysisMethod, AnalysisSpec | null> = {
  NDVI_CHANGE: NDVI_CHANGE_SPEC,
  URBAN_EXPANSION: URBAN_EXPANSION_SPEC,
  BUILT_UP_CHANGE: BUILT_UP_CHANGE_SPEC,
  LAND_COVER_CHANGE: LAND_COVER_CHANGE_SPEC,
  FLOOD_CHANGE: FLOOD_CHANGE_SPEC,
  TEMPORAL_CHANGE: TEMPORAL_CHANGE_SPEC,
  IMAGE_COMPARISON: IMAGE_COMPARISON_SPEC,
  DATASET_DISCOVERY: DATASET_DISCOVERY_SPEC,
  NONE: null,
};

export function getSpec(method: AnalysisMethod): AnalysisSpec | null {
  return REGISTRY[method] ?? null;
}

export function listMethods(): AnalysisMethod[] {
  return Object.keys(REGISTRY) as AnalysisMethod[];
}

/**
 * Deterministic intent → method routing.
 *
 * The LLM classifies intent; this table decides what actually runs. Keeping
 * the mapping here rather than in a prompt is what stops the model from
 * inventing an analysis type the backend cannot perform.
 */
const INTENT_TO_METHOD: Record<QueryIntent, AnalysisMethod> = {
  LOCATION_QUERY: 'IMAGE_COMPARISON',
  DATASET_QUERY: 'DATASET_DISCOVERY',
  SATELLITE_IMAGE_SEARCH: 'DATASET_DISCOVERY',
  IMAGE_COMPARISON: 'IMAGE_COMPARISON',
  VEGETATION_ANALYSIS: 'NDVI_CHANGE',
  NDVI_ANALYSIS: 'NDVI_CHANGE',
  URBAN_EXPANSION: 'URBAN_EXPANSION',
  BUILT_UP_CHANGE: 'BUILT_UP_CHANGE',
  LAND_COVER_CHANGE: 'LAND_COVER_CHANGE',
  FLOOD_ANALYSIS: 'FLOOD_CHANGE',
  TEMPORAL_CHANGE: 'TEMPORAL_CHANGE',
  CHANGE_DETECTION: 'TEMPORAL_CHANGE',
  GENERAL_EARTH_OBSERVATION: 'TEMPORAL_CHANGE',
  CLARIFICATION_NEEDED: 'NONE',
};

export function methodForIntent(intent: QueryIntent): AnalysisMethod {
  return INTENT_TO_METHOD[intent] ?? 'TEMPORAL_CHANGE';
}

/**
 * Keyword fallback used when the LLM is unavailable. Deterministic, auditable,
 * and honest about being a fallback — it never fabricates a result, it only
 * decides which real pipeline to run.
 */
export function classifyByKeywords(query: string): QueryIntent {
  const q = query.toLowerCase();
  const has = (...words: string[]) => words.some((w) => q.includes(w));

  if (has('flood', 'inundat', 'waterlog', 'deluge')) return 'FLOOD_ANALYSIS';
  if (has('urban expansion', 'built-up', 'built up', 'builtup', 'sprawl', 'construction', 'urban growth'))
    return 'URBAN_EXPANSION';
  if (has('deforest', 'vegetation', 'ndvi', 'canopy', 'forest', 'green cover', 'crop'))
    return 'VEGETATION_ANALYSIS';
  if (has('land use', 'land-use', 'land cover', 'land-cover', 'lulc')) return 'LAND_COVER_CHANGE';
  if (has('water body', 'water-body', 'lake', 'reservoir', 'ndwi', 'wetland'))
    return 'FLOOD_ANALYSIS';
  if (has('compare', 'before and after', 'before/after', 'versus', ' vs ')) return 'IMAGE_COMPARISON';
  if (has('find', 'search', 'available', 'imagery for', 'scenes', 'products', 'cloud cover'))
    return 'SATELLITE_IMAGE_SEARCH';
  if (has('show me a satellite', 'satellite map', 'show me ranchi', 'show ')) return 'LOCATION_QUERY';
  if (has('what changed', 'change detection', 'changed around')) return 'CHANGE_DETECTION';
  return 'GENERAL_EARTH_OBSERVATION';
}
