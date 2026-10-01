import { createHash, randomUUID } from 'node:crypto';
import type { BBox } from '../lib/geo.js';

/**
 * Server-side store for rendered rasters.
 *
 * Copernicus imagery is fetched with a bearer token; the browser must never
 * see it. So the PNG lands here and the frontend is handed a URL on our own
 * origin (`/api/imagery/:id`). That also keeps the response payload small —
 * the JSON contract carries a URL, not megabytes of base64.
 */

export interface StoredImage {
  id: string;
  png: Uint8Array;
  bbox: BBox;
  width: number;
  height: number;
  contentType: 'image/png';
  createdAt: number;
  /** Free-form provenance for the evidence panel. */
  meta: Record<string, unknown>;
}

const TTL_MS = 60 * 60 * 1000; // an hour is long enough for a session
const MAX_ENTRIES = 300;

const store = new Map<string, StoredImage>();
/** Content hash → id, so an identical re-render reuses the same URL. */
const byHash = new Map<string, string>();

function evictExpired(): void {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, img] of store) {
    if (img.createdAt < cutoff) {
      store.delete(id);
      byHash.delete(hashOf(img.png));
    }
  }
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    const img = store.get(oldest);
    store.delete(oldest);
    if (img) byHash.delete(hashOf(img.png));
  }
}

function hashOf(png: Uint8Array): string {
  return createHash('sha1').update(png).digest('hex');
}

export function putImage(
  png: Uint8Array,
  bbox: BBox,
  width: number,
  height: number,
  meta: Record<string, unknown> = {},
): StoredImage {
  evictExpired();

  const hash = hashOf(png);
  const existingId = byHash.get(hash);
  if (existingId) {
    const existing = store.get(existingId);
    if (existing) return existing;
  }

  const image: StoredImage = {
    id: randomUUID(),
    png,
    bbox,
    width,
    height,
    contentType: 'image/png',
    createdAt: Date.now(),
    meta,
  };
  store.set(image.id, image);
  byHash.set(hash, image.id);
  return image;
}

export function getImage(id: string): StoredImage | undefined {
  const img = store.get(id);
  if (!img) return undefined;
  if (img.createdAt < Date.now() - TTL_MS) {
    store.delete(id);
    return undefined;
  }
  return img;
}

/** Path the frontend uses. Relative so it works behind any host or proxy. */
export function imageUrl(id: string): string {
  return `/api/imagery/${id}`;
}

export function storeStats(): { count: number; bytes: number } {
  let bytes = 0;
  for (const img of store.values()) bytes += img.png.byteLength;
  return { count: store.size, bytes };
}

export function __clearImageStore(): void {
  store.clear();
  byHash.clear();
}
