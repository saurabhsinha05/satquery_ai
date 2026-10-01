import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, hasSupabase } from '../config/env.js';
import { logger } from '../lib/logger.js';
import type {
  ActivityEvent,
  AgentResponse,
  AgentStep,
  SavedAnalysis,
} from '../types/contract.js';

/**
 * Supabase persistence.
 *
 * The service-role key lives only here. Every write is scoped to a verified
 * user id that came from a validated access token — never from a request body.
 * When Supabase is not configured the whole module degrades to no-ops so the
 * agent still runs; the UI is told persistence is off rather than shown
 * invented history.
 */

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!hasSupabase()) return null;
  if (!client) {
    client = createClient(env.SUPABASE_URL as string, env.SUPABASE_SECRET_KEY as string, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}

/** Verify a user's access token. Returns null for anonymous callers. */
export async function verifyUser(
  accessToken: string | undefined,
): Promise<{ id: string; email?: string } | null> {
  if (!accessToken) return null;
  const sb = supabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb.auth.getUser(accessToken);
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? undefined };
  } catch (e) {
    logger.warn('supabase token verification failed', {
      reason: e instanceof Error ? e.message : 'unknown',
    });
    return null;
  }
}

/* ────────────────────────────── Writes ───────────────────────────────────── */

export async function ensureSession(sessionId: string, userId: string | null): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  const { error } = await sb
    .from('sessions')
    .upsert({ id: sessionId, user_id: userId, last_active_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) logger.warn('session upsert failed', { reason: error.message });
}

export async function recordQuery(params: {
  runId: string;
  sessionId: string;
  userId: string | null;
  text: string;
  intent: string;
}): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  const { error } = await sb.from('queries').insert({
    id: params.runId,
    session_id: params.sessionId,
    user_id: params.userId,
    text: params.text,
    intent: params.intent,
  });
  if (error) logger.warn('query insert failed', { reason: error.message });
}

export async function recordAgentRun(params: {
  runId: string;
  sessionId: string;
  userId: string | null;
  status: string;
  traceUrl?: string;
  durationMs?: number;
}): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  const { error } = await sb.from('agent_runs').upsert(
    {
      id: params.runId,
      session_id: params.sessionId,
      user_id: params.userId,
      status: params.status,
      trace_url: params.traceUrl ?? null,
      duration_ms: params.durationMs ?? null,
      finished_at: params.status === 'running' ? null : new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (error) logger.warn('agent_run upsert failed', { reason: error.message });
}

export async function recordAgentSteps(runId: string, steps: AgentStep[]): Promise<void> {
  const sb = supabase();
  if (!sb || steps.length === 0) return;
  const rows = steps.map((s, index) => ({
    run_id: runId,
    ordinal: index,
    node: s.node,
    label: s.label,
    status: s.status,
    detail: s.detail ?? null,
    error: s.error ?? null,
    duration_ms: s.durationMs ?? null,
  }));
  const { error } = await sb.from('agent_steps').upsert(rows, { onConflict: 'run_id,ordinal' });
  if (error) logger.warn('agent_steps upsert failed', { reason: error.message });
}

export async function recordAnalysis(params: {
  runId: string;
  sessionId: string;
  userId: string | null;
  response: AgentResponse;
}): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  const { response } = params;
  const { error } = await sb.from('analyses').upsert(
    {
      id: response.runId,
      run_id: response.runId,
      session_id: params.sessionId,
      user_id: params.userId,
      query_text: response.query.text,
      intent: response.query.intent,
      analysis_method: response.analysis?.method ?? 'NONE',
      analysis_status: response.analysis?.status ?? 'no_data',
      place_name: response.query.location?.placeName ?? null,
      bbox: response.query.location?.bbox ?? null,
      date_from: response.query.dateRange?.from ?? null,
      date_to: response.query.dateRange?.to ?? null,
      payload: response,
    },
    { onConflict: 'id' },
  );
  if (error) logger.warn('analysis upsert failed', { reason: error.message });
}

export async function recordActivity(
  events: ActivityEvent[],
  sessionId: string,
  userId: string | null,
): Promise<void> {
  const sb = supabase();
  if (!sb || events.length === 0) return;
  const rows = events.map((e) => ({
    id: e.id,
    session_id: sessionId,
    user_id: userId,
    run_id: e.runId ?? null,
    type: e.type,
    message: e.message,
    metadata: e.metadata ?? {},
    created_at: e.createdAt,
  }));
  const { error } = await sb.from('activity').upsert(rows, { onConflict: 'id' });
  if (error) logger.warn('activity insert failed', { reason: error.message });
}

export async function recordDatasets(
  runId: string,
  userId: string | null,
  datasets: AgentResponse['datasets'],
): Promise<void> {
  const sb = supabase();
  if (!sb || datasets.length === 0) return;
  const rows = datasets.map((d) => ({
    id: `${runId}:${d.id}`,
    run_id: runId,
    user_id: userId,
    collection: d.collection,
    name: d.name,
    provider: d.provider,
    purpose: d.purpose,
    match_count: d.matchCount,
    status: d.status,
    payload: d,
  }));
  const { error } = await sb.from('datasets').upsert(rows, { onConflict: 'id' });
  if (error) logger.warn('datasets upsert failed', { reason: error.message });
}

export async function saveAnalysis(params: {
  userId: string | null;
  sessionId: string;
  response: AgentResponse;
  title?: string;
}): Promise<SavedAnalysis | null> {
  const sb = supabase();
  if (!sb) return null;
  const record = {
    id: crypto.randomUUID(),
    run_id: params.response.runId,
    session_id: params.sessionId,
    user_id: params.userId,
    title:
      params.title ??
      `${params.response.query.location?.placeName ?? 'Analysis'} — ${params.response.query.requestedAnalysis}`,
    query_text: params.response.query.text,
    payload: params.response,
  };
  const { error } = await sb.from('saved_analyses').insert(record);
  if (error) {
    logger.warn('saved_analyses insert failed', { reason: error.message });
    return null;
  }
  return {
    id: record.id,
    runId: record.run_id,
    title: record.title,
    query: record.query_text,
    intent: params.response.query.intent,
    location: params.response.query.location,
    dateRange: params.response.query.dateRange,
    analysisMethod: params.response.query.requestedAnalysis,
    createdAt: new Date().toISOString(),
    response: params.response,
  };
}

/* ────────────────────────────── Reads ────────────────────────────────────── */

export async function listActivity(
  userId: string | null,
  sessionId: string | null,
  limit = 40,
): Promise<ActivityEvent[]> {
  const sb = supabase();
  if (!sb) return [];
  let q = sb.from('activity').select('*').order('created_at', { ascending: false }).limit(limit);
  if (userId) q = q.eq('user_id', userId);
  else if (sessionId) q = q.eq('session_id', sessionId);
  else return [];

  const { data, error } = await q;
  if (error) {
    logger.warn('activity query failed', { reason: error.message });
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id as string,
    type: row.type as ActivityEvent['type'],
    message: row.message as string,
    createdAt: row.created_at as string,
    runId: (row.run_id as string) ?? undefined,
    metadata: (row.metadata as Record<string, unknown>) ?? undefined,
  }));
}

export async function listSavedAnalyses(
  userId: string | null,
  sessionId: string | null,
  limit = 30,
): Promise<SavedAnalysis[]> {
  const sb = supabase();
  if (!sb) return [];
  let q = sb
    .from('saved_analyses')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (userId) q = q.eq('user_id', userId);
  else if (sessionId) q = q.eq('session_id', sessionId);
  else return [];

  const { data, error } = await q;
  if (error) {
    logger.warn('saved_analyses query failed', { reason: error.message });
    return [];
  }
  return (data ?? []).map((row) => {
    const payload = row.payload as AgentResponse;
    return {
      id: row.id as string,
      runId: row.run_id as string,
      title: row.title as string,
      query: row.query_text as string,
      intent: payload?.query?.intent ?? 'GENERAL_EARTH_OBSERVATION',
      location: payload?.query?.location ?? null,
      dateRange: payload?.query?.dateRange ?? null,
      analysisMethod: payload?.query?.requestedAnalysis ?? 'NONE',
      createdAt: row.created_at as string,
      response: payload,
    };
  });
}

export async function getAnalysis(runId: string): Promise<AgentResponse | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data, error } = await sb.from('analyses').select('payload').eq('id', runId).maybeSingle();
  if (error || !data) return null;
  return data.payload as AgentResponse;
}

/** Prior turns in the session, so "now compare that with 2020" has context. */
export async function sessionHistory(
  sessionId: string,
  limit = 5,
): Promise<Array<{ text: string; intent: string; placeName: string | null; dateFrom: string | null; dateTo: string | null }>> {
  const sb = supabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('analyses')
    .select('query_text,intent,place_name,date_from,date_to,created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r) => ({
    text: r.query_text as string,
    intent: r.intent as string,
    placeName: (r.place_name as string) ?? null,
    dateFrom: (r.date_from as string) ?? null,
    dateTo: (r.date_to as string) ?? null,
  }));
}
