import React from 'react';
import type { Manifest } from '../../datasource/schema';
import { useAppStore } from '../../store/appStore';
import { Flame, ShieldAlert, FileText, Database } from 'lucide-react';

interface FooterProps {
  manifest: Manifest;
}

export const Footer: React.FC<FooterProps> = ({ manifest }) => {
  const { setIsHarmonizationModalOpen, setIsExportModalOpen } = useAppStore();

  return (
    <footer
      role="contentinfo"
      className="bg-app-bg border-t border-app-border text-app-textMuted py-8 px-4 sm:px-6 font-mono text-xs"
    >
      <div className="max-w-[1720px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
        {/* Left Branding & Mission */}
        <div className="space-y-2 max-w-xl">
          <div className="flex items-center gap-2 text-app-text font-black text-sm uppercase tracking-wider">
            <Flame className="w-4 h-4 text-app-accent" aria-hidden="true" />
            <span>PyroSync</span>
            <span className="text-app-textSubdued font-normal">·</span>
            <span className="text-xs font-normal text-app-textSubdued">
              NASA Space Apps Challenge 2026 Entry
            </span>
          </div>
          <p className="text-[11px] text-app-textSubdued leading-relaxed">
            Temporal &amp; spatial harmonization of MODIS and VIIRS satellite active-fire observation records for California.
          </p>
          <div className="flex items-center gap-2 text-[11px] text-amber-400/90 bg-amber-950/20 border border-amber-900/40 rounded px-2.5 py-1 w-fit">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>
              Data record concludes <strong className="text-amber-300">{manifest.coverage.end}</strong>. A detection count is not a unique fire or burned acreage.
            </span>
          </div>
        </div>

        {/* Right Navigation Links & Citations */}
        <div className="flex flex-col sm:flex-row gap-6 text-[11px]">
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase font-bold text-app-text tracking-wider">
              Scientific Instrumentation
            </div>
            <ul className="space-y-1 text-app-textMuted">
              <li>
                <button
                  onClick={() => setIsHarmonizationModalOpen(true)}
                  className="hover:text-app-text transition-colors flex items-center gap-1"
                >
                  <FileText className="w-3 h-3 text-app-accent" aria-hidden="true" />
                  <span>Methodology &amp; Ratios</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => setIsExportModalOpen(true)}
                  className="hover:text-app-text transition-colors flex items-center gap-1"
                >
                  <Database className="w-3 h-3 text-app-accent" aria-hidden="true" />
                  <span>Download AOI Series (CSV)</span>
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-1.5">
            <div className="text-[10px] uppercase font-bold text-app-text tracking-wider">
              Satellite Sensors
            </div>
            <ul className="space-y-1 text-app-textSubdued">
              <li>MODIS Terra (from {manifest.modisStart})</li>
              <li>MODIS Aqua (from {manifest.firstAquaMonth})</li>
              <li>VIIRS Suomi-NPP (from {manifest.viirsStart})</li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
};
