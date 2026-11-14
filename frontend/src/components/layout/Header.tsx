import React from 'react';
import { Flame, ExternalLink, HelpCircle, Download } from 'lucide-react';
import type { Manifest, Harmonization } from '../../datasource/schema';
import { useAppStore } from '../../store/appStore';

interface HeaderProps {
  manifest: Manifest;
  harmonization: Harmonization;
}

export const Header: React.FC<HeaderProps> = ({ manifest, harmonization }) => {
  const { setIsHarmonizationModalOpen, setIsExportModalOpen } = useAppStore();

  return (
    <header className="bg-app-surface1/95 border-b border-app-border backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 py-2.5">
      <div className="max-w-[1720px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left Identity */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-app-accent/30 to-app-accent/10 border border-app-accent/40 rounded-lg text-app-accent shadow-[0_0_15px_rgba(249,115,22,0.3)]">
            <Flame className="w-5 h-5 animate-pulse" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-widest text-app-text font-mono uppercase">
                PyroSync
              </h1>
              <span className="text-xs px-2 py-0.5 rounded bg-app-surface2 border border-app-border text-app-textMuted font-mono font-medium">
                v{manifest.version}
              </span>
              <span className="hidden sm:inline-block text-[11px] px-2 py-0.5 rounded bg-sky-950/70 border border-sky-800/80 text-sky-400 font-mono tracking-wider font-semibold">
                NASA SPACE APPS
              </span>
            </div>
            <p className="text-xs text-app-textMuted font-medium tracking-tight">
              California Burning Activity Observatory · <span className="text-app-textSubdued">Harmonized active-fire detection records</span>
            </p>
          </div>
        </div>

        {/* Right Badges & Tactical Actions */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded bg-app-surface2 border border-app-border text-app-textMuted font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>CA · {manifest.coverage.start} → {manifest.coverage.end}</span>
          </div>

          <button
            onClick={() => setIsHarmonizationModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-app-surface2 hover:bg-app-elevated border border-app-border hover:border-app-borderLight text-app-text transition-all font-mono text-[11px] font-medium focus:ring-1 focus:ring-app-accent"
            title="Inspect seasonal ratio models, Terra-only era math, and LOYO-CV validation"
          >
            <HelpCircle className="w-3.5 h-3.5 text-app-accent" aria-hidden="true" />
            <span>Methodology</span>
            <span className="text-[10px] text-app-textSubdued font-normal">({harmonization.status})</span>
          </button>

          <button
            onClick={() => setIsExportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-app-accent/20 hover:bg-app-accent/30 border border-app-accent/40 text-app-accent transition-all font-mono text-[11px] font-semibold focus:ring-1 focus:ring-app-accent"
            title="Download CSV of current AOI detection time-series"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Export CSV</span>
          </button>

          <a
            href="https://github.com/nilanjanajui/pyrosync"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-app-surface2 hover:bg-app-elevated border border-app-border text-app-textMuted hover:text-app-text transition-colors font-mono text-[11px]"
          >
            <span>GitHub</span>
            <ExternalLink className="w-3 h-3 text-app-textSubdued" aria-hidden="true" />
          </a>
        </div>
      </div>
    </header>
  );
};
