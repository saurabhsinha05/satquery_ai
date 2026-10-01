import { env, hasCopernicus } from '../../config/env.js';
import { TtlCache } from '../../lib/cache.js';
import { ConfigurationError, UpstreamError, fetchWithTimeout } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';

/**
 * Copernicus Data Space OAuth2 (client credentials).
 *
 * The token is cached until shortly before it expires. The client secret never
 * leaves this module: callers get an Authorization header, not the credential.
 */

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

const tokenCache = new TtlCache<string>(60_000, 4);
const CACHE_KEY = 'cdse:access_token';

/** Refresh this many ms before the token actually expires. */
const EXPIRY_MARGIN_MS = 60_000;

let inFlight: Promise<string> | null = null;

export async function getAccessToken(): Promise<string> {
  if (!hasCopernicus()) {
    throw new ConfigurationError('COPERNICUS_CLIENT_ID / COPERNICUS_CLIENT_SECRET');
  }

  const cached = tokenCache.get(CACHE_KEY);
  if (cached) return cached;

  // Collapse concurrent misses into a single token request.
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.COPERNICUS_CLIENT_ID as string,
      client_secret: env.COPERNICUS_CLIENT_SECRET as string,
    });

    const res = await fetchWithTimeout(env.COPERNICUS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      timeoutMs: 20_000,
    });

    if (!res.ok) {
      // Deliberately does not include the response body — it can echo the request.
      throw new UpstreamError(
        'Copernicus authentication',
        `token endpoint returned ${res.status}. Check COPERNICUS_CLIENT_ID and COPERNICUS_CLIENT_SECRET.`,
        502,
      );
    }

    const json = (await res.json()) as TokenResponse;
    if (!json.access_token) {
      throw new UpstreamError('Copernicus authentication', 'no access_token in response');
    }

    const ttl = Math.max(30_000, json.expires_in * 1000 - EXPIRY_MARGIN_MS);
    tokenCache.set(CACHE_KEY, json.access_token, ttl);
    logger.info('copernicus token acquired', { expiresInSeconds: json.expires_in });
    return json.access_token;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

/** Authorization header for a Copernicus request. Never log the result. */
export async function authHeader(): Promise<Record<string, string>> {
  return { Authorization: `Bearer ${await getAccessToken()}` };
}

/** Verifies credentials without performing any data work. */
export async function verifyCredentials(): Promise<{ ok: boolean; message: string }> {
  if (!hasCopernicus()) {
    return { ok: false, message: 'Copernicus credentials are not configured.' };
  }
  try {
    await getAccessToken();
    return { ok: true, message: 'Copernicus Data Space authentication succeeded.' };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Copernicus authentication failed.',
    };
  }
}

/** Test seam. */
export function __resetTokenCache(): void {
  tokenCache.clear();
  inFlight = null;
}
