import { env } from '../../config/env.js';
import { UpstreamError, fetchWithTimeout } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import type { BBox } from '../../lib/geo.js';
import { rasterSizeFor } from '../../lib/geo.js';

/**
 * Sentinel Hub Process API.
 *
 * Renders a PNG for a bbox and time window using an evalscript, on Copernicus
 * infrastructure. The bytes come back here, are stored server-side, and are
 * served to the browser from our own origin — the browser never sees a token.
 *
 * Because every render is requested for the *same* bbox and the *same* output
 * size, a before/after pair is pixel-aligned by construction. There is no way
 * for two epochs to end up at different extents.
 */

export interface RenderInput {
  collection: string;
  /** Time window the mosaic is built from. */
  from: string;
  to: string;
  maxCloudCoverage?: number;
  /** Present only for two-epoch scripts. */
  id?: 'before' | 'after';
}

export interface RenderRequest {
  bbox: BBox;
  evalscript: string;
  inputs: RenderInput[];
  targetResolutionM?: number;
  maxDimension?: number;
}

export interface RenderResult {
  png: Uint8Array;
  width: number;
  height: number;
  pixelSizeMeters: number;
  bbox: BBox;
}

function buildDataEntry(input: RenderInput): Record<string, unknown> {
  const dataFilter: Record<string, unknown> = {
    timeRange: {
      from: `${input.from}T00:00:00Z`,
      to: `${input.to}T23:59:59Z`,
    },
  };
  if (typeof input.maxCloudCoverage === 'number') {
    dataFilter.maxCloudCoverage = input.maxCloudCoverage;
  }

  const entry: Record<string, unknown> = {
    type: input.collection,
    dataFilter,
  };
  if (input.id) entry.id = input.id;
  // Harmonise Sentinel-2 processing-baseline offsets so epochs are comparable.
  if (input.collection.startsWith('sentinel-2')) {
    entry.processing = { harmonizeValues: true };
  }
  return entry;
}

export async function renderImage(
  req: RenderRequest,
  authorization: Record<string, string>,
): Promise<RenderResult> {
  const { width, height, pixelSizeMeters } = rasterSizeFor(
    req.bbox,
    req.targetResolutionM ?? 10,
    req.maxDimension ?? 1400,
  );

  const body = {
    input: {
      bounds: {
        bbox: req.bbox,
        properties: { crs: 'http://www.opengis.net/def/crs/OGC/1.3/CRS84' },
      },
      data: req.inputs.map(buildDataEntry),
    },
    output: {
      width,
      height,
      responses: [{ identifier: 'default', format: { type: 'image/png' } }],
    },
    evalscript: req.evalscript,
  };

  const res = await fetchWithTimeout(`${env.COPERNICUS_SH_BASE}/api/v1/process`, {
    method: 'POST',
    headers: { ...authorization, 'Content-Type': 'application/json', Accept: 'image/png' },
    body: JSON.stringify(body),
    timeoutMs: 90_000,
  });

  if (!res.ok) {
    let detail = `Process API returned ${res.status}`;
    try {
      const text = await res.text();
      // Sentinel Hub error payloads carry a short reason we can safely surface.
      const parsed = JSON.parse(text) as { error?: { message?: string; status?: number } };
      if (parsed?.error?.message) detail = `${detail} — ${parsed.error.message}`;
    } catch {
      /* keep the generic detail */
    }
    throw new UpstreamError('Copernicus imagery', detail);
  }

  const buffer = new Uint8Array(await res.arrayBuffer());
  if (buffer.byteLength > env.MAX_IMAGE_BYTES) {
    throw new UpstreamError(
      'Copernicus imagery',
      `rendered image exceeded the ${Math.round(env.MAX_IMAGE_BYTES / 1024 / 1024)}MB limit`,
    );
  }

  logger.info('imagery rendered', {
    collection: req.inputs.map((i) => i.collection).join(','),
    epochs: req.inputs.length,
    width,
    height,
    bytes: buffer.byteLength,
  });

  return { png: buffer, width, height, pixelSizeMeters, bbox: req.bbox };
}

/**
 * True when a rendered PNG is effectively empty — every pixel transparent.
 * Used to tell "no usable imagery in this window" apart from "here is a blank
 * picture", which is the difference between an honest empty state and a lie.
 */
export function looksEmpty(png: Uint8Array): boolean {
  // A fully-transparent PNG of any size compresses to a very small file.
  return png.byteLength < 1200;
}
