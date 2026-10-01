import { env, hasTracing } from '../config/env.js';
import { logger } from '../lib/logger.js';
import type { AgentRequest, AgentResponse } from '../types/contract.js';
import type { BBox } from '../lib/geo.js';
import { isValidBBox } from '../lib/geo.js';
import { ensureSession, recordAnalysis, sessionHistory } from '../services/supabase.js';
import { buildGraph } from './graph.js';

import { createRun, finishRun, publish, type RunRecord } from './events.js';

/**
 * Executes one agent run.
 *
 * The graph is invoked with a hard wall-clock ceiling and a recursion limit, so
 * an unlucky query cannot hold a worker open indefinitely. Whatever happens —
 * success, timeout, upstream failure — the caller gets a complete, honestly
 * populated `AgentResponse`.
 */

export interface StartRunOptions {
  request: AgentRequest;
  sessionId: string;
  userId: string | null;
}

export function startRun(options: StartRunOptions): RunRecord {
  const run = createRun(options.sessionId, options.userId);
  // Fire and forget: the SSE stream and the polling endpoint both read the run.
  void execute(run, options).catch((e) => {
    logger.forRun(run.runId).error('agent run crashed', {
      reason: e instanceof Error ? e.message : 'unknown',
    });
  });
  return run;
}

async function execute(run: RunRecord, options: StartRunOptions): Promise<void> {
  const log = logger.forRun(run.runId);
  const startedAt = new Date().toISOString();
  const { request, sessionId, userId } = options;

  const suppliedBBox: BBox | null =
    request.bbox && isValidBBox(request.bbox) ? request.bbox : null;

  let history: Awaited<ReturnType<typeof sessionHistory>> = [];
  try {
    await ensureSession(sessionId, userId);
    history = await sessionHistory(sessionId, 5);
  } catch (e) {
    log.warn('session context unavailable', {
      reason: e instanceof Error ? e.message : 'unknown',
    });
  }

  const timeout = setTimeout(() => run.controller.abort(), env.AGENT_TIMEOUT_MS);

  let finalState: Record<string, unknown> = {};
  let failure: string | null = null;

  try {
    const graph = buildGraph(run);
    finalState = (await graph.invoke(
      {
        query: request.query,
        userId,
        sessionId,
        runId: run.runId,
        suppliedBBox,
        history,
      },
      {
        signal: run.controller.signal,
        recursionLimit: 30,
        configurable: { thread_id: run.runId },
        runName: 'satquery-agent',
        metadata: { runId: run.runId, sessionId, intentHint: request.query.slice(0, 120) },
        tags: ['satquery', hasTracing() ? 'traced' : 'untraced'],
      },
    )) as Record<string, unknown>;
  } catch (e) {
    failure =
      run.controller.signal.aborted
        ? `The analysis exceeded the ${Math.round(env.AGENT_TIMEOUT_MS / 1000)}s time limit and was stopped.`
        : e instanceof Error
          ? e.message
          : 'The agent failed for an unknown reason.';
    log.error('agent run failed', { reason: failure });
    publish(run, 'agent.error', failure);
  } finally {
    clearTimeout(timeout);
  }

  const response = toResponse(run, finalState, startedAt, failure, sessionId);

  try {
    await recordAnalysis({ runId: run.runId, sessionId, userId, response });
  } catch (e) {
    log.warn('analysis persistence failed', {
      reason: e instanceof Error ? e.message : 'unknown',
    });
  }

  publish(
    run,
    response.status === 'failed' ? 'agent.error' : 'agent.completed',
    response.status === 'failed'
      ? (response.errors[0] ?? 'The run failed.')
      : 'Analysis complete.',
    response,
  );
  finishRun(run, response);
}

function toResponse(
  run: RunRecord,
  state: Record<string, unknown>,
  startedAt: string,
  failure: string | null,
  sessionId: string,
): AgentResponse {
  const s = state as {
    query?: string;
    intent?: AgentResponse['query']['intent'];
    location?: AgentResponse['query']['location'];
    dateRange?: AgentResponse['query']['dateRange'];
    requestedAnalysis?: AgentResponse['query']['requestedAnalysis'];
    clarificationNeeded?: string | null;
    discoveredDatasets?: AgentResponse['datasets'];
    analysisResult?: AgentResponse['analysis'];
    mapState?: AgentResponse['map'];
    evidence?: AgentResponse['evidence'];
    agentSteps?: AgentResponse['agentSteps'];
    finalAnswer?: string;
    errors?: string[];
    warnings?: string[];
    workspaceState?: AgentResponse['workspace'];
  };

  const errors = [...(s.errors ?? [])];
  if (failure) errors.push(failure);

  const status: AgentResponse['status'] = failure
    ? 'failed'
    : s.clarificationNeeded
      ? 'needs_clarification'
      : 'completed';

  // A run that failed early never reached the persist node, so build the
  // workspace from whatever the graph did manage to produce.
  const workspace =
    s.workspaceState ??
    ({
      datasets: s.discoveredDatasets ?? [],
      insights: [],
      activity: [],
      statistics: [],
      timeline: [],
      evidence: s.evidence ?? [],
    } satisfies AgentResponse['workspace']);

  const finishedAt = new Date().toISOString();

  return {
    runId: run.runId,
    sessionId,
    status,
    query: {
      text: s.query ?? '',
      intent: s.intent ?? 'GENERAL_EARTH_OBSERVATION',
      location: s.location ?? null,
      dateRange: s.dateRange ?? null,
      requestedAnalysis: s.requestedAnalysis ?? 'NONE',
      clarificationNeeded: s.clarificationNeeded ?? undefined,
    },
    datasets: s.discoveredDatasets ?? [],
    analysis: s.analysisResult ?? null,
    map: s.mapState ?? null,
    evidence: s.evidence ?? [],
    agentSteps: s.agentSteps ?? [],
    workspace,
    answer:
      s.finalAnswer ??
      (failure ? failure : 'The run produced no answer.'),
    errors,
    warnings: s.warnings ?? [],
    traceUrl: hasTracing()
      ? `https://smith.langchain.com/projects/p/${encodeURIComponent(env.LANGSMITH_PROJECT)}`
      : undefined,
    startedAt,
    finishedAt,
    durationMs: Date.now() - run.startedAt,
  };
}
