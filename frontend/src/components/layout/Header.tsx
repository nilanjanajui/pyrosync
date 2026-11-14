import React from 'react';
import { Flame, HelpCircle, Download } from 'lucide-react';
import copy from '../../copy';
import { useAppStore } from '../../store/appStore';

export const Header: React.FC = () => {
  const { setIsHarmonizationModalOpen, setIsExportModalOpen } = useAppStore();

  return (
    <header className="bg-app-surface1 border-b border-app-border px-4 py-2.5 sm:px-6">
      <div className="max-w-[1920px] mx-auto flex items-center justify-between gap-4">
        {/* Brand & One-line description */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0"
            aria-hidden="true"
          >
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-white tracking-tight leading-tight">
              {copy.header.title}
            </h1>
            <p className="text-xs text-app-textMuted truncate leading-normal">
              {copy.header.tagline}
            </p>
          </div>
        </div>

        {/* Action Buttons: How it works & Download */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsHarmonizationModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-lg bg-app-surface2 hover:bg-app-elevated border border-app-border hover:border-app-borderLight text-xs sm:text-sm font-medium text-app-text transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <HelpCircle className="w-4 h-4 text-amber-400" aria-hidden="true" />
            <span>{copy.header.howItWorksButton}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 min-h-[44px] rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs sm:text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
          >
            <Download className="w-4 h-4 text-black" aria-hidden="true" />
            <span>{copy.header.downloadButton}</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
