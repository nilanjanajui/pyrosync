import React, { useRef, useCallback, useMemo, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import {
  aoiSeries,
  isPredictedMonth,
  isTerraOnlyMonth,
  isPartialViirsMonth,
} from '../../domain/aggregate';
import { buildClimatology, median } from '../../domain/stats';
import { CalendarDays, HelpCircle } from 'lucide-react';

const MONTH_LABELS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface CalendarCellInfo {
  month: string; // YYYY-MM
  year: number;
  calMon: number; // 1-12
  value: number; // NaN = null / unoperated
  modisValue: number;
  viirsValue: number | null;
  medianValue: number;
  anomalyPct: number;
  source: number; // 0=observed_viirs, 1=predicted, 2=terra_only, 255=no_data
  isPartialViirs: boolean;
  isTerraOnly: boolean;
  isPredicted: boolean;
  isBlendBoundary: boolean;
}

type PaletteMode = 'thermal' | 'viridis';

function getCellColor(value: number, maxVal: number, palette: PaletteMode): string {
  if (isNaN(value) || value <= 0) return '#111827';
  const ratio = Math.max(0, Math.min(1, value / Math.max(1, maxVal)));

  if (palette === 'viridis') {
    if (ratio < 0.15) return '#1e1b4b';
    if (ratio < 0.30) return '#312e81';
    if (ratio < 0.45) return '#0f766e';
    if (ratio < 0.62) return '#059669';
    if (ratio < 0.80) return '#84cc16';
    return '#fde047';
  } else {
    // Thermal
    if (ratio < 0.15) return '#181e2c';
    if (ratio < 0.30) return '#451a03';
    if (ratio < 0.48) return '#9a3412';
    if (ratio < 0.66) return '#ea580c';
    if (ratio < 0.84) return '#dc2626';
    return '#fbbf24';
  }
}

export const BurnCalendar: React.FC = () => {
  const {
    dataset,
    selectedCellIndexes,
    activeMonth,
    setActiveMonth,
    setIsHarmonizationModalOpen,
  } = useAppStore();

  const [palette, setPalette] = useState<PaletteMode>('thermal');
  const [hoveredCell, setHoveredCell] = useState<CalendarCellInfo | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);

  // Compute time-series for all three sensors
  const harmSeries = useMemo(
    () => (dataset ? aoiSeries(dataset, selectedCellIndexes, 'harmonized') : null),
    [dataset, selectedCellIndexes]
  );
  const modisSeries = useMemo(
    () => (dataset ? aoiSeries(dataset, selectedCellIndexes, 'modis') : null),
    [dataset, selectedCellIndexes]
  );
  const viirsSeries = useMemo(
    () => (dataset ? aoiSeries(dataset, selectedCellIndexes, 'viirs') : null),
    [dataset, selectedCellIndexes]
  );

  // Years in descending order (2021 down to 2000)
  const yearsDesc = useMemo(() => {
    if (!harmSeries) return [];
    const ys = new Set<number>();
    harmSeries.months.forEach((m) => ys.add(parseInt(m.split('-')[0], 10)));
    return Array.from(ys).sort((a, b) => b - a);
  }, [harmSeries]);

  const monthIndexMap = useMemo(() => {
    if (!harmSeries) return new Map<string, number>();
    const map = new Map<string, number>();
    harmSeries.months.forEach((m, i) => map.set(m, i));
    return map;
  }, [harmSeries]);

  const maxValue = useMemo(() => {
    if (!harmSeries) return 1;
    let max = 1;
    for (let i = 0; i < harmSeries.values.length; i++) {
      if (!isNaN(harmSeries.values[i]) && harmSeries.values[i] > max) {
        max = harmSeries.values[i];
      }
    }
    return max;
  }, [harmSeries]);

  const climatology = useMemo(
    () => (harmSeries ? buildClimatology(harmSeries.months, harmSeries.values) : new Map<number, number[]>()),
    [harmSeries]
  );

  const calMonthMedians = useMemo(() => {
    const m = new Map<number, number>();
    climatology.forEach((vals, calMon) => m.set(calMon, median(vals)));
    return m;
  }, [climatology]);

  // Build matrix data: Map<year, Map<calMon, CalendarCellInfo>>
  const calendarData = useMemo(() => {
    const map = new Map<number, (CalendarCellInfo | null)[]>();
    if (!harmSeries || !modisSeries || !viirsSeries) return map;

    yearsDesc.forEach((year) => {
      const row: (CalendarCellInfo | null)[] = [];
      for (let calMon = 1; calMon <= 12; calMon++) {
        const monthStr = `${year}-${String(calMon).padStart(2, '0')}`;
        const idx = monthIndexMap.get(monthStr);

        if (idx === undefined) {
          row.push(null);
          continue;
        }

        const value = harmSeries.values[idx];
        const modisValue = Math.round(modisSeries.values[idx] || 0);
        const viirsVal = viirsSeries.values[idx];
        const viirsValue = isNaN(viirsVal) ? null : Math.round(viirsVal);
        const source = harmSeries.sources[idx];
        const med = Math.round(calMonthMedians.get(calMon) || 1);
        const anomalyPct = med > 0 ? +(((value - med) / med) * 100).toFixed(1) : 0;

        row.push({
          month: monthStr,
          year,
          calMon,
          value,
          modisValue,
          viirsValue,
          medianValue: med,
          anomalyPct,
          source,
          isPartialViirs: isPartialViirsMonth(monthStr),
          isTerraOnly: isTerraOnlyMonth(monthStr),
          isPredicted: isPredictedMonth(monthStr),
          isBlendBoundary: monthStr === '2012-02',
        });
      }
      map.set(year, row);
    });

    return map;
  }, [yearsDesc, harmSeries, modisSeries, viirsSeries, monthIndexMap, calMonthMedians]);

  const handleCellClick = useCallback(
    (cell: CalendarCellInfo | null) => {
      if (!cell || isNaN(cell.value)) return;
      setActiveMonth(cell.month === activeMonth ? null : cell.month);
    },
    [activeMonth, setActiveMonth]
  );

  const handleMouseEnter = (cell: CalendarCellInfo | null, e: React.MouseEvent) => {
    if (!cell) return;
    setHoveredCell(cell);
    setTooltipPos({ x: e.clientX + 14, y: e.clientY + 14 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!hoveredCell) return;
    let x = e.clientX + 14;
    let y = e.clientY + 14;
    if (x + 260 > window.innerWidth) x = e.clientX - 270;
    if (y + 150 > window.innerHeight) y = e.clientY - 160;
    setTooltipPos({ x, y });
  };

  const handleMouseLeave = () => {
    setHoveredCell(null);
    setTooltipPos(null);
  };

  // Keyboard navigation for WAI-ARIA grid
  const handleKeyDown = (e: React.KeyboardEvent, cell: CalendarCellInfo | null) => {
    if (!cell) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCellClick(cell);
    }
  };

  const paletteSwatches = palette === 'viridis'
    ? ['#1e1b4b', '#312e81', '#0f766e', '#059669', '#84cc16', '#fde047']
    : ['#181e2c', '#451a03', '#9a3412', '#ea580c', '#dc2626', '#fbbf24'];

  return (
    <div className="bg-app-surface1 rounded-2xl border border-app-border p-4 sm:p-5 flex flex-col shadow-xl h-full font-mono relative">
      {/* Calendar Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-app-border">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-amber-400" />
            <h2 className="text-base font-bold text-white font-mono">
              Harmonized Burning Activity Calendar
            </h2>
          </div>
          <p className="text-xs text-app-textMuted mt-1 font-mono">
            Click any Year &times; Month cell (2000–2021) to inspect spatial fire hotspots &amp; anomalies.
          </p>
        </div>

        {/* Accessible Color Ramp Selector */}
        <div className="flex items-center gap-1.5 bg-app-surface2 p-1 rounded-xl border border-app-border text-xs">
          <span className="text-[11px] text-app-textSubdued pl-2 pr-1">Palette:</span>
          <button
            onClick={() => setPalette('thermal')}
            className={`px-2.5 py-1 rounded-lg font-medium transition ${
              palette === 'thermal'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Thermal
          </button>
          <button
            onClick={() => setPalette('viridis')}
            className={`px-2.5 py-1 rounded-lg font-medium transition ${
              palette === 'viridis'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Colorblind-safe Viridis scale"
          >
            Viridis (CVD-Safe)
          </button>
        </div>
      </div>

      {/* Color Ramp Legend Bar */}
      <div className="flex items-center justify-between gap-2 my-3 text-[11px] text-app-textMuted font-mono">
        <span>Low Activity</span>
        <div className="flex-1 h-2.5 rounded-full overflow-hidden flex mx-2 border border-app-border">
          {paletteSwatches.map((hex, i) => (
            <div key={i} className="flex-1 h-full" style={{ backgroundColor: hex }} />
          ))}
        </div>
        <span>Extreme Surge</span>
      </div>

      {/* Heatmap Calendar Matrix Grid Container */}
      <div
        ref={gridRef}
        role="grid"
        aria-label="Burn activity calendar (2000-11 to 2021-12)"
        className="relative flex-1 overflow-x-auto select-none"
      >
        <div className="min-w-[420px]">
          {/* Column Headers (JAN - DEC) */}
          <div
            role="row"
            className="grid grid-cols-[46px_repeat(12,minmax(0,1fr))] gap-1 mb-1.5 text-[11px] font-mono font-semibold text-app-textMuted text-center"
          >
            <div role="columnheader" className="text-left pl-1">
              YEAR
            </div>
            {MONTH_LABELS.map((m) => (
              <div key={m} role="columnheader">
                {m}
              </div>
            ))}
          </div>

          {/* Year Rows */}
          <div className="space-y-1">
            {yearsDesc.map((year) => {
              const cells = calendarData.get(year) || [];
              const isSelectedYear = activeMonth?.startsWith(year.toString());

              return (
                <div
                  key={year}
                  role="row"
                  className="grid grid-cols-[46px_repeat(12,minmax(0,1fr))] gap-1 items-center"
                >
                  <div
                    role="rowheader"
                    className={`text-[11px] font-mono pl-1 ${
                      isSelectedYear ? 'text-sky-400 font-bold' : 'text-app-textSubdued'
                    }`}
                  >
                    {year}
                  </div>

                  {cells.map((cell, mIdx) => {
                    if (!cell || isNaN(cell.value)) {
                      return (
                        <div
                          key={mIdx}
                          role="gridcell"
                          aria-disabled="true"
                          className="h-4 sm:h-[18px] w-full rounded-[4px] bg-[#0c1218] border border-gray-900/60 opacity-40"
                          title="No data (unoperated)"
                        />
                      );
                    }

                    const isActive = cell.month === activeMonth;
                    const bg = getCellColor(cell.value, maxValue, palette);

                    return (
                      <button
                        key={mIdx}
                        type="button"
                        role="gridcell"
                        tabIndex={isActive ? 0 : -1}
                        aria-selected={isActive}
                        aria-label={`${MONTH_NAMES_SHORT[mIdx]} ${year}: ${Math.round(
                          cell.value
                        )} harmonized detections`}
                        onClick={() => handleCellClick(cell)}
                        onMouseEnter={(e) => handleMouseEnter(cell, e)}
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                        onKeyDown={(e) => handleKeyDown(e, cell)}
                        className={`h-4 sm:h-[18px] w-full rounded-[4px] border border-black/30 transition-transform duration-100 hover:scale-125 hover:z-20 focus:outline-none relative ${
                          isActive
                            ? 'ring-2 ring-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.8)] z-15 scale-110'
                            : ''
                        } ${cell.isPredicted ? 'bg-hatched' : ''} ${
                          cell.isTerraOnly ? 'border-dashed border-amber-400/60' : ''
                        }`}
                        style={{ backgroundColor: bg }}
                      >
                        {cell.isPartialViirs && (
                          <span
                            className="absolute -top-1 -right-0.5 text-[8px] text-amber-300 leading-none select-none"
                            title="Partial VIIRS month"
                          >
                            ◐
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating Interactive Hover Tooltip */}
      {hoveredCell && tooltipPos && (
        <div
          style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
          className="fixed z-50 pointer-events-none bg-app-surface1/95 backdrop-blur-md border border-app-border rounded-xl p-3 shadow-2xl text-xs w-64 font-mono transition-opacity"
        >
          <div className="flex items-center justify-between border-b border-app-border pb-1.5 mb-2">
            <span className="font-bold text-white font-mono uppercase">
              {MONTH_NAMES_SHORT[hoveredCell.calMon - 1]} {hoveredCell.year}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                hoveredCell.anomalyPct >= 20
                  ? 'bg-red-500/20 text-red-300'
                  : hoveredCell.anomalyPct <= -15
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              {hoveredCell.anomalyPct >= 0 ? `+${hoveredCell.anomalyPct}%` : `${hoveredCell.anomalyPct}%`}
            </span>
          </div>

          <div className="space-y-1 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-sky-400">Harmonized Index:</span>
              <span className="font-bold text-white">
                {Math.round(hoveredCell.value).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-app-textMuted">
              <span>Raw MODIS (1km):</span>
              <span>{hoveredCell.modisValue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-app-textMuted">
              <span>Raw VIIRS (375m):</span>
              <span>
                {hoveredCell.viirsValue !== null ? hoveredCell.viirsValue.toLocaleString() : 'N/A (Pre-Launch)'}
              </span>
            </div>
            <div className="flex justify-between text-app-textSubdued pt-1 border-t border-app-border">
              <span>22-Yr Median:</span>
              <span>{hoveredCell.medianValue.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Methodology footnote & provenance reminder */}
      <div className="mt-4 pt-3 border-t border-app-border flex items-center justify-between text-[11px] text-app-textSubdued">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-[3px] bg-[#181e2c] border border-gray-700 inline-block" />
            Observed VIIRS (2012–2021)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-[3px] bg-hatched bg-amber-900 border border-gray-700 inline-block" />
            Predicted MODIS→VIIRS (2000–2012)
          </span>
        </div>
        <button
          onClick={() => setIsHarmonizationModalOpen(true)}
          className="text-sky-400 hover:underline flex items-center gap-1"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Methodology</span>
        </button>
      </div>
    </div>
  );
};
