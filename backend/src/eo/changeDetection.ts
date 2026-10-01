import { TEMPORAL_CHANGE_SCRIPT } from '../services/copernicus/evalscripts.js';
import type { AnalysisSpec } from './types.js';

/**
 * Undirected change magnitude — the honest answer to "what changed here?".
 *
 * Computes the Euclidean distance between the (NDVI, NDBI, NDWI) vectors of
 * the two epochs and bins it. It says how much changed, not what it became;
 * the directional question is what the land-cover analysis is for.
 */
export const TEMPORAL_CHANGE_SPEC: AnalysisSpec = {
  method: 'TEMPORAL_CHANGE',
  label: 'Temporal change detection',
  methodDescription:
    'NDVI, NDBI and NDWI computed per epoch from Sentinel-2 L2A surface reflectance. The magnitude of the change vector between epochs is binned into intensity classes. This measures how much a pixel changed, not what it changed into.',
  collection: 'sentinel-2-l2a',
  indices: ['NDVI', 'NDBI', 'NDWI'],
  bands: ['B03 (Green)', 'B04 (Red)', 'B08 (NIR)', 'B11 (SWIR-1)', 'SCL'],
  requiresTwoEpochs: true,
  overlayEvalscript: TEMPORAL_CHANGE_SCRIPT,
  statisticsMethod: 'TEMPORAL_CHANGE',
  classes: [
    {
      id: 'high',
      label: 'High change',
      color: '#FF4D3D',
      description: 'Change-vector magnitude of 0.35 or more.',
    },
    {
      id: 'moderate',
      label: 'Moderate change',
      color: '#FF9F1C',
      description: 'Change-vector magnitude of 0.22–0.35.',
    },
    {
      id: 'low',
      label: 'Low change',
      color: '#F2E14C',
      description: 'Change-vector magnitude of 0.12–0.22.',
    },
  ],
  legendTitle: 'Change intensity',
  legendNote: 'Pixels below the 0.12 magnitude threshold are left transparent.',
  maxCloudCover: 25,
  targetResolutionM: 10,
  purpose: 'Undirected change magnitude',
};
