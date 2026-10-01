import { NDBI_CHANGE_SCRIPT } from '../services/copernicus/evalscripts.js';
import type { AnalysisSpec } from './types.js';

/**
 * Built-up / urban expansion (NDBI, guarded by NDVI).
 *
 * NDBI = (SWIR - NIR) / (SWIR + NIR). A pixel counts as built-up when NDBI is
 * positive and NDVI is low, which keeps bare soil and harvested fields from
 * being read as new construction. Expansion is the transition from not-built
 * to built between the two epochs.
 */
export const URBAN_EXPANSION_SPEC: AnalysisSpec = {
  method: 'URBAN_EXPANSION',
  label: 'Urban expansion (NDBI change)',
  methodDescription:
    'NDBI and NDVI computed per epoch from Sentinel-2 L2A surface reflectance, cloud-masked with the scene classification layer. Pixels transitioning from non-built to built between epochs are classified by the magnitude of the NDBI shift.',
  collection: 'sentinel-2-l2a',
  indices: ['NDBI', 'NDVI'],
  bands: ['B04 (Red)', 'B08 (NIR)', 'B11 (SWIR-1)', 'SCL'],
  requiresTwoEpochs: true,
  overlayEvalscript: NDBI_CHANGE_SCRIPT,
  statisticsMethod: 'BUILT_UP_CHANGE',
  classes: [
    {
      id: 'high',
      label: 'High built-up gain',
      color: '#FF4D3D',
      description: 'Non-built to built with an NDBI increase above 0.18.',
    },
    {
      id: 'moderate',
      label: 'Moderate built-up gain',
      color: '#FF9F1C',
      description: 'Non-built to built with an NDBI increase of 0.11–0.18.',
    },
    {
      id: 'low',
      label: 'Low built-up gain',
      color: '#F2E14C',
      description: 'Non-built to built with an NDBI increase of 0.06–0.11.',
    },
    {
      id: 'existing',
      label: 'Existing built-up',
      color: '#8C99A8',
      description: 'Built-up in both epochs — the baseline urban footprint.',
    },
  ],
  legendTitle: 'Urban expansion',
  legendNote: 'Pixels with no significant transition are left transparent.',
  maxCloudCover: 20,
  targetResolutionM: 10,
  purpose: 'Built-up surface growth',
};

/** BUILT_UP_CHANGE is the same computation under the name the API exposes. */
export const BUILT_UP_CHANGE_SPEC: AnalysisSpec = {
  ...URBAN_EXPANSION_SPEC,
  method: 'BUILT_UP_CHANGE',
  label: 'Built-up change (NDBI)',
};
