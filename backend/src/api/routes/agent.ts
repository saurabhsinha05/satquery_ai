import { Router } from 'express';
import { z } from 'zod';
import { getRun } from '../../agent/events.js';
import { startRun } from '../../agent/run.js';
import { capabilities } from '../../config/env.js';
import { ValidationError, toPublicError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { isValidBBox } from '../../lib/geo.js';
import { agentLimiter, readLimiter } from '../middleware/rateLimit.js';

export const agentRouter = Router();

const runSchema = z.object({
  query: z.string().trim().min(3, 'Ask a question of at least 3 characters.').max(600),
  sessionId: z.string().trim().min(1).max(128).optional(),
  bbox: z.array(z.number()).length(4).optional(),
});

/** POST /api/agent/run — starts a run and returns immediately. */
agentRouter.post('/run', agentLimiter, (req, res) => {
  const parsed = runSchema.safeParse(req.body);
  if (!parsed.success) {
    const err = new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid request.', {
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    const { status, body } = toPublicError(err);
    res.status(status).json(body);
    return;
  }

  if (parsed.data.bbox && !isValidBBox(parsed.data.bbox)) {
    const { status, body } = toPublicError(
      new ValidationError('bbox must be [west, south, east, north] in EPSG:4326.'),
    );
    res.status(status).json(body);
    return;
  }

  const sessionId = parsed.data.sessionId ?? req.sessionId ?? 'anonymous';
  const run = startRun({
    request: {
      query: parsed.data.query,
      sessionId,
      bbox: parsed.data.bbox as [number, number, number, number] | undefined,
    },
    sessionId,
    userId: req.user?.id ?? null,
  });

  logger.forRun(run.runId).info('agent run accepted', {
    sessionId,
    authenticated: Boolean(req.user),
  });

  res.status(202).json({
    runId: run.runId,
    sessionId,
    status: 'running',
    streamUrl: `/api/agent/stream/${run.runId}`,
    capabilities: capabilities(),
  });
});

/**
 * GET /api/agent/stream/:runId — Server-Sent Events.
 *
 * Events that already fired are replayed on connect, so a client that attaches
 * a moment late still sees the whole run.
 */
agentRouter.get('/stream/:runId', (req, res) => {
  const run = getRun(req.params.runId);
  if (!run) {
    res.status(404).json({ error: { code: 'not_found', message: 'Unknown run id.' } });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  const send = (payload: unknown) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  for (const event of run.events) send(event);

  if (run.status !== 'running' && run.response) {
    send({ event: 'agent.completed', runId: run.runId, at: new Date().toISOString(), message: 'Analysis complete.', data: run.response });
    res.end();
    return;
  }

  const onEvent = (event: unknown) => send(event);
  const onDone = () => {
    clearInterval(heartbeat);
    res.end();
  };

  run.emitter.on('event', onEvent);
  run.emitter.once('done', onDone);

  // Keeps proxies from closing an idle connection mid-run.
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    run.emitter.off('event', onEvent);
    run.emitter.off('done', onDone);
  });
});

/** GET /api/agent/run/:runId — polling fallback for clients without SSE. */
agentRouter.get('/run/:runId', readLimiter, (req, res) => {
  const run = getRun(req.params.runId);
  if (!run) {
    res.status(404).json({ error: { code: 'not_found', message: 'Unknown run id.' } });
    return;
  }
  res.json({
    runId: run.runId,
    status: run.status,
    events: run.events,
    response: run.response ?? null,
  });
});
