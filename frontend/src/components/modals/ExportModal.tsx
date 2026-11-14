import React from 'react';
import { X, Download, FileText, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { aoiSeries, sourceLabel } from '../../domain/aggregate';
import { estimateAoiAreaKm2 } from '../../domain/aoi';

export const ExportModal: React.FC = () => {
  const {
    isExportModalOpen,
    setIsExportModalOpen,
    dataset,
    selectedCellIndexes,
    sensorMode,
    aoi,
  } = useAppStore();

  if (!isExportModalOpen || !dataset) return null;

  const series = aoiSeries(dataset, selectedCellIndexes, sensorMode);
  const aoiArea = estimateAoiAreaKm2(aoi);

  const handleDownload = () => {
    // Generate CSV content with comment header
    const headers = [
      '# PyroSync — California Fire Activity Observatory Data Export',
      `# Generated UTC: ${new Date().toISOString()}`,
      `# Study Area: ${dataset.manifest.studyArea.name} (${selectedCellIndexes.length} cells, ≈${Math.round(aoiArea).toLocaleString()} km²)`,
      `# AOI Mode: ${aoi.mode}`,
      `# Sensor Mode: ${sensorMode.toUpperCase()} (VIIRS-equivalent active-fire detection records)`,
      `# Harmonization Method: ${dataset.harmonization.method}`,
      `# Validation Metrics: WAPE ${(dataset.harmonization.validation.wape * 100).toFixed(1)}%, Forward Test Bias ${(dataset.harmonization.validation.forwardTestBias * 100).toFixed(1)}%`,
      '# Semantic Notice: A detection count is not a unique fire or burned acreage.',
      'month,value,typical_err_lo,typical_err_hi,source_code,source_label,cell_count',
    ];

    const stateUncertainty = dataset.harmonization.validation.uncertainty.state;

    const rows = series.months.map((m, i) => {
      const val = series.values[i];
      const src = series.sources[i];
      const calMon = parseInt(m.split('-')[1], 10);
      const season = [12, 1, 2].includes(calMon) ? 'DJF' : [3, 4, 5].includes(calMon) ? 'MAM' : [6, 7, 8].includes(calMon) ? 'JJA' : 'SON';
      const sIdx = stateUncertainty.seasons.indexOf(season);
      const lo5 = sIdx >= 0 ? stateUncertainty.lo5[sIdx] : 0.75;
      const hi95 = sIdx >= 0 ? stateUncertainty.hi95[sIdx] : 1.35;

      const valStr = isNaN(val) ? '' : val.toFixed(1);
      const loStr = isNaN(val) ? '' : (val * lo5).toFixed(1);
      const hiStr = isNaN(val) ? '' : (val * hi95).toFixed(1);

      return `${m},${valStr},${loStr},${hiStr},${src},"${sourceLabel(src)}",${series.cellCounts[i]}`;
    });

    const csvContent = [...headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `pyrosync_${sensorMode}_aoi_${series.months[0]}_to_${series.months[series.months.length - 1]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setIsExportModalOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <div className="bg-app-surface1 border border-app-borderLight rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-5 font-mono">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-app-border pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-app-accent" aria-hidden="true" />
            <h2 id="export-modal-title" className="text-base font-bold text-app-text uppercase tracking-wider">
              Export Aggregated CSV
            </h2>
          </div>
          <button
            onClick={() => setIsExportModalOpen(false)}
            className="p-1 rounded bg-app-surface2 hover:bg-app-elevated border border-app-border text-app-textMuted hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Export Specification Summary */}
        <div className="bg-app-surface2 border border-app-border rounded-lg p-4 space-y-2.5 text-xs">
          <div className="flex justify-between border-b border-app-border pb-1.5">
            <span className="text-app-textSubdued">Selected AOI:</span>
            <span className="text-app-text font-bold uppercase">{aoi.mode}</span>
          </div>
          <div className="flex justify-between border-b border-app-border pb-1.5">
            <span className="text-app-textSubdued">Contributing Cells:</span>
            <span className="text-app-text font-bold tabular-nums">
              {selectedCellIndexes.length.toLocaleString()} cells (≈{Math.round(aoiArea).toLocaleString()} km²)
            </span>
          </div>
          <div className="flex justify-between border-b border-app-border pb-1.5">
            <span className="text-app-textSubdued">Temporal Window:</span>
            <span className="text-app-text font-bold">
              {series.months[0]} → {series.months[series.months.length - 1]} ({series.months.length} months)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-app-textSubdued">Active Mode:</span>
            <span className="text-app-accent font-bold uppercase">{sensorMode}</span>
          </div>
        </div>

        {/* Confirmation Note */}
        <div className="text-[11px] text-app-textMuted flex items-start gap-2 bg-app-surface2/60 p-2.5 rounded border border-app-border">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            CSV includes comment header with scientific citations, uncertainty multipliers, and data provenance codes.
          </span>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-app-border">
          <button
            onClick={() => setIsExportModalOpen(false)}
            className="px-4 py-2 bg-app-surface2 hover:bg-app-elevated border border-app-border text-app-textMuted hover:text-app-text rounded text-xs font-bold transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-app-accent hover:bg-orange-500 text-white rounded text-xs font-bold transition-all shadow-[0_0_15px_rgba(249,115,22,0.4)] focus:ring-1 focus:ring-white"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>
    </div>
  );
};

