/**
 * SatQuery AI — API response contract.
 *
 * This file is the single source of truth for the shapes the backend returns
 * and the frontend consumes. It is mirrored verbatim into the frontend at
 * `src/lib/contract.ts`; keep the two in sync.
 *
 * Data-integrity rule that runs through every type here: a field is either a
 * value that came from a real service (Copernicus, Mapbox/Nominatim, the LLM's
 * own words) or it is absent. Nothing in this contract is ever filled with a
 * plausible-looking placeholder.
 */

/* ────────────────────────────── Query & intent ───────────────────────────── */

export const QUERY_INTENTS = [
  'LOCATION_QUERY',
  'DATASET_QUERY',
  'TEMPORAL_CHANGE',
  'VEGETATION_ANALYSIS',
  'NDVI_ANALYSIS',
  'URBAN_EXPANSION',
  'BUILT_UP_CHANGE',
  'LAND_COVER_CHANGE',
  'FLOOD_ANALYSIS',
  'IMAGE_COMPARISON',
  'SATELLITE_IMAGE_SEARCH',
  'CHANGE_DETECTION',
  'GENERAL_EARTH_OBSERVATION',
  'CLARIFICATION_NEEDED',
] as const;
export type QueryIntent = (typeof QUERY_INTENTS)[number];

export const ANALYSIS_METHODS = [
  'NDVI_CHANGE',
  'URBAN_EXPANSION',
  'BUILT_UP_CHANGE',
  'LAND_COVER_CHANGE',
  'FLOOD_CHANGE',
  'TEMPORAL_CHANGE',
  'IMAGE_COMPARISON',
  'DATASET_DISCOVERY',
  'NONE',
] as const;
export type AnalysisMethod = (typeof ANALYSIS_METHODS)[number];

export interface DateRange {
  /** ISO date, inclusive. */
  from: string;
  /** ISO date, inclusive. */
  to: string;
  /** Present when the query is a two-epoch comparison. */
  before?: { from: string; to: string; label: string };
  after?: { from: string; to: string; label: string };
}

export interface ResolvedLocation {
  placeName: string;
  latitude: number;
  longitude: number;
  /** [west, south, east, north] in EPSG:4326. */
  bbox: [number, number, number, number];
  country?: string;
  region?: string;
  /** Which geocoder produced this — never invented. */
  source: 'mapbox' | 'nominatim' | 'user-supplied';
  /** Alternatives when the place name was ambiguous. */
  candidates?: Array<{ placeName: string; latitude: number; longitude: number }>;
}

export interface QuerySummary {
  text: string;
  intent: QueryIntent;
  location: ResolvedLocation | null;
  dateRange: DateRange | null;
  requestedAnalysis: AnalysisMethod;
  /** Set when the agent cannot proceed without more information. */
  clarificationNeeded?: string;
}

/* ──────────────────────────────── Datasets ───────────────────────────────── */

export interface SatelliteScene {
  /** Catalogue product identifier as returned by Copernicus. */
  id: string;
  collection: string;
  acquisitionDate: string;
  /** Percent, as reported by the catalogue. Absent when the catalogue omits it. */
  cloudCover?: number;
  platform?: string;
  instrument?: string;
  /** Ground sample distance in metres for the bands used. */
  resolution?: string;
  bbox?: [number, number, number, number];
  /** Which epoch of a comparison this scene was chosen for. */
  epoch?: 'before' | 'after' | 'single';
  /** Why the selector picked it over the alternatives. */
  selectionReason?: string;
}

export interface Dataset {
  id: string;
  name: string;
  collection: string;
  provider: string;
  purpose: string;
  bands: string[];
  indices: string[];
  temporalRange: { from: string; to: string };
  spatialExtent: [number, number, number, number];
  /** Number of catalogue matches actually returned for this search. */
  matchCount: number;
  scenes: SatelliteScene[];
  status: 'available' | 'no_matches' | 'error';
  message?: string;
}

/* ──────────────────────────────── Analysis ───────────────────────────────── */

export type AnalysisStatus =
  | 'completed'
  | 'partial'
  | 'data_available_processing_required'
  | 'no_data'
  | 'unsupported'
  | 'error';

export interface StatisticBand {
  label: string;
  /** Index or band this statistic describes, e.g. "NDVI". */
  index: string;
  epoch: 'before' | 'after' | 'delta';
  mean?: number;
  min?: number;
  max?: number;
  stDev?: number;
  /** Fraction of valid (non-masked) samples, 0-1. */
  sampleCoverage?: number;
  /** Number of pixels the aggregation ran over. */
  sampleCount?: number;
  unit?: string;
}

export interface AnalysisClassArea {
  classId: string;
  label: string;
  color: string;
  /** Area in square kilometres, derived from the pixel count and cell size. */
  areaKm2: number;
  /** Share of the analysed area, 0-1. */
  fraction: number;
  pixelCount: number;
}

export interface AnalysisResult {
  method: AnalysisMethod;
  status: AnalysisStatus;
  /** Human-readable statement of what was computed and by which service. */
  computedBy: string;
  /** Present only when status is completed/partial. */
  statistics: StatisticBand[];
  classes: AnalysisClassArea[];
  /** Cell size used to convert pixel counts to area. */
  pixelSizeMeters?: number;
  analysedAreaKm2?: number;
  message?: string;
}

/* ────────────────────────────────── Map ──────────────────────────────────── */

export interface MapImagery {
  id: string;
  /** Epoch label the UI shows, e.g. "2021". */
  label: string;
  epoch: 'before' | 'after' | 'single';
  year?: number;
  source: string;
  collection: string;
  acquisitionDate?: string;
  acquisitionWindow?: { from: string; to: string };
  cloudCover?: number;
  resolution?: string;
  /** Backend-proxied PNG. Never a Copernicus URL — credentials stay server-side. */
  layerUrl: string;
  /** Geographic corners the PNG covers, so both epochs align exactly. */
  bbox: [number, number, number, number];
  sceneIds: string[];
  attribution: string;
}

export interface MapAnalysisLayer {
  id: string;
  label: string;
  /** `image` = georeferenced PNG overlay; `geojson` = vector features. */
  type: 'image' | 'geojson';
  layerUrl?: string;
  geojson?: unknown;
  bbox: [number, number, number, number];
  opacity: number;
  visible: boolean;
  legendId?: string;
  description: string;
}

export interface MapLegendEntry {
  label: string;
  color: string;
  /** Populated from the analysis, so a legend never shows an unused class. */
  areaKm2?: number;
  fraction?: number;
}

export interface MapLegend {
  id: string;
  title: string;
  entries: MapLegendEntry[];
  note?: string;
}

export interface MapComparison {
  enabled: boolean;
  mode: 'split' | 'toggle' | 'none';
  beforeLabel: string;
  afterLabel: string;
  beforeImageryId?: string;
  afterImageryId?: string;
}

export interface MapMarker {
  id: string;
  coordinates: [number, number];
  label: string;
  description?: string;
}

export interface MapBoundary {
  id: string;
  label: string;
  geojson: unknown;
  color: string;
}

export interface MapControlsConfig {
  zoom: boolean;
  resetView: boolean;
  layerToggle: boolean;
  baseMapToggle: boolean;
  opacity: boolean;
  comparisonSlider: boolean;
  legend: boolean;
  fullscreen: boolean;
}

export interface MapState {
  center: [number, number];
  zoom: number;
  bounds: [number, number, number, number];
  baseLayer: { type: 'satellite' | 'dark' | 'streets'; label: string };
  imagery: MapImagery[];
  comparison: MapComparison;
  analysisLayers: MapAnalysisLayer[];
  legend: MapLegend[];
  markers: MapMarker[];
  boundaries: MapBoundary[];
  controls: MapControlsConfig;
  attribution: string[];
  /** Set when imagery could not be retrieved — the UI shows this, not a fallback picture. */
  error?: string;
}

/* ─────────────────────────── Agent, evidence, workspace ──────────────────── */

export type AgentStepStatus = 'pending' | 'running' | 'completed' | 'skipped' | 'failed';

export interface AgentStep {
  id: string;
  node: string;
  label: string;
  status: AgentStepStatus;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  detail?: string;
  error?: string;
}

export type EvidenceKind =
  | 'observation'
  | 'computation'
  | 'inference'
  | 'uncertainty'
  | 'source';

export interface Evidence {
  id: string;
  kind: EvidenceKind;
  title: string;
  body: string;
  /** Where this came from — service name, product id, or "model inference". */
  origin: string;
  url?: string;
}

export interface TimelineEntry {
  date: string;
  label: string;
  collection: string;
  cloudCover?: number;
  epoch?: 'before' | 'after' | 'single';
  sceneId?: string;
}

export interface ActivityEvent {
  id: string;
  type:
    | 'QUERY_STARTED'
    | 'QUERY_COMPLETED'
    | 'DATASET_FOUND'
    | 'IMAGERY_SELECTED'
    | 'MAP_GENERATED'
    | 'ANALYSIS_COMPLETED'
    | 'ANALYSIS_FAILED'
    | 'ANALYSIS_SAVED';
  message: string;
  createdAt: string;
  runId?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkspaceInsight {
  id: string;
  title: string;
  body: string;
  /** Distinguishes a measured value from a model reading of it. */
  basis: 'measured' | 'derived' | 'inferred';
}

export interface WorkspaceState {
  datasets: Dataset[];
  insights: WorkspaceInsight[];
  activity: ActivityEvent[];
  statistics: StatisticBand[];
  timeline: TimelineEntry[];
  evidence: Evidence[];
}

/* ───────────────────────────── Top-level response ────────────────────────── */

export type RunStatus = 'running' | 'completed' | 'failed' | 'needs_clarification';

export interface AgentResponse {
  runId: string;
  sessionId: string;
  status: RunStatus;
  query: QuerySummary;
  datasets: Dataset[];
  analysis: AnalysisResult | null;
  map: MapState | null;
  evidence: Evidence[];
  agentSteps: AgentStep[];
  workspace: WorkspaceState;
  answer: string;
  errors: string[];
  warnings: string[];
  /** LangSmith trace URL when tracing is configured. */
  traceUrl?: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
}

export interface AgentRequest {
  query: string;
  sessionId?: string;
  /** Optional client-supplied AOI overriding geocoding (drawn or uploaded). */
  bbox?: [number, number, number, number];
}

/* ──────────────────────────────── SSE events ─────────────────────────────── */

export const AGENT_EVENTS = [
  'agent.started',
  'query.understood',
  'location.resolved',
  'map.planned',
  'dataset.search.started',
  'dataset.search.completed',
  'dataset.selected',
  'imagery.selected',
  'analysis.started',
  'analysis.progress',
  'map.updated',
  'analysis.completed',
  'evidence.generated',
  'workspace.updated',
  'agent.completed',
  'agent.error',
] as const;
export type AgentEventName = (typeof AGENT_EVENTS)[number];

export interface AgentEvent<T = unknown> {
  event: AgentEventName;
  runId: string;
  at: string;
  /** Message shown in the UI — always produced by the backend, never invented client-side. */
  message: string;
  data?: T;
}

/* ─────────────────────────────── Saved analyses ──────────────────────────── */

export interface SavedAnalysis {
  id: string;
  runId: string;
  title: string;
  query: string;
  intent: QueryIntent;
  location: ResolvedLocation | null;
  dateRange: DateRange | null;
  analysisMethod: AnalysisMethod;
  createdAt: string;
  response: AgentResponse;
}

/** Health/config report so the UI can show a precise configuration error. */
export interface BackendCapabilities {
  llm: boolean;
  copernicus: boolean;
  supabase: boolean;
  geocoding: 'mapbox' | 'nominatim' | 'none';
  tracing: boolean;
  missing: string[];
}
