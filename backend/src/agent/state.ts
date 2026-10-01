import { Annotation } from '@langchain/langgraph';
import type {
  ActivityEvent,
  AgentStep,
  AnalysisMethod,
  AnalysisResult,
  Dataset,
  DateRange,
  Evidence,
  MapAnalysisLayer,
  MapComparison,
  MapImagery,
  MapState,
  QueryIntent,
  ResolvedLocation,
  SatelliteScene,
  StatisticBand,
  TimelineEntry,
  WorkspaceState,
} from '../types/contract.js';
import type { BBox } from '../lib/geo.js';
import type { EpochWindow } from '../eo/runner.js';

/**
 * The LangGraph state.
 *
 * Every field is plain JSON so a run can be serialised, persisted and streamed.
 * Reducers are last-write-wins except for the append-only channels (steps,
 * errors, warnings, evidence, activity), which accumulate across nodes.
 */

const replace = <T>(initial: T) =>
  Annotation<T>({ reducer: (_prev: T, next: T) => next, default: () => initial });

const append = <T>() =>
  Annotation<T[]>({
    reducer: (prev: T[], next: T[]) => [...prev, ...next],
    default: () => [],
  });

export const SatQueryState = Annotation.Root({
  /* Request */
  query: replace<string>(''),
  userId: replace<string | null>(null),
  sessionId: replace<string>(''),
  runId: replace<string>(''),
  /** Client-supplied area of interest, when the user drew or uploaded one. */
  suppliedBBox: replace<BBox | null>(null),
  /** Prior turns, so follow-ups resolve against the session. */
  history: replace<Array<{ text: string; intent: string; placeName: string | null; dateFrom: string | null; dateTo: string | null }>>([]),

  /* Understanding */
  intent: replace<QueryIntent>('GENERAL_EARTH_OBSERVATION'),
  locationQuery: replace<string | null>(null),
  location: replace<ResolvedLocation | null>(null),
  bbox: replace<BBox | null>(null),
  dateRange: replace<DateRange | null>(null),
  requestedAnalysis: replace<AnalysisMethod>('NONE'),
  clarificationNeeded: replace<string | null>(null),

  /* Planning */
  requiredDatasets: replace<string[]>([]),
  epochs: replace<{ before: EpochWindow | null; after: EpochWindow | null; single: EpochWindow | null }>({
    before: null,
    after: null,
    single: null,
  }),
  mapPlan: replace<{
    comparisonMode: 'split' | 'toggle' | 'none';
    needsOverlay: boolean;
    needsImagery: boolean;
    zoom: number;
    center: [number, number];
  } | null>(null),

  /* Discovery */
  discoveredDatasets: replace<Dataset[]>([]),
  selectedScenes: replace<SatelliteScene[]>([]),

  /* Processing */
  processingStatus: replace<string>('idle'),
  analysisMethod: replace<AnalysisMethod>('NONE'),
  analysisResult: replace<AnalysisResult | null>(null),
  statistics: replace<StatisticBand[]>([]),

  /* Map */
  mapImagery: replace<MapImagery[]>([]),
  mapLayers: replace<MapAnalysisLayer[]>([]),
  mapComparison: replace<MapComparison | null>(null),
  mapState: replace<MapState | null>(null),

  /* Output */
  evidence: append<Evidence>(),
  timeline: replace<TimelineEntry[]>([]),
  activity: append<ActivityEvent>(),
  agentSteps: append<AgentStep>(),
  errors: append<string>(),
  warnings: append<string>(),
  finalAnswer: replace<string>(''),
  workspaceState: replace<WorkspaceState | null>(null),
});

export type SatQueryStateType = typeof SatQueryState.State;
export type SatQueryUpdate = Partial<SatQueryStateType>;
