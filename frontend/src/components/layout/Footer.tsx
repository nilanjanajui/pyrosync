import React from 'react';
import copy from '../../copy';
import { useAppStore } from '../../store/appStore';
import { DemoBadge } from '../common/DemoBadge';

export const Footer: React.FC = () => {
  const dataset = useAppStore((s) => s.dataset);
  const end = dataset?.manifest.coverage.end;
  return (
    <footer role="contentinfo" className="border-t border-app-border bg-app-surface1 px-4 py-2 text-xs text-app-textMuted sm:px-6">
      <div className="mx-auto flex max-w-[1920px] flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-left">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <DemoBadge isSynthetic={!!dataset?.manifest.synthetic} />
          <span>{copy.footer.archiveNote}</span>
          {end && <span className="font-medium text-gray-300">{copy.footer.coverageNote(end)}</span>}
          <span>{copy.footer.detectionSemantics}</span>
        </div>
        <div className="text-[11px] text-app-textSubdued">NASA Space Apps Challenge 2026</div>
      </div>
    </footer>
  );
};

export default Footer;
