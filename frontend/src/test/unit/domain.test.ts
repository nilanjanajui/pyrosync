import { describe, it, expect } from 'vitest';
import {
  median,
  ratioToMedian,
  midRankPercentile,
  rankDescending,
  unusualFlag,
  buildClimatology,
  annualTotals,
} from '../../domain/stats';
import {
  aoiToPolygon,
  estimateAoiAreaKm2,
  isAoiTooSmall,
  snapCellsToAoi,
} from '../../domain/aoi';
import {
  isPartialViirsMonth,
  isTerraOnlyMonth,
  isPredictedMonth,
  sourceLabel,
} from '../../domain/aggregate';
import type { GridFeature } from '../../datasource/schema';

describe('Statistical calculations (stats.ts)', () => {
  it('computes median correctly for odd and even arrays', () => {
    expect(median([1, 5, 2])).toBe(2);
    expect(median([1, 2, 5, 10])).toBe(3.5);
    expect(median([1, NaN, 5, 2])).toBe(2);
    expect(median([])).toBeNaN();
    expect(median([NaN, NaN])).toBeNaN();
  });

  it('computes ratioToMedian with proper handling of 0/NaN', () => {
    expect(ratioToMedian(10, 5)).toBe(2);
    expect(ratioToMedian(0, 5)).toBe(0);
    // When median is 0, ratio should be NaN (displayed as "-" in UI, never Infinity)
    expect(ratioToMedian(5, 0)).toBeNaN();
    expect(ratioToMedian(NaN, 5)).toBeNaN();
  });

  it('computes midRankPercentile strictly', () => {
    // 5 values: 10, 20, 30, 40, 50
    const refs = [10, 20, 30, 40, 50];
    // value = 30: 2 below, 1 equal -> (2 + 0.5 * 1)/5 = 0.5
    expect(midRankPercentile(30, refs)).toBe(0.5);
    // value = 10: 0 below, 1 equal -> 0.5/5 = 0.1
    expect(midRankPercentile(10, refs)).toBe(0.1);
    // value = 50: 4 below, 1 equal -> 4.5/5 = 0.9
    expect(midRankPercentile(50, refs)).toBe(0.9);
  });

  it('computes rankDescending (1 = highest)', () => {
    const refs = [10, 50, 30, 20, 40];
    expect(rankDescending(50, refs)).toBe(1);
    expect(rankDescending(40, refs)).toBe(2);
    expect(rankDescending(10, refs)).toBe(5);
  });

  it('flags unusual high/low months correctly', () => {
    // 10 reference values: 10, 20, 30, 40, 50, 60, 70, 80, 90, 100
    const refs = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    // 100 is >= 90th percentile -> unusual_high
    expect(unusualFlag(100, refs)).toBe('unusual_high');
    // 10 is <= 10th percentile -> unusual_low
    expect(unusualFlag(10, refs)).toBe('unusual_low');
    // 50 is normal
    expect(unusualFlag(50, refs)).toBe('normal');
    // < 5 reference values -> insufficient_data
    expect(unusualFlag(100, [10, 20, 30])).toBe('insufficient_data');
  });

  it('builds climatology and annual totals correctly', () => {
    const months = ['2019-01', '2019-02', '2020-01', '2020-02'];
    const values = new Float64Array([10, 20, 30, 40]);
    const clim = buildClimatology(months, values);
    expect(clim.get(1)).toEqual([10, 30]);
    expect(clim.get(2)).toEqual([20, 40]);

    const annual = annualTotals(months, values);
    expect(annual.get(2019)).toBe(30);
    expect(annual.get(2020)).toBe(70);
  });
});

describe('AOI domain logic (aoi.ts)', () => {
  it('converts bbox AOI to polygon feature', () => {
    const poly = aoiToPolygon({
      mode: 'bbox',
      bbox: [-122, 37, -121, 38],
    });
    expect(poly).not.toBeNull();
    expect(poly?.type).toBe('Feature');
    expect(poly?.geometry.type).toBe('Polygon');
  });

  it('converts radius AOI to circle polygon feature', () => {
    const poly = aoiToPolygon({
      mode: 'radius',
      center: [-120, 37],
      radiusKm: 25,
    });
    expect(poly).not.toBeNull();
    expect(poly?.geometry.type).toBe('Polygon');
  });

  it('identifies small AOIs below MIN_AOI_AREA_KM2', () => {
    expect(estimateAoiAreaKm2({ mode: 'state' })).toBe(423970);
    expect(isAoiTooSmall({ mode: 'state' })).toBe(false);
    // 1 km radius circle area ~ 3.14 km² < 500 km²
    expect(isAoiTooSmall({ mode: 'radius', center: [-120, 37], radiusKm: 1 })).toBe(true);
    // 50 km radius circle area ~ 7853 km² > 500 km²
    expect(isAoiTooSmall({ mode: 'radius', center: [-120, 37], radiusKm: 50 })).toBe(false);
  });

  it('snaps cells to AOI correctly', () => {
    const mockFeatures: GridFeature[] = [
      {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [] },
        properties: { id: 'cell_in', lat: 37.5, lon: -121.5, overlapPct: 100 },
      },
      {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [] },
        properties: { id: 'cell_out', lat: 39.5, lon: -123.5, overlapPct: 100 },
      },
    ];

    // State AOI returns all
    expect(snapCellsToAoi({ mode: 'state' }, mockFeatures)).toEqual([0, 1]);

    // Bbox covering cell_in only
    const matched = snapCellsToAoi(
      { mode: 'bbox', bbox: [-122.0, 37.0, -121.0, 38.0] },
      mockFeatures
    );
    expect(matched).toEqual([0]);
  });
});

describe('Aggregation and timeline metadata (aggregate.ts)', () => {
  it('correctly classifies era boundaries', () => {
    expect(isTerraOnlyMonth('2000-11')).toBe(true);
    expect(isTerraOnlyMonth('2002-06')).toBe(true);
    expect(isTerraOnlyMonth('2002-07')).toBe(false);

    expect(isPartialViirsMonth('2012-01')).toBe(true);
    expect(isPartialViirsMonth('2012-02')).toBe(false);

    expect(isPredictedMonth('2000-11')).toBe(true);
    expect(isPredictedMonth('2012-01')).toBe(true);
    expect(isPredictedMonth('2012-02')).toBe(false);
    expect(isPredictedMonth('2021-12')).toBe(false);
  });

  it('provides appropriate source labels', () => {
    expect(sourceLabel(0)).toContain('Observed VIIRS');
    expect(sourceLabel(1)).toContain('MODIS→VIIRS');
    expect(sourceLabel(2)).toContain('Terra-only');
    expect(sourceLabel(255)).toBe('No data');
  });
});
