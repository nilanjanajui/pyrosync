/**
 * BurnCalendar — Primary Temporal Visualization & History Matrix
 * Follows the WAI-ARIA Grid design pattern with full keyboard navigation.
 *
 * Visual Provenance Grammar (Non-Color Dependent):
 *  - Observed VIIRS: Solid fill
 *  - Predicted MODIS → VIIRS: Solid fill + 45° diagonal hatch overlay (bg-hatched)
 *  - Terra-only era (pre-Aqua, 2000-11 to 2002-06): Dashed border
 *  - Partial month (Jan 2012): Dedicated corner indicator (◐)
 *  - Blend boundary: Prominent vertical divider line between Jan 2012 and Feb 2012
 *  - Missing/unavailable: Muted dark tone + opposite hatch (bg-missing-hatched)
 */
import React, { useRef, useCallback, useMemo, useState } from 'react';
import { CIVIDIS, PUOR_DIVERGING } from '../../config/colors';
import { useAppStore } from '../../store/appStore';
import {
  aoiSeries,
  isPredictedMonth,
  isTerraOnlyMonth,
  isPartialViirsMonth,
  sourceLabel,
} from '../../domain/aggregate';
import { buildClimatology, median, ratioToMedian } from '../../domain/stats';
import { Calendar, HelpCircle } from 'lucide-react';

const MONTH_LABELS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const BLEND_BOUNDARY_MONTH = '2012-02';

interface CalendarCellInfo {
  month: string;        // YYYY-MM
  year: number;
  calMon: number;
  value: number;        // NaN = null / unoperated
  source: number;       // 0=observed_viirs, 1=predicted, 2=terra_only, 255=no_data
  isPartialViirs: boolean;
  isTerraOnly: boolean;
  isPredicted: boolean;
  isBlendBoundary: boolean;
}

function getCividisFill(val: number, max: number): string {
  if (max <= 0 || isNaN(val) || val <= 0) return '#11181E'; // Neutral dark cell
  const t = Math.min(val / max, 1);
  const idx = Math.round(t * (CIVIDIS.length - 1));
  return CIVIDIS[idx];
}

function getPuOrFill(ratio: number): string {
  if (isNaN(ratio)) return '#11181E'; // Neutral dark cell
  // Ratio 1.0 = neutral/median; >1 = orange; <1 = purple
  const delta = Math.max(-1, Math.min(1, ratio - 1));
  const t = (delta + 1) / 2;
  const idx = Math.round(t * (PUOR_DIVERGING.length - 1));
  return PUOR_DIVERGING[idx];
}

export const BurnCalendar: React.FC = () => {
  const {
    dataset,
    selectedCellIndexes,
    sensorMode,
    calendarMode,
    setCalendarMode,
    activeMonth,
    setActiveMonth,
    setIsHarmonizationModalOpen,
  } = useAppStore();

  const [hoveredCell, setHoveredCell] = useState<CalendarCellInfo | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef<{ row: number; col: number }>({ row: 0, col: 0 });

  // Compute aggregated time series for selected cells
  const series = useMemo(
    () => (dataset ? aoiSeries(dataset, selectedCellIndexes, sensorMode) : null),
    [dataset, selectedCellIndexes, sensorMode]
  );

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

  const maxValue = useMemo(() => {
    if (!series) return 0;
    let max = 0;
    for (let i = 0; i < series.values.length; i++) {
      if (!isNaN(series.values[i]) && series.values[i] > max) max = series.values[i];
    }
    return max;
  }, [series]);

  const climatology = useMemo(
    () => (series ? buildClimatology(series.months, series.values) : new Map<number, number[]>()),
    [series]
  );

  const calMonthMedians = useMemo(() => {
    const m = new Map<number, number>();
    climatology.forEach((vals, calMon) => m.set(calMon, median(vals)));
    return m;
  }, [climatology]);

  // Build matrix data [12 months][years]
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
          year,
          calMon,
          value,
          source,
          isPartialViirs: isPartialViirsMonth(monthStr),
          isTerraOnly: isTerraOnlyMonth(monthStr),
          isPredicted: isPredictedMonth(monthStr),
          isBlendBoundary: monthStr === BLEND_BOUNDARY_MONTH,
        };
      }
    }
    return grid;
  }, [years, monthIndexMap, series]);

  // ARIA Grid keyboard navigation
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
      else if (e.key === 'Enter' || e.key === ' ') {
        const cell = cellGrid[row][col];
        if (cell) setActiveMonth(cell.month);
        e.preventDefault();
        return;
      } else {
        return;
      }
      focusedRef.current = { row: newRow, col: newCol };
      const id = `cal-cell-${newRow}-${newCol}`;
      document.getElementById(id)?.focus();
    },
    [years.length, cellGrid, setActiveMonth]
  );

  const handleCellClick = useCallback(
    (cell: CalendarCellInfo) => {
      setActiveMonth(activeMonth === cell.month ? null : cell.month);
    },
    [activeMonth, setActiveMonth]
  );

  const handleMouseEnter = (cell: CalendarCellInfo, e: React.MouseEvent<HTMLDivElement>) => {
    setHoveredCell(cell);
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
  };

  const handleMouseLeave = () => {
    setHoveredCell(null);
    setTooltipPos(null);
  };

  if (!series || !dataset || years.length === 0) return null;

  return (
    <div className="bg-app-surface1 border border-app-border rounded-xl flex flex-col overflow-hidden shadow-2xl">
      {/* Calendar Header Toolbar */}
      <div className="px-4 py-2.5 border-b border-app-border bg-app-surface1 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-app-accent" aria-hidden="true" />
          <div>
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-app-text flex items-center gap-2">
              <span>Burning Activity Calendar</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-app-surface2 border border-app-border text-app-textMuted font-normal">
                {years.length} Years ({years[0]} → {years[years.length - 1]})
              </span>
            </h2>
            <p className="text-[11px] text-app-textSubdued font-mono">
              VIIRS-equivalent active-fire detection records · 12 months × {years.length} years
            </p>
          </div>
        </div>

        {/* View Mode Toggle: [Counts] vs [Anomaly] */}
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Calendar data view" className="flex items-center gap-1 bg-app-surface2 p-0.5 rounded border border-app-border">
            <button
              onClick={() => setCalendarMode('counts')}
              aria-pressed={calendarMode === 'counts'}
              className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-all ${
                calendarMode === 'counts'
                  ? 'bg-app-accent text-white shadow-[0_0_8px_rgba(249,115,22,0.4)]'
                  : 'text-app-textMuted hover:text-app-text'
              }`}
            >
              Detection Counts
            </button>
            <button
              onClick={() => setCalendarMode('anomaly')}
              aria-pressed={calendarMode === 'anomaly'}
              className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-all ${
                calendarMode === 'anomaly'
                  ? 'bg-purple-600 text-white shadow-[0_0_8px_rgba(147,51,234,0.4)]'
                  : 'text-app-textMuted hover:text-app-text'
              }`}
            >
              vs. Historical Median
            </button>
          </div>

          <button
            onClick={() => setIsHarmonizationModalOpen(true)}
            className="p-1 rounded bg-app-surface2 hover:bg-app-elevated border border-app-border text-app-textMuted hover:text-app-accent transition-colors"
            title="How harmonization works: seasonal multipliers & validation"
          >
            <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Blend Boundary Annotation Banner */}
      <div className="px-4 py-1.5 bg-app-surface2/60 border-b border-app-border/80 flex items-center justify-between text-[11px] font-mono text-app-textMuted flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-sky-400 font-semibold">
            <span className="w-1.5 h-3 bg-sky-400 rounded-sm inline-block" />
            2012-02 Boundary:
          </span>
          <span>VIIRS begins direct on-orbit observation. Pre-2012 values are seasonal ratio models.</span>
        </div>
        <div className="flex items-center gap-2 text-app-textSubdued">
          <span>Click any cell to inspect provenance</span>
        </div>
      </div>

      {/* Calendar Matrix View (Sticky Months Column & Sticky Years Header on Horizontal Scroll) */}
      <div className="relative overflow-x-auto p-4">
        <div
          ref={gridRef}
          role="grid"
          aria-label={`Burn activity calendar matrix, ${years[0]} to ${years[years.length - 1]}`}
          aria-rowcount={13}
          aria-colcount={years.length + 1}
          className="min-w-max select-none font-mono"
        >
          {/* Header Row: Years */}
          <div role="row" className="flex items-center mb-1">
            {/* Sticky Top-Left Corner */}
            <div
              role="columnheader"
              className="sticky left-0 z-20 w-11 shrink-0 bg-app-surface1 text-right pr-2 text-[10px] font-bold text-app-textSubdued"
              aria-label="Calendar Month"
            >
              MTH
            </div>

            {/* Year Column Headers */}
            {years.map((year) => {
              const is2012 = year === 2012;
              return (
                <div
                  key={year}
                  role="columnheader"
                  className={`w-8 shrink-0 text-center text-[10px] font-semibold py-0.5 tracking-tight ${
                    is2012
                      ? 'text-sky-400 font-black border-l-2 border-sky-400/80 bg-sky-950/20'
                      : 'text-app-textSubdued'
                  }`}
                  aria-label={`Year ${year}${is2012 ? ' (VIIRS blend start)' : ''}`}
                >
                  {String(year).slice(2)}
                </div>
              );
            })}
          </div>

          {/* 12 Rows: Months */}
          {MONTH_LABELS.map((monthName, rowIdx) => {
            const calMon = rowIdx + 1;
            const histMedian = calMonthMedians.get(calMon) ?? NaN;

            return (
              <div
                key={monthName}
                role="row"
                aria-rowindex={rowIdx + 2}
                className="flex items-center mb-1 group"
              >
                {/* Sticky Left Column: Month Name */}
                <div
                  role="rowheader"
                  className="sticky left-0 z-20 w-11 shrink-0 bg-app-surface1 text-right pr-2 text-xs font-bold text-app-textMuted group-hover:text-app-text transition-colors"
                >
                  {monthName}
                </div>

                {/* Data Cells */}
                {years.map((year, colIdx) => {
                  const cell = cellGrid[rowIdx][colIdx];
                  if (!cell) {
                    return (
                      <div
                        key={year}
                        role="gridcell"
                        aria-colindex={colIdx + 2}
                        className="w-8 h-7 shrink-0"
                      />
                    );
                  }

                  const isSelected = activeMonth === cell.month;
                  const isNull = isNaN(cell.value);
                  const isZero = !isNull && cell.value === 0;
                  const isPred = cell.isPredicted;
                  const isTerra = cell.isTerraOnly;
                  const isPartial = cell.isPartialViirs;
                  const isBoundary = cell.isBlendBoundary;

                  // Fill color calculation
                  let bgColor = '#11181E'; // Neutral dark cell
                  let cellText = '—';
                  let ratio = NaN;

                  if (!isNull) {
                    if (calendarMode === 'counts') {
                      bgColor = isZero ? '#11181E' : getCividisFill(cell.value, maxValue);
                      cellText = cell.value >= 1000 ? `${(cell.value / 1000).toFixed(0)}k` : `${Math.round(cell.value)}`;
                    } else {
                      ratio = ratioToMedian(cell.value, histMedian);
                      bgColor = isNaN(ratio) ? '#11181E' : getPuOrFill(ratio);
                      cellText = isNaN(ratio) ? '—' : `${ratio.toFixed(1)}×`;
                    }
                  }

                  // Accessibility label
                  const accessibleLabel = [
                    `${monthName} ${year}`,
                    isNull ? 'unavailable' : `${Math.round(cell.value).toLocaleString()} detections`,
                    sourceLabel(cell.source),
                    !isNaN(ratio) ? `${ratio.toFixed(2)} times historical median` : '',
                    isPartial ? 'partial VIIRS operating month' : '',
                    isTerra ? 'Terra-only observation era' : '',
                  ]
                    .filter(Boolean)
                    .join(', ');

                  return (
                    <div
                      key={year}
                      id={`cal-cell-${rowIdx}-${colIdx}`}
                      role="gridcell"
                      aria-colindex={colIdx + 2}
                      aria-selected={isSelected}
                      aria-label={accessibleLabel}
                      tabIndex={focusedRef.current.row === rowIdx && focusedRef.current.col === colIdx ? 0 : -1}
                      onClick={() => handleCellClick(cell)}
                      onMouseEnter={(e) => handleMouseEnter(cell, e)}
                      onMouseLeave={handleMouseLeave}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
                      className={`relative w-8 h-7 shrink-0 rounded-[2px] cursor-pointer transition-all flex items-center justify-center text-[10px] font-bold font-mono focus:outline-none focus:ring-2 focus:ring-app-accent focus:z-30 ${
                        isBoundary ? 'border-l-2 border-l-sky-400' : ''
                      } ${
                        isSelected
                          ? 'ring-2 ring-white scale-110 z-20 shadow-[0_0_15px_rgba(255,255,255,0.7)]'
                          : 'border border-app-border/40 hover:border-app-borderLight hover:scale-105 hover:z-10'
                      } ${
                        isTerra ? 'border-dashed border-amber-500/80' : ''
                      }`}
                      style={{
                        backgroundColor: isNull ? '#0B1014' : bgColor,
                        color: isNull ? '#5A6B7C' : cell.value > maxValue * 0.6 ? '#000000' : '#FFFFFF',
                      }}
                    >
                      {/* Predicted Diagonal Hatch Overlay */}
                      {isPred && !isNull && (
                        <div
                          className="absolute inset-0 bg-hatched pointer-events-none rounded-[2px]"
                          aria-hidden="true"
                        />
                      )}

                      {/* Missing / Null Hatch Pattern */}
                      {isNull && (
                        <div
                          className="absolute inset-0 bg-missing-hatched pointer-events-none rounded-[2px]"
                          aria-hidden="true"
                        />
                      )}

                      {/* Jan 2012 Partial Month Corner Marker */}
                      {isPartial && (
                        <span
                          className="absolute top-0 right-0 w-2 h-2 bg-amber-400 rounded-bl text-[8px] leading-none pointer-events-none"
                          aria-hidden="true"
                          title="Partial month (Jan 2012)"
                        />
                      )}

                      {/* Minimal Visible Text */}
                      <span className="relative z-10 text-[9px] tracking-tighter opacity-90">
                        {cellText}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Tactical Hover Tooltip */}
      {hoveredCell && tooltipPos && (
        <div
          className="fixed z-50 pointer-events-none bg-app-bg/95 backdrop-blur-md border border-app-border rounded-lg p-2.5 shadow-2xl text-xs font-mono w-52 transform -translate-x-1/2 -translate-y-full"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <div className="font-bold text-app-text flex items-center justify-between">
            <span>
              {MONTH_LABELS[hoveredCell.calMon - 1]} {hoveredCell.year}
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                hoveredCell.source === 0
                  ? 'bg-sky-950 text-sky-400 border border-sky-800'
                  : hoveredCell.source === 1
                  ? 'bg-amber-950 text-amber-400 border border-amber-800'
                  : 'bg-orange-950 text-orange-400 border border-orange-800'
              }`}
            >
              {hoveredCell.source === 0 ? 'VIIRS' : hoveredCell.source === 1 ? 'PREDICTED' : 'TERRA-ONLY'}
            </span>
          </div>

          <div className="text-base font-black text-white mt-1 tabular-nums">
            {isNaN(hoveredCell.value) ? 'No record' : Math.round(hoveredCell.value).toLocaleString()}
          </div>
          <div className="text-[10px] text-app-textSubdued">
            VIIRS-equiv. detection records
          </div>

          {!isNaN(hoveredCell.value) && (
            <div className="mt-2 pt-1.5 border-t border-app-border space-y-0.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-app-textSubdued">vs Median:</span>
                <span className="text-app-text font-bold">
                  {isNaN(ratioToMedian(hoveredCell.value, calMonthMedians.get(hoveredCell.calMon) ?? 0))
                    ? '—'
                    : `${ratioToMedian(hoveredCell.value, calMonthMedians.get(hoveredCell.calMon) ?? 0).toFixed(2)}×`}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Comprehensive Scientific Legend (Section 62 of Design Spec) */}
      <div className="px-4 py-3 bg-app-surface2 border-t border-app-border flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
        {/* Quantitative Scale (Cividis or PuOr) */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] uppercase font-bold text-app-textSubdued tracking-wider">
            {calendarMode === 'counts' ? 'ACTIVITY (CIVIDIS):' : 'ANOMALY (PUOR):'}
          </span>
          {calendarMode === 'counts' ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-app-textMuted">0</span>
              <div
                className="h-2 w-28 rounded-sm border border-app-border"
                style={{
                  background: `linear-gradient(to right, ${CIVIDIS.join(', ')})`,
                }}
                aria-hidden="true"
              />
              <span className="text-[10px] text-app-textMuted">{Math.round(maxValue).toLocaleString()}+</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-purple-400">&lt; Median</span>
              <div
                className="h-2 w-28 rounded-sm border border-app-border"
                style={{
                  background: `linear-gradient(to right, ${PUOR_DIVERGING.join(', ')})`,
                }}
                aria-hidden="true"
              />
              <span className="text-[10px] text-orange-400">&gt; Median</span>
            </div>
          )}
        </div>

        {/* Provenance Visual Language Indicators */}
        <div className="flex items-center gap-3 text-[11px] text-app-textMuted flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-sky-500 rounded-[2px]" aria-hidden="true" />
            <span>Observed VIIRS</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-[#11181E] border border-app-border bg-hatched rounded-[2px]" aria-hidden="true" />
            <span>Predicted (Hatched)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 border border-dashed border-amber-500 rounded-[2px]" aria-hidden="true" />
            <span>Terra-only</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-app-bg bg-missing-hatched rounded-[2px]" aria-hidden="true" />
            <span>No data</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-3 bg-sky-400 rounded-sm" aria-hidden="true" />
            <span>Blend Boundary</span>
          </span>
        </div>
      </div>
    </div>
  );
};
