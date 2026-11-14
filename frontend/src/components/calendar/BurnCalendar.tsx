import React, { useMemo, useState, useRef, useCallback } from 'react';
import { useAppStore } from '../../store/appStore';
import { aoiSeries, isPredictedMonth } from '../../domain/aggregate';
import copy from '../../copy';

const MONTH_COLS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// 4 distinct Cividis colorblind-safe steps (WCAG compliant)
const CIVIDIS_STEPS = {
  zero: '#1e293b',      // Monitored zero detections
  quiet: '#00204d',     // Low / Quiet (Cividis dark blue)
  moderate: '#414d6b',  // Moderate (Cividis mid slate-blue)
  busy: '#8a8b79',      // Busy (Cividis muted khaki)
  veryBusy: '#ffea46',  // Very busy (Cividis bright yellow)
};

export const BurnCalendar: React.FC = () => {
  const { dataset, selectedCellIndexes, activeMonth, setActiveMonth } = useAppStore();
  const [hoveredCell, setHoveredCell] = useState<{ month: string; value: number } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);

  // Time-series for currently selected area
  const series = useMemo(
    () => (dataset ? aoiSeries(dataset, selectedCellIndexes, 'harmonized') : null),
    [dataset, selectedCellIndexes]
  );

  // Descending years (2021 down to 2000)
  const years = useMemo(() => {
    if (!series) return [];
    const ys = new Set<number>();
    series.months.forEach((m) => ys.add(parseInt(m.split('-')[0], 10)));
    return Array.from(ys).sort((a, b) => b - a);
  }, [series]);

  const monthIndexMap = useMemo(() => {
    if (!series) return new Map<string, number>();
    const map = new Map<string, number>();
    series.months.forEach((m, i) => map.set(m, i));
    return map;
  }, [series]);

  // Compute 4 plain classes from non-zero quantile breaks
  const breaks = useMemo(() => {
    if (!series) return { q25: 10, q50: 50, q75: 150 };
    const positive = Array.from(series.values)
      .filter((v) => !isNaN(v) && v > 0)
      .sort((a, b) => a - b);

    if (positive.length === 0) return { q25: 5, q50: 20, q75: 50 };

    const getP = (p: number) => positive[Math.min(positive.length - 1, Math.floor(positive.length * p))];
    const q25 = Math.max(1, Math.round(getP(0.25)));
    const q50 = Math.max(q25 + 1, Math.round(getP(0.5)));
    const q75 = Math.max(q50 + 1, Math.round(getP(0.75)));

    return { q25, q50, q75 };
  }, [series]);

  const getColor = useCallback(
    (val: number) => {
      if (isNaN(val) || val <= 0) return CIVIDIS_STEPS.zero;
      if (val <= breaks.q25) return CIVIDIS_STEPS.quiet;
      if (val <= breaks.q50) return CIVIDIS_STEPS.moderate;
      if (val <= breaks.q75) return CIVIDIS_STEPS.busy;
      return CIVIDIS_STEPS.veryBusy;
    },
    [breaks]
  );

  const handleCellClick = (monthStr: string) => {
    setActiveMonth(monthStr === activeMonth ? null : monthStr);
  };

  const handleMouseEnter = (monthStr: string, val: number, e: React.MouseEvent) => {
    setHoveredCell({ month: monthStr, value: val });
    setTooltipPos({ x: e.clientX + 12, y: e.clientY + 12 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!hoveredCell) return;
    let x = e.clientX + 12;
    let y = e.clientY + 12;
    if (x + 220 > window.innerWidth) x = e.clientX - 230;
    if (y + 80 > window.innerHeight) y = e.clientY - 90;
    setTooltipPos({ x, y });
  };

  const handleMouseLeave = () => {
    setHoveredCell(null);
    setTooltipPos(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, monthStr: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCellClick(monthStr);
    }
  };

  return (
    <div className="bg-app-surface1 rounded-xl border border-app-border p-4 flex flex-col font-sans">
      {/* Title */}
      <div className="mb-3">
        <h3 className="text-base font-bold text-white tracking-tight">
          {copy.calendar.title}
        </h3>
        <p className="text-xs text-app-textMuted mt-0.5">
          {copy.calendar.subtitle}
        </p>
      </div>

      {/* Quantile Breaks Legend with Real Counts */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs text-app-textMuted bg-app-surface2/60 p-2.5 rounded-lg border border-app-border/80">
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-sm border border-black/30" style={{ backgroundColor: CIVIDIS_STEPS.quiet }} />
          <span>{copy.calendar.legendQuiet} <span className="text-app-textSubdued font-mono">(&le;{breaks.q25})</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-sm border border-black/30" style={{ backgroundColor: CIVIDIS_STEPS.moderate }} />
          <span>{copy.calendar.legendModerate} <span className="text-app-textSubdued font-mono">({breaks.q25 + 1}–{breaks.q50})</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-sm border border-black/30" style={{ backgroundColor: CIVIDIS_STEPS.busy }} />
          <span>{copy.calendar.legendBusy} <span className="text-app-textSubdued font-mono">({breaks.q50 + 1}–{breaks.q75})</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-sm border border-black/30 text-black font-bold" style={{ backgroundColor: CIVIDIS_STEPS.veryBusy }} />
          <span>{copy.calendar.legendVeryBusy} <span className="text-app-textSubdued font-mono">({breaks.q75 + 1}+)</span></span>
        </div>
        <div className="flex items-center gap-1.5 border-l border-app-border pl-2">
          <span className="w-3.5 h-3.5 rounded-sm bg-hatched bg-slate-800 border border-slate-600" />
          <span>{copy.calendar.legendEstimated}</span>
        </div>
      </div>

      {/* Year × Month ARIA Grid */}
      <div
        ref={gridRef}
        role="grid"
        aria-label="Burn activity calendar (2000-11 to 2021-12)"
        className="overflow-x-auto select-none max-h-[380px] overflow-y-auto pr-1"
      >
        <div className="min-w-[340px]">
          {/* Header Row: Month Names */}
          <div role="row" className="grid grid-cols-[44px_repeat(12,minmax(0,1fr))] gap-1 mb-1 text-center text-xs font-semibold text-app-textSubdued">
            <div role="columnheader" className="text-left pl-1">Year</div>
            {MONTH_COLS.map((m) => (
              <div key={m} role="columnheader">{m}</div>
            ))}
          </div>

          {/* Grid Rows */}
          <div className="space-y-1">
            {years.map((yr) => (
              <div key={yr} role="row" className="grid grid-cols-[44px_repeat(12,minmax(0,1fr))] gap-1 items-center">
                <div
                  role="rowheader"
                  className={`text-xs pl-1 font-mono ${
                    activeMonth?.startsWith(yr.toString()) ? 'text-amber-400 font-bold' : 'text-app-textSubdued'
                  }`}
                >
                  {yr}
                </div>

                {MONTH_COLS.map((_, mIdx) => {
                  const monStr = String(mIdx + 1).padStart(2, '0');
                  const monthStr = `${yr}-${monStr}`;
                  const idx = monthIndexMap.get(monthStr);

                  if (idx === undefined) {
                    return (
                      <div
                        key={mIdx}
                        role="gridcell"
                        aria-disabled="true"
                        className="h-4 sm:h-[18px] w-full rounded-sm bg-[#0b1014] border border-gray-900/40 opacity-30"
                        title={copy.calendar.legendNoData}
                      />
                    );
                  }

                  const val = series?.values[idx] ?? NaN;
                  const isEstimated = isPredictedMonth(monthStr);
                  const isActive = monthStr === activeMonth;
                  const bg = getColor(val);

                  return (
                    <button
                      key={mIdx}
                      type="button"
                      role="gridcell"
                      tabIndex={isActive ? 0 : -1}
                      aria-selected={isActive}
                      aria-label={`${MONTH_COLS[mIdx]} ${yr}: ${isNaN(val) ? 0 : Math.round(val)} hotspot detections${isEstimated ? ' (estimated)' : ''}`}
                      onClick={() => handleCellClick(monthStr)}
                      onMouseEnter={(e) => handleMouseEnter(monthStr, val, e)}
                      onMouseMove={handleMouseMove}
                      onMouseLeave={handleMouseLeave}
                      onKeyDown={(e) => handleKeyDown(e, monthStr)}
                      className={`h-4 sm:h-[18px] w-full rounded-sm border border-black/40 transition-transform duration-100 hover:scale-125 hover:z-20 focus:outline-none relative ${
                        isActive
                          ? 'ring-2 ring-amber-400 shadow-[0_0_10px_rgba(249,115,22,0.8)] z-10 scale-110'
                          : ''
                      } ${isEstimated ? 'bg-hatched' : ''}`}
                      style={{ backgroundColor: bg }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredCell && tooltipPos && (
        <div
          style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
          className="fixed z-50 pointer-events-none bg-app-surface1/95 backdrop-blur-md border border-app-border rounded-lg p-2.5 shadow-2xl text-xs w-56 font-sans transition-opacity"
        >
          <div className="flex items-center justify-between border-b border-app-border pb-1 mb-1.5">
            <span className="font-bold text-white">
              {new Date(`${hoveredCell.month}-01T00:00:00Z`).toLocaleString('en-US', {
                month: 'short',
                year: 'numeric',
                timeZone: 'UTC',
              })}
            </span>
            <span className="text-[10px] font-mono text-app-textMuted">
              {isPredictedMonth(hoveredCell.month) ? 'Estimated' : 'Measured'}
            </span>
          </div>
          <div className="flex items-center justify-between font-mono">
            <span className="text-app-textMuted text-xs">Detections:</span>
            <span className="font-bold text-amber-400 text-sm">
              {isNaN(hoveredCell.value) ? 0 : Math.round(hoveredCell.value).toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default BurnCalendar;
