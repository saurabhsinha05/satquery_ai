import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { env, hasLlm } from './env.js';
import { ConfigurationError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

/**
 * The single place the model is configured.
 *
 * Everything the LLM does in SatQuery is planning or prose: classify the
 * intent, choose the analysis, phrase the answer. It is never asked for a
 * measurement, and every structured call below is schema-constrained so it
 * cannot return a number the pipeline would then present as satellite data.
 */

let cached: ChatOpenAI | null = null;

export function llm(options?: { temperature?: number }): ChatOpenAI {
  if (!hasLlm()) throw new ConfigurationError('OPENAI_API_KEY');
  if (cached && options?.temperature === undefined) return cached;

  const model = new ChatOpenAI({
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL,
    temperature: options?.temperature ?? 0,
    maxRetries: 2,
    timeout: 45_000,
  });

  if (options?.temperature === undefined) cached = model;
  return model;
}

export function modelName(): string {
  return env.OPENAI_MODEL;
}

/**
 * Structured call with a hard fallback.
 *
 * If the model is unavailable or returns something off-schema, the caller gets
 * `null` and takes its deterministic path. It never gets a half-parsed object.
 */
export async function structured<T extends z.ZodTypeAny>(
  schema: T,
  system: string,
  user: string,
  name: string,
): Promise<z.infer<T> | null> {
  if (!hasLlm()) return null;
  try {
    const model = llm().withStructuredOutput(schema, { name });
    const result = await model.invoke([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ]);
    return result as z.infer<T>;
  } catch (e) {
    logger.warn('structured LLM call failed', {
      name,
      reason: e instanceof Error ? e.message : 'unknown',
    });
    return null;
  }
}

/** Free-text completion used for the final answer. */
export async function complete(system: string, user: string): Promise<string | null> {
  if (!hasLlm()) return null;
  try {
    const res = await llm({ temperature: 0.2 }).invoke([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ]);
    const content = res.content;
    if (typeof content === 'string') return content.trim();
    if (Array.isArray(content)) {
      return content
        .map((c) => (typeof c === 'string' ? c : 'text' in c ? String(c.text) : ''))
        .join('')
        .trim();
    }
    return null;
  } catch (e) {
    logger.warn('LLM completion failed', {
      reason: e instanceof Error ? e.message : 'unknown',
    });
    return null;
  }
}
