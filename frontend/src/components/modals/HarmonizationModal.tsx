import React from 'react';
import { X, Cpu, ShieldCheck, AlertTriangle } from 'lucide-react';
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
      <div className="bg-app-surface1 border border-app-border rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-4 font-mono text-gray-200">
        <button
          onClick={() => setIsHarmonizationModalOpen(false)}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-1.5 rounded-lg bg-app-surface2 border border-app-border"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 id="harm-modal-title" className="text-base sm:text-lg font-bold text-white font-mono">
              MODIS &amp; VIIRS Harmonization Pipeline
            </h2>
            <p className="text-xs text-app-textMuted font-mono">
              How we eliminate cross-sensor bias between Terra/Aqua MODIS and SNPP/NOAA-20 VIIRS
            </p>
          </div>
        </div>

        {/* 1. Sensor Continuity Problem */}
        <div className="bg-app-bg/90 p-4 rounded-xl border border-app-border text-xs leading-relaxed">
          <h3 className="font-semibold text-amber-400 mb-1">1. The Sensor Continuity Problem</h3>
          <p className="text-gray-400">
            NASA&apos;s MODIS sensors (launched 1999/2002) detect active fires at <strong>1 km nadir resolution</strong>,
            whereas VIIRS (launched 2011/2017) resolves thermal anomalies at <strong>375 m</strong>.
            Consequently, VIIRS detects ~2.8&times;–4.5&times; more smaller and cooler understory fires. Raw counts jump
            artificially after 2012, obscuring true climate and fire trends.
          </p>
        </div>

        {/* 2. Three Step Harmonization Flow */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-app-bg/90 p-3.5 rounded-xl border border-app-border">
            <div className="font-mono text-sky-400 font-semibold text-xs mb-1">Step A: Spatial Clustering</div>
            <p className="text-[11px] text-gray-400 leading-snug">
              Sub-pixel 375 m VIIRS detections falling within equivalent 1 km footprints during overlapping orbital windows are unified into coherent clusters.
            </p>
          </div>
          <div className="bg-app-bg/90 p-3.5 rounded-xl border border-app-border">
            <div className="font-mono text-sky-400 font-semibold text-xs mb-1">Step B: Overpass Adjustment</div>
            <p className="text-[11px] text-gray-400 leading-snug">
              Diurnal fire cycle weights normalize Terra (~10:30/22:30) and Aqua/VIIRS (~13:30/01:30) overpass times, preventing orbital drift bias as Terra/Aqua retire.
            </p>
          </div>
          <div className="bg-app-bg/90 p-3.5 rounded-xl border border-app-border">
            <div className="font-mono text-sky-400 font-semibold text-xs mb-1">Step C: Quantile Mapping</div>
            <p className="text-[11px] text-gray-400 leading-snug">
              Using the dual-sensor overlap benchmark, seasonal ratio models map pre-2012 MODIS counts into continuous <strong>VIIRS-equivalent detection records</strong>.
            </p>
          </div>
        </div>

        {/* 3. Seasonal Multipliers Table */}
        <div className="space-y-1.5">
          <h4 className="text-xs uppercase font-bold text-gray-400 tracking-wider">
            Fitted Seasonal Multipliers (VIIRS per MODIS Detection)
          </h4>
          <div className="overflow-x-auto border border-app-border rounded-lg text-xs">
            <table className="w-full text-left font-mono">
              <thead className="bg-app-surface2 text-gray-400 border-b border-app-border">
                <tr>
                  <th scope="col" className="p-2 font-bold">Season</th>
                  <th scope="col" className="p-2 font-bold">Months</th>
                  <th scope="col" className="p-2 font-bold text-right">Combined (Terra+Aqua)</th>
                  <th scope="col" className="p-2 font-bold text-right">Terra-Only Era</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border tabular-nums text-gray-200">
                <tr>
                  <td className="p-2 font-bold text-sky-400">DJF</td>
                  <td className="p-2 text-gray-400">Dec, Jan, Feb</td>
                  <td className="p-2 text-right font-bold">{harm.seasonalRatios.DJF.toFixed(3)}</td>
                  <td className="p-2 text-right text-amber-400">{harm.terraOnlyRatios.DJF.toFixed(3)}</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold text-emerald-400">MAM</td>
                  <td className="p-2 text-gray-400">Mar, Apr, May</td>
                  <td className="p-2 text-right font-bold">{harm.seasonalRatios.MAM.toFixed(3)}</td>
                  <td className="p-2 text-right text-amber-400">{harm.terraOnlyRatios.MAM.toFixed(3)}</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold text-orange-400">JJA</td>
                  <td className="p-2 text-gray-400">Jun, Jul, Aug</td>
                  <td className="p-2 text-right font-bold">{harm.seasonalRatios.JJA.toFixed(3)}</td>
                  <td className="p-2 text-right text-amber-400">{harm.terraOnlyRatios.JJA.toFixed(3)}</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold text-red-400">SON</td>
                  <td className="p-2 text-gray-400">Sep, Oct, Nov</td>
                  <td className="p-2 text-right font-bold">{harm.seasonalRatios.SON.toFixed(3)}</td>
                  <td className="p-2 text-right text-amber-400">{harm.terraOnlyRatios.SON.toFixed(3)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Cross-Validation Metrics */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs uppercase font-bold text-gray-400 tracking-wider">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Validation Metrics (Leave-One-Year-Out Cross-Validation)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="bg-app-bg/90 border border-app-border rounded-lg p-2.5">
              <span className="text-[10px] text-gray-400 block">Combined LOYO WAPE:</span>
              <span className="text-base font-bold text-emerald-400">
                {(harm.validation.wape * 100).toFixed(1)}%
              </span>
              <span className="text-[10px] text-gray-500 block mt-0.5">2012–2021 Benchmark</span>
            </div>
            <div className="bg-app-bg/90 border border-app-border rounded-lg p-2.5">
              <span className="text-[10px] text-gray-400 block">Terra-Only CV WAPE:</span>
              <span className="text-base font-bold text-emerald-400">
                {(harm.validation.wapeTerraOnly * 100).toFixed(1)}%
              </span>
              <span className="text-[10px] text-gray-500 block mt-0.5">Pre-Aqua Era (2000–02)</span>
            </div>
            <div className="bg-app-bg/90 border border-app-border rounded-lg p-2.5">
              <span className="text-[10px] text-gray-400 block">Forward Test Bias:</span>
              <span className="text-base font-bold text-amber-400">
                {(harm.validation.forwardTestBias * 100).toFixed(1)}%
              </span>
              <span className="text-[10px] text-gray-500 block mt-0.5">Train ≤2019, Test 2020–21</span>
            </div>
          </div>
        </div>

        {/* 5. Cell-Level Limitation Warning */}
        <div className="bg-amber-950/40 border border-amber-600/50 rounded-lg p-3 text-xs text-amber-300 space-y-1">
          <div className="flex items-center gap-2 font-bold uppercase">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Cell-Level Bias Limitation at Low Counts</span>
          </div>
          <p className="leading-relaxed text-[11px] text-amber-200/90">
            When MODIS detections are low (1–2 per cell), ratio models overestimate VIIRS counts by +78%.
            Predictions are only statistically reliable when aggregated over multiple grid cells or across entire regions.
          </p>
        </div>

        {/* 6. Tip Banner & Footer Action */}
        <div className="bg-sky-950/30 border border-sky-500/30 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs">
          <div className="text-sky-200 text-xs">
            <strong>Tip:</strong> Toggle between <em>&quot;Harmonized Index&quot;</em> and <em>&quot;Raw Sensors&quot;</em> in the top header to inspect the 2012 sensor step-change in the time-series chart and map markers.
          </div>
          <button
            onClick={() => setIsHarmonizationModalOpen(false)}
            className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-black font-bold text-xs shrink-0 transition"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
