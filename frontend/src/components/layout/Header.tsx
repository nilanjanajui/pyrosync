import React from 'react';
import { Flame, Database, ShieldCheck, GitBranch } from 'lucide-react';
import type { Manifest, Harmonization } from '../../datasource/schema';

interface HeaderProps {
  manifest?: Manifest;
  harmonization?: Harmonization;
}

export const Header: React.FC<HeaderProps> = ({ manifest, harmonization }) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Logo and Title */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-600/20 border border-orange-500/40 rounded-lg text-orange-500">
            <Flame className="w-6 h-6 animate-pulse" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">PyroSync</h1>
              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                NASA Space Apps 2026
              </span>
            </div>
            <p className="text-xs text-slate-400">
              MODIS & VIIRS Satellite Hotspot Harmonization
            </p>
          </div>
        </div>

        {/* Metadata Badges */}
        {manifest && (
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded border border-slate-800 text-slate-300">
              <Database className="w-3.5 h-3.5 text-orange-400" aria-hidden="true" />
              <span>Coverage: <strong>{manifest.coverage.start}</strong> to <strong>{manifest.coverage.end}</strong></span>
            </div>

            {harmonization && (
              <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded border border-slate-800 text-slate-300">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
                <span>
                  Harmonization: <strong className="capitalize">{harmonization.status}</strong> ({harmonization.version})
                </span>
              </div>
            )}

            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded border border-slate-800 text-slate-400">
              <GitBranch className="w-3.5 h-3.5" aria-hidden="true" />
              <span>v{manifest.version}</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

