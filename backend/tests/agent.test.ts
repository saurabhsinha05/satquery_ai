import { describe, expect, it } from 'vitest';
import {
  buildDateRange,
  extractPlace,
  extractYears,
} from '../src/agent/nodes/understanding.js';
import { classifyByKeywords, getSpec, methodForIntent } from '../src/eo/registry.js';
import { selectBestScene } from '../src/services/copernicus/catalog.js';
import { classFractionScript, indexStatsScript } from '../src/services/copernicus/evalscripts.js';
import {
  bboxAround,
  bboxAreaKm2,
  isValidBBox,
  rasterSizeFor,
  zoomForBBox,
} from '../src/lib/geo.js';
import { computeAnalysis } from '../src/eo/runner.js';
import { scrub } from '../src/lib/logger.js';
import type { SatelliteScene } from '../src/types/contract.js';

/**
 * These tests run with no credentials configured, which is deliberate: the
 * most important property to lock down is that an unconfigured backend
 * reports its limits rather than inventing a result.
 */

/* ─────────────────────────── Query classification ────────────────────────── */

describe('query classification', () => {
  const CASES: Array<[string, string]> = [
    ['Show urban expansion around Ranchi from 2021 to 2026.', 'URBAN_EXPANSION'],
    ['Analyze vegetation change around Ranchi from 2020 to 2025.', 'VEGETATION_ANALYSIS'],
    ['Find Sentinel-2 imagery around Ranchi from January 2025.', 'SATELLITE_IMAGE_SEARCH'],
    ['Show flood affected areas around Assam.', 'FLOOD_ANALYSIS'],
    ['What changed around this location?', 'CHANGE_DETECTION'],
    ['Find satellite images with low cloud cover.', 'SATELLITE_IMAGE_SEARCH'],
    ['Compare Ranchi in 2021 and 2026.', 'IMAGE_COMPARISON'],
    ['Show vegetation loss on the map.', 'VEGETATION_ANALYSIS'],
    ['Compare land-use change between 2019 and 2026.', 'LAND_COVER_CHANGE'],
    ['Show deforestation around this region between 2020 and 2025.', 'VEGETATION_ANALYSIS'],
  ];

  it.each(CASES)('routes %s to %s', (query, expected) => {
    expect(classifyByKeywords(query)).toBe(expected);
  });

  it('routes every intent to a method that has a spec or is explicitly NONE', () => {
    for (const [, intent] of CASES) {
      const method = methodForIntent(intent as never);
      expect(method).not.toBe('NONE');
      expect(getSpec(method)).not.toBeNull();
    }
  });
});

/* ───────────────────────────── Date extraction ───────────────────────────── */

describe('date range construction', () => {
  it('pulls both years out of a two-year query', () => {
    const years = extractYears('Show urban expansion around Ranchi from 2021 to 2026.');
    expect(years.start).toBe(2021);
    expect(years.end).toBe(2026);
  });

  it('builds two matched epochs with identical calendar windows', () => {
    const range = buildDateRange(2021, 2023, null, null, true);
    expect(range.before).toBeDefined();
    expect(range.after).toBeDefined();
    expect(range.before?.from.slice(5)).toBe(range.after?.from.slice(5));
    expect(range.before?.label).toBe('2021');
    expect(range.after?.label).toBe('2023');
  });

  it('never asks for imagery after the current year', () => {
    const thisYear = new Date().getUTCFullYear();
    const range = buildDateRange(2021, 2099, null, null, true);
    expect(Number(range.after?.label)).toBeLessThanOrEqual(thisYear);
  });

  it('never asks for imagery before the Sentinel-2 archive begins', () => {
    const range = buildDateRange(1998, 2020, null, null, true);
    expect(Number(range.before?.label)).toBeGreaterThanOrEqual(2016);
  });

  it('handles "the last 5 years"', () => {
    const years = extractYears('Analyze vegetation change over the last 5 years.');
    expect(years.relative).toBe(5);
    const range = buildDateRange(null, null, null, 5, false);
    expect(Number(range.to.slice(0, 4)) - Number(range.from.slice(0, 4))).toBe(5);
  });

  it('uses the same month window in both epochs when a month is named', () => {
    const range = buildDateRange(2021, 2025, 1, null, true);
    expect(range.before?.label).toContain('2021');
    expect(range.after?.label).toContain('2025');
    expect(range.before?.label.split(' ')[0]).toBe(range.after?.label.split(' ')[0]);
  });
});

describe('place extraction', () => {
  it('finds a place after a preposition', () => {
    expect(extractPlace('Show urban expansion around Ranchi from 2021 to 2026.')).toBe('Ranchi');
  });

  it('returns null when no place is named', () => {
    expect(extractPlace('what changed here?')).toBeNull();
  });
});

/* ─────────────────────────────── Geo helpers ─────────────────────────────── */

describe('geo', () => {
  it('builds a valid bbox around a point', () => {
    const bbox = bboxAround(85.33, 23.35, 20);
    expect(isValidBBox(bbox)).toBe(true);
    expect(bboxAreaKm2(bbox)).toBeGreaterThan(1000);
  });

  it('rejects malformed bboxes', () => {
    expect(isValidBBox([1, 2, 3])).toBe(false);
    expect(isValidBBox([10, 10, 5, 20])).toBe(false); // west east of east
    expect(isValidBBox(['a', 1, 2, 3])).toBe(false);
  });

  it('picks a city-scale zoom for a city-scale bbox', () => {
    const zoom = zoomForBBox(bboxAround(85.33, 23.35, 15));
    expect(zoom).toBeGreaterThan(8);
    expect(zoom).toBeLessThan(14);
  });

  it('caps raster dimensions so the Process API request stays in bounds', () => {
    const { width, height } = rasterSizeFor(bboxAround(85.33, 23.35, 120), 10, 1400);
    expect(width).toBeLessThanOrEqual(1400);
    expect(height).toBeLessThanOrEqual(1400);
  });
});

/* ───────────────────────────── Scene selection ───────────────────────────── */

describe('scene selection', () => {
  const scenes: SatelliteScene[] = [
    { id: 'first', collection: 'sentinel-2-l2a', acquisitionDate: '2021-01-05T00:00:00Z', cloudCover: 62 },
    { id: 'cloudy-mid', collection: 'sentinel-2-l2a', acquisitionDate: '2021-06-30T00:00:00Z', cloudCover: 80 },
    { id: 'clear-mid', collection: 'sentinel-2-l2a', acquisitionDate: '2021-07-02T00:00:00Z', cloudCover: 3 },
    { id: 'clear-edge', collection: 'sentinel-2-l2a', acquisitionDate: '2021-12-28T00:00:00Z', cloudCover: 4 },
  ];

  it('does not simply take the first catalogue result', () => {
    const best = selectBestScene(scenes, { from: '2021-01-01', to: '2021-12-31' }, 'before');
    expect(best?.id).not.toBe('first');
  });

  it('prefers the least cloudy scene near the middle of the window', () => {
    const best = selectBestScene(scenes, { from: '2021-01-01', to: '2021-12-31' }, 'before');
    expect(best?.id).toBe('clear-mid');
    expect(best?.epoch).toBe('before');
    expect(best?.selectionReason).toContain('cloud');
  });

  it('returns null rather than a placeholder when there is nothing to pick', () => {
    expect(selectBestScene([], { from: '2021-01-01', to: '2021-12-31' }, 'before')).toBeNull();
  });
});

/* ────────────────────────────── Evalscripts ──────────────────────────────── */

describe('evalscripts', () => {
  it('declares one statistics band per class', () => {
    const { script, classes } = classFractionScript('BUILT_UP_CHANGE');
    expect(classes).toHaveLength(4);
    expect(script).toContain(`bands: ${classes.length}`);
    expect(script).toContain('sampleType: "FLOAT32"');
    expect(script).toContain('dataMask');
  });

  it('builds two datasources for a change script', () => {
    const { script } = classFractionScript('NDVI_CHANGE');
    expect(script).toContain('datasource: "before"');
    expect(script).toContain('datasource: "after"');
  });

  it('masks cloud in the index statistics script', () => {
    const script = indexStatsScript('NDVI');
    expect(script).toContain('isBadPixel');
    expect(script).toContain('B08');
    expect(script).toContain('B04');
  });
});

/* ─────────────────────── Data integrity without credentials ──────────────── */

describe('analysis without Copernicus credentials', () => {
  it('reports that processing is required rather than inventing statistics', async () => {
    const spec = getSpec('URBAN_EXPANSION');
    expect(spec).not.toBeNull();

    const result = await computeAnalysis(
      spec!,
      bboxAround(85.33, 23.35, 15),
      { from: '2021-01-01', to: '2021-12-31', label: '2021', epoch: 'before' },
      { from: '2026-01-01', to: '2026-12-31', label: '2026', epoch: 'after' },
    );

    expect(result.status).toBe('data_available_processing_required');
    expect(result.statistics).toHaveLength(0);
    expect(result.classes).toHaveLength(0);
    expect(result.message).toContain('credentials');
  });

  it('reports imagery-only methods honestly, with no statistics', async () => {
    const spec = getSpec('IMAGE_COMPARISON');
    const result = await computeAnalysis(spec!, bboxAround(85.33, 23.35, 15), null, null);
    expect(result.status).toBe('completed');
    expect(result.statistics).toHaveLength(0);
    expect(result.message).toContain('imagery only');
  });
});

/* ───────────────────────────── Secret redaction ──────────────────────────── */

describe('logger redaction', () => {
  it('scrubs credential-shaped keys', () => {
    const scrubbed = scrub({
      openai_api_key: 'sk-abcdefghijklmnopqrstuvwxyz123456',
      copernicus_client_secret: 'super-secret',
      nested: { authorization: 'Bearer abc.def.ghi', safe: 'keep me' },
    }) as Record<string, unknown>;

    expect(scrubbed.openai_api_key).toBe('[redacted]');
    expect(scrubbed.copernicus_client_secret).toBe('[redacted]');
    expect((scrubbed.nested as Record<string, unknown>).authorization).toBe('[redacted]');
    expect((scrubbed.nested as Record<string, unknown>).safe).toBe('keep me');
  });

  it('scrubs bearer tokens embedded in free text', () => {
    const scrubbed = scrub('called with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9') as string;
    expect(scrubbed).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(scrubbed).toContain('[redacted]');
  });
});
