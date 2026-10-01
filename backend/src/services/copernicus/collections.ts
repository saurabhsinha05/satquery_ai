/**
 * The Copernicus collections this build knows how to work with.
 *
 * Adding a sensor is a matter of adding an entry here plus an evalscript —
 * nothing in the agent graph needs to change.
 */

export interface CollectionSpec {
  /** Sentinel Hub collection id (STAC + Process API). */
  id: string;
  /** OData collection name for catalogue queries. */
  odataName: string;
  displayName: string;
  provider: string;
  platform: string;
  instrument: string;
  /** Bands exposed to evalscripts. */
  bands: string[];
  /** Native ground sample distance of the bands we use. */
  resolution: string;
  /** Native resolution in metres, used to size rasters. */
  resolutionMeters: number;
  revisitDays: number;
  /** Whether `eo:cloud_cover` is meaningful for this sensor. */
  hasCloudCover: boolean;
  archiveFrom: string;
  description: string;
}

export const COLLECTIONS: Record<string, CollectionSpec> = {
  'sentinel-2-l2a': {
    id: 'sentinel-2-l2a',
    odataName: 'SENTINEL-2',
    displayName: 'Sentinel-2 L2A',
    provider: 'Copernicus / ESA',
    platform: 'Sentinel-2',
    instrument: 'MSI',
    bands: ['B02', 'B03', 'B04', 'B08', 'B11', 'B12', 'SCL', 'dataMask'],
    resolution: '10 m (VNIR) / 20 m (SWIR)',
    resolutionMeters: 10,
    revisitDays: 5,
    hasCloudCover: true,
    archiveFrom: '2015-06-23',
    description:
      'Surface-reflectance multispectral optical imagery. The default source for NDVI, NDBI and NDWI work.',
  },
  'sentinel-1-grd': {
    id: 'sentinel-1-grd',
    odataName: 'SENTINEL-1',
    displayName: 'Sentinel-1 GRD',
    provider: 'Copernicus / ESA',
    platform: 'Sentinel-1',
    instrument: 'C-SAR',
    bands: ['VV', 'VH', 'dataMask'],
    resolution: '10 m (IW GRD)',
    resolutionMeters: 10,
    revisitDays: 6,
    hasCloudCover: false,
    archiveFrom: '2014-10-03',
    description:
      'C-band radar backscatter. Sees through cloud, which is what makes monsoon-season flood mapping possible.',
  },
  'sentinel-3-olci': {
    id: 'sentinel-3-olci',
    odataName: 'SENTINEL-3',
    displayName: 'Sentinel-3 OLCI',
    provider: 'Copernicus / ESA',
    platform: 'Sentinel-3',
    instrument: 'OLCI',
    bands: ['B04', 'B06', 'B08', 'B17', 'dataMask'],
    resolution: '300 m',
    resolutionMeters: 300,
    revisitDays: 2,
    hasCloudCover: true,
    archiveFrom: '2016-04-25',
    description: 'Wide-swath optical imagery for regional and national-scale vegetation work.',
  },
  dem: {
    id: 'dem',
    odataName: 'COP-DEM',
    displayName: 'Copernicus DEM',
    provider: 'Copernicus / ESA',
    platform: 'Copernicus DEM',
    instrument: 'DEM',
    bands: ['DEM'],
    resolution: '30 m',
    resolutionMeters: 30,
    revisitDays: 0,
    hasCloudCover: false,
    archiveFrom: '2011-01-01',
    description: 'Elevation model used for slope context and hydrological masking.',
  },
};

export function getCollection(id: string): CollectionSpec {
  const spec = COLLECTIONS[id];
  if (!spec) throw new Error(`Unknown collection: ${id}`);
  return spec;
}

export function listCollections(): CollectionSpec[] {
  return Object.values(COLLECTIONS);
}
