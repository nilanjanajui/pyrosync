/**
 * Free Vector Basemap Configuration (Open, No API Key, Clean Terms)
 * Uses Carto Positron Dark style or fallback open vector tiles.
 */
import type { StyleSpecification } from 'maplibre-gl';

export const BASEMAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

/** High-resolution satellite imagery tiles (Esri World Imagery, open access) */
export const SATELLITE_TILES_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

/**
 * Resilient fallback style used if external vector tile network requests fail.
 * Provides a clean slate-900 canvas for the boundary and grid.
 */
export const FALLBACK_BLANK_STYLE: StyleSpecification = {
  version: 8,
  name: 'PyroSync Blank Offline Fallback',
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': '#0f172a',
      },
    },
  ],
};

