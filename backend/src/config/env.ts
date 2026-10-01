import { z } from 'zod';
import type { BackendCapabilities } from '../types/contract.js';

/**
 * Environment configuration.
 *
 * Every secret lives here and nowhere else. Nothing in this module is ever
 * serialised into an API response, a log line, or a LangSmith trace.
 */

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8000),
  FRONTEND_URL: z.string().default('http://localhost:5173'),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),

  LANGSMITH_API_KEY: z.string().optional(),
  LANGSMITH_TRACING: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  LANGSMITH_PROJECT: z.string().default('satquery-ai'),

  COPERNICUS_CLIENT_ID: z.string().optional(),
  COPERNICUS_CLIENT_SECRET: z.string().optional(),
  COPERNICUS_TOKEN_URL: z
    .string()
    .default(
      'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token',
    ),
  COPERNICUS_SH_BASE: z.string().default('https://sh.dataspace.copernicus.eu'),
  COPERNICUS_ODATA_BASE: z.string().default('https://catalogue.dataspace.copernicus.eu/odata/v1'),

  SUPABASE_URL: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),

  /** Server-side geocoding token. Distinct from the browser's VITE_MAPBOX_ACCESS_TOKEN. */
  MAPBOX_TOKEN: z.string().optional(),

  /** Hard ceiling on a single agent run. */
  AGENT_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  /** Max PNG bytes we will hold per rendered layer. */
  MAX_IMAGE_BYTES: z.coerce.number().int().positive().default(6 * 1024 * 1024),
});

export type Env = z.infer<typeof schema>;

function loadEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration — ${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();

export const hasLlm = (): boolean => Boolean(env.OPENAI_API_KEY);
export const hasCopernicus = (): boolean =>
  Boolean(env.COPERNICUS_CLIENT_ID && env.COPERNICUS_CLIENT_SECRET);
export const hasSupabase = (): boolean => Boolean(env.SUPABASE_URL && env.SUPABASE_SECRET_KEY);
export const hasTracing = (): boolean => Boolean(env.LANGSMITH_TRACING && env.LANGSMITH_API_KEY);

/**
 * What this deployment can actually do. The frontend renders a precise
 * configuration error from this rather than silently degrading.
 */
export function capabilities(): BackendCapabilities {
  const missing: string[] = [];
  if (!hasLlm()) missing.push('OPENAI_API_KEY');
  if (!hasCopernicus()) missing.push('COPERNICUS_CLIENT_ID / COPERNICUS_CLIENT_SECRET');
  if (!hasSupabase()) missing.push('SUPABASE_URL / SUPABASE_SECRET_KEY');

  return {
    llm: hasLlm(),
    copernicus: hasCopernicus(),
    supabase: hasSupabase(),
    geocoding: env.MAPBOX_TOKEN ? 'mapbox' : 'nominatim',
    tracing: hasTracing(),
    missing,
  };
}

/** LangSmith reads these from the process env; set them once, here. */
export function configureTracing(): void {
  if (!hasTracing()) {
    process.env.LANGCHAIN_TRACING_V2 = 'false';
    return;
  }
  process.env.LANGCHAIN_TRACING_V2 = 'true';
  process.env.LANGCHAIN_API_KEY = env.LANGSMITH_API_KEY;
  process.env.LANGCHAIN_PROJECT = env.LANGSMITH_PROJECT;
}
