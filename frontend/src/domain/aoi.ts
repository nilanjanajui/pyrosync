/**
 * AOI (Area of Interest) domain logic.
 * Handles bbox, center+radius, state, and polygon definitions, cell snapping, and area calculations.
 * Uses turf for point-in-polygon and circle generation.
 */
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import circle from '@turf/circle';
import bboxTurf from '@turf/bbox';
import { point, polygon, featureCollection } from '@turf/helpers';
import type { Feature, Polygon, BBox } from 'geojson';
import type { GridFeature } from '../datasource/schema';

export type AoiMode = 'bbox' | 'radius' | 'state' | 'polygon';

export interface BboxAoi {
  mode: 'bbox';
  /** [west, south, east, north] in WGS84 */
  bbox: [number, number, number, number];
}

export interface RadiusAoi {
  mode: 'radius';
  center: [number, number]; // [lon, lat]
  radiusKm: number;
}

export interface StateAoi {
  mode: 'state';
}

export interface PolygonAoi {
  mode: 'polygon';
  geometry: Feature<Polygon>;
}

export type Aoi = BboxAoi | RadiusAoi | StateAoi | PolygonAoi;

export type RegionKey = 'all' | 'north' | 'central' | 'south' | 'draw';

export const REGION_PRESETS: Record<'all' | 'north' | 'central' | 'south', Aoi> = {
  all: { mode: 'state' },
  north: { mode: 'bbox', bbox: [-124.5, 38.8, -119.5, 42.0] },
  central: { mode: 'bbox', bbox: [-123.0, 35.5, -118.0, 38.8] },
  south: { mode: 'bbox', bbox: [-121.0, 32.5, -114.1, 35.5] },
};

/** Returns the polygon for the AOI (for filtering and display) */
export function aoiToPolygon(aoi: Aoi): Feature<Polygon> | null {
  if (aoi.mode === 'state') return null; // entire state — no polygon clip needed
  if (aoi.mode === 'polygon') return aoi.geometry;
  if (aoi.mode === 'bbox') {
    const [w, s, e, n] = aoi.bbox;
    return polygon([
      [
        [w, s],
        [e, s],
        [e, n],
        [w, n],
        [w, s],
      ],
    ]);
  }
  if (aoi.mode === 'radius') {
    const c = circle(aoi.center, aoi.radiusKm, { units: 'kilometers', steps: 64 });
    return c as Feature<Polygon>;
  }
  return null;
}

/** Returns the bounding box of the AOI */
export function aoiBBox(aoi: Aoi, boundary?: Feature<Polygon>): BBox | null {
  if (aoi.mode === 'state') {
    if (boundary) return bboxTurf(boundary);
    return [-124.48, 32.53, -114.13, 42.01]; // California default
  }
  const poly = aoiToPolygon(aoi);
  if (!poly) return null;
  return bboxTurf(poly);
}

/**
 * Snap grid cell centers to the AOI.
 * Returns an array of cell indexes (into cells array) that intersect the AOI.
 */
export function snapCellsToAoi(
  aoi: Aoi,
  features: GridFeature[]
): number[] {
  if (aoi.mode === 'state') {
    // All cells
    return features.map((_, i) => i);
  }
  const aoiPoly = aoiToPolygon(aoi);
  if (!aoiPoly) return features.map((_, i) => i);

  const matched: number[] = [];
  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    const pt = point([f.properties.lon, f.properties.lat]);
    if (booleanPointInPolygon(pt, aoiPoly)) {
      matched.push(i);
    }
  }
  return matched;
}

/**
 * Estimate approximate area of an AOI in km².
 * Uses a rough spherical calculation — not projected area.
 */
export function estimateAoiAreaKm2(aoi: Aoi): number {
  if (aoi.mode === 'state') return 423_970; // California km²
  if (aoi.mode === 'radius') return Math.PI * aoi.radiusKm ** 2;
  if (aoi.mode === 'bbox') {
    const [w, s, e, n] = aoi.bbox;
    const latM = (s + n) / 2;
    const kmPerDegLat = 111.32;
    const kmPerDegLon = 111.32 * Math.cos((latM * Math.PI) / 180);
    return Math.abs(e - w) * kmPerDegLon * Math.abs(n - s) * kmPerDegLat;
  }
  if (aoi.mode === 'polygon') {
    const b = bboxTurf(aoi.geometry);
    const [w, s, e, n] = b;
    const latM = (s + n) / 2;
    const kmPerDegLat = 111.32;
    const kmPerDegLon = 111.32 * Math.cos((latM * Math.PI) / 180);
    return Math.abs(e - w) * kmPerDegLon * Math.abs(n - s) * kmPerDegLat * 0.7; // rough estimate
  }
  return 0;
}

/** Minimum recommended AOI area: below this, small area warning is shown for estimated months */
export const MIN_AOI_AREA_KM2 = 500; // roughly 50 10km cells

/** Check if the AOI is below minimum size */
export function isAoiTooSmall(aoi: Aoi): boolean {
  return estimateAoiAreaKm2(aoi) < MIN_AOI_AREA_KM2;
}

/** Build a GeoJSON FeatureCollection from matched cell features (for map highlight) */
export function aoiCellsFeatureCollection(features: GridFeature[], cellIndexes: number[]) {
  const matched = cellIndexes.map((i) => features[i]);
  return featureCollection(matched as Feature<Polygon>[]);
}
