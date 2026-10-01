import rateLimit from 'express-rate-limit';

/**
 * Agent runs cost money and upstream quota, so they are limited far more
 * tightly than reads. Keyed on the authenticated user when there is one, and
 * on the session otherwise, so one browser cannot exhaust everyone's budget.
 */

const keyGenerator = (req: { user?: { id: string } | null; sessionId?: string; ip?: string }) =>
  req.user?.id ?? req.sessionId ?? req.ip ?? 'unknown';

export const agentLimiter = rateLimit({
  windowMs: 60_000,
  limit: 8,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator,
  message: {
    error: {
      code: 'rate_limited',
      message: 'Too many analyses in the last minute. Wait a moment and try again.',
    },
  },
});

export const readLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator,
  message: {
    error: { code: 'rate_limited', message: 'Too many requests. Slow down a little.' },
  },
});
