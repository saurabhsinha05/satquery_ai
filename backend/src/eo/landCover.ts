import { LAND_COVER_CHANGE_SCRIPT } from '../services/copernicus/evalscripts.js';
import type { AnalysisSpec } from './types.js';

/**
 * Land-cover transition.
 *
 * Rather than a full supervised classification, this compares NDVI, NDBI and
 * NDWI between epochs and labels each changed pixel by whichever index moved
 * most. That is an honest description of what it does: a dominant-transition
 * map, not a land-cover product.
 */
export const LAND_COVER_CHANGE_SPEC: AnalysisSpec = {
  method: 'LAND_COVER_CHANGE',
  label: 'Land-cover transition',
  methodDescription:
    'NDVI, NDBI and NDWI computed per epoch from Sentinel-2 L2A surface reflectance. Each pixel whose index vector moved beyond the stability threshold is labelled by the dominant index shift. This is a dominant-transition map rather than a supervised land-cover classification.',
  collection: 'sentinel-2-l2a',
  indices: ['NDVI', 'NDBI', 'NDWI'],
  bands: ['B03 (Green)', 'B04 (Red)', 'B08 (NIR)', 'B11 (SWIR-1)', 'SCL'],
  requiresTwoEpochs: true,
  overlayEvalscript: LAND_COVER_CHANGE_SCRIPT,
  statisticsMethod: 'LAND_COVER_CHANGE',
  classes: [
    {
      id: 'to_builtup',
      label: 'Converted to built-up',
      color: '#D96BCC',
      description: 'NDBI shift dominates and is positive.',
    },
    {
      id: 'to_water',
      label: 'Converted to water',
      color: '#289EEB',
      description: 'NDWI shift dominates and is positive.',
    },
    {
      id: 'to_vegetation',
      label: 'Converted to vegetation',
      color: '#52B78C',
      description: 'NDVI rose without a dominant built-up or water shift.',
    },
    {
      id: 'vegetation_lost',
      label: 'Vegetation lost',
      color: '#E69433',
      description: 'NDVI fell without a dominant built-up or water shift.',
    },
  ],
  legendTitle: 'Land-cover change',
  legendNote: 'Pixels inside the stability threshold are left transparent.',
  maxCloudCover: 25,
  targetResolutionM: 10,
  purpose: 'Land-cover transitions between two epochs',
};
