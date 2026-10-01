import { NDWI_CHANGE_SCRIPT } from '../services/copernicus/evalscripts.js';
import type { AnalysisSpec } from './types.js';

/**
 * Water extent and flood change (NDWI).
 *
 * NDWI = (Green - NIR) / (Green + NIR). Optical water detection is blocked by
 * cloud, which is exactly the condition a flood tends to arrive in — so the
 * runner falls back to Sentinel-1 radar when the optical window is unusable.
 */
export const FLOOD_CHANGE_SPEC: AnalysisSpec = {
  method: 'FLOOD_CHANGE',
  label: 'Water / flood extent change (NDWI)',
  methodDescription:
    'NDWI computed per epoch from Sentinel-2 L2A surface reflectance and thresholded to a water mask, then differenced between epochs to separate newly inundated area from permanent water and receded water.',
  collection: 'sentinel-2-l2a',
  fallbackCollection: 'sentinel-1-grd',
  indices: ['NDWI'],
  bands: ['B03 (Green)', 'B08 (NIR)', 'SCL'],
  requiresTwoEpochs: true,
  overlayEvalscript: NDWI_CHANGE_SCRIPT,
  statisticsMethod: 'FLOOD_CHANGE',
  classes: [
    {
      id: 'new_water',
      label: 'Newly inundated',
      color: '#22A0F2',
      description: 'Not water in the earlier epoch, water in the later one.',
    },
    {
      id: 'permanent_water',
      label: 'Permanent water',
      color: '#34D9EE',
      description: 'Water in both epochs.',
    },
    {
      id: 'receded',
      label: 'Receded water',
      color: '#9EAEC7',
      description: 'Water in the earlier epoch, not water in the later one.',
    },
  ],
  legendTitle: 'Flood analysis',
  legendNote:
    'Optical water detection cannot see through cloud; check the cloud cover reported for each epoch.',
  maxCloudCover: 40,
  targetResolutionM: 10,
  purpose: 'Surface water and flood extent',
};
