/**
 * Statistical helpers for the burn calendar.
 * Uses mid-rank percentile and strict median (never fabricated).
 * All values are VIIRS-equivalent active-fire detection records.
 */

/**
 * Compute the median of an array, ignoring NaN values.
 * Returns NaN if no valid values.
 */
export function median(values: number[]): number {
  const valid = values.filter((v) => !isNaN(v)).sort((a, b) => a - b);
  if (valid.length === 0) return NaN;
  const mid = Math.floor(valid.length / 2);
  if (valid.length % 2 === 1) return valid[mid];
  return (valid[mid - 1] + valid[mid]) / 2;
}

/**
 * Ratio of a value to the historical median for the same calendar month.
 * Returns NaN if median is 0 or if either is NaN.
 * When median is 0, ratio is undefined — show "—" in UI, not "∞".
 */
export function ratioToMedian(value: number, med: number): number {
  if (isNaN(value) || isNaN(med) || med === 0) return NaN;
  return value / med;
}

/**
 * Mid-rank percentile of a value within an array (ignoring NaN).
 * Returns [0, 1]. Returns NaN if fewer than 2 valid references.
 */
export function midRankPercentile(value: number, referenceValues: number[]): number {
  const valid = referenceValues.filter((v) => !isNaN(v));
  if (isNaN(value) || valid.length < 2) return NaN;
  const below = valid.filter((v) => v < value).length;
  const equal = valid.filter((v) => v === value).length;
  // mid-rank: (below + 0.5 * equal) / total
  return (below + 0.5 * equal) / valid.length;
}

/** Rank (1 = highest) of a value within an array (ignoring NaN). */
export function rankDescending(value: number, allValues: number[]): number {
  const valid = allValues.filter((v) => !isNaN(v));
  const above = valid.filter((v) => v > value).length;
  return above + 1;
}

export const UNUSUAL_HIGH_PERCENTILE = 0.9;
export const UNUSUAL_LOW_PERCENTILE = 0.1;
export const MIN_REFERENCE_YEARS = 5;

export type AnomalyFlag = 'unusual_high' | 'unusual_low' | 'normal' | 'insufficient_data';

/**
 * Flag a monthly value as unusually high/low relative to same-calendar-month history.
 */
export function unusualFlag(
  value: number,
  referenceValues: number[]
): AnomalyFlag {
  const valid = referenceValues.filter((v) => !isNaN(v));
  if (isNaN(value) || valid.length < MIN_REFERENCE_YEARS) return 'insufficient_data';
  const pct = midRankPercentile(value, valid);
  if (pct >= UNUSUAL_HIGH_PERCENTILE) return 'unusual_high';
  if (pct <= UNUSUAL_LOW_PERCENTILE) return 'unusual_low';
  return 'normal';
}

/**
 * Build a climatology: for each calendar month (1–12),
 * collect all values from across years (from a MonthlySeries' values + months arrays).
 */
export function buildClimatology(
  months: string[],
  values: Float64Array
): Map<number, number[]> {
  const byCalMonth = new Map<number, number[]>();
  for (let i = 0; i < months.length; i++) {
    const calMonth = parseInt(months[i].split('-')[1], 10);
    if (!byCalMonth.has(calMonth)) byCalMonth.set(calMonth, []);
    byCalMonth.get(calMonth)!.push(values[i]);
  }
  return byCalMonth;
}

/** Compute annual totals from a monthly series. Returns Map<year, total>. */
export function annualTotals(months: string[], values: Float64Array): Map<number, number> {
  const byYear = new Map<number, number>();
  for (let i = 0; i < months.length; i++) {
    const year = parseInt(months[i].split('-')[0], 10);
    if (isNaN(values[i])) continue;
    byYear.set(year, (byYear.get(year) ?? 0) + values[i]);
  }
  return byYear;
}

