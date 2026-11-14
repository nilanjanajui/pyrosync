import React from 'react';
import { AlertOctagon, RefreshCw, FileText } from 'lucide-react';
import type { DatasetLoadError } from '../../datasource/load';

interface ErrorScreenProps {
  error: DatasetLoadError;
  onRetry?: () => void;
}

export const ErrorScreen: React.FC<ErrorScreenProps> = ({ error, onRetry }) => {
  return (
    <main
      role="main"
      className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6"
    >
      <div className="max-w-2xl w-full bg-slate-900 border-2 border-red-600 rounded-xl p-8 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-red-950/80 border border-red-600 rounded-lg text-red-400">
            <AlertOctagon className="w-8 h-8" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-red-400 tracking-tight">
              Dataset Loading Failure
            </h1>
            <p className="mt-1 text-slate-300">
              The PyroSync data contract check failed while loading required static datasets.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 font-mono text-sm">
            <div className="flex items-center gap-2 text-orange-400 font-semibold mb-2">
              <FileText className="w-4 h-4" aria-hidden="true" />
              <span>Failed File: <strong className="text-white">{error.file}</strong></span>
            </div>
            {error.field && (
              <div className="text-slate-300 mb-2">
                Failed Field: <span className="text-yellow-400 font-semibold">{error.field}</span>
              </div>
            )}
            <div className="text-red-300 text-xs sm:text-sm whitespace-pre-wrap mt-2">
              {error.message}
            </div>
            {error.rawDetails && (
              <details className="mt-3 text-xs text-slate-400">
                <summary className="cursor-pointer hover:text-slate-200">View Validation Details</summary>
                <pre className="mt-2 p-2 bg-slate-900 rounded overflow-x-auto text-slate-300">
                  {error.rawDetails}
                </pre>
              </details>
            )}
          </div>

          <div className="text-sm text-slate-400">
            <p>
              Please run the backend verification command to inspect dataset integrity:
            </p>
            <code className="block mt-2 p-2 bg-slate-950 text-orange-400 rounded text-xs font-mono">
              python -m pyrosync.cli check --data frontend/public/datasets
            </code>
          </div>
        </div>

        {onRetry && (
          <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-medium rounded-lg transition-colors focus:ring-2 focus:ring-orange-400 focus:outline-none"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              Retry Loading
            </button>
          </div>
        )}
      </div>
    </main>
  );
};

