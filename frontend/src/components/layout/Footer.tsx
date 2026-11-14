import React from 'react';
import copy from '../../copy';

export const Footer: React.FC = () => {
  return (
    <footer
      role="contentinfo"
      className="bg-app-surface1 border-t border-app-border py-2 px-4 sm:px-6 text-xs text-app-textMuted font-sans"
    >
      <div className="max-w-[1920px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
        <div>
          <span>{copy.footer.archiveNote} </span>
          <span className="text-gray-300 font-medium">Record ends December 2021 (2021-12). </span>
          <span className="text-app-textSubdued">{copy.footer.detectionSemantics}</span>
        </div>
        <div className="text-[11px] text-app-textSubdued">
          WCAG 2.2 AA compliant &bull; NASA Space Apps Challenge
        </div>
      </div>
    </footer>
  );
};

export default Footer;
