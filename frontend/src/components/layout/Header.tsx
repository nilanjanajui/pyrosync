import React from 'react';
import { Flame, HelpCircle, Download, CalendarRange, Globe2 } from 'lucide-react';
import copy from '../../copy';
import { useAppStore } from '../../store/appStore';
import { studyName, type RegionEntry } from '../../domain/study';

interface HeaderProps {
  regions: RegionEntry[];
  regionId: string | null;
  onRegionChange: (id: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ regions, regionId, onRegionChange }) => {
  const { setIsHarmonizationModalOpen, setIsExportModalOpen, dataset } = useAppStore();
  const cov = dataset?.manifest.coverage;

  return (
    <header className="border-b border-app-border bg-gradient-to-b from-app-surface2 to-app-surface1 px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-[1920px] items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 shadow-[0_0_18px_rgba(249,115,22,0.35)]"
            aria-hidden="true"
          >
            <Flame className="h-5 w-5 text-black" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-tight tracking-tight text-white">{copy.header.title}</h1>
            {dataset && (
              <p className="truncate text-xs leading-normal text-app-textMuted">
                {copy.header.tagline(studyName(dataset))}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          {regions.length > 1 && (
            <label className="relative hidden items-center sm:flex">
              <span className="sr-only">{copy.header.regionLabel}</span>
              <Globe2 className="pointer-events-none absolute left-3 h-4 w-4 text-amber-400" aria-hidden="true" />
              <select
                value={regionId ?? regions[0].id}
                onChange={(e) => onRegionChange(e.target.value)}
                className="min-h-[44px] appearance-none rounded-lg border border-app-border bg-app-surface2 py-1.5 pl-9 pr-8 text-sm font-medium text-app-text hover:border-app-borderLight focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {cov && (
            <span className="hidden items-center gap-1.5 rounded-full border border-app-border bg-app-surface2 px-3 py-1.5 text-xs text-app-textMuted md:inline-flex">
              <CalendarRange className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
              {copy.header.coverageChip(cov.start, cov.end)}
            </span>
          )}

          <button
            type="button"
            onClick={() => setIsHarmonizationModalOpen(true)}
            aria-label={copy.header.howItWorksButton}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg border border-app-border bg-app-surface2 px-3 py-1.5 text-sm font-medium text-app-text transition-colors hover:border-app-borderLight hover:bg-app-elevated focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <HelpCircle className="h-4 w-4 text-amber-400" aria-hidden="true" />
            <span className="hidden sm:inline">{copy.header.howItWorksButton}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            aria-label={copy.header.downloadButton}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-1.5 text-sm font-semibold text-black shadow-sm transition-colors hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{copy.header.downloadButton}</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
