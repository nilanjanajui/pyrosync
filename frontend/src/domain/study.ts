/**
 * Study-area helpers. Everything region-specific (name, extent, coverage, presets) is read from the
 * dataset manifest, so the app works for any region the pipeline exports, not only California.
 */
import type { DenseDataset } from '../datasource/load';
import type { StudyArea } from './aoi';
import { aoiSeries } from './aggregate';

/** One entry of the optional public/datasets/regions.json registry. */
export interface RegionEntry {
  id: string;
  name: string;
  path: string;
}

export interface Preset {
  id: string;
  name: string;
  bbox: [number, number, number, number];
}

export const studyName = (ds: DenseDataset): string => ds.manifest.studyArea.name;

export const studyGeometry = (ds: DenseDataset): StudyArea => ({
  bbox: ds.manifest.studyArea.bbox,
  areaKm2: ds.manifest.studyArea.areaKm2,
});

export const studyPresets = (ds: DenseDataset): Preset[] => ds.manifest.studyArea.presets ?? [];

/** Month (YYYY-MM) with the highest whole-area count, or the last month if nothing was detected. */
export function peakMonth(ds: DenseDataset): string {
  const all = ds.grid.features.map((_, i) => i);
  const { months, values } = aoiSeries(ds, all, 'harmonized');
  let best = months.length - 1;
  let max = -1;
  values.forEach((v, i) => {
    if (!isNaN(v) && v > max) {
      max = v;
      best = i;
    }
  });
  return months[best];
}

/** "Aug 2020" from "2020-08". */
export function monthLabel(month: string, style: 'short' | 'long' = 'short'): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleString('en-US', {
    month: style,
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** 1 -> 1st, 22 -> 22nd, 81 -> 81st, 13 -> 13th. */
export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

/** "-122.4" -> "122.40°W", "37.8" -> "37.80°N". Works in every hemisphere. */
export function formatLatLon(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${ns}, ${Math.abs(lon).toFixed(2)}°${ew}`;
}

export const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
