/**
 * Sentinel Hub evalscripts.
 *
 * These run on Copernicus infrastructure, not here — the index maths and the
 * change classification are performed against real surface reflectance, and
 * what comes back is a rendered raster or a real statistic. This module is the
 * only place band formulas live, so adding an analysis means adding a script
 * here and registering it in `src/eo/registry.ts`.
 */

/** Sentinel-2 L2A scene classification values we treat as unusable. */
const SCL_MASK = `
function isBadPixel(scl) {
  // 0 no data, 1 saturated, 3 cloud shadow, 8/9 cloud medium/high, 10 cirrus
  return scl === 0 || scl === 1 || scl === 3 || scl === 8 || scl === 9 || scl === 10;
}`;

/* ─────────────────────────── Visual (true colour) ────────────────────────── */

export const TRUE_COLOUR_S2 = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B02", "B03", "B04", "SCL", "dataMask"] }],
    output: { bands: 4, sampleType: "AUTO" },
    mosaicking: "ORBIT"
  };
}
${SCL_MASK}
// Gentle tone curve so the image reads well on a dark UI without faking detail.
function stretch(v) {
  var g = Math.pow(Math.max(0, Math.min(1, v * 3.1)), 0.86);
  return g;
}
function evaluatePixel(samples) {
  var acc = [0, 0, 0], n = 0;
  for (var i = 0; i < samples.length; i++) {
    var s = samples[i];
    if (s.dataMask === 0 || isBadPixel(s.SCL)) continue;
    acc[0] += s.B04; acc[1] += s.B03; acc[2] += s.B02; n++;
  }
  if (n === 0) return [0, 0, 0, 0];
  return [stretch(acc[0] / n), stretch(acc[1] / n), stretch(acc[2] / n), 1];
}`;

/** Sentinel-1 VV/VH false colour — usable through cloud. */
export const RADAR_COMPOSITE_S1 = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["VV", "VH", "dataMask"] }],
    output: { bands: 4, sampleType: "AUTO" },
    mosaicking: "ORBIT"
  };
}
function db(v) { return Math.max(0, Math.min(1, (10 * Math.log(v) / Math.LN10 + 25) / 25)); }
function evaluatePixel(samples) {
  var vv = 0, vh = 0, n = 0;
  for (var i = 0; i < samples.length; i++) {
    if (samples[i].dataMask === 0) continue;
    vv += samples[i].VV; vh += samples[i].VH; n++;
  }
  if (n === 0) return [0, 0, 0, 0];
  var a = db(vv / n), b = db(vh / n);
  return [a, b, a * 0.6 + b * 0.4, 1];
}`;

/* ───────────────────────── Two-epoch change rasters ──────────────────────── */

/**
 * Builds a two-datasource change script. `formula` must define `idx(s)`
 * returning the index for one sample, and `classify(before, after)` returning
 * an RGBA array.
 */
function twoEpochScript(bands: string[], body: string): string {
  return `//VERSION=3
function setup() {
  return {
    input: [
      { datasource: "before", bands: ${JSON.stringify(bands)}, mosaicking: "ORBIT" },
      { datasource: "after", bands: ${JSON.stringify(bands)}, mosaicking: "ORBIT" }
    ],
    output: [{ id: "default", bands: 4, sampleType: "AUTO" }]
  };
}
${SCL_MASK}
function composite(list) {
  var acc = {}, n = 0, keys = ${JSON.stringify(bands.filter((b) => b !== 'dataMask' && b !== 'SCL'))};
  for (var k = 0; k < keys.length; k++) acc[keys[k]] = 0;
  for (var i = 0; i < list.length; i++) {
    var s = list[i];
    if (s.dataMask === 0) continue;
    if (s.SCL !== undefined && isBadPixel(s.SCL)) continue;
    for (var j = 0; j < keys.length; j++) acc[keys[j]] += s[keys[j]];
    n++;
  }
  if (n === 0) return null;
  for (var m = 0; m < keys.length; m++) acc[keys[m]] /= n;
  return acc;
}
${body}
function evaluatePixel(samples) {
  var b = composite(samples.before);
  var a = composite(samples.after);
  if (!b || !a) return [0, 0, 0, 0];
  return classify(b, a);
}`;
}

const NDVI_FN = `function idx(s) { return (s.B08 - s.B04) / (s.B08 + s.B04 + 1e-6); }`;
const NDBI_FN = `function idx(s) { return (s.B11 - s.B08) / (s.B11 + s.B08 + 1e-6); }`;
const NDWI_FN = `function idx(s) { return (s.B03 - s.B08) / (s.B03 + s.B08 + 1e-6); }`;

/** Vegetation change: severe loss / moderate loss / stable / gain. */
export const NDVI_CHANGE_SCRIPT = twoEpochScript(
  ['B04', 'B08', 'SCL', 'dataMask'],
  `${NDVI_FN}
function classify(b, a) {
  var d = idx(a) - idx(b);
  if (d <= -0.20) return [0.91, 0.38, 0.25, 0.88];   // severe loss
  if (d <= -0.08) return [0.79, 0.64, 0.22, 0.78];   // moderate loss
  if (d >= 0.12)  return [0.36, 0.66, 0.31, 0.70];   // gain
  return [0, 0, 0, 0];                                // stable — left transparent
}`,
);

/** Built-up change: new built-up / existing built-up. */
export const NDBI_CHANGE_SCRIPT = twoEpochScript(
  ['B04', 'B08', 'B11', 'SCL', 'dataMask'],
  `${NDBI_FN}
function veg(s) { return (s.B08 - s.B04) / (s.B08 + s.B04 + 1e-6); }
function classify(b, a) {
  var nb = idx(b), na = idx(a);
  var builtBefore = nb > 0.0 && veg(b) < 0.25;
  var builtAfter = na > 0.0 && veg(a) < 0.25;
  var delta = na - nb;
  if (!builtBefore && builtAfter && delta > 0.06) {
    // Strength of the transition drives the intensity ramp.
    if (delta > 0.18) return [1.0, 0.30, 0.24, 0.92];  // high
    if (delta > 0.11) return [1.0, 0.62, 0.11, 0.85];  // moderate
    return [0.95, 0.88, 0.30, 0.78];                   // low
  }
  if (builtBefore && builtAfter) return [0.55, 0.60, 0.66, 0.35]; // existing built-up
  return [0, 0, 0, 0];
}`,
);

/** Water / flood change: new water, permanent water, receded water. */
export const NDWI_CHANGE_SCRIPT = twoEpochScript(
  ['B03', 'B08', 'SCL', 'dataMask'],
  `${NDWI_FN}
function classify(b, a) {
  var wb = idx(b) > 0.1, wa = idx(a) > 0.1;
  if (!wb && wa) return [0.13, 0.62, 0.95, 0.90];   // newly inundated
  if (wb && wa)  return [0.20, 0.85, 0.93, 0.70];   // permanent water
  if (wb && !wa) return [0.62, 0.68, 0.78, 0.60];   // receded
  return [0, 0, 0, 0];
}`,
);

/** Generic land-cover transition, driven by the dominant index shift. */
export const LAND_COVER_CHANGE_SCRIPT = twoEpochScript(
  ['B03', 'B04', 'B08', 'B11', 'SCL', 'dataMask'],
  `function ndvi(s) { return (s.B08 - s.B04) / (s.B08 + s.B04 + 1e-6); }
function ndbi(s) { return (s.B11 - s.B08) / (s.B11 + s.B08 + 1e-6); }
function ndwi(s) { return (s.B03 - s.B08) / (s.B03 + s.B08 + 1e-6); }
function classify(b, a) {
  var dv = ndvi(a) - ndvi(b), du = ndbi(a) - ndbi(b), dw = ndwi(a) - ndwi(b);
  var av = Math.abs(dv), au = Math.abs(du), aw = Math.abs(dw);
  if (av < 0.09 && au < 0.07 && aw < 0.09) return [0, 0, 0, 0];
  if (au >= av && au >= aw && du > 0) return [0.85, 0.42, 0.80, 0.85];  // to built-up
  if (aw >= av && aw >= au && dw > 0) return [0.16, 0.62, 0.92, 0.85];  // to water
  if (dv > 0) return [0.32, 0.72, 0.55, 0.80];                          // to vegetation
  return [0.90, 0.58, 0.20, 0.85];                                      // vegetation lost
}`,
);

/** Undirected change magnitude — for "what changed here?". */
export const TEMPORAL_CHANGE_SCRIPT = twoEpochScript(
  ['B03', 'B04', 'B08', 'B11', 'SCL', 'dataMask'],
  `function vec(s) {
  return [
    (s.B08 - s.B04) / (s.B08 + s.B04 + 1e-6),
    (s.B11 - s.B08) / (s.B11 + s.B08 + 1e-6),
    (s.B03 - s.B08) / (s.B03 + s.B08 + 1e-6)
  ];
}
function classify(b, a) {
  var vb = vec(b), va = vec(a);
  var d = Math.sqrt(
    Math.pow(va[0] - vb[0], 2) + Math.pow(va[1] - vb[1], 2) + Math.pow(va[2] - vb[2], 2)
  );
  if (d < 0.12) return [0, 0, 0, 0];
  if (d < 0.22) return [0.95, 0.88, 0.30, 0.70];
  if (d < 0.35) return [1.0, 0.62, 0.11, 0.82];
  return [1.0, 0.30, 0.24, 0.92];
}`,
);

/* ───────────────────── Statistics scripts (real numbers) ─────────────────── */

/**
 * Single-index statistics over one window. The Statistics API returns the
 * genuine mean/min/max/stDev and sample counts for this band.
 */
export function indexStatsScript(index: 'NDVI' | 'NDBI' | 'NDWI'): string {
  const bands =
    index === 'NDVI'
      ? ['B04', 'B08']
      : index === 'NDBI'
        ? ['B08', 'B11']
        : ['B03', 'B08'];
  const formula =
    index === 'NDVI'
      ? '(s.B08 - s.B04) / (s.B08 + s.B04 + 1e-6)'
      : index === 'NDBI'
        ? '(s.B11 - s.B08) / (s.B11 + s.B08 + 1e-6)'
        : '(s.B03 - s.B08) / (s.B03 + s.B08 + 1e-6)';

  return `//VERSION=3
function setup() {
  return {
    input: [{ bands: ${JSON.stringify([...bands, 'SCL', 'dataMask'])}, units: "DN" }],
    output: [
      { id: "index", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
${SCL_MASK}
function evaluatePixel(s) {
  var valid = s.dataMask === 1 && !isBadPixel(s.SCL);
  return { index: [${formula}], dataMask: [valid ? 1 : 0] };
}`;
}

/**
 * Class-indicator statistics: one FLOAT32 band per class, valued 0 or 1.
 * The mean of each band is the fraction of valid pixels in that class, which
 * multiplied by the analysed area gives a real area in km².
 */
export function classFractionScript(
  method: 'NDVI_CHANGE' | 'BUILT_UP_CHANGE' | 'FLOOD_CHANGE' | 'LAND_COVER_CHANGE' | 'TEMPORAL_CHANGE',
): { script: string; classes: Array<{ id: string; label: string; color: string }> } {
  const shared = `
function composite(list) {
  var keys = ["B03","B04","B08","B11"], acc = {}, n = 0;
  for (var k = 0; k < keys.length; k++) acc[keys[k]] = 0;
  for (var i = 0; i < list.length; i++) {
    var s = list[i];
    if (s.dataMask === 0 || isBadPixel(s.SCL)) continue;
    for (var j = 0; j < keys.length; j++) acc[keys[j]] += s[keys[j]];
    n++;
  }
  if (n === 0) return null;
  for (var m = 0; m < keys.length; m++) acc[keys[m]] /= n;
  return acc;
}
function ndvi(s) { return (s.B08 - s.B04) / (s.B08 + s.B04 + 1e-6); }
function ndbi(s) { return (s.B11 - s.B08) / (s.B11 + s.B08 + 1e-6); }
function ndwi(s) { return (s.B03 - s.B08) / (s.B03 + s.B08 + 1e-6); }`;

  const configs: Record<
    string,
    { classes: Array<{ id: string; label: string; color: string }>; classify: string }
  > = {
    NDVI_CHANGE: {
      classes: [
        { id: 'severe_loss', label: 'Severe vegetation loss', color: '#E8613F' },
        { id: 'moderate_loss', label: 'Moderate vegetation loss', color: '#C9A238' },
        { id: 'gain', label: 'Vegetation gain', color: '#5CA84E' },
      ],
      classify: `var d = ndvi(a) - ndvi(b);
      return [d <= -0.20 ? 1 : 0, (d <= -0.08 && d > -0.20) ? 1 : 0, d >= 0.12 ? 1 : 0];`,
    },
    BUILT_UP_CHANGE: {
      classes: [
        { id: 'high', label: 'High built-up gain', color: '#FF4D3D' },
        { id: 'moderate', label: 'Moderate built-up gain', color: '#FF9F1C' },
        { id: 'low', label: 'Low built-up gain', color: '#F2E14C' },
        { id: 'existing', label: 'Existing built-up', color: '#8C99A8' },
      ],
      classify: `var nb = ndbi(b), na = ndbi(a), d = na - nb;
      var bb = nb > 0 && ndvi(b) < 0.25, ba = na > 0 && ndvi(a) < 0.25;
      var gain = (!bb && ba && d > 0.06);
      return [
        (gain && d > 0.18) ? 1 : 0,
        (gain && d > 0.11 && d <= 0.18) ? 1 : 0,
        (gain && d <= 0.11) ? 1 : 0,
        (bb && ba) ? 1 : 0
      ];`,
    },
    FLOOD_CHANGE: {
      classes: [
        { id: 'new_water', label: 'Newly inundated', color: '#22A0F2' },
        { id: 'permanent_water', label: 'Permanent water', color: '#34D9EE' },
        { id: 'receded', label: 'Receded water', color: '#9EAEC7' },
      ],
      classify: `var wb = ndwi(b) > 0.1, wa = ndwi(a) > 0.1;
      return [(!wb && wa) ? 1 : 0, (wb && wa) ? 1 : 0, (wb && !wa) ? 1 : 0];`,
    },
    LAND_COVER_CHANGE: {
      classes: [
        { id: 'to_builtup', label: 'Converted to built-up', color: '#D96BCC' },
        { id: 'to_water', label: 'Converted to water', color: '#289EEB' },
        { id: 'to_vegetation', label: 'Converted to vegetation', color: '#52B78C' },
        { id: 'vegetation_lost', label: 'Vegetation lost', color: '#E69433' },
      ],
      classify: `var dv = ndvi(a) - ndvi(b), du = ndbi(a) - ndbi(b), dw = ndwi(a) - ndwi(b);
      var av = Math.abs(dv), au = Math.abs(du), aw = Math.abs(dw);
      var stable = (av < 0.09 && au < 0.07 && aw < 0.09);
      var toBuilt = (!stable && au >= av && au >= aw && du > 0);
      var toWater = (!stable && aw >= av && aw >= au && dw > 0);
      var toVeg = (!stable && !toBuilt && !toWater && dv > 0);
      var vegLost = (!stable && !toBuilt && !toWater && dv <= 0);
      return [toBuilt ? 1 : 0, toWater ? 1 : 0, toVeg ? 1 : 0, vegLost ? 1 : 0];`,
    },
    TEMPORAL_CHANGE: {
      classes: [
        { id: 'high', label: 'High change', color: '#FF4D3D' },
        { id: 'moderate', label: 'Moderate change', color: '#FF9F1C' },
        { id: 'low', label: 'Low change', color: '#F2E14C' },
      ],
      classify: `var d = Math.sqrt(
        Math.pow(ndvi(a) - ndvi(b), 2) + Math.pow(ndbi(a) - ndbi(b), 2) + Math.pow(ndwi(a) - ndwi(b), 2)
      );
      return [d >= 0.35 ? 1 : 0, (d >= 0.22 && d < 0.35) ? 1 : 0, (d >= 0.12 && d < 0.22) ? 1 : 0];`,
    },
  };

  const cfg = configs[method];
  const n = cfg.classes.length;

  const script = `//VERSION=3
function setup() {
  return {
    input: [
      { datasource: "before", bands: ["B03","B04","B08","B11","SCL","dataMask"], mosaicking: "ORBIT" },
      { datasource: "after", bands: ["B03","B04","B08","B11","SCL","dataMask"], mosaicking: "ORBIT" }
    ],
    output: [
      { id: "classes", bands: ${n}, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
${SCL_MASK}
${shared}
function classify(b, a) { ${cfg.classify} }
function evaluatePixel(samples) {
  var b = composite(samples.before);
  var a = composite(samples.after);
  if (!b || !a) return { classes: ${JSON.stringify(new Array(n).fill(0))}, dataMask: [0] };
  return { classes: classify(b, a), dataMask: [1] };
}`;

  return { script, classes: cfg.classes };
}
