import { env } from '../../config/env.js';
import { UpstreamError, fetchWithTimeout } from '../../lib/errors.js';
import type { BBox } from '../../lib/geo.js';

/**
 * Sentinel Hub Statistics API.
 *
 * This is where SatQuery's numbers come from. The API aggregates real pixel
 * values over the requested bbox and time window and returns mean/min/max/
 * stDev plus sample counts. Nothing here is estimated on our side: if the API
 * has no valid samples it says so, and the caller reports "no data" rather
 * than filling in a figure.
 */

export interface StatsBandResult {
  band: string;
  mean?: number;
  min?: number;
  max?: number;
  stDev?: number;
  sampleCount?: number;
  noDataCount?: number;
}

export interface StatsResult {
  interval: { from: string; to: string };
  bands: StatsBandResult[];
  /** Valid samples / total samples for the aggregation, 0-1. */
  coverage: number;
}

interface StatisticsResponse {
  data?: Array<{
    interval?: { from?: string; to?: string };
    outputs?: Record<
      string,
      {
        bands?: Record<
          string,
          {
            stats?: {
              min?: number;
              max?: number;
              mean?: number;
              stDev?: number;
              sampleCount?: number;
              noDataCount?: number;
            };
          }
        >;
      }
    >;
  }>;
  status?: string;
  error?: { message?: string };
}

export interface StatisticsRequest {
  bbox: BBox;
  evalscript: string;
  /** One entry for a single-epoch request, two for a change request. */
  inputs: Array<{
    collection: string;
    from: string;
    to: string;
    maxCloudCoverage?: number;
    id?: 'before' | 'after';
  }>;
  /** Aggregation window. For a change script this spans both epochs. */
  aggregation: { from: string; to: string };
  /** Output identifier declared in the evalscript. */
  outputId: string;
  resolutionMeters?: number;
}

export async function fetchStatistics(
  req: StatisticsRequest,
  authorization: Record<string, string>,
): Promise<StatsResult | null> {
  const res = Math.max(10, req.resolutionMeters ?? 20);
  // Statistics API takes resolution in the CRS unit; CRS84 is degrees, so ask
  // in metres by using the UTM-equivalent trick Sentinel Hub supports: pass
  // resx/resy in degrees derived from the requested ground resolution.
  const degPerMeterLat = 1 / 111_320;
  const midLat = (req.bbox[1] + req.bbox[3]) / 2;
  const degPerMeterLon = 1 / (111_320 * Math.max(0.15, Math.cos((midLat * Math.PI) / 180)));

  const body = {
    input: {
      bounds: {
        bbox: req.bbox,
        properties: { crs: 'http://www.opengis.net/def/crs/OGC/1.3/CRS84' },
      },
      data: req.inputs.map((i) => {
        const entry: Record<string, unknown> = {
          type: i.collection,
          dataFilter: {
            ...(typeof i.maxCloudCoverage === 'number'
              ? { maxCloudCoverage: i.maxCloudCoverage }
              : {}),
            timeRange: { from: `${i.from}T00:00:00Z`, to: `${i.to}T23:59:59Z` },
          },
        };
        if (i.id) entry.id = i.id;
        if (i.collection.startsWith('sentinel-2')) {
          entry.processing = { harmonizeValues: true };
        }
        return entry;
      }),
    },
    aggregation: {
      timeRange: {
        from: `${req.aggregation.from}T00:00:00Z`,
        to: `${req.aggregation.to}T23:59:59Z`,
      },
      aggregationInterval: { of: 'P100Y' }, // one bucket over the whole range
      resx: res * degPerMeterLon,
      resy: res * degPerMeterLat,
      evalscript: req.evalscript,
    },
    calculations: { [req.outputId]: {} },
  };

  const response = await fetchWithTimeout(`${env.COPERNICUS_SH_BASE}/api/v1/statistics`, {
    method: 'POST',
    headers: { ...authorization, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    timeoutMs: 90_000,
  });

  if (!response.ok) {
    let detail = `Statistics API returned ${response.status}`;
    try {
      const parsed = (await response.json()) as StatisticsResponse;
      if (parsed?.error?.message) detail = `${detail} — ${parsed.error.message}`;
    } catch {
      /* keep generic */
    }
    throw new UpstreamError('Copernicus statistics', detail);
  }

  const json = (await response.json()) as StatisticsResponse;
  const first = json.data?.[0];
  if (!first) return null;

  const output = first.outputs?.[req.outputId];
  const bandsRecord = output?.bands ?? {};
  const bands: StatsBandResult[] = Object.entries(bandsRecord).map(([band, value]) => ({
    band,
    mean: value.stats?.mean,
    min: value.stats?.min,
    max: value.stats?.max,
    stDev: value.stats?.stDev,
    sampleCount: value.stats?.sampleCount,
    noDataCount: value.stats?.noDataCount,
  }));

  if (bands.length === 0) return null;

  const total = bands[0].sampleCount ?? 0;
  const noData = bands[0].noDataCount ?? 0;
  const valid = Math.max(0, total - noData);
  const coverage = total > 0 ? valid / total : 0;

  // No valid samples at all means the window had nothing usable. Say so.
  if (valid === 0) return { interval: normaliseInterval(first.interval, req), bands, coverage: 0 };

  return { interval: normaliseInterval(first.interval, req), bands, coverage };
}

function normaliseInterval(
  interval: { from?: string; to?: string } | undefined,
  req: StatisticsRequest,
): { from: string; to: string } {
  return {
    from: interval?.from ?? req.aggregation.from,
    to: interval?.to ?? req.aggregation.to,
  };
}

/** Band keys in Statistics responses are B0, B1, … in evalscript output order. */
export function bandKey(index: number): string {
  return `B${index}`;
}
