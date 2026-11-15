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

/** 'all' = whole study area, 'draw' = user-drawn, anything else = a preset id from the manifest. */
export type RegionKey = string;

/** Study-area facts the AOI maths needs (taken from the dataset manifest). */
export interface StudyArea {
  bbox: [number, number, number, number];
  areaKm2?: number;
}

function bboxAreaKm2(w: number, s: number, e: number, n: number): number {
  const latM = (s + n) / 2;
  return Math.abs(e - w) * 111.32 * Math.cos((latM * Math.PI) / 180) * Math.abs(n - s) * 111.32;
}

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
export function aoiBBox(aoi: Aoi, study: StudyArea): BBox | null {
  if (aoi.mode === 'state') return study.bbox;
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
export function estimateAoiAreaKm2(aoi: Aoi, study: StudyArea): number {
  if (aoi.mode === 'state') return study.areaKm2 ?? bboxAreaKm2(...study.bbox);
  if (aoi.mode === 'radius') return Math.PI * aoi.radiusKm ** 2;
  if (aoi.mode === 'bbox') {
    return bboxAreaKm2(...aoi.bbox);
  }
  if (aoi.mode === 'polygon') {
    const [w, s, e, n] = bboxTurf(aoi.geometry);
    return bboxAreaKm2(w, s, e, n) * 0.7; // rough estimate
  }
  return 0;
}

/** Minimum recommended AOI area: below this, small area warning is shown for estimated months */
export const MIN_AOI_AREA_KM2 = 500; // roughly 50 10km cells

/** Check if the AOI is below minimum size */
export function isAoiTooSmall(aoi: Aoi, study: StudyArea): boolean {
  return estimateAoiAreaKm2(aoi, study) < MIN_AOI_AREA_KM2;
}

/** Build a GeoJSON FeatureCollection from matched cell features (for map highlight) */
export function aoiCellsFeatureCollection(features: GridFeature[], cellIndexes: number[]) {
  const matched = cellIndexes.map((i) => features[i]);
  return featureCollection(matched as Feature<Polygon>[]);
}
