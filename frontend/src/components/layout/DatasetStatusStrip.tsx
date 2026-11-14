import React from 'react';
import { MapPin, Calendar, Layers, ShieldCheck } from 'lucide-react';
import type { Manifest, Harmonization } from '../../datasource/schema';
import { useAppStore } from '../../store/appStore';
import type { SensorMode } from '../../domain/aggregate';

interface DatasetStatusStripProps {
  manifest: Manifest;
  harmonization: Harmonization;
  numMonths: number;
}

export const DatasetStatusStrip: React.FC<DatasetStatusStripProps> = ({
  manifest,
  harmonization,
  numMonths,
}) => {
  const { sensorMode, setSensorMode, setIsHarmonizationModalOpen } = useAppStore();

  const handleModeClick = (mode: SensorMode) => {
    setSensorMode(mode);
  };

  return (
    <section
      aria-label="Dataset Status Strip"
      className="max-w-[1720px] mx-auto px-4 sm:px-6 pt-3 pb-1"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {/* Card 1: Study Area */}
        <div className="bg-app-surface1 border border-app-border rounded-lg p-2.5 flex items-center gap-3">
          <div className="p-2 rounded bg-app-surface2 border border-app-border text-app-accent">
            <MapPin className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-app-textSubdued font-mono font-semibold">
              Study Area
            </div>
            <div className="text-sm font-bold text-app-text truncate">
              {manifest.studyArea.name.split('(')[0].trim()}
            </div>
            <div className="text-[11px] text-app-textMuted font-mono">
              {manifest.grid.cells.toLocaleString()} cells ({manifest.grid.cellKm} km)
            </div>
          </div>
        </div>

        {/* Card 2: Record Coverage */}
        <div className="bg-app-surface1 border border-app-border rounded-lg p-2.5 flex items-center gap-3">
          <div className="p-2 rounded bg-app-surface2 border border-app-border text-sky-400">
            <Calendar className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-app-textSubdued font-mono font-semibold">
              Temporal Record
            </div>
            <div className="text-sm font-bold text-app-text font-mono truncate">
              {manifest.coverage.start} → {manifest.coverage.end}
            </div>
            <div className="text-[11px] text-app-textMuted font-mono">
              {numMonths} calendar months
            </div>
          </div>
        </div>

        {/* Card 3: Active Mode Selector Pill */}
        <div className="bg-app-surface1 border border-app-border rounded-lg p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-app-textSubdued font-mono font-semibold">
              Sensor Mode
            </span>
            <span className="text-[10px] text-app-textSubdued font-mono">
              {sensorMode === 'harmonized' ? 'VIIRS-equiv.' : 'Raw Counts'}
            </span>
          </div>
          <div role="radiogroup" aria-label="Sensor mode" className="flex gap-1 mt-1">
            <button
              role="radio"
              aria-checked={sensorMode === 'harmonized'}
              onClick={() => handleModeClick('harmonized')}
              className={`flex-1 px-1.5 py-1 rounded text-[11px] font-mono font-semibold transition-all text-center focus:outline-none focus:ring-1 focus:ring-app-accent ${
                sensorMode === 'harmonized'
                  ? 'bg-app-accent text-white shadow-[0_0_10px_rgba(249,115,22,0.4)]'
                  : 'bg-app-surface2 text-app-textMuted hover:text-app-text hover:bg-app-elevated'
              }`}
              title="Seamless 2000-2021 VIIRS-equivalent series using seasonal ratio model"
            >
              ≈ HARM
            </button>
            <button
              role="radio"
              aria-checked={sensorMode === 'modis'}
              onClick={() => handleModeClick('modis')}
              className={`flex-1 px-1.5 py-1 rounded text-[11px] font-mono font-semibold transition-all text-center focus:outline-none focus:ring-1 focus:ring-app-accent ${
                sensorMode === 'modis'
                  ? 'bg-amber-600 text-white shadow-[0_0_10px_rgba(217,119,6,0.4)]'
                  : 'bg-app-surface2 text-app-textMuted hover:text-app-text hover:bg-app-elevated'
              }`}
              title="Raw MODIS (Terra & Aqua) 1 km observations"
            >
              ◈ MODIS
            </button>
            <button
              role="radio"
              aria-checked={sensorMode === 'viirs'}
              onClick={() => handleModeClick('viirs')}
              className={`flex-1 px-1.5 py-1 rounded text-[11px] font-mono font-semibold transition-all text-center focus:outline-none focus:ring-1 focus:ring-app-accent ${
                sensorMode === 'viirs'
                  ? 'bg-sky-600 text-white shadow-[0_0_10px_rgba(2,132,199,0.4)]'
                  : 'bg-app-surface2 text-app-textMuted hover:text-app-text hover:bg-app-elevated'
              }`}
              title="Raw VIIRS (Suomi-NPP) 375m observations (starts 2012-01)"
            >
              ◇ VIIRS
            </button>
          </div>
        </div>

        {/* Card 4: Validation Status */}
        <div
          onClick={() => setIsHarmonizationModalOpen(true)}
          className="bg-app-surface1 border border-app-border hover:border-app-borderLight cursor-pointer rounded-lg p-2.5 flex items-center justify-between transition-colors group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded bg-app-surface2 border border-app-border text-emerald-400 group-hover:border-emerald-500/40 transition-colors">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-app-textSubdued font-mono font-semibold">
                Model Validation
              </div>
              <div className="text-sm font-bold text-emerald-400 font-mono flex items-center gap-1.5">
                <span>✓ {harmonization.status.toUpperCase()}</span>
              </div>
              <div className="text-[11px] text-app-textMuted font-mono">
                WAPE {(harmonization.validation.wape * 100).toFixed(1)}% · Bias {(harmonization.validation.forwardTestBias * 100).toFixed(1)}%
              </div>
            </div>
          </div>
          <Layers className="w-4 h-4 text-app-textSubdued group-hover:text-app-accent transition-colors shrink-0" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
};

