import { env, hasCopernicus } from '../../config/env.js';
import { TtlCache } from '../../lib/cache.js';
import { UpstreamError, fetchWithTimeout } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import type { BBox } from '../../lib/geo.js';
import { bboxToWkt } from '../../lib/geo.js';
import type { SatelliteScene } from '../../types/contract.js';
import { authHeader } from './auth.js';
import { getCollection } from './collections.js';

/**
 * Catalogue access.
 *
 * Two independent paths, both real Copernicus endpoints:
 *  - Sentinel Hub STAC search (authenticated) — rich per-scene metadata,
 *    the one we prefer because it is what the Process API will actually read.
 *  - OData catalogue (unauthenticated) — used when credentials are absent, so
 *    dataset discovery still returns genuine products instead of nothing.
 *
 * If both fail, the caller gets an error. Neither path ever invents a scene.
 */

const searchCache = new TtlCache<SatelliteScene[]>(10 * 60_000, 200);

export interface SceneSearchParams {
  collection: string;
  bbox: BBox;
  from: string;
  to: string;
  maxCloudCover?: number;
  limit?: number;
}

interface StacItem {
  id: string;
  bbox?: number[];
  properties?: {
    datetime?: string;
    'eo:cloud_cover'?: number;
    platform?: string;
    instruments?: string[];
  };
}

function cacheKey(p: SceneSearchParams): string {
  return [
    p.collection,
    p.bbox.map((v) => v.toFixed(3)).join(','),
    p.from,
    p.to,
    p.maxCloudCover ?? 'any',
    p.limit ?? 50,
  ].join('|');
}

/* ───────────────────────────── STAC (authenticated) ──────────────────────── */

async function searchStac(p: SceneSearchParams): Promise<SatelliteScene[]> {
  const spec = getCollection(p.collection);
  const url = `${env.COPERNICUS_SH_BASE}/api/v1/catalog/1.0.0/search`;

  const body: Record<string, unknown> = {
    collections: [p.collection],
    bbox: p.bbox,
    datetime: `${p.from}T00:00:00Z/${p.to}T23:59:59Z`,
    limit: Math.min(p.limit ?? 50, 100),
  };

  if (spec.hasCloudCover && typeof p.maxCloudCover === 'number') {
    body.filter = {
      op: '<=',
      args: [{ property: 'eo:cloud_cover' }, p.maxCloudCover],
    };
    body['filter-lang'] = 'cql2-json';
  }

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { ...(await authHeader()), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeoutMs: 30_000,
  });

  if (!res.ok) {
    throw new UpstreamError('Copernicus catalogue (STAC)', `search returned ${res.status}`);
  }

  const json = (await res.json()) as { features?: StacItem[] };
  const features = json.features ?? [];

  return features.map((f) => ({
    id: f.id,
    collection: p.collection,
    acquisitionDate: f.properties?.datetime ?? '',
    cloudCover:
      typeof f.properties?.['eo:cloud_cover'] === 'number'
        ? Math.round(f.properties['eo:cloud_cover'] * 10) / 10
        : undefined,
    platform: f.properties?.platform ?? spec.platform,
    instrument: f.properties?.instruments?.[0] ?? spec.instrument,
    resolution: spec.resolution,
    bbox: (f.bbox?.length === 4 ? (f.bbox as BBox) : undefined) ?? undefined,
  }));
}

/* ─────────────────────────── OData (unauthenticated) ─────────────────────── */

interface ODataProduct {
  Id: string;
  Name: string;
  ContentDate?: { Start?: string };
  Attributes?: Array<{ Name: string; Value: unknown }>;
}

async function searchODataProducts(p: SceneSearchParams): Promise<SatelliteScene[]> {
  const spec = getCollection(p.collection);
  const filters = [
    `Collection/Name eq '${spec.odataName}'`,
    `OData.CSC.Intersects(area=geography'SRID=4326;${bboxToWkt(p.bbox)}')`,
    `ContentDate/Start gt ${p.from}T00:00:00.000Z`,
    `ContentDate/Start lt ${p.to}T23:59:59.999Z`,
  ];
  if (spec.hasCloudCover && typeof p.maxCloudCover === 'number') {
    filters.push(
      `Attributes/OData.CSC.DoubleAttribute/any(att:att/Name eq 'cloudCover' and att/OData.CSC.DoubleAttribute/Value lt ${p.maxCloudCover})`,
    );
  }

  const url =
    `${env.COPERNICUS_ODATA_BASE}/Products?` +
    new URLSearchParams({
      $filter: filters.join(' and '),
      $orderby: 'ContentDate/Start asc',
      $top: String(Math.min(p.limit ?? 50, 100)),
      $expand: 'Attributes',
    }).toString();

  const res = await fetchWithTimeout(url, { timeoutMs: 30_000 });
  if (!res.ok) {
    throw new UpstreamError('Copernicus catalogue (OData)', `search returned ${res.status}`);
  }

  const json = (await res.json()) as { value?: ODataProduct[] };
  return (json.value ?? []).map((prod) => {
    const cloudAttr = prod.Attributes?.find((a) => a.Name === 'cloudCover');
    const cloud = typeof cloudAttr?.Value === 'number' ? cloudAttr.Value : undefined;
    return {
      id: prod.Name || prod.Id,
      collection: p.collection,
      acquisitionDate: prod.ContentDate?.Start ?? '',
      cloudCover: cloud !== undefined ? Math.round(cloud * 10) / 10 : undefined,
      platform: spec.platform,
      instrument: spec.instrument,
      resolution: spec.resolution,
    };
  });
}

/* ─────────────────────────────────── API ─────────────────────────────────── */

export async function searchScenes(p: SceneSearchParams): Promise<SatelliteScene[]> {
  const key = cacheKey(p);
  const cached = searchCache.get(key);
  if (cached) return cached;

  let scenes: SatelliteScene[] = [];
  let stacError: string | undefined;

  if (hasCopernicus()) {
    try {
      scenes = await searchStac(p);
    } catch (e) {
      stacError = e instanceof Error ? e.message : 'STAC search failed';
      logger.warn('STAC search failed, falling back to OData', {
        collection: p.collection,
        reason: stacError,
      });
    }
  }

  if (scenes.length === 0) {
    // Either no credentials, or STAC failed / returned nothing. OData is public.
    scenes = await searchODataProducts(p);
  }

  scenes.sort((a, b) => a.acquisitionDate.localeCompare(b.acquisitionDate));
  searchCache.set(key, scenes);
  return scenes;
}

/**
 * Pick the scene that best represents an epoch.
 *
 * Deliberately not "the first result": we score on cloud cover first (a cloudy
 * scene is a useless comparison) and then on distance from the middle of the
 * requested window, so both epochs land on comparable seasons.
 */
export function selectBestScene(
  scenes: SatelliteScene[],
  window: { from: string; to: string },
  epoch: 'before' | 'after' | 'single',
): SatelliteScene | null {
  if (scenes.length === 0) return null;

  const midpoint = (Date.parse(window.from) + Date.parse(window.to)) / 2;
  const span = Math.max(1, Date.parse(window.to) - Date.parse(window.from));

  const scored = scenes
    .filter((s) => s.acquisitionDate)
    .map((s) => {
      const cloud = s.cloudCover ?? 0;
      const temporalOffset = Math.abs(Date.parse(s.acquisitionDate) - midpoint) / span;
      // Cloud dominates; temporal centring breaks ties.
      const score = cloud / 100 + temporalOffset * 0.35;
      return { scene: s, score, cloud, temporalOffset };
    })
    .sort((a, b) => a.score - b.score);

  if (scored.length === 0) return null;
  const best = scored[0];

  const reasons: string[] = [];
  if (best.cloud !== undefined && best.scene.cloudCover !== undefined) {
    reasons.push(`lowest cloud cover in the window (${best.scene.cloudCover}%)`);
  }
  reasons.push(`acquisition closest to the centre of the ${window.from} → ${window.to} window`);
  reasons.push(`chosen from ${scenes.length} catalogue matches`);

  return { ...best.scene, epoch, selectionReason: reasons.join('; ') };
}

export function __clearCatalogCache(): void {
  searchCache.clear();
}
