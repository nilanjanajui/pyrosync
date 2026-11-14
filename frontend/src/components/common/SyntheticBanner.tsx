import React from 'react';
import copy from '../../copy';

interface SyntheticBannerProps {
  isSynthetic: boolean;
}

export const SyntheticBanner: React.FC<SyntheticBannerProps> = ({ isSynthetic }) => {
  if (!isSynthetic) return null;

  return (
    <div
      role="alert"
      aria-label="Synthetic Data Warning"
      className="bg-amber-950/80 border-b border-amber-600/50 text-amber-100 px-4 py-1 text-xs flex items-center justify-center gap-2 font-sans relative z-10"
    >
      <span className="font-bold tracking-wider uppercase text-[11px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
        {copy.syntheticBanner.badge}
      </span>
      <span className="text-amber-200 text-xs">
        {copy.syntheticBanner.message}
      </span>
    </div>
  );
};

export default SyntheticBanner;
