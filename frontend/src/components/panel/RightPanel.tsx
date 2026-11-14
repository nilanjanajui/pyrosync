import React, { useMemo } from 'react';
import { useAppStore } from '../../store/appStore';
import { aoiSeries, isPredictedMonth } from '../../domain/aggregate';
import { buildClimatology, midRankPercentile } from '../../domain/stats';
import { estimateAoiAreaKm2, isAoiTooSmall } from '../../domain/aoi';
import { BurnCalendar } from '../calendar/BurnCalendar';
import { CheckCircle2, AlertCircle, Download } from 'lucide-react';
import copy from '../../copy';

export const RightPanel: React.FC = () => {
  const {
    dataset,
    selectedCellIndexes,
    activeMonth,
    aoi,
    setIsExportModalOpen,
  } = useAppStore();

  const activeMonthStr = useMemo(() => {
    if (activeMonth) return activeMonth;
    return '2020-08'; // Default to peak record month for immediate analytical clarity
  }, [activeMonth]);

  const summaryData = useMemo(() => {
    if (!dataset) return null;

    const harmSeries = aoiSeries(dataset, selectedCellIndexes, 'harmonized');
    const mIdx = dataset.monthIndexMap.get(activeMonthStr) ?? (dataset.numMonths - 1);
    const count = Math.round(harmSeries.values[mIdx] || 0);

    const [, monStr] = activeMonthStr.split('-');
    const calMon = parseInt(monStr, 10);

    const dateObj = new Date(`${activeMonthStr}-01T00:00:00Z`);
    const monthName = dateObj.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
    const monthYear = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

    // Historical comparison for this same calendar month across years
    const climatology = buildClimatology(dataset.months, harmSeries.values);
    const history = climatology.get(calMon) || [];
    const validHistory = history.filter((v) => !isNaN(v));

    let pct = 50;
    if (validHistory.length > 1) {
      const p = midRankPercentile(count, validHistory);
      pct = Math.round(p * 100);
    }

    let typicality: string = copy.summary.typical;
    if (pct >= 75) typicality = copy.summary.unusualHigh;
    else if (pct <= 25) typicality = copy.summary.unusualLow;

    const pctText = copy.summary.percentileHigherThan(pct, monthName);
    const sentence = copy.summary.sentence(monthYear, count, monthName, typicality, pctText);

    const isEstimated = isPredictedMonth(activeMonthStr);
    const tooSmall = isAoiTooSmall(aoi);
    const areaKm2 = Math.round(estimateAoiAreaKm2(aoi));

    // Typical error percentage from official validation parameters
    const typicalErrorPct = Math.round((dataset.harmonization?.validation?.wape ?? 0.129) * 100);

    return {
      count,
      pct,
      sentence,
      isEstimated,
      tooSmall,
      areaKm2,
      typicalErrorPct,
    };
  }, [dataset, selectedCellIndexes, activeMonthStr, aoi]);

  if (!summaryData) return null;

  return (
    <div className="flex flex-col gap-4 font-sans text-app-text h-full overflow-y-auto">
      {/* A. Plain-Language Summary of Area and Month */}
      <section
        aria-label={copy.summary.title}
        className="bg-app-surface1 rounded-xl border border-app-border p-4 shadow-sm"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 className="text-sm font-bold text-white tracking-tight uppercase">
            {copy.summary.title}
          </h2>
          {/* Reliability Chip (Defect 3: Observed has NO error band; Estimated shows typical error) */}
          <div className="shrink-0">
            {summaryData.isEstimated ? (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30"
                title={copy.reliability.estimatedTooltip}
              >
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>{copy.reliability.estimatedBadge}</span>
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                title={copy.reliability.measuredTooltip}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{copy.reliability.measuredBadge}</span>
              </span>
            )}
          </div>
        </div>

        {/* Narrative Sentence (High-school reading level, accessible, plain english) */}
        <p className="text-sm text-gray-200 leading-relaxed mb-4">
          {summaryData.sentence}
        </p>

        {/* Max 3 Summary Numbers Visible At Once (NO KPI GRID) */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-app-border/80 text-center">
          <div className="bg-app-surface2/60 p-2 rounded-lg">
            <span className="text-[11px] text-app-textSubdued block leading-tight">Hotspots</span>
            <span className="text-lg font-bold font-mono text-amber-400">
              {summaryData.count.toLocaleString()}
            </span>
          </div>

          <div className="bg-app-surface2/60 p-2 rounded-lg">
            <span className="text-[11px] text-app-textSubdued block leading-tight">Historical Rank</span>
            <span className="text-lg font-bold font-mono text-white">
              {summaryData.pct}th <span className="text-xs font-normal text-app-textMuted">%tile</span>
            </span>
          </div>

          <div className="bg-app-surface2/60 p-2 rounded-lg">
            <span className="text-[11px] text-app-textSubdued block leading-tight">Area Coverage</span>
            <span className="text-lg font-bold font-mono text-white">
              {selectedCellIndexes.length}{' '}
              <span className="text-xs font-normal text-app-textMuted">cells</span>
            </span>
          </div>
        </div>

        {/* Reliability & Small Area Warnings */}
        <div className="mt-3 space-y-1.5">
          {summaryData.isEstimated && (
            <p className="text-xs text-amber-300/90 flex items-center gap-1 font-mono">
              <span>{copy.reliability.typicalErrorLabel(summaryData.typicalErrorPct)}</span>
            </p>
          )}

          {summaryData.isEstimated && summaryData.tooSmall && (
            <div className="bg-amber-950/40 border border-amber-600/40 rounded-lg p-2.5 text-xs text-amber-200 leading-snug">
              {copy.reliability.smallAreaWarning}
            </div>
          )}
        </div>
      </section>

      {/* B. Calendar Heatmap: Which months were busiest? */}
      <section aria-label={copy.calendar.title} className="flex-1 min-h-[300px]">
        <BurnCalendar />
      </section>

      {/* D. Download Button */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setIsExportModalOpen(true)}
          className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-app-surface2 hover:bg-app-elevated border border-app-border hover:border-amber-500/50 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
        >
          <Download className="w-4 h-4 text-amber-400" />
          <span>{copy.download.buttonLabel}</span>
        </button>
      </div>
    </div>
  );
};

export default RightPanel;
