import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type {
  ActivityEvent,
  AgentEvent,
  AgentEventName,
  AgentResponse,
  AgentStep,
} from '../types/contract.js';

/**
 * Per-run event bus.
 *
 * The graph publishes here as it works; the SSE endpoint subscribes. Events
 * that fired before a client connected are replayed on subscribe, so a browser
 * that attaches a beat late still sees the whole run rather than joining
 * mid-stream with no context.
 */

export interface RunRecord {
  runId: string;
  sessionId: string;
  userId: string | null;
  status: AgentResponse['status'];
  events: AgentEvent[];
  emitter: EventEmitter;
  startedAt: number;
  finishedAt?: number;
  response?: AgentResponse;
  /** Abort signal for timeout enforcement. */
  controller: AbortController;
}

const runs = new Map<string, RunRecord>();
const RUN_TTL_MS = 30 * 60_000;

function evictOldRuns(): void {
  const cutoff = Date.now() - RUN_TTL_MS;
  for (const [id, run] of runs) {
    if ((run.finishedAt ?? run.startedAt) < cutoff) runs.delete(id);
  }
}

export function createRun(sessionId: string, userId: string | null): RunRecord {
  evictOldRuns();
  const emitter = new EventEmitter();
  emitter.setMaxListeners(20);
  const run: RunRecord = {
    runId: randomUUID(),
    sessionId,
    userId,
    status: 'running',
    events: [],
    emitter,
    startedAt: Date.now(),
    controller: new AbortController(),
  };
  runs.set(run.runId, run);
  return run;
}

export function getRun(runId: string): RunRecord | undefined {
  return runs.get(runId);
}

export function publish<T>(
  run: RunRecord,
  event: AgentEventName,
  message: string,
  data?: T,
): void {
  const payload: AgentEvent<T> = {
    event,
    runId: run.runId,
    at: new Date().toISOString(),
    message,
    data,
  };
  run.events.push(payload as AgentEvent);
  run.emitter.emit('event', payload);
}

export function finishRun(run: RunRecord, response: AgentResponse): void {
  run.status = response.status;
  run.response = response;
  run.finishedAt = Date.now();
  run.emitter.emit('done', response);
}

/** Convenience builders keeping ids and timestamps consistent. */
export function step(
  node: string,
  label: string,
  status: AgentStep['status'],
  extra: Partial<AgentStep> = {},
): AgentStep {
  return {
    id: `${node}:${status}`,
    node,
    label,
    status,
    startedAt: new Date().toISOString(),
    ...extra,
  };
}

export function activity(
  type: ActivityEvent['type'],
  message: string,
  runId: string,
  metadata?: Record<string, unknown>,
): ActivityEvent {
  return {
    id: randomUUID(),
    type,
    message,
    createdAt: new Date().toISOString(),
    runId,
    metadata,
  };
}

export function runCount(): number {
  return runs.size;
}

export function __clearRuns(): void {
  runs.clear();
}
