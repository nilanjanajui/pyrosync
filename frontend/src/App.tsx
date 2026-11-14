import React, { useEffect, useState, useCallback } from 'react';
import { loadDataset, type DatasetLoadError } from './datasource/load';
import { SyntheticBanner } from './components/common/SyntheticBanner';
import { ErrorScreen } from './components/common/ErrorScreen';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { FireMap } from './components/map/FireMap';
import { RightPanel } from './components/panel/RightPanel';
import { HowItWorksDrawer } from './components/modals/HowItWorksDrawer';
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
      <div className="min-h-screen bg-app-bg flex flex-col items-center justify-center text-app-text p-4 font-sans">
        <div className="p-3 bg-app-surface1 border border-amber-500/40 rounded-2xl mb-3 shadow-[0_0_20px_rgba(245,158,11,0.2)] animate-pulse">
          <Flame className="w-8 h-8 text-amber-400" aria-hidden="true" />
        </div>
        <h2 className="text-sm font-bold tracking-wider uppercase text-white">
          Loading PyroSync Satellite Records...
        </h2>
      </div>
    );
  }

  if (error) {
    return <ErrorScreen error={error} onRetry={loadData} />;
  }

  if (!dataset) return null;

  return (
    <div className="min-h-screen bg-app-bg text-app-text flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Screen Reader Skip Link */}
      <a
        href="#main-workspace"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-amber-500 focus:text-black focus:rounded focus:text-xs focus:font-bold"
      >
        Skip to main analytical workspace
      </a>

      {/* Screen Reader Polite Live Region */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveAnnouncement}
      </div>

      {/* Slim Persistent Synthetic Demo Banner in normal flow (Never overlaps header) */}
      <SyntheticBanner isSynthetic={dataset.manifest.synthetic} />

      {/* Top Bar: Logo, PyroSync, One-line tagline, Buttons: How it works, Download */}
      <Header />

      {/* Main Single-Screen Workspace (Desktop: one screen, no vertical page scroll) */}
      <main
        id="main-workspace"
        className="flex-1 max-w-[1920px] w-full mx-auto p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:h-[calc(100vh-84px)] lg:overflow-hidden"
      >
        {/* Left 65% (8 of 12 cols on desktop): Large Map with Region Chips & Timeline Slider */}
        <section aria-label="Spatial Activity Exploration" className="lg:col-span-8 flex flex-col h-full min-h-[460px] lg:min-h-0">
          <FireMap dataset={dataset} />
        </section>

        {/* Right 35% (4 of 12 cols on desktop): Right Panel (Summary, Calendar, Reliability, Download) */}
        <section aria-label="Temporal Activity Exploration" className="lg:col-span-4 flex flex-col h-full min-h-0 overflow-y-auto">
          <RightPanel />
        </section>
      </main>

      {/* Footer */}
      <Footer />

      {/* How it works drawer and Export CSV modal */}
      <HowItWorksDrawer />
      <ExportModal />
    </div>
  );
};

export default App;
