/**
 * MonthInspector — Detailed Scientific Interrogation Dock
 * Implements Sections 36-40 of the UI Design Specification.
 *
 * Core Principle: "A user should be able to tell what happened, where it happened,
 * when it happened, whether it was directly observed or modeled, and how uncertain
 * the result is—all without opening a methodology document."
 */
import React from 'react';
import { X, TrendingUp, TrendingDown, Minus, AlertTriangle, ShieldCheck, HelpCircle, Download } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { aoiSeries, isPredictedMonth, sourceLabel } from '../../domain/aggregate';
import {
  buildClimatology,
  median,
  ratioToMedian,
  midRankPercentile,
  rankDescending,
  unusualFlag,
} from '../../domain/stats';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const MonthInspector: React.FC = () => {
  const {
    dataset,
    selectedCellIndexes,
    sensorMode,
    activeMonth,
    setActiveMonth,
    setIsHarmonizationModalOpen,
    setIsExportModalOpen,
  } = useAppStore();

  if (!dataset || !activeMonth) return null;

  const series = aoiSeries(dataset, selectedCellIndexes, sensorMode);
  const mIdx = series.months.indexOf(activeMonth);
  if (mIdx < 0) return null;

  const value = series.values[mIdx];
  const source = series.sources[mIdx];
  const [yearStr, monStr] = activeMonth.split('-');
  const calMon = parseInt(monStr, 10);
  const year = parseInt(yearStr, 10);

  // Climatology for the same calendar month
  const climatology = buildClimatology(series.months, series.values);
  const histValues = climatology.get(calMon) ?? [];
  const histMedian = median(histValues);
  const ratio = ratioToMedian(value, histMedian);
  const percentile = midRankPercentile(value, histValues);
  const rank = isNaN(value) ? null : rankDescending(value, histValues.filter((v) => !isNaN(v)));
  const flag = unusualFlag(value, histValues);
  const isPred = isPredictedMonth(activeMonth);

  // Empirical typical-error multiplier bands (5th to 95th percentile)
  const monthSeason = (() => {
    if ([12, 1, 2].includes(calMon)) return 'DJF';
    if ([3, 4, 5].includes(calMon)) return 'MAM';
    if ([6, 7, 8].includes(calMon)) return 'JJA';
    return 'SON';
  })();
  const stateUncertainty = dataset.harmonization.validation.uncertainty.state;
  const sIdx = stateUncertainty.seasons.indexOf(monthSeason);
  const lo5 = sIdx >= 0 ? stateUncertainty.lo5[sIdx] : 0.75;
  const hi95 = sIdx >= 0 ? stateUncertainty.hi95[sIdx] : 1.35;

  return (
    <section
      aria-label={`Detailed inspector for ${MONTH_NAMES[calMon - 1]} ${year}`}
      className="bg-app-surface1 border border-app-border rounded-xl p-4 sm:p-5 shadow-2xl space-y-4 font-mono"
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-app-border pb-3">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-app-accent animate-ping" />
          <h2 className="text-sm font-bold tracking-wider uppercase text-app-text">
            {MONTH_NAMES[calMon - 1]} {year} · Selected Month Inspection
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsHarmonizationModalOpen(true)}
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded bg-app-surface2 hover:bg-app-elevated border border-app-border text-xs text-app-textMuted hover:text-app-text transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5 text-app-accent" aria-hidden="true" />
            <span>Harmonization Math</span>
          </button>
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded bg-app-surface2 hover:bg-app-elevated border border-app-border text-xs text-app-accent hover:text-white transition-colors"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Export AOI Series</span>
          </button>
          <button
            onClick={() => setActiveMonth(null)}
            className="p-1 rounded bg-app-surface2 hover:bg-app-elevated border border-app-border text-app-textSubdued hover:text-white transition-colors"
            aria-label="Close month inspector"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Main Inspection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Column 1: Huge Primary Metric (Section 37) */}
        <div className="bg-app-surface2 border border-app-border rounded-lg p-4 flex flex-col justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-app-textSubdued mb-1">
              Active Detection Count
            </div>
            <div className="text-3xl sm:text-4xl font-black text-white tabular-nums tracking-tight">
              {isNaN(value) ? '—' : Math.round(value).toLocaleString()}
            </div>
          </div>
          <div className="text-[11px] text-app-textMuted mt-2 pt-2 border-t border-app-border/80 leading-snug">
            <span className="text-app-accent font-semibold">VIIRS-equivalent</span> active-fire detection records
            <span className="block text-[10px] text-app-textSubdued mt-0.5">
              (A detection record is not a unique fire or burned acreage)
            </span>
          </div>
        </div>

        {/* Column 2: Data Provenance Card (Section 38) */}
        <div className="bg-app-surface2 border border-app-border rounded-lg p-4 flex flex-col justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-app-textSubdued mb-1 flex items-center justify-between">
              <span>Data Provenance</span>
              <span className="text-[10px] text-app-accent font-semibold">
                {source === 0 ? '● OBSERVED' : source === 1 ? '◐ PREDICTED' : '◇ TERRA-ONLY'}
              </span>
            </div>
            <div className="text-sm font-bold text-app-text mt-1">
              {sourceLabel(source)}
            </div>
            <div className="text-[11px] text-app-textMuted mt-1">
              {source === 0 ? 'Suomi-NPP VIIRS 375m on-orbit sensor' : 'Seasonal ratio model fit on 2012–2021 overlap'}
            </div>
          </div>

          {/* Unvalidated warning if pre-2012 */}
          {isPred ? (
            <div className="bg-amber-950/40 border border-amber-600/50 rounded p-2 text-[10px] text-amber-300 mt-2 leading-tight flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
              <span>Values before Feb 2012 cannot be validated against on-orbit VIIRS. Forward test bias: -9.6%.</span>
            </div>
          ) : (
            <div className="bg-emerald-950/40 border border-emerald-600/50 rounded p-2 text-[10px] text-emerald-300 mt-2 leading-tight flex items-start gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
              <span>Direct satellite observation validated against high-resolution ground fire perimeters.</span>
            </div>
          )}
        </div>

        {/* Column 3: Historical Context (Section 39) */}
        <div className="bg-app-surface2 border border-app-border rounded-lg p-4 flex flex-col justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-app-textSubdued mb-2">
              Historical Context ({MONTH_NAMES[calMon - 1]}s)
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-app-textSubdued block text-[10px]">Hist. Median:</span>
                <span className="text-app-text font-bold tabular-nums">
                  {isNaN(histMedian) ? '—' : Math.round(histMedian).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-app-textSubdued block text-[10px]">Ratio to Median:</span>
                <span className="text-app-text font-bold tabular-nums">
                  {isNaN(ratio) ? '—' : `${ratio.toFixed(2)}×`}
                </span>
              </div>
              <div>
                <span className="text-app-textSubdued block text-[10px]">Percentile:</span>
                <span className="text-app-text font-bold tabular-nums">
                  {isNaN(percentile) ? '—' : `${(percentile * 100).toFixed(0)}th`}
                </span>
              </div>
              <div>
                <span className="text-app-textSubdued block text-[10px]">Month Rank:</span>
                <span className="text-app-text font-bold tabular-nums">
                  {rank == null ? '—' : `#${rank} / ${histValues.filter((v) => !isNaN(v)).length}`}
                </span>
              </div>
            </div>
          </div>

          {/* Anomaly Badge */}
          <div className="mt-2">
            {flag === 'unusual_high' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-orange-950/60 border border-orange-600/60 text-orange-400 text-[11px] font-bold">
                <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
                <span>UNUSUALLY HIGH · TOP 10%</span>
              </div>
            )}
            {flag === 'unusual_low' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-purple-950/60 border border-purple-600/60 text-purple-400 text-[11px] font-bold">
                <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />
                <span>UNUSUALLY LOW · BOTTOM 10%</span>
              </div>
            )}
            {flag === 'normal' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-app-surface1 border border-app-border text-app-textMuted text-[11px]">
                <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>WITHIN NORMAL RANGE</span>
              </div>
            )}
          </div>
        </div>

        {/* Column 4: Asymmetrical Typical Error Band (Section 40) */}
        <div className="bg-app-surface2 border border-app-border rounded-lg p-4 flex flex-col justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-app-textSubdued mb-1">
              Typical Error Band (LOYO-CV)
            </div>
            <div className="text-xs text-app-textMuted mb-2">
              Season: <span className="text-app-text font-bold">{monthSeason}</span> · 5th to 95th percentile
            </div>

            {/* Asymmetrical Error Scale Visualizer */}
            <div className="relative pt-4 pb-2">
              {/* Scale Line */}
              <div className="h-1.5 bg-app-surface1 rounded-full relative border border-app-border">
                {/* Point estimate marker (at 1.0x center) */}
                <div
                  className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-app-accent border-2 border-white shadow-[0_0_8px_rgba(249,115,22,0.8)]"
                  style={{ left: '50%' }}
                  title="Point estimate (1.0x)"
                />
              </div>

              {/* Labels below scale */}
              <div className="flex justify-between text-[10px] font-mono text-app-textMuted mt-1.5">
                <span>×{lo5.toFixed(2)}</span>
                <span className="text-app-accent font-bold">1.0×</span>
                <span>×{hi95.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-app-textSubdued pt-2 border-t border-app-border/80 leading-snug">
            Empirical prediction error multiplier band. <span className="text-app-textMuted font-medium">Not a confidence interval; do not center on point estimate.</span>
          </div>
        </div>
      </div>
    </section>
  );
};

