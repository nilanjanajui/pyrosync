/**
 * BurnCalendar — ARIA grid calendar showing harmonized fire detection counts.
 * Rows = calendar months (Jan–Dec), Columns = years (2000–2021).
 * Features:
 *  - Cividis sequential fill for counts (colorblind-safe)
 *  - Observed vs predicted visually distinct: predicted uses hatched overlay
 *  - Terra-only era labeled
 *  - 2012-01 partial month labeled
 *  - 2012-02 blend boundary marker
 *  - No-data null cells hatched differently
 *  - Keyboard arrow-key navigation (ARIA grid pattern)
 *  - PuOr anomaly view toggle
 */
import React, { useRef, useCallback, useMemo } from 'react';
import { CIVIDIS, PUOR_DIVERGING } from '../../config/colors';
import { useAppStore } from '../../store/appStore';
import { aoiSeries, isPredictedMonth, isTerraOnlyMonth, isPartialViirsMonth, sourceLabel } from '../../domain/aggregate';
import { buildClimatology, median, ratioToMedian, unusualFlag } from '../../domain/stats';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BLEND_START = '2012-02';

type ViewMode = 'counts' | 'anomaly';

interface CalendarCellInfo {
  month: string;        // YYYY-MM
  value: number;        // NaN = null/no-data
  source: number;       // 0,1,2,255
  isPartialViirs: boolean;
  isTerraOnly: boolean;
  isPredicted: boolean;
  isBlendBoundary: boolean;
}

function cividisFill(value: number, max: number): string {
  if (max <= 0 || isNaN(value) || value <= 0) return 'transparent';
  const t = Math.min(value / max, 1);
  const idx = Math.round(t * (CIVIDIS.length - 1));
  return CIVIDIS[idx];
}

function anomalyFill(ratio: number): string {
  if (isNaN(ratio)) return 'transparent';
  // Map ratio to -1..+1 for PuOr: 1.0 = neutral, >1 = warm, <1 = cool
  const delta = Math.max(-1, Math.min(1, ratio - 1)); // clamp
  const t = (delta + 1) / 2; // 0..1
  const idx = Math.round(t * (PUOR_DIVERGING.length - 1));
  return PUOR_DIVERGING[idx];
}

interface BurnCalendarProps {
  initialViewMode?: ViewMode;
}

export const BurnCalendar: React.FC<BurnCalendarProps> = ({ initialViewMode = 'counts' }) => {
  const { dataset, selectedCellIndexes, sensorMode, activeMonth, setActiveMonth } = useAppStore();
  const [viewMode, setViewMode] = React.useState<ViewMode>(initialViewMode);
  const gridRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef<{ row: number; col: number }>({ row: 0, col: 0 });

  // Compute series for selected cells (safe even when dataset is null)
  const series = useMemo(
    () => dataset ? aoiSeries(dataset, selectedCellIndexes, sensorMode) : null,
    [dataset, selectedCellIndexes, sensorMode]
  );

  // Build year/month grid structure
  const years = useMemo(() => {
    if (!series) return [] as number[];
    const ys = new Set<number>();
    series.months.forEach((m) => ys.add(parseInt(m.split('-')[0], 10)));
    return Array.from(ys).sort((a, b) => a - b);
  }, [series]);

  const monthIndexMap = useMemo(() => {
    if (!series) return new Map<string, number>();
    const map = new Map<string, number>();
    series.months.forEach((m, i) => map.set(m, i));
    return map;
  }, [series]);

  // Compute max value for Cividis scale
  const maxValue = useMemo(() => {
    if (!series) return 0;
    let max = 0;
    for (let i = 0; i < series.values.length; i++) {
      if (!isNaN(series.values[i]) && series.values[i] > max) max = series.values[i];
    }
    return max;
  }, [series]);

  // Build climatology for anomaly view
  const climatology = useMemo(
    () => series ? buildClimatology(series.months, series.values) : new Map<number, number[]>(),
    [series]
  );
  const calMonthMedians = useMemo(() => {
    const m = new Map<number, number>();
    climatology.forEach((vals, calMon) => m.set(calMon, median(vals)));
    return m;
  }, [climatology]);

  // Build cell info for each grid position [calMonth 1-12][year]
  const cellGrid = useMemo((): (CalendarCellInfo | null)[][] => {
    const grid: (CalendarCellInfo | null)[][] = Array.from({ length: 12 }, () =>
      Array(years.length).fill(null)
    );
    if (!series) return grid;
    for (let calMon = 1; calMon <= 12; calMon++) {
      for (let yi = 0; yi < years.length; yi++) {
        const year = years[yi];
        const monthStr = `${year}-${String(calMon).padStart(2, '0')}`;
        const idx = monthIndexMap.get(monthStr);
        if (idx === undefined) continue;
        const value = series.values[idx];
        const source = series.sources[idx];
        grid[calMon - 1][yi] = {
          month: monthStr,
          value,
          source,
          isPartialViirs: isPartialViirsMonth(monthStr),
          isTerraOnly: isTerraOnlyMonth(monthStr),
          isPredicted: isPredictedMonth(monthStr),
          isBlendBoundary: monthStr === BLEND_START,
        };
      }
    }
    return grid;
  }, [years, monthIndexMap, series]);

  // Keyboard navigation handler (ARIA grid pattern)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, row: number, col: number) => {
      let newRow = row;
      let newCol = col;
      if (e.key === 'ArrowDown') { newRow = Math.min(row + 1, 11); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { newRow = Math.max(row - 1, 0); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { newCol = Math.min(col + 1, years.length - 1); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { newCol = Math.max(col - 1, 0); e.preventDefault(); }
      else if (e.key === 'Home') { newCol = 0; e.preventDefault(); }
      else if (e.key === 'End') { newCol = years.length - 1; e.preventDefault(); }
      else { return; }
      focusedRef.current = { row: newRow, col: newCol };
      const id = `cal-cell-${newRow}-${newCol}`;
      document.getElementById(id)?.focus();
    },
    [years.length]
  );

  const handleCellClick = useCallback(
    (cell: CalendarCellInfo) => {
      setActiveMonth(activeMonth === cell.month ? null : cell.month);
    },
    [activeMonth, setActiveMonth]
  );

  // Guard after all hooks
  if (!series || !dataset || years.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-200">
          Burn Activity Calendar
          <span className="ml-2 text-xs font-normal text-slate-400">
            ({sensorMode === 'harmonized' ? 'Harmonized' : sensorMode.toUpperCase()} · VIIRS-equivalent detection records)
          </span>
        </h3>
        {/* View toggle */}
        <div role="group" aria-label="Calendar view mode" className="flex gap-1">
          {(['counts', 'anomaly'] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              aria-pressed={viewMode === v}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                viewMode === v
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {v === 'counts' ? 'Counts' : 'vs. Median'}
            </button>
          ))}
        </div>
      </div>

      {/* Era legend */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-sky-500/70 inline-block" aria-hidden="true" />
          Observed VIIRS
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-hatched inline-block border border-slate-600" aria-hidden="true" />
          Predicted (MODIS→VIIRS)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm border border-dashed border-amber-500 inline-block" aria-hidden="true" />
          Terra-only era
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-slate-700 inline-block" aria-hidden="true" />
          No detection record
        </span>
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto">
        <div
          ref={gridRef}
          role="grid"
          aria-label={`Burn activity calendar, ${years[0]}–${years[years.length - 1]}, ${sensorMode} sensor mode`}
          aria-rowcount={13}
          aria-colcount={years.length + 1}
          className="min-w-max"
        >
          {/* Column header row */}
          <div role="row" className="flex">
            <div
              role="columnheader"
              className="w-10 shrink-0 text-xs text-slate-500 text-center py-1"
              aria-label="Month"
            />
            {years.map((year) => (
              <div
                key={year}
                role="columnheader"
                className={`w-7 shrink-0 text-center text-xs font-medium py-1 ${
                  year === 2012
                    ? 'text-sky-400 font-bold'
                    : 'text-slate-500'
                }`}
                aria-label={`Year ${year}${year === 2012 ? ' — VIIRS blend start' : ''}`}
              >
                {year % 5 === 0 || year === years[0] || year === 2012
                  ? String(year).slice(2)
                  : ''}
              </div>
            ))}
          </div>

          {/* Data rows — one per calendar month */}
          {MONTH_LABELS.map((label, calMonIdx) => {
            const calMon = calMonIdx + 1;
            const calMonMedian = calMonthMedians.get(calMon) ?? NaN;
            return (
              <div key={calMon} role="row" aria-rowindex={calMonIdx + 2} className="flex items-center">
                {/* Row header */}
                <div
                  role="rowheader"
                  className="w-10 shrink-0 text-xs text-slate-400 text-right pr-1.5 py-0.5"
                >
                  {label}
                </div>

                {/* Data cells */}
                {years.map((year, yi) => {
                  const cell = cellGrid[calMonIdx][yi];
                  if (!cell) {
                    return (
                      <div
                        key={year}
                        role="gridcell"
                        aria-colindex={yi + 2}
                        className="w-7 h-6 shrink-0"
                      />
                    );
                  }

                  const isActive = activeMonth === cell.month;
                  const isNull = isNaN(cell.value);
                  const isZero = !isNull && cell.value === 0;
                  const isPred = cell.isPredicted;
                  const isTerraOnly = cell.isTerraOnly;
                  const isPartial = cell.isPartialViirs;
                  const isBlendBdry = cell.isBlendBoundary;

                  // Fill color
                  let fillColor = 'transparent';
                  let borderClass = 'border border-slate-800/50';
                  if (!isNull) {
                    if (viewMode === 'counts') {
                      fillColor = isZero ? '' : cividisFill(cell.value, maxValue);
                    } else {
                      const ratio = ratioToMedian(cell.value, calMonMedian);
                      fillColor = isNaN(ratio) ? '' : anomalyFill(ratio);
                    }
                  }

                  if (isActive) borderClass = 'border-2 border-orange-400';
                  if (isBlendBdry) borderClass = 'border-l-2 border-l-sky-400 border-t border-b border-r border-slate-700';

                  // Pattern overlay classes
                  const overlayClass = isPred
                    ? isTerraOnly
                      ? 'ring-1 ring-inset ring-amber-500/40 ring-dashed'
                      : 'bg-hatched opacity-80'
                    : '';

                  // Anomaly flag for aria
                  const flag = viewMode === 'anomaly' && !isNull
                    ? unusualFlag(cell.value, Array.from(climatology.get(calMon) ?? []))
                    : 'normal';

                  const cellLabel = [
                    `${label} ${year}`,
                    isNull ? 'no data' : `${Math.round(cell.value).toLocaleString()} detections`,
                    sourceLabel(cell.source),
                    isPartial ? '— partial month (VIIRS not fully operational)' : '',
                    isTerraOnly ? '— Terra-only era' : '',
                    flag === 'unusual_high' ? '— unusually high' : '',
                    flag === 'unusual_low' ? '— unusually low' : '',
                  ].filter(Boolean).join(', ');

                  return (
                    <div
                      key={year}
                      id={`cal-cell-${calMonIdx}-${yi}`}
                      role="gridcell"
                      aria-colindex={yi + 2}
                      aria-selected={isActive}
                      aria-label={cellLabel}
                      tabIndex={focusedRef.current.row === calMonIdx && focusedRef.current.col === yi ? 0 : -1}
                      onClick={() => handleCellClick(cell)}
                      onKeyDown={(e) => handleKeyDown(e, calMonIdx, yi)}
                      onFocus={() => { focusedRef.current = { row: calMonIdx, col: yi }; }}
                      className={`w-7 h-6 shrink-0 rounded-sm cursor-pointer transition-all relative overflow-hidden ${borderClass} ${overlayClass} focus:outline-none focus:ring-2 focus:ring-orange-400 focus:z-10`}
                      style={{
                        backgroundColor: isNull ? undefined : fillColor || undefined,
                      }}
                    >
                      {isNull && (
                        <div
                          className="absolute inset-0 bg-hatched opacity-30"
                          aria-hidden="true"
                        />
                      )}
                      {isPartial && (
                        <div
                          className="absolute top-0 right-0 w-1.5 h-1.5 bg-amber-400 rounded-bl"
                          aria-hidden="true"
                          title="Partial VIIRS month"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Color scale */}
      <div className="flex items-center gap-2 mt-1">
        {viewMode === 'counts' ? (
          <>
            <span className="text-xs text-slate-500">0</span>
            <div
              className="h-2 flex-1 rounded"
              style={{
                background: `linear-gradient(to right, ${CIVIDIS[0]}, ${CIVIDIS[Math.floor(CIVIDIS.length / 2)]}, ${CIVIDIS[CIVIDIS.length - 1]})`,
              }}
              aria-label={`Cividis color scale from 0 to ${Math.round(maxValue).toLocaleString()} detections`}
            />
            <span className="text-xs text-slate-500">{Math.round(maxValue).toLocaleString()}</span>
            <span className="text-xs text-slate-500 ml-1">(Cividis, colorblind-safe)</span>
          </>
        ) : (
          <>
            <span className="text-xs text-slate-500">Below median</span>
            <div
              className="h-2 flex-1 rounded"
              style={{
                background: `linear-gradient(to right, ${PUOR_DIVERGING[0]}, ${PUOR_DIVERGING[Math.floor(PUOR_DIVERGING.length / 2)]}, ${PUOR_DIVERGING[PUOR_DIVERGING.length - 1]})`,
              }}
              aria-label="PuOr diverging scale: purple = below median, white = at median, orange = above median"
            />
            <span className="text-xs text-slate-500">Above median</span>
            <span className="text-xs text-slate-500 ml-1">(PuOr diverging, colorblind-safe)</span>
          </>
        )}
      </div>

      {/* Blend boundary note */}
      <p className="text-xs text-slate-500">
        <span className="text-sky-400 font-medium">Blue left border</span> marks 2012-02 — VIIRS blend start.
        Values before that date are VIIRS-equivalent predictions from MODIS;
        they cannot be validated against observed VIIRS.
      </p>
    </div>
  );
};
