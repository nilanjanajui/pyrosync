import React from 'react';
import { Flame, Layers, GitCompare, HelpCircle, Download, ExternalLink } from 'lucide-react';
import type { Manifest, Harmonization } from '../../datasource/schema';
import { useAppStore } from '../../store/appStore';

interface HeaderProps {
  manifest: Manifest;
  harmonization: Harmonization;
}

export const Header: React.FC<HeaderProps> = ({ manifest, harmonization }) => {
  const {
    sensorMode,
    setSensorMode,
    setIsHarmonizationModalOpen,
    setIsExportModalOpen,
  } = useAppStore();

  return (
    <header className="sticky top-0 z-40 bg-app-bg/95 backdrop-blur-md border-b border-app-border px-4 py-3 lg:px-6 font-mono">
      <div className="max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand / Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 via-orange-600 to-red-700 flex items-center justify-center shadow-lg shadow-orange-950/50 border border-amber-400/30 shrink-0">
            <Flame className="w-5 h-5 text-white animate-pulse" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white font-mono">
                PyroSync: Harmonized MODIS &amp; VIIRS Burning Activity Calendar
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30">
                NASA Space Apps 2026
              </span>
            </div>
            <p className="text-xs text-app-textMuted hidden sm:block">
              Cross-Sensor Thermal Anomaly Normalization (Terra/Aqua MODIS 1km + SNPP/NOAA-20 VIIRS 375m &bull; {manifest.coverage.start}–{manifest.coverage.end})
            </p>
          </div>
        </div>

        {/* Global Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-xs">
          {/* Sensor Mode Switch */}
          <div
            className="bg-app-surface1 p-1 rounded-xl border border-app-border flex items-center"
            role="group"
            aria-label="Sensor Harmonization Mode"
          >
            <button
              onClick={() => setSensorMode('harmonized')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                sensorMode === 'harmonized'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm font-bold'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Harmonized Index</span>
            </button>
            <button
              onClick={() => setSensorMode(sensorMode === 'harmonized' ? 'viirs' : 'harmonized')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                sensorMode !== 'harmonized'
                  ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40 shadow-sm font-bold'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>Raw Sensors</span>
            </button>
          </div>

          {/* Methodology Info Button */}
          <button
            onClick={() => setIsHarmonizationModalOpen(true)}
            className="px-3 py-2 rounded-xl bg-app-surface1 hover:bg-app-surface2 text-gray-200 text-xs font-medium border border-app-border transition flex items-center gap-1.5"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Harmonization Methodology</span>
            <span className="md:hidden">Method ({harmonization.status})</span>
          </button>

          {/* Download CSV Button */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-bold text-xs shadow-lg shadow-orange-950/40 transition flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-black" />
            <span>Export CSV</span>
          </button>

          <a
            href="https://github.com/nilanjanajui/pyrosync"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden xl:inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-app-surface1 hover:bg-app-surface2 border border-app-border text-app-textMuted hover:text-app-text transition-colors text-xs"
          >
            <span>GitHub</span>
            <ExternalLink className="w-3 h-3 text-app-textSubdued" />
          </a>
        </div>
      </div>
    </header>
  );
};
