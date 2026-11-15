import React, { useMemo } from 'react';
import { useAppStore } from '../../store/appStore';
import { aoiSeries, isPredictedMonth } from '../../domain/aggregate';
import { buildClimatology, median, midRankPercentile } from '../../domain/stats';
import { estimateAoiAreaKm2, isAoiTooSmall } from '../../domain/aoi';
import { studyGeometry, studyName } from '../../domain/study';
import { BurnCalendar } from '../calendar/BurnCalendar';
import { CoordinateForm } from '../aoi/CoordinateForm';
import { DemoBadge } from '../common/DemoBadge';
import { CheckCircle2, AlertCircle, Download, MapPinOff, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import copy from '../../copy';

const monthInput =
  'w-full rounded-md border border-app-border bg-app-surface2 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500';

export const RightPanel: React.FC = () => {
  const { dataset, selectedCellIndexes, activeMonth, aoi, setIsExportModalOpen, dateStart, dateEnd, setDateRange } =
    useAppStore();

  const summary = useMemo(() => {
    if (!dataset) return null;
    const month = activeMonth ?? dataset.months[dataset.numMonths - 1];
    const series = aoiSeries(dataset, selectedCellIndexes, 'harmonized');
    const mIdx = dataset.monthIndexMap.get(month) ?? dataset.numMonths - 1;
    const count = Math.round(series.values[mIdx] || 0);

    const date = new Date(`${month}-01T00:00:00Z`);
    const monthName = date.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
    const monthYear = date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

    const history = (buildClimatology(dataset.months, series.values).get(date.getUTCMonth() + 1) ?? []).filter(
      (v) => !isNaN(v)
    );
    const usual = Math.round(median(history));
    let pct = 50;
    if (history.length > 1) pct = Math.round(midRankPercentile(count, history) * 100);

    let typicality: string = copy.summary.typical;
    if (pct >= 75) typicality = copy.summary.unusualHigh;
    else if (pct <= 25) typicality = copy.summary.unusualLow;

    const study = studyGeometry(dataset);
    return {
      count,
      pct,
      usual,
      monthName,
      monthYear,
      delta: usual > 0 ? Math.round(((count - usual) / usual) * 100) : null,
      sentence: copy.summary.sentence(
        monthYear,
        count,
        monthName,
        typicality,
        copy.summary.percentileHigherThan(pct, monthName, dataset.manifest.coverage.start.slice(0, 4))
      ),
      isEstimated: isPredictedMonth(month),
      tooSmall: isAoiTooSmall(aoi, study),
      areaKm2: Math.round(estimateAoiAreaKm2(aoi, study)),
      typicalErrorPct: Math.round((dataset.harmonization?.validation?.wape ?? 0.129) * 100),
    };
  }, [dataset, selectedCellIndexes, activeMonth, aoi]);

  if (!dataset || !summary) return null;

  const first = dataset.months[0];
  const last = dataset.months[dataset.numMonths - 1];
  const empty = selectedCellIndexes.length === 0;
  const tile = 'rounded-lg bg-app-surface2/60 p-2.5';
  const tileLabel = 'block text-xs leading-tight text-app-textMuted';

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1 font-sans text-app-text [&>*]:shrink-0">
      <section aria-label={copy.summary.title} className="rounded-xl border border-app-border bg-app-surface1 p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold tracking-tight text-white">{copy.summary.title}</h2>
            <DemoBadge isSynthetic={dataset.manifest.synthetic} />
          </div>
          {!empty &&
            (summary.isEstimated ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300"
                title={copy.reliability.estimatedTooltip}
              >
                <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                {copy.reliability.estimatedBadge}
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300"
                title={copy.reliability.measuredTooltip}
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                {copy.reliability.measuredBadge}
              </span>
            ))}
        </div>

        {empty ? (
          <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-600/40 bg-amber-950/40 p-3 text-sm text-amber-100">
            <MapPinOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
            <span>{copy.summary.noCoverage(studyName(dataset))}</span>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <span className="block text-xs font-medium uppercase tracking-wide text-app-textMuted">
                  {copy.summary.detectionsLabel} · {summary.monthYear}
                </span>
                <span className="text-4xl font-bold leading-none tabular-nums text-white">
                  {summary.count.toLocaleString()}
                </span>
              </div>
              {summary.delta === null ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-app-border bg-app-surface2 px-3 py-1.5 text-xs font-medium text-app-textMuted">
                  <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                  {copy.summary.vsUsualNone}
                </span>
              ) : Math.abs(summary.delta) < 10 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-app-border bg-app-surface2 px-3 py-1.5 text-xs font-semibold text-gray-200">
                  <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                  {copy.summary.vsUsualSame}
                </span>
              ) : summary.delta > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/40 bg-orange-500/15 px-3 py-1.5 text-xs font-semibold text-orange-300">
                  <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                  {copy.summary.vsUsualAbove(summary.delta)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/40 bg-violet-500/15 px-3 py-1.5 text-xs font-semibold text-violet-300">
                  <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                  {copy.summary.vsUsualBelow(Math.abs(summary.delta))}
                </span>
              )}
            </div>
            <p className="mb-4 text-sm leading-relaxed text-gray-300">{summary.sentence}</p>
            <div className="grid grid-cols-2 gap-2 border-t border-app-border/80 pt-3">
              <div className={tile} title={copy.summary.usualNote}>
                <span className={tileLabel}>{copy.summary.usualLabel(summary.monthName)}</span>
                <span className="text-xl font-bold tabular-nums text-white">
                  {isNaN(summary.usual) ? '–' : summary.usual.toLocaleString()}
                </span>
              </div>
              <div className={tile}>
                <span className={tileLabel}>{copy.summary.cellsLabel}</span>
                <span className="text-xl font-bold tabular-nums text-white">{summary.areaKm2.toLocaleString()}</span>
                <span className="ml-1 text-xs text-app-textMuted">km²</span>
              </div>
            </div>
            {summary.isEstimated && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-amber-300/90">{copy.reliability.typicalErrorLabel(summary.typicalErrorPct)}</p>
                {summary.tooSmall && (
                  <div className="rounded-lg border border-amber-600/40 bg-amber-950/40 p-2.5 text-xs leading-snug text-amber-200">
                    {copy.reliability.smallAreaWarning}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      <section
        aria-label={copy.download.rangeTitle}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-app-border bg-app-surface1 px-4 py-3"
      >
        <label className="min-w-[130px] flex-1 text-xs text-app-textMuted">
          {copy.download.rangeFrom}
          <input
            type="month"
            className={monthInput}
            min={first}
            max={dateEnd}
            value={dateStart}
            onChange={(e) => e.target.value && setDateRange(e.target.value, dateEnd)}
          />
        </label>
        <label className="min-w-[130px] flex-1 text-xs text-app-textMuted">
          {copy.download.rangeTo}
          <input
            type="month"
            className={monthInput}
            min={dateStart}
            max={last}
            value={dateEnd}
            onChange={(e) => e.target.value && setDateRange(dateStart, e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => setDateRange(first, last)}
          className="min-h-[38px] rounded-md px-2 text-xs text-amber-300 hover:bg-app-surface2 focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          {copy.download.rangeReset}
        </button>
      </section>

      <section aria-label={copy.calendar.title}>
        <BurnCalendar />
      </section>

      <CoordinateForm />

      <button
        type="button"
        onClick={() => setIsExportModalOpen(true)}
        disabled={empty}
        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-app-border bg-app-surface2 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:border-amber-500/50 hover:bg-app-elevated focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Download className="h-4 w-4 text-amber-400" aria-hidden="true" />
        <span>{copy.download.buttonLabel}</span>
      </button>
    </div>
  );
};

export default RightPanel;
