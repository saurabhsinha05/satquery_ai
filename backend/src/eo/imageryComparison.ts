import type { AnalysisSpec } from './types.js';

/**
 * Side-by-side imagery, with no derived layer.
 *
 * "Show me Ranchi in 2021" and "compare Ranchi in 2021 and 2026" ask to *see*
 * the ground, not to have it classified. This spec renders true-colour
 * composites for the requested epochs and produces no analysis classes — so
 * the UI shows no legend and claims no measurement.
 */
export const IMAGE_COMPARISON_SPEC: AnalysisSpec = {
  method: 'IMAGE_COMPARISON',
  label: 'Satellite imagery comparison',
  methodDescription:
    'True-colour composites rendered from Sentinel-2 L2A surface reflectance for each requested epoch, cloud-masked with the scene classification layer and rendered over an identical bounding box so the two views align exactly.',
  collection: 'sentinel-2-l2a',
  fallbackCollection: 'sentinel-1-grd',
  indices: [],
  bands: ['B02 (Blue)', 'B03 (Green)', 'B04 (Red)', 'SCL'],
  requiresTwoEpochs: false,
  overlayEvalscript: '',
  statisticsMethod: null,
  classes: [],
  legendTitle: '',
  maxCloudCover: 20,
  targetResolutionM: 10,
  purpose: 'Visual inspection of the ground',
};

/** Catalogue-only: what data exists here, without rendering an analysis. */
export const DATASET_DISCOVERY_SPEC: AnalysisSpec = {
  ...IMAGE_COMPARISON_SPEC,
  method: 'DATASET_DISCOVERY',
  label: 'Dataset discovery',
  methodDescription:
    'Catalogue search against the Copernicus Data Space for products intersecting the area of interest within the requested time range, filtered by cloud cover where the sensor reports it.',
  purpose: 'Find available Earth-observation products',
};
