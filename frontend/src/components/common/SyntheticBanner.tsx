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
      className="bg-red-700 text-white px-4 py-2 text-center text-sm font-bold tracking-wide flex items-center justify-center gap-2 shadow-md z-50 sticky top-0"
    >
      <AlertTriangle className="w-5 h-5 flex-shrink-0 animate-pulse text-yellow-300" aria-hidden="true" />
      <span>
        SYNTHETIC DATA — Test & demonstration dataset generated with simulated fire activity. Not for operational emergency decisions.
      </span>
    </aside>
  );
};

