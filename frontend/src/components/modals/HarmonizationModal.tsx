import React from 'react';
import { X, Layers, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../../store/appStore';

export const HarmonizationModal: React.FC = () => {
  const { isHarmonizationModalOpen, setIsHarmonizationModalOpen, dataset } = useAppStore();

  if (!isHarmonizationModalOpen || !dataset) return null;

  const harm = dataset.harmonization;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="harm-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <div className="bg-app-surface1 border border-app-borderLight rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-5 font-mono max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-app-border pb-3">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-app-accent" aria-hidden="true" />
            <h2 id="harm-modal-title" className="text-base font-bold text-app-text uppercase tracking-wider">
              Harmonization Methodology &amp; Validation
            </h2>
          </div>
          <button
            onClick={() => setIsHarmonizationModalOpen(false)}
            className="p-1 rounded bg-app-surface2 hover:bg-app-elevated border border-app-border text-app-textMuted hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Core Method Summary */}
        <div className="bg-app-surface2 border border-app-border rounded-lg p-3.5 space-y-1.5 text-xs">
          <div className="text-app-text font-bold">
            Method: VIIRS-Equivalent Seasonal Ratio Model (v{harm.version})
          </div>
          <p className="text-app-textMuted leading-relaxed">
            {harm.description}
          </p>
          <div className="text-[11px] text-emerald-400 font-semibold pt-1">
            Status: ✓ {harm.status.toUpperCase()} (Phase 5/6 Pipeline Fit)
          </div>
        </div>

        {/* Seasonal Multipliers Table (Section 44) */}
        <div className="space-y-2">
          <h3 className="text-xs uppercase font-bold text-app-textSubdued tracking-wider">
            Seasonal Multipliers (VIIRS per MODIS Detection)
          </h3>
          <div className="overflow-x-auto border border-app-border rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-app-surface2 text-app-textSubdued border-b border-app-border">
                <tr>
                  <th scope="col" className="p-2.5 font-bold">Season</th>
                  <th scope="col" className="p-2.5 font-bold">Months</th>
                  <th scope="col" className="p-2.5 font-bold text-right">Standard (MODIS+Aqua)</th>
                  <th scope="col" className="p-2.5 font-bold text-right">Terra-Only Era</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border text-app-text tabular-nums">
                <tr>
                  <td className="p-2.5 font-bold text-sky-400">DJF</td>
                  <td className="p-2.5 text-app-textMuted">Dec, Jan, Feb</td>
                  <td className="p-2.5 text-right font-bold">{harm.seasonalRatios.DJF.toFixed(3)}</td>
                  <td className="p-2.5 text-right text-amber-400">{harm.terraOnlyRatios.DJF.toFixed(3)}</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-emerald-400">MAM</td>
                  <td className="p-2.5 text-app-textMuted">Mar, Apr, May</td>
                  <td className="p-2.5 text-right font-bold">{harm.seasonalRatios.MAM.toFixed(3)}</td>
                  <td className="p-2.5 text-right text-amber-400">{harm.terraOnlyRatios.MAM.toFixed(3)}</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-app-accent">JJA</td>
                  <td className="p-2.5 text-app-textMuted">Jun, Jul, Aug</td>
                  <td className="p-2.5 text-right font-bold">{harm.seasonalRatios.JJA.toFixed(3)}</td>
                  <td className="p-2.5 text-right text-amber-400">{harm.terraOnlyRatios.JJA.toFixed(3)}</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-orange-400">SON</td>
                  <td className="p-2.5 text-app-textMuted">Sep, Oct, Nov</td>
                  <td className="p-2.5 text-right font-bold">{harm.seasonalRatios.SON.toFixed(3)}</td>
                  <td className="p-2.5 text-right text-amber-400">{harm.terraOnlyRatios.SON.toFixed(3)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Validation Metrics (Section 45) */}
        <div className="space-y-2">
          <h3 className="text-xs uppercase font-bold text-app-textSubdued tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" />
            <span>Validation Metrics (Leave-One-Year-Out Cross-Validation)</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="bg-app-surface2 border border-app-border rounded-lg p-2.5">
              <span className="text-[10px] text-app-textSubdued block">Region-Month WAPE:</span>
              <span className="text-base font-bold text-emerald-400">
                {(harm.validation.wape * 100).toFixed(1)}%
              </span>
              <span className="text-[10px] text-app-textSubdued block mt-0.5">LOYO-CV Combined</span>
            </div>
            <div className="bg-app-surface2 border border-app-border rounded-lg p-2.5">
              <span className="text-[10px] text-app-textSubdued block">Terra-Only CV WAPE:</span>
              <span className="text-base font-bold text-emerald-400">
                {(harm.validation.wapeTerraOnly * 100).toFixed(1)}%
              </span>
              <span className="text-[10px] text-app-textSubdued block mt-0.5">Pre-Aqua Era (2000–02)</span>
            </div>
            <div className="bg-app-surface2 border border-app-border rounded-lg p-2.5">
              <span className="text-[10px] text-app-textSubdued block">Forward Test Bias:</span>
              <span className="text-base font-bold text-amber-400">
                {(harm.validation.forwardTestBias * 100).toFixed(1)}%
              </span>
              <span className="text-[10px] text-app-textSubdued block mt-0.5">Train ≤2019, Test 2020–21</span>
            </div>
          </div>
        </div>

        {/* Cell-Level Bias Warning Alert */}
        <div className="bg-amber-950/40 border border-amber-600/50 rounded-lg p-3 text-xs text-amber-300 space-y-1">
          <div className="flex items-center gap-2 font-bold uppercase">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <span>Important Scientific Limitation: Cell-Level Bias at Low Counts</span>
          </div>
          <p className="leading-relaxed">
            When MODIS detections are low (1–2 per cell), ratio models overestimate VIIRS counts by +78%.
            Predictions are only statistically reliable when aggregated over multiple grid cells or across entire regions.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end pt-2 border-t border-app-border">
          <button
            onClick={() => setIsHarmonizationModalOpen(false)}
            className="px-4 py-2 bg-app-surface2 hover:bg-app-elevated border border-app-border hover:border-app-borderLight text-app-text rounded text-xs font-bold transition-all focus:ring-1 focus:ring-app-accent"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
