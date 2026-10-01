import cors from 'cors';
import express from 'express';
import { capabilities, configureTracing, env } from './config/env.js';
import { toPublicError } from './lib/errors.js';
import { logger } from './lib/logger.js';
import { attachUser } from './api/middleware/auth.js';
import { agentRouter } from './api/routes/agent.js';
import { workspaceRouter } from './api/routes/workspace.js';

configureTracing();

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Explicit origin allow-list — never "*", so a stray site cannot drive the agent.
  const allowedOrigins = env.FRONTEND_URL.split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin and server-to-server requests have no Origin header.
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        if (env.NODE_ENV !== 'production' && /^http:\/\/localhost:\d+$/.test(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} is not allowed.`));
      },
      credentials: true,
      exposedHeaders: ['X-Imagery-BBox', 'X-Imagery-Size'],
    }),
  );

  app.use(express.json({ limit: '256kb' }));
  app.use(attachUser);

  app.use('/api/agent', agentRouter);
  app.use('/api', workspaceRouter);

  app.use((req, res) => {
    res.status(404).json({
      error: { code: 'not_found', message: `No route for ${req.method} ${req.path}.` },
    });
  });

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      logger.error('unhandled request error', {
        reason: err instanceof Error ? err.message : 'unknown',
      });
      const { status, body } = toPublicError(err);
      res.status(status).json(body);
    },
  );

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    const caps = capabilities();
    logger.info('SatQuery backend listening', {
      port: env.PORT,
      frontendUrl: env.FRONTEND_URL,
      llm: caps.llm,
      copernicus: caps.copernicus,
      supabase: caps.supabase,
      geocoding: caps.geocoding,
      tracing: caps.tracing,
    });
    if (caps.missing.length > 0) {
      logger.warn('running with reduced capability', { missing: caps.missing });
    }
  });

  const shutdown = (signal: string) => {
    logger.info('shutting down', { signal });
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
