import { END, START, StateGraph } from '@langchain/langgraph';
import { SatQueryState } from './state.js';
import type { RunRecord } from './events.js';
import { makeLocationResolution, makeQueryUnderstanding } from './nodes/understanding.js';
import { makeAnalysisPlanner, makeMapPlanner } from './nodes/planning.js';
import { makeDatasetDiscovery, makeDatasetValidation } from './nodes/discovery.js';
import { makeEoProcessing, makeMapGeneration } from './nodes/processing.js';
import {
  makeAnswerGeneration,
  makeEvidenceGeneration,
  makePersist,
  makeResultValidation,
} from './nodes/output.js';

/**
 * The SatQuery agent graph.
 *
 *   query_understanding → location_resolution → analysis_planner
 *     → dataset_discovery → dataset_validation → map_planner
 *     → eo_processing → map_generation → result_validation
 *     → evidence_generation → answer_generation → persist → END
 *
 * Two conditional edges short-circuit to the answer: an unresolvable location,
 * and a catalogue that returned nothing. Both produce an honest empty result
 * rather than letting the pipeline invent its way to a picture.
 */
export function buildGraph(run: RunRecord) {
  const graph = new StateGraph(SatQueryState)
    .addNode('query_understanding', makeQueryUnderstanding(run))
    .addNode('location_resolution', makeLocationResolution(run))
    .addNode('analysis_planner', makeAnalysisPlanner(run))
    .addNode('dataset_discovery', makeDatasetDiscovery(run))
    .addNode('dataset_validation', makeDatasetValidation(run))
    .addNode('map_planner', makeMapPlanner(run))
    .addNode('eo_processing', makeEoProcessing(run))
    .addNode('map_generation', makeMapGeneration(run))
    .addNode('result_validation', makeResultValidation(run))
    .addNode('evidence_generation', makeEvidenceGeneration(run))
    .addNode('answer_generation', makeAnswerGeneration(run))
    .addNode('persist', makePersist(run));

  return graph
    .addEdge(START, 'query_understanding')
    // No usable location → skip straight to explaining why.
    .addConditionalEdges(
      'query_understanding',
      (state) => (state.clarificationNeeded ? 'evidence_generation' : 'location_resolution'),
      ['evidence_generation', 'location_resolution'],
    )
    .addConditionalEdges(
      'location_resolution',
      (state) => (state.bbox ? 'analysis_planner' : 'evidence_generation'),
      ['analysis_planner', 'evidence_generation'],
    )
    .addEdge('analysis_planner', 'dataset_discovery')
    .addEdge('dataset_discovery', 'dataset_validation')
    .addEdge('dataset_validation', 'map_planner')
    // Catalogue-only queries stop before the processing pipeline.
    .addConditionalEdges(
      'map_planner',
      (state) => (state.analysisMethod === 'DATASET_DISCOVERY' ? 'result_validation' : 'eo_processing'),
      ['result_validation', 'eo_processing'],
    )
    .addEdge('eo_processing', 'map_generation')
    .addEdge('map_generation', 'result_validation')
    .addEdge('result_validation', 'evidence_generation')
    .addEdge('evidence_generation', 'answer_generation')
    .addEdge('answer_generation', 'persist')
    .addEdge('persist', END)
    .compile();
}
