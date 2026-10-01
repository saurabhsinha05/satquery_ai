import { Router } from 'express';
import { z } from 'zod';
import { getRun } from '../../agent/events.js';
import { capabilities, hasSupabase } from '../../config/env.js';
import { listCollections } from '../../services/copernicus/collections.js';
import { verifyCredentials } from '../../services/copernicus/auth.js';
import {
  getAnalysis,
  listActivity,
  listSavedAnalyses,
  saveAnalysis,
} from '../../services/supabase.js';
import { getImage, storeStats } from '../../services/imageryStore.js';
import { listMethods } from '../../eo/registry.js';
import { readLimiter } from '../middleware/rateLimit.js';

export const workspaceRouter = Router();

/** GET /api/capabilities — what this deployment can actually do. */
workspaceRouter.get('/capabilities', readLimiter, (_req, res) => {
  res.json({ ...capabilities(), analysisMethods: listMethods() });
});

/** GET /api/health — liveness plus a real Copernicus auth check. */
workspaceRouter.get('/health', readLimiter, async (_req, res) => {
  const copernicus = await verifyCredentials();
  res.json({
    ok: true,
    uptimeSeconds: Math.round(process.uptime()),
    capabilities: capabilities(),
    copernicus,
    imageStore: storeStats(),
  });
});

/** GET /api/datasets — the collections the backend knows how to work with. */
workspaceRouter.get('/datasets', readLimiter, (_req, res) => {
  res.json({ collections: listCollections() });
});

/** GET /api/activity — real activity from Supabase, or an empty list. */
workspaceRouter.get('/activity', readLimiter, async (req, res) => {
  if (!hasSupabase()) {
    res.json({ activity: [], persistence: false });
    return;
  }
  const activity = await listActivity(req.user?.id ?? null, req.sessionId ?? null, 40);
  res.json({ activity, persistence: true });
});

/** GET /api/saved — saved analyses for this user or session. */
workspaceRouter.get('/saved', readLimiter, async (req, res) => {
  if (!hasSupabase()) {
    res.json({ saved: [], persistence: false });
    return;
  }
  const saved = await listSavedAnalyses(req.user?.id ?? null, req.sessionId ?? null, 30);
  res.json({ saved, persistence: true });
});

const saveSchema = z.object({
  runId: z.string().min(1),
  title: z.string().trim().min(1).max(160).optional(),
});

/** POST /api/saved — keep a completed run. */
workspaceRouter.post('/saved', readLimiter, async (req, res) => {
  const parsed = saveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { code: 'validation_error', message: parsed.error.issues[0]?.message ?? 'Invalid request.' },
    });
    return;
  }
  if (!hasSupabase()) {
    res.status(503).json({
      error: {
        code: 'configuration_error',
        message: 'Saving requires Supabase. Set SUPABASE_URL and SUPABASE_SECRET_KEY on the backend.',
      },
    });
    return;
  }

  const run = getRun(parsed.data.runId);
  const response = run?.response ?? (await getAnalysis(parsed.data.runId));
  if (!response) {
    res.status(404).json({ error: { code: 'not_found', message: 'No completed run with that id.' } });
    return;
  }

  const saved = await saveAnalysis({
    userId: req.user?.id ?? null,
    sessionId: req.sessionId ?? response.sessionId,
    response,
    title: parsed.data.title,
  });

  if (!saved) {
    res.status(500).json({ error: { code: 'internal_error', message: 'Could not save the analysis.' } });
    return;
  }
  res.status(201).json({ saved });
});

/** GET /api/analyses/:runId — a stored run. */
workspaceRouter.get('/analyses/:runId', readLimiter, async (req, res) => {
  const live = getRun(req.params.runId)?.response;
  const stored = live ?? (await getAnalysis(req.params.runId));
  if (!stored) {
    res.status(404).json({ error: { code: 'not_found', message: 'No analysis with that id.' } });
    return;
  }
  res.json({ analysis: stored });
});

/**
 * GET /api/imagery/:id — serves a rendered raster from our own origin.
 *
 * This is what keeps the Copernicus bearer token server-side: the browser only
 * ever sees a URL on this host.
 */
workspaceRouter.get('/imagery/:id', (req, res) => {
  const image = getImage(req.params.id);
  if (!image) {
    res.status(404).json({ error: { code: 'not_found', message: 'Imagery expired or not found.' } });
    return;
  }
  res.setHeader('Content-Type', image.contentType);
  res.setHeader('Cache-Control', 'private, max-age=3600, immutable');
  res.setHeader('X-Imagery-BBox', image.bbox.join(','));
  res.setHeader('X-Imagery-Size', `${image.width}x${image.height}`);
  res.send(Buffer.from(image.png));
});
