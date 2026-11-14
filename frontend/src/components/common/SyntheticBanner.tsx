import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface SyntheticBannerProps {
  isSynthetic: boolean;
}

export const SyntheticBanner: React.FC<SyntheticBannerProps> = ({ isSynthetic }) => {
  if (!isSynthetic) return null;

  return (
    <aside
      role="alert"
      aria-label="Synthetic Data Warning"
      className="bg-red-950/95 border-b-2 border-red-600 text-red-100 px-4 py-2 flex items-center justify-center gap-3 shadow-2xl z-50 sticky top-0 font-mono text-xs"
    >
      <div className="p-1 rounded bg-red-900 border border-red-500 text-white shrink-0">
        <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" aria-hidden="true" />
      </div>
      <div>
        <strong className="font-black tracking-wider uppercase text-white mr-2">
          ⚠ SYNTHETIC DEMO DATA
        </strong>
        <span className="text-red-200">
          Not for operational fire management decisions. Test dataset with simulated detection records.
        </span>
      </div>
    </aside>
  );
};
