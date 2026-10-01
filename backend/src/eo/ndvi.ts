import { NDVI_CHANGE_SCRIPT } from '../services/copernicus/evalscripts.js';
import type { AnalysisSpec } from './types.js';

/**
 * Vegetation change (NDVI).
 *
 * NDVI = (NIR - Red) / (NIR + Red). Computed per epoch from Sentinel-2 L2A
 * surface reflectance on Copernicus infrastructure, then differenced. The
 * class thresholds are the algorithm's, not a guess about a particular place.
 */
export const NDVI_CHANGE_SPEC: AnalysisSpec = {
  method: 'NDVI_CHANGE',
  label: 'Vegetation change (NDVI)',
  methodDescription:
    'NDVI computed per epoch from Sentinel-2 L2A surface reflectance, cloud-masked with the scene classification layer, then differenced between the two epochs and binned into loss/gain classes.',
  collection: 'sentinel-2-l2a',
  indices: ['NDVI'],
  bands: ['B04 (Red)', 'B08 (NIR)', 'SCL'],
  requiresTwoEpochs: true,
  overlayEvalscript: NDVI_CHANGE_SCRIPT,
  statisticsMethod: 'NDVI_CHANGE',
  classes: [
    {
      id: 'severe_loss',
      label: 'Severe vegetation loss',
      color: '#E8613F',
      description: 'NDVI fell by more than 0.20 between the two epochs.',
    },
    {
      id: 'moderate_loss',
      label: 'Moderate vegetation loss',
      color: '#C9A238',
      description: 'NDVI fell by 0.08–0.20 between the two epochs.',
    },
    {
      id: 'gain',
      label: 'Vegetation gain',
      color: '#5CA84E',
      description: 'NDVI rose by more than 0.12 between the two epochs.',
    },
  ],
  legendTitle: 'Vegetation change',
  legendNote: 'Areas below the change threshold are left transparent.',
  maxCloudCover: 25,
  targetResolutionM: 10,
  purpose: 'Vegetation condition and canopy change',
};
