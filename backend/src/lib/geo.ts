/** Geodesy helpers. Everything here is EPSG:4326 unless stated otherwise. */

export type BBox = [number, number, number, number]; // [west, south, east, north]

const EARTH_RADIUS_M = 6_378_137;

export function clampLat(lat: number): number {
  return Math.max(-85.05112878, Math.min(85.05112878, lat));
}

/** Square-ish bbox of the given half-width around a point. */
export function bboxAround(lon: number, lat: number, halfWidthKm: number): BBox {
  const dLat = (halfWidthKm * 1000) / 111_320;
  const dLon = (halfWidthKm * 1000) / (111_320 * Math.cos((lat * Math.PI) / 180) || 1);
  return [lon - dLon, clampLat(lat - dLat), lon + dLon, clampLat(lat + dLat)];
}

export function bboxCenter(bbox: BBox): [number, number] {
  return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
}

/** Approximate ground dimensions of a bbox, in metres. */
export function bboxDimensionsMeters(bbox: BBox): { width: number; height: number } {
  const [w, s, e, n] = bbox;
  const midLat = ((s + n) / 2) * (Math.PI / 180);
  const width = ((e - w) * Math.PI * EARTH_RADIUS_M * Math.cos(midLat)) / 180;
  const height = ((n - s) * Math.PI * EARTH_RADIUS_M) / 180;
  return { width: Math.abs(width), height: Math.abs(height) };
}

export function bboxAreaKm2(bbox: BBox): number {
  const { width, height } = bboxDimensionsMeters(bbox);
  return (width * height) / 1e6;
}

/**
 * Web-Mercator zoom that fits the bbox into a viewport.
 * Used so "show me Ranchi" opens at a useful scale rather than a world view.
 */
export function zoomForBBox(bbox: BBox, viewportPx = { width: 900, height: 700 }): number {
  const [w, s, e, n] = bbox;
  const latFraction = (mercatorY(n) - mercatorY(s)) / Math.PI;
  const lngDiff = e - w;
  const lngFraction = (lngDiff < 0 ? lngDiff + 360 : lngDiff) / 360;

  const latZoom = Math.log2(viewportPx.height / 512 / Math.max(latFraction, 1e-9));
  const lngZoom = Math.log2(viewportPx.width / 512 / Math.max(lngFraction, 1e-9));
  const zoom = Math.min(latZoom, lngZoom, 16);
  return Math.max(2, Math.round(zoom * 10) / 10);
}

function mercatorY(lat: number): number {
  const rad = (clampLat(lat) * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

/**
 * Output raster size for a bbox, capped so we never ask Sentinel Hub for a
 * tile larger than the Process API allows or larger than a browser wants.
 */
export function rasterSizeFor(
  bbox: BBox,
  targetResolutionM = 10,
  maxDimension = 1500,
): { width: number; height: number; pixelSizeMeters: number } {
  const { width: gw, height: gh } = bboxDimensionsMeters(bbox);
  let width = Math.round(gw / targetResolutionM);
  let height = Math.round(gh / targetResolutionM);
  const longest = Math.max(width, height);
  let pixelSizeMeters = targetResolutionM;

  if (longest > maxDimension) {
    const scale = maxDimension / longest;
    width = Math.max(64, Math.round(width * scale));
    height = Math.max(64, Math.round(height * scale));
    pixelSizeMeters = gw / width;
  }
  return {
    width: Math.max(64, width),
    height: Math.max(64, height),
    pixelSizeMeters,
  };
}

export function bboxToPolygon(bbox: BBox): GeoJSONPolygon {
  const [w, s, e, n] = bbox;
  return {
    type: 'Polygon',
    coordinates: [
      [
        [w, s],
        [e, s],
        [e, n],
        [w, n],
        [w, s],
      ],
    ],
  };
}

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

/** WKT for the Copernicus OData spatial filter. */
export function bboxToWkt(bbox: BBox): string {
  const [w, s, e, n] = bbox;
  return `POLYGON((${w} ${s},${e} ${s},${e} ${n},${w} ${n},${w} ${s}))`;
}

export function isValidBBox(value: unknown): value is BBox {
  if (!Array.isArray(value) || value.length !== 4) return false;
  const [w, s, e, n] = value as number[];
  return (
    [w, s, e, n].every((v) => typeof v === 'number' && Number.isFinite(v)) &&
    w >= -180 &&
    e <= 180 &&
    w < e &&
    s >= -90 &&
    n <= 90 &&
    s < n
  );
}
