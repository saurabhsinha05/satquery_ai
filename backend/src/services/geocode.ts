import { env } from '../config/env.js';
import { TtlCache } from '../lib/cache.js';
import { NoDataError, UpstreamError, fetchWithTimeout } from '../lib/errors.js';
import type { BBox } from '../lib/geo.js';
import { bboxAround, isValidBBox } from '../lib/geo.js';
import type { ResolvedLocation } from '../types/contract.js';

/**
 * Place-name resolution.
 *
 * Mapbox when a server-side token is configured, OpenStreetMap Nominatim
 * otherwise so the product works out of the box. Coordinates always come from
 * a geocoder — the agent is explicitly forbidden from inventing them, and this
 * module is the only path by which a location can enter the graph state.
 */

const cache = new TtlCache<ResolvedLocation[]>(24 * 60 * 60_000, 500);

/** Default half-width when a geocoder returns a point with no extent. */
const DEFAULT_HALF_WIDTH_KM = 18;

interface MapboxFeature {
  place_name: string;
  center: [number, number];
  bbox?: [number, number, number, number];
  context?: Array<{ id: string; text: string }>;
  place_type?: string[];
  text?: string;
}

async function geocodeMapbox(query: string, limit: number): Promise<ResolvedLocation[]> {
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
    new URLSearchParams({
      access_token: env.MAPBOX_TOKEN as string,
      limit: String(limit),
      types: 'place,locality,district,region,country,neighborhood',
    }).toString();

  const res = await fetchWithTimeout(url, { timeoutMs: 15_000 });
  if (!res.ok) throw new UpstreamError('Mapbox geocoding', `returned ${res.status}`);

  const json = (await res.json()) as { features?: MapboxFeature[] };
  return (json.features ?? []).map((f) => {
    const [lon, lat] = f.center;
    const bbox: BBox = isValidBBox(f.bbox)
      ? (f.bbox as BBox)
      : bboxAround(lon, lat, DEFAULT_HALF_WIDTH_KM);
    const country = f.context?.find((c) => c.id.startsWith('country'))?.text;
    const region = f.context?.find((c) => c.id.startsWith('region'))?.text;
    return {
      placeName: f.place_name,
      latitude: lat,
      longitude: lon,
      bbox,
      country,
      region,
      source: 'mapbox' as const,
    };
  });
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  boundingbox?: [string, string, string, string]; // [south, north, west, east]
  address?: { country?: string; state?: string; region?: string };
}

async function geocodeNominatim(query: string, limit: number): Promise<ResolvedLocation[]> {
  const url =
    'https://nominatim.openstreetmap.org/search?' +
    new URLSearchParams({
      q: query,
      format: 'jsonv2',
      limit: String(limit),
      addressdetails: '1',
    }).toString();

  const res = await fetchWithTimeout(url, {
    timeoutMs: 15_000,
    headers: {
      // Nominatim requires an identifying User-Agent.
      'User-Agent': 'SatQueryAI/1.0 (Earth-observation research prototype)',
      'Accept-Language': 'en',
    },
  });
  if (!res.ok) throw new UpstreamError('Nominatim geocoding', `returned ${res.status}`);

  const json = (await res.json()) as NominatimResult[];
  return json.map((r) => {
    const lat = Number(r.lat);
    const lon = Number(r.lon);
    let bbox: BBox;
    if (r.boundingbox && r.boundingbox.length === 4) {
      const [s, n, w, e] = r.boundingbox.map(Number);
      bbox = [w, s, e, n];
      if (!isValidBBox(bbox)) bbox = bboxAround(lon, lat, DEFAULT_HALF_WIDTH_KM);
    } else {
      bbox = bboxAround(lon, lat, DEFAULT_HALF_WIDTH_KM);
    }
    return {
      placeName: r.display_name,
      latitude: lat,
      longitude: lon,
      bbox,
      country: r.address?.country,
      region: r.address?.state ?? r.address?.region,
      source: 'nominatim' as const,
    };
  });
}

/**
 * Keep an area of interest workable: a whole country is too coarse for 10 m
 * change detection, and a single street is smaller than the sensor's useful
 * unit. Clamp to a window that Sentinel-2 can actually say something about.
 */
export function constrainBBox(bbox: BBox, lon: number, lat: number): BBox {
  const widthDeg = bbox[2] - bbox[0];
  const heightDeg = bbox[3] - bbox[1];
  const maxDeg = 1.2; // roughly 130 km
  const minDeg = 0.06; // roughly 6 km

  if (widthDeg > maxDeg || heightDeg > maxDeg) return bboxAround(lon, lat, 55);
  if (widthDeg < minDeg || heightDeg < minDeg) return bboxAround(lon, lat, 6);
  return bbox;
}

export async function geocode(query: string, limit = 5): Promise<ResolvedLocation[]> {
  const key = `${env.MAPBOX_TOKEN ? 'mb' : 'nm'}:${query.toLowerCase()}:${limit}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const results = env.MAPBOX_TOKEN
    ? await geocodeMapbox(query, limit)
    : await geocodeNominatim(query, limit);

  const constrained = results.map((r) => ({
    ...r,
    bbox: constrainBBox(r.bbox, r.longitude, r.latitude),
  }));

  cache.set(key, constrained);
  return constrained;
}

/**
 * Resolve to one location. Ambiguity is reported through `candidates` so the
 * agent can ask rather than silently picking the wrong Springfield.
 */
export async function resolveLocation(placeName: string): Promise<ResolvedLocation> {
  const results = await geocode(placeName, 5);
  if (results.length === 0) {
    throw new NoDataError(
      `Could not resolve "${placeName}" to a location. Try a more specific place name, or draw the area on the map.`,
    );
  }

  const [best, ...rest] = results;
  // Distinct enough alternatives are worth surfacing.
  const candidates = rest
    .filter((r) => Math.abs(r.latitude - best.latitude) > 0.4 || Math.abs(r.longitude - best.longitude) > 0.4)
    .slice(0, 3)
    .map((r) => ({ placeName: r.placeName, latitude: r.latitude, longitude: r.longitude }));

  return candidates.length > 0 ? { ...best, candidates } : best;
}

export function __clearGeocodeCache(): void {
  cache.clear();
}
