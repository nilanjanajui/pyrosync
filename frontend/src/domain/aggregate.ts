import { getEra } from './era';
/**
 * Monthly aggregation and time-series computation from dense matrices.
 * All counts are VIIRS-equivalent active-fire detection records — never "fires".
 */
import type { DenseDataset } from '../datasource/load';

export type SensorMode = 'modis' | 'viirs' | 'harmonized';

export interface MonthlySeries {
  /** YYYY-MM strings for each point */
  months: string[];
  /** Raw count values. NaN = no data (sensor not operating). */
  values: Float64Array;
  /** Source code per month: 0=observed_viirs, 1=predicted_modis_viirs, 2=predicted_terra_only, 255=no_data */
  sources: Uint8Array;
  /** Number of contributing cells per month */
  cellCounts: Uint16Array;
  sensor: SensorMode;
}

/**
 * Compute a monthly aggregated time-series for a given set of cell indexes.
 * Zero means "no detection record in those cells that month".
 * NaN means the sensor was not operating (null, not zero).
 */
export function aoiSeries(
  dataset: DenseDataset,
  cellIndexes: number[],
  sensor: SensorMode
): MonthlySeries {
  const { numMonths, numCells, months } = dataset;
  const values = new Float64Array(numMonths);
  const sources = new Uint8Array(numMonths).fill(255);
  const cellCounts = new Uint16Array(numMonths);

  if (cellIndexes.length === 0) {
    // No cells — all NaN
    values.fill(NaN);
    return { months, values, sources, cellCounts, sensor };
  }

  for (let mIdx = 0; mIdx < numMonths; mIdx++) {
    // Determine if sensor is operating this month
    let isOperating = false;
    if (sensor === 'modis') {
      isOperating = dataset.modisMask[mIdx] === 1;
    } else if (sensor === 'viirs') {
      isOperating = dataset.viirsMask[mIdx] === 1;
    } else {
      // harmonized covers all months
      isOperating = dataset.harmonizedMask[mIdx] === 1;
    }

    if (!isOperating) {
      values[mIdx] = NaN;
      continue;
    }

    // Sum across cells
    let sum = 0;
    let activeCells = 0;
    let dominantSrc = 255;

    for (const cIdx of cellIndexes) {
      const offset = mIdx * numCells + cIdx;
      let v = 0;
      if (sensor === 'modis') {
        v = dataset.modisTotal[offset];
      } else if (sensor === 'viirs') {
        v = dataset.viirsTotal[offset];
      } else {
        v = dataset.harmonizedTotal[offset];
        const src = dataset.harmonizedSource[offset];
        // Track dominant source (lowest code = most authoritative)
        if (src < dominantSrc) dominantSrc = src;
      }
      if (v > 0) {
        sum += v;
        activeCells++;
      }
    }

    values[mIdx] = sum;
    cellCounts[mIdx] = activeCells;
    if (sensor === 'harmonized') {
      // If no cells contributed, derive source from perMonthSources
      if (dominantSrc === 255) {
        // Find from harmonization.perMonthSources
        const pmIdx = dataset.harmonization.perMonthSources.months.indexOf(months[mIdx]);
        if (pmIdx >= 0) {
          dominantSrc = dataset.harmonization.perMonthSources.source[pmIdx] as number;
        }
      }
      sources[mIdx] = dominantSrc;
    }
  }

  return { months, values, sources, cellCounts, sensor };
}

/** True for months VIIRS only partly covers (from the dataset manifest). */
export function isPartialViirsMonth(month: string): boolean {
  return getEra().partialMonths.includes(month);
}

/** True for months before Aqua data exists (Terra-only era). */
export function isTerraOnlyMonth(month: string): boolean {
  const aqua = getEra().firstAquaMonth;
  return aqua !== null && month < aqua;
}

/** True for months estimated from MODIS, i.e. before the first complete VIIRS month. */
export function isPredictedMonth(month: string): boolean {
  return month < getEra().blendStart;
}

/** Label a source code as a human-readable string */
export function sourceLabel(src: number): string {
  switch (src) {
    case 0: return 'Observed VIIRS';
    case 1: return 'Predicted (MODIS→VIIRS seasonal ratio)';
    case 2: return 'Predicted (Terra-only seasonal ratio)';
    default: return 'No data';
  }
}

