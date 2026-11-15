import React from 'react';
import { FlaskConical } from 'lucide-react';
import copy from '../../copy';

/** Small, persistent marker shown wherever numbers are displayed while the dataset is synthetic. */
export const DemoBadge: React.FC<{ isSynthetic: boolean }> = ({ isSynthetic }) => {
  if (!isSynthetic) return null;
  return (
    <span
      role="note"
      title={copy.demo.message}
      aria-label={`${copy.demo.badge}. ${copy.demo.message}`}
      className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300"
    >
      <FlaskConical className="h-3 w-3" aria-hidden="true" />
      {copy.demo.badge}
    </span>
  );
};

export default DemoBadge;
