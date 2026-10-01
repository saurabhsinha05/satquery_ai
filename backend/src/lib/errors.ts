/**
 * Typed errors. Each carries a message that is safe to show a user — no
 * upstream response bodies, no credentials, no stack traces.
 */

export class AppError extends Error {
  constructor(
    message: string,
    readonly status = 500,
    readonly code = 'internal_error',
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ConfigurationError extends AppError {
  constructor(missing: string) {
    super(
      `SatQuery is not fully configured: ${missing} is missing. Set it in the backend environment and restart.`,
      503,
      'configuration_error',
      { missing },
    );
    this.name = 'ConfigurationError';
  }
}

export class UpstreamError extends AppError {
  constructor(service: string, detail: string, status = 502) {
    super(`${service} request failed: ${detail}`, status, 'upstream_error', { service });
    this.name = 'UpstreamError';
  }
}

export class NoDataError extends AppError {
  constructor(message: string) {
    super(message, 404, 'no_data');
    this.name = 'NoDataError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, 'validation_error', details);
    this.name = 'ValidationError';
  }
}

export function toPublicError(err: unknown): {
  status: number;
  body: { error: { code: string; message: string; details?: Record<string, unknown> } };
} {
  if (err instanceof AppError) {
    return {
      status: err.status,
      body: { error: { code: err.code, message: err.message, details: err.details } },
    };
  }
  return {
    status: 500,
    body: { error: { code: 'internal_error', message: 'An unexpected server error occurred.' } },
  };
}

/** fetch with a timeout, so one slow upstream cannot stall an agent run. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 30_000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new UpstreamError('Upstream', `timed out after ${timeoutMs}ms`, 504);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
