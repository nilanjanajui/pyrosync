import React, { useMemo, useState, useRef, useCallback } from 'react';
import { useAppStore } from '../../store/appStore';
import { aoiSeries, isPredictedMonth } from '../../domain/aggregate';
import { studyName } from '../../domain/study';
import { buildClimatology, median } from '../../domain/stats';
import { ImageDown } from 'lucide-react';
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

// Diverging Purple-Orange (ColorBrewer PuOr, colorblind safe) for the "compared with usual" view
const ANOMALY_STEPS = {
  muchLower: '#5e3c99',
  lower: '#b2abd2',
  usual: '#64748b',
  higher: '#fdb863',
  muchHigher: '#e66101',
};

export const BurnCalendar: React.FC = () => {
  const { dataset, selectedCellIndexes, activeMonth, setActiveMonth, dateStart, dateEnd, calendarMode, setCalendarMode } =
    useAppStore();
  const anomaly = calendarMode === 'anomaly';
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
    series.months.forEach((m) => {
      if (m >= dateStart && m <= dateEnd) ys.add(parseInt(m.split('-')[0], 10));
    });
    return Array.from(ys).sort((a, b) => b - a);
  }, [series, dateStart, dateEnd]);

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

  // Usual (median) value for each calendar month, from all years of the selected area
  const usualByMonth = useMemo(() => {
    const out = new Map<number, number>();
    if (series) buildClimatology(series.months, series.values).forEach((v, k) => out.set(k, median(v)));
    return out;
  }, [series]);

  const getColor = useCallback(
    (val: number, monthStr: string) => {
      if (isNaN(val)) return CIVIDIS_STEPS.zero;
      if (anomaly) {
        const usual = usualByMonth.get(parseInt(monthStr.split('-')[1], 10)) ?? NaN;
        if (isNaN(usual)) return CIVIDIS_STEPS.zero;
        if (usual === 0) return val === 0 ? ANOMALY_STEPS.usual : ANOMALY_STEPS.muchHigher;
        const r = val / usual;
        if (r < 0.5) return ANOMALY_STEPS.muchLower;
        if (r < 0.85) return ANOMALY_STEPS.lower;
        if (r <= 1.15) return ANOMALY_STEPS.usual;
        if (r <= 2) return ANOMALY_STEPS.higher;
        return ANOMALY_STEPS.muchHigher;
      }
      if (val <= 0) return CIVIDIS_STEPS.zero;
      if (val <= breaks.q25) return CIVIDIS_STEPS.quiet;
      if (val <= breaks.q50) return CIVIDIS_STEPS.moderate;
      if (val <= breaks.q75) return CIVIDIS_STEPS.busy;
      return CIVIDIS_STEPS.veryBusy;
    },
    [breaks, anomaly, usualByMonth]
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

  /** Draws the visible calendar to a canvas and downloads it as a PNG (no extra dependencies). */
  const saveImage = () => {
    if (!dataset || !series) return;
    const cell = 40, gap = 4, left = 70, top = 96, rowH = cell * 0.55 + gap;
    const w = left + 12 * (cell + gap) + 20;
    const h = top + years.length * rowH + 90;
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;
    const g = canvas.getContext('2d');
    if (!g) return;
    g.scale(scale, scale);
    g.fillStyle = '#0B1014';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#F0F4F8';
    g.font = 'bold 18px system-ui, sans-serif';
    g.fillText(`${studyName(dataset)}: fire hotspot detections by month`, 16, 30);
    g.font = '12px system-ui, sans-serif';
    g.fillStyle = '#8C9BAE';
    g.fillText(anomaly ? `${dateStart} to ${dateEnd}. Orange = above the usual month, purple = below. Hatched = estimated.` : `${dateStart} to ${dateEnd}. Brighter squares = more detections. Hatched = estimated.`, 16, 50);
    if (dataset.manifest.synthetic) {
      g.fillStyle = '#FCD34D';
      g.fillText('DEMO DATA: simulated, not for operational use.', 16, 68);
    }
    g.fillStyle = '#8C9BAE';
    g.font = '11px system-ui, sans-serif';
    MONTH_COLS.forEach((m, i) => g.fillText(m, left + i * (cell + gap) + 8, top - 8));
    years.forEach((yr, row) => {
      const y = top + row * rowH;
      g.fillStyle = '#8C9BAE';
      g.fillText(String(yr), 16, y + cell * 0.4);
      MONTH_COLS.forEach((_, mi) => {
        const monthStr = `${yr}-${String(mi + 1).padStart(2, '0')}`;
        const idx = monthIndexMap.get(monthStr);
        const x = left + mi * (cell + gap);
        if (idx === undefined || monthStr < dateStart || monthStr > dateEnd) {
          g.fillStyle = '#131c22';
          g.fillRect(x, y, cell, cell * 0.55);
          return;
        }
        g.fillStyle = getColor(series.values[idx], monthStr);
        g.fillRect(x, y, cell, cell * 0.55);
        if (isPredictedMonth(monthStr)) {
          g.strokeStyle = 'rgba(255,255,255,0.35)';
          g.lineWidth = 1;
          for (let k = -cell; k < cell; k += 6) {
            g.beginPath();
            g.moveTo(x + k, y + cell * 0.55);
            g.lineTo(x + k + cell * 0.55, y);
            g.stroke();
          }
        }
      });
    });
    const ly = top + years.length * rowH + 24;
    const items: [string, string][] = anomaly
      ? [
          [ANOMALY_STEPS.muchLower, copy.calendar.anomalyMuchLower],
          [ANOMALY_STEPS.lower, copy.calendar.anomalyLower],
          [ANOMALY_STEPS.usual, copy.calendar.anomalyUsual],
          [ANOMALY_STEPS.higher, copy.calendar.anomalyHigher],
          [ANOMALY_STEPS.muchHigher, copy.calendar.anomalyMuchHigher],
        ]
      : [
          [CIVIDIS_STEPS.quiet, `${copy.calendar.legendQuiet} (up to ${breaks.q25})`],
          [CIVIDIS_STEPS.moderate, `${copy.calendar.legendModerate} (${breaks.q25 + 1} to ${breaks.q50})`],
          [CIVIDIS_STEPS.busy, `${copy.calendar.legendBusy} (${breaks.q50 + 1} to ${breaks.q75})`],
          [CIVIDIS_STEPS.veryBusy, `${copy.calendar.legendVeryBusy} (${breaks.q75 + 1}+)`],
        ];
    g.font = '12px system-ui, sans-serif';
    items.forEach(([c, label], i) => {
      const x = 16 + (i % 2) * 230;
      const y = ly + Math.floor(i / 2) * 22;
      g.fillStyle = c;
      g.fillRect(x, y - 10, 14, 14);
      g.fillStyle = '#F0F4F8';
      g.fillText(label, x + 22, y + 1);
    });
    g.fillStyle = '#5A6B7C';
    g.fillText('Counts are satellite detections, not fires or burned area. Source: NASA FIRMS archive, PyroSync.', 16, h - 12);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pyrosync_calendar_${dateStart}_to_${dateEnd}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  return (
    <div className="bg-app-surface1 rounded-xl border border-app-border p-4 flex flex-col font-sans">
      {/* Title */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight">{copy.calendar.title}</h3>
          <p className="mt-0.5 text-xs text-app-textMuted">{anomaly ? copy.calendar.anomalySubtitle : copy.calendar.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={saveImage}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg border border-app-border bg-app-surface2 px-2.5 text-xs font-medium text-gray-200 hover:bg-app-elevated focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <ImageDown className="h-4 w-4 text-amber-400" aria-hidden="true" />
          <span className="hidden sm:inline">{copy.download.imageButton}</span>
          <span className="sm:hidden">PNG</span>
        </button>
      </div>

      {/* Quantile Breaks Legend with Real Counts */}
      <div role="group" aria-label="Calendar view" className="mb-3 inline-flex self-start rounded-lg border border-app-border bg-app-surface2 p-0.5">
        {([['counts', copy.calendar.modeCounts], ['anomaly', copy.calendar.modeAnomaly]] as const).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            aria-pressed={calendarMode === mode}
            onClick={() => setCalendarMode(mode)}
            className={`min-h-[36px] rounded-md px-3 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 ${
              calendarMode === mode ? 'bg-amber-500 text-black' : 'text-gray-300 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-app-border/80 bg-app-surface2/60 p-2.5 text-xs text-app-textMuted">
        {(anomaly
          ? [
              [ANOMALY_STEPS.muchLower, copy.calendar.anomalyMuchLower, ''],
              [ANOMALY_STEPS.lower, copy.calendar.anomalyLower, ''],
              [ANOMALY_STEPS.usual, copy.calendar.anomalyUsual, ''],
              [ANOMALY_STEPS.higher, copy.calendar.anomalyHigher, ''],
              [ANOMALY_STEPS.muchHigher, copy.calendar.anomalyMuchHigher, ''],
            ]
          : [
              [CIVIDIS_STEPS.quiet, copy.calendar.legendQuiet, `≤${breaks.q25}`],
              [CIVIDIS_STEPS.moderate, copy.calendar.legendModerate, `${breaks.q25 + 1}–${breaks.q50}`],
              [CIVIDIS_STEPS.busy, copy.calendar.legendBusy, `${breaks.q50 + 1}–${breaks.q75}`],
              [CIVIDIS_STEPS.veryBusy, copy.calendar.legendVeryBusy, `${breaks.q75 + 1}+`],
            ]
        ).map(([color, label, range]) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded-sm border border-black/30" style={{ backgroundColor: color }} />
            <span>
              {label} {range && <span className="tabular-nums text-app-textSubdued">({range})</span>}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 border-l border-app-border pl-3">
          <span className="h-3.5 w-3.5 rounded-sm border border-slate-600 bg-slate-800 bg-hatched" />
          <span>{copy.calendar.legendEstimated}</span>
        </div>
      </div>

      {/* Year × Month ARIA Grid */}
      <div
        ref={gridRef}
        role="grid"
        aria-label={`Burn activity calendar (${dateStart} to ${dateEnd})`}
        className="overflow-x-auto select-none pr-1"
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
                  className={`text-xs pl-1 tabular-nums ${
                    activeMonth?.startsWith(yr.toString()) ? 'text-amber-400 font-bold' : 'text-app-textSubdued'
                  }`}
                >
                  {yr}
                </div>

                {MONTH_COLS.map((_, mIdx) => {
                  const monStr = String(mIdx + 1).padStart(2, '0');
                  const monthStr = `${yr}-${monStr}`;
                  const idx = monthIndexMap.get(monthStr);

                  if (idx === undefined || monthStr < dateStart || monthStr > dateEnd) {
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
                  const bg = getColor(val, monthStr);

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
            <span className="text-[10px] tabular-nums text-app-textMuted">
              {isPredictedMonth(hoveredCell.month) ? 'Estimated' : 'Measured'}
            </span>
          </div>
          <div className="flex items-center justify-between tabular-nums">
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
