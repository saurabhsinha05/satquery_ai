import type { NextFunction, Request, Response } from 'express';
import { verifyUser } from '../../services/supabase.js';

/**
 * Identity comes from a verified Supabase access token and nowhere else.
 *
 * A `userId` in a request body is ignored — it is trivially forgeable. When no
 * valid token is present the caller is anonymous and scoped to its session id,
 * which is enough to run an analysis but not to read anyone else's history.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; email?: string } | null;
      sessionId?: string;
    }
  }
}

function bearer(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return undefined;
  return token;
}

export async function attachUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  req.user = await verifyUser(bearer(req));
  const headerSession = req.header('x-satquery-session');
  const bodySession =
    typeof req.body === 'object' && req.body !== null
      ? (req.body as { sessionId?: unknown }).sessionId
      : undefined;
  req.sessionId =
    (typeof bodySession === 'string' && bodySession) ||
    headerSession ||
    `anon-${req.ip ?? 'unknown'}`;
  next();
}
