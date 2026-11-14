import React from 'react';
import { Calendar, Github, AlertCircle } from 'lucide-react';
import type { Manifest } from '../../datasource/schema';

interface FooterProps {
  manifest?: Manifest;
}

export const Footer: React.FC<FooterProps> = ({ manifest }) => {
  return (
    <footer className="bg-slate-950 border-t border-slate-800 py-6 px-4 text-xs text-slate-400 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Coverage Note */}
        <div className="flex items-center gap-2 text-slate-300">
          <Calendar className="w-4 h-4 text-orange-400 flex-shrink-0" aria-hidden="true" />
          <span>
            Coverage: <strong>{manifest?.coverage.start ?? '2000-11'}</strong> to{' '}
            <strong>{manifest?.coverage.end ?? '2021-12'}</strong>. The dataset ends at{' '}
            {manifest?.coverage.end ?? '2021-12'} (not real-time).
          </span>
        </div>

        {/* Disclaimer and Links */}
        <div className="flex items-center gap-4 flex-wrap justify-center">
          <div className="flex items-center gap-1.5 text-slate-400">
            <AlertCircle className="w-4 h-4 text-yellow-400" aria-hidden="true" />
            <span>Aggregated detection records (10 km cell-month), not individual fires.</span>
          </div>
          <a
            href="https://github.com/nilanjanajui/pyrosync"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-slate-300 hover:text-orange-400 transition-colors focus:ring-1 focus:ring-orange-400"
          >
            <Github className="w-4 h-4" aria-hidden="true" />
            <span>Repository</span>
          </a>
        </div>
      </div>
    </footer>
  );
};

