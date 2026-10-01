import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../src/index.js';

/**
 * HTTP-level tests. They exercise validation, CORS policy and the honest
 * capability report without touching any upstream service.
 */

let server: Server;
let base: string;

beforeAll(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('POST /api/agent/run validation', () => {
  it('rejects a missing query', async () => {
    const res = await fetch(`${base}/api/agent/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('validation_error');
  });

  it('rejects a query that is too short', async () => {
    const res = await fetch(`${base}/api/agent/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'hi' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects a malformed bbox', async () => {
    const res = await fetch(`${base}/api/agent/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'Show urban expansion around Ranchi from 2021 to 2026.',
        bbox: [100, 50, 90, 40],
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain('bbox');
  });

  it('accepts a valid query and returns a run id plus a stream url', async () => {
    const res = await fetch(`${base}/api/agent/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'Show urban expansion around Ranchi from 2021 to 2026.',
        sessionId: 'test-session',
      }),
    });
    expect(res.status).toBe(202);
    const body = (await res.json()) as { runId: string; streamUrl: string; status: string };
    expect(body.runId).toMatch(/[0-9a-f-]{36}/);
    expect(body.streamUrl).toBe(`/api/agent/stream/${body.runId}`);
    expect(body.status).toBe('running');
  });
});

describe('GET /api/capabilities', () => {
  it('reports exactly what is configured, and what is missing', async () => {
    const res = await fetch(`${base}/api/capabilities`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      llm: boolean;
      copernicus: boolean;
      supabase: boolean;
      geocoding: string;
      missing: string[];
      analysisMethods: string[];
    };
    // No env vars are set in the test run, so everything should read false.
    expect(body.llm).toBe(false);
    expect(body.copernicus).toBe(false);
    expect(body.supabase).toBe(false);
    expect(body.geocoding).toBe('nominatim');
    expect(body.missing).toContain('OPENAI_API_KEY');
    expect(body.analysisMethods).toContain('URBAN_EXPANSION');
  });

  it('names missing variables without ever carrying their values', async () => {
    const res = await fetch(`${base}/api/capabilities`);
    const text = await res.text();
    // Naming the variable is the point of the report; the value must never appear.
    expect(text).toContain('COPERNICUS_CLIENT_ID / COPERNICUS_CLIENT_SECRET');
    expect(text).not.toMatch(/sk-[A-Za-z0-9]{16,}/);
    expect(text).not.toMatch(/eyJ[A-Za-z0-9._-]{20,}/);
    expect(text).not.toMatch(/"(client_secret|access_token|apikey)"/i);
  });
});

describe('unknown routes and imagery', () => {
  it('404s an unknown route with a structured error', async () => {
    const res = await fetch(`${base}/api/nope`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('not_found');
  });

  it('404s an expired imagery id rather than serving something else', async () => {
    const res = await fetch(`${base}/api/imagery/does-not-exist`);
    expect(res.status).toBe(404);
  });

  it('404s an unknown run id', async () => {
    const res = await fetch(`${base}/api/agent/run/00000000-0000-0000-0000-000000000000`);
    expect(res.status).toBe(404);
  });
});

describe('persistence-free endpoints', () => {
  it('returns an empty activity list and says persistence is off', async () => {
    const res = await fetch(`${base}/api/activity`);
    const body = (await res.json()) as { activity: unknown[]; persistence: boolean };
    expect(body.activity).toEqual([]);
    expect(body.persistence).toBe(false);
  });

  it('refuses to save without Supabase, with a configuration error', async () => {
    const res = await fetch(`${base}/api/saved`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: 'abc' }),
    });
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('configuration_error');
    expect(body.error.message).toContain('Supabase');
  });
});
