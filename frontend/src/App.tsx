import React, { useEffect, useState, useCallback } from 'react';
import { loadDataset, type DatasetLoadError } from './datasource/load';
import { SyntheticBanner } from './components/common/SyntheticBanner';
import { ErrorScreen } from './components/common/ErrorScreen';
import { Header } from './components/layout/Header';
import { DatasetStatusStrip } from './components/layout/DatasetStatusStrip';
import { Footer } from './components/layout/Footer';
import { FireMap } from './components/map/FireMap';
import { BurnCalendar } from './components/calendar/BurnCalendar';
import { MonthInspector } from './components/inspector/MonthInspector';
import { HarmonizationModal } from './components/modals/HarmonizationModal';
import { ExportModal } from './components/modals/ExportModal';
import { Flame } from 'lucide-react';
import { useAppStore } from './store/appStore';
import { snapCellsToAoi } from './domain/aoi';

export const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DatasetLoadError | null>(null);

  const {
    dataset,
    setDataset,
    aoi,
    setSelectedCellIndexes,
    activeMonth,
    liveAnnouncement,
  } = useAppStore();

  // Custom dataset path support (?dataset=malformed)
  const queryParams = new URLSearchParams(window.location.search);
  const customDataset = queryParams.get('dataset');
  const basePath = customDataset === 'malformed' ? '/datasets/malformed' : '/datasets';

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadDataset(basePath);
      setDataset(data);
      // Initialize with statewide selection (all cells)
      setSelectedCellIndexes(data.grid.features.map((_, i) => i));
    } catch (err: unknown) {
      console.error('Failed to load dataset:', err);
      setError(err as DatasetLoadError);
    } finally {
      setLoading(false);
    }
  }, [basePath, setDataset, setSelectedCellIndexes]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync AOI changes with cell snapping
  useEffect(() => {
    if (!dataset) return;
    const indexes = snapCellsToAoi(aoi, dataset.grid.features);
    setSelectedCellIndexes(indexes);
  }, [aoi, dataset, setSelectedCellIndexes]);

  if (loading) {
    return (
      <div className="min-h-screen bg-app-bg flex flex-col items-center justify-center text-app-text p-4 font-mono">
        <div className="p-4 bg-app-surface1 border border-app-accent/40 rounded-2xl mb-4 shadow-[0_0_25px_rgba(249,115,22,0.3)] animate-pulse">
          <Flame className="w-10 h-10 text-app-accent" aria-hidden="true" />
        </div>
        <h2 className="text-sm font-bold tracking-widest uppercase">
          Initializing PyroSync Tactical Engine...
        </h2>
        <p className="text-xs text-app-textSubdued mt-1">
          Validating contract schemas &amp; constructing 22-year dense typed array matrices
        </p>
      </div>
    );
  }

  if (error) {
    return <ErrorScreen error={error} onRetry={loadData} />;
  }

  if (!dataset) return null;

  return (
    <div className="min-h-screen bg-app-bg text-app-text flex flex-col font-sans selection:bg-app-accent selection:text-white">
      {/* Screen Reader Skip Link */}
      <a
        href="#main-workspace"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-app-accent focus:text-white focus:rounded focus:text-xs focus:font-mono focus:font-bold"
      >
        Skip to main analytical workspace
      </a>

      {/* Screen Reader Polite Live Region (Section 71) */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveAnnouncement}
      </div>

      {/* Persistent Synthetic Demo Banner (Disappears when real data loads) */}
      <SyntheticBanner isSynthetic={dataset.manifest.synthetic} />

      {/* Global Mission Control Header */}
      <Header manifest={dataset.manifest} harmonization={dataset.harmonization} />

      {/* Dataset Status Strip */}
      <DatasetStatusStrip
        manifest={dataset.manifest}
        harmonization={dataset.harmonization}
        numMonths={dataset.numMonths}
      />

      {/* Primary Analytical Exploration Workspace (Map ~44% : Calendar ~56%) */}
      <main
        id="main-workspace"
        className="flex-1 max-w-[1720px] w-full mx-auto p-4 sm:p-6 space-y-4"
      >
        {/* Top Split: 3D Tactical Map (Where?) + Burn Calendar (When?) */}
        <div className="grid grid-cols-1 xl:grid-cols-[44%_56%] gap-4 items-start">
          {/* Spatial Activity: 3D Oblique Grid Map & AOI Snapping */}
          <section aria-label="Spatial Activity Exploration">
            <FireMap dataset={dataset} />
          </section>

          {/* Temporal Activity: 22-Year Burn Activity Calendar */}
          <section aria-label="Temporal Activity Exploration">
            <BurnCalendar />
          </section>
        </div>

        {/* Selected Month Scientific Inspection Dock (What does this number mean?) */}
        {activeMonth && (
          <div className="transition-all animate-fadeIn">
            <MonthInspector />
          </div>
        )}
      </main>

      {/* Persistent Technical Footer */}
      <Footer manifest={dataset.manifest} />

      {/* Interactive Modal Dialogs */}
      <HarmonizationModal />
      <ExportModal />
    </div>
  );
};
export default App;
