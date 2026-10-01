/**
 * Structured logger with secret redaction.
 *
 * Anything that looks like a credential is scrubbed before it reaches stdout,
 * because the alternative — remembering not to log secrets at every call site —
 * fails exactly once and then it is in the logs forever.
 */

const SECRET_KEYS = [
  'openai_api_key',
  'copernicus_client_secret',
  'copernicus_client_id',
  'langsmith_api_key',
  'supabase_secret_key',
  'mapbox_token',
  'access_token',
  'refresh_token',
  'authorization',
  'apikey',
  'api_key',
  'password',
  'secret',
  'token',
  'client_secret',
];

const REDACTED = '[redacted]';

function scrubValue(key: string, value: unknown): unknown {
  if (SECRET_KEYS.some((s) => key.toLowerCase().includes(s))) return REDACTED;
  return scrub(value);
}

export function scrub(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[depth-limit]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    // Bearer tokens and long opaque keys that slipped into a message.
    return value
      .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, `Bearer ${REDACTED}`)
      .replace(/\b(sk|pk|eyJ)[A-Za-z0-9._-]{20,}\b/g, REDACTED);
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = scrubValue(k, typeof v === 'object' ? scrub(v, depth + 1) : v);
  }
  return out;
}

type Level = 'debug' | 'info' | 'warn' | 'error';

function emit(level: Level, message: string, context?: Record<string, unknown>): void {
  const line = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(context ? { ctx: scrub(context) as Record<string, unknown> } : {}),
  };
  const serialised = JSON.stringify(line);
  if (level === 'error') console.error(serialised);
  else if (level === 'warn') console.warn(serialised);
  else console.log(serialised);
}

export const logger = {
  debug: (m: string, c?: Record<string, unknown>) => emit('debug', m, c),
  info: (m: string, c?: Record<string, unknown>) => emit('info', m, c),
  warn: (m: string, c?: Record<string, unknown>) => emit('warn', m, c),
  error: (m: string, c?: Record<string, unknown>) => emit('error', m, c),
  /** Child logger that stamps every line with a correlation id. */
  forRun(runId: string) {
    return {
      debug: (m: string, c?: Record<string, unknown>) => emit('debug', m, { runId, ...c }),
      info: (m: string, c?: Record<string, unknown>) => emit('info', m, { runId, ...c }),
      warn: (m: string, c?: Record<string, unknown>) => emit('warn', m, { runId, ...c }),
      error: (m: string, c?: Record<string, unknown>) => emit('error', m, { runId, ...c }),
    };
  },
};

export type RunLogger = ReturnType<typeof logger.forRun>;
