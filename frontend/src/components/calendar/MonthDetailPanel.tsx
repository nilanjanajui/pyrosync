/**
 * Month detail panel — shown when user clicks a calendar cell.
 * Displays: value, source label, typical-error band, percentile, rank, anomaly flag.
 */
import React from 'react';
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { aoiSeries, sourceLabel, isPredictedMonth } from '../../domain/aggregate';
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

export const MonthDetailPanel: React.FC = () => {
  const { dataset, selectedCellIndexes, sensorMode, activeMonth, setActiveMonth } = useAppStore();
  if (!dataset || !activeMonth) return null;

  const series = aoiSeries(dataset, selectedCellIndexes, sensorMode);
  const mIdx = series.months.indexOf(activeMonth);
  if (mIdx < 0) return null;

  const value = series.values[mIdx];
  const source = series.sources[mIdx];
  const [yearStr, monStr] = activeMonth.split('-');
  const calMon = parseInt(monStr, 10);
  const year = parseInt(yearStr, 10);

  // Historical values for same calendar month
  const climatology = buildClimatology(series.months, series.values);
  const histValues = climatology.get(calMon) ?? [];
  const histMedian = median(histValues);
  const ratio = ratioToMedian(value, histMedian);
  const percentile = midRankPercentile(value, histValues);
  const rank = isNaN(value) ? null : rankDescending(value, histValues.filter((v) => !isNaN(v)));
  const flag = unusualFlag(value, histValues);
  const isPred = isPredictedMonth(activeMonth);

  // Uncertainty band from harmonization
  const monthSeason = (() => {
    if ([12, 1, 2].includes(calMon)) return 'DJF';
    if ([3, 4, 5].includes(calMon)) return 'MAM';
    if ([6, 7, 8].includes(calMon)) return 'JJA';
    return 'SON';
  })();
  const uncertaintyState = dataset.harmonization.validation.uncertainty.state;
  const sIdx = uncertaintyState.seasons.indexOf(monthSeason);
  const lo5 = sIdx >= 0 ? uncertaintyState.lo5[sIdx] : null;
  const hi95 = sIdx >= 0 ? uncertaintyState.hi95[sIdx] : null;

  return (
    <div
      role="complementary"
      aria-label={`Detail for ${MONTH_NAMES[calMon - 1]} ${year}`}
      className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-bold text-white">
            {MONTH_NAMES[calMon - 1]} {year}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {sensorMode === 'harmonized' ? 'Harmonized · ' : `${sensorMode.toUpperCase()} · `}
            {sourceLabel(source)}
          </p>
        </div>
        <button
          onClick={() => setActiveMonth(null)}
          aria-label="Close month detail"
          className="text-slate-500 hover:text-slate-200 transition-colors p-1 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Main value */}
      <div className="bg-slate-800/60 rounded-lg p-3 text-center">
        {isNaN(value) ? (
          <p className="text-slate-400 text-sm">No detection record</p>
        ) : (
          <>
            <p className="text-3xl font-bold text-white tabular-nums">
              {Math.round(value).toLocaleString()}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              VIIRS-equivalent active-fire detection records
            </p>
          </>
        )}
      </div>

      {/* Prediction warning */}
      {isPred && sensorMode === 'harmonized' && (
        <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-2.5 text-xs text-amber-300">
          ⚠ Predicted value — no VIIRS observations before Feb 2012.
          This is a MODIS-derived estimate using seasonal ratios and cannot be validated against VIIRS.
        </div>
      )}

      {/* Stats */}
      {!isNaN(value) && (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Historical median ({MONTH_NAMES[calMon - 1]})</span>
            <span className="text-slate-200 font-medium tabular-nums">
              {isNaN(histMedian) ? '—' : Math.round(histMedian).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Ratio to median</span>
            <span className="text-slate-200 font-medium tabular-nums">
              {isNaN(ratio) ? '—' : ratio.toFixed(2) + '×'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Percentile (same month)</span>
            <span className="text-slate-200 font-medium tabular-nums">
              {isNaN(percentile) ? '—' : (percentile * 100).toFixed(0) + 'th'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Rank ({MONTH_NAMES[calMon - 1]})</span>
            <span className="text-slate-200 font-medium tabular-nums">
              {rank == null ? '—' : `#${rank} of ${histValues.filter((v) => !isNaN(v)).length}`}
            </span>
          </div>

          {/* Anomaly flag */}
          {flag !== 'insufficient_data' && flag !== 'normal' && (
            <div
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
                flag === 'unusual_high'
                  ? 'bg-orange-900/40 border border-orange-700/50 text-orange-300'
                  : 'bg-purple-900/40 border border-purple-700/50 text-purple-300'
              }`}
            >
              {flag === 'unusual_high' ? (
                <TrendingUp className="w-4 h-4" aria-hidden="true" />
              ) : (
                <TrendingDown className="w-4 h-4" aria-hidden="true" />
              )}
              <span>
                {flag === 'unusual_high'
                  ? 'Unusually high — top 10% for this calendar month'
                  : 'Unusually low — bottom 10% for this calendar month'}
              </span>
            </div>
          )}
          {flag === 'normal' && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Minus className="w-3 h-3" aria-hidden="true" />
              Within normal range for {MONTH_NAMES[calMon - 1]}
            </div>
          )}

          {/* Typical-error band (harmonized only) */}
          {sensorMode === 'harmonized' && lo5 != null && hi95 != null && isPred && (
            <div className="bg-slate-800/60 rounded-lg p-2.5 text-xs space-y-1">
              <p className="text-slate-300 font-medium">
                Typical error band ({monthSeason} season, state-level)
              </p>
              <p className="text-slate-400">
                5th–95th percentile of prediction errors:{' '}
                <span className="text-slate-200">
                  ×{lo5.toFixed(2)} to ×{hi95.toFixed(2)} of this estimate
                </span>
              </p>
              <p className="text-amber-400/70">
                Not a confidence interval. Do not center on this point estimate.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

