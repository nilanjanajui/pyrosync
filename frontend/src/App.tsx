import React, { useEffect, useState, useCallback } from 'react';
import { loadDataset, type DatasetLoadError } from './datasource/load';
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
import { setEra } from './domain/era';
import type { RegionEntry } from './domain/study';

export const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DatasetLoadError | null>(null);
  const [regions, setRegions] = useState<RegionEntry[] | null>(null);
  const [regionId, setRegionId] = useState<string | null>(new URLSearchParams(window.location.search).get('region'));

  // Optional region registry; a missing file just means a single-region deployment.
  useEffect(() => {
    fetch('/datasets/regions.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((list: unknown) => {
        const ok = Array.isArray(list) ? (list as RegionEntry[]).filter((x) => x?.id && x?.name && x?.path) : [];
        setRegions(ok);
      })
      .catch(() => setRegions([]));
  }, []);

  const {
    dataset,
    setDataset,
    aoi,
    setSelectedCellIndexes,
    setDateRange,
    setActiveMonth,
    liveAnnouncement,
  } = useAppStore();

  // Custom dataset path support (?dataset=malformed)
  const queryParams = new URLSearchParams(window.location.search);
  const customDataset = queryParams.get('dataset');
  const regionPath = regions?.find((r) => r.id === regionId)?.path ?? regions?.[0]?.path;
  const basePath = customDataset === 'malformed' ? '/datasets/malformed' : regionPath ?? '/datasets';

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadDataset(basePath);
      setEra({
        blendStart: data.manifest.viirsFirstCompleteMonth,
        partialMonths: data.manifest.viirsPartialMonths,
        firstAquaMonth: data.manifest.firstAquaMonth,
      });
      setDataset(data);
      setDateRange(data.months[0], data.months[data.numMonths - 1]);
      setActiveMonth(data.months[data.numMonths - 1]); // the latest month: "this month vs history"
      // Initialize with statewide selection (all cells)
      setSelectedCellIndexes(data.grid.features.map((_, i) => i));
    } catch (err: unknown) {
      console.error('Failed to load dataset:', err);
      setError(err as DatasetLoadError);
    } finally {
      setLoading(false);
    }
  }, [basePath, setDataset, setSelectedCellIndexes, setDateRange, setActiveMonth]);

  useEffect(() => {
    if (regions === null) return; // wait for the registry check so the right dataset loads first
    loadData();
  }, [loadData, regions]);

  const changeRegion = (id: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('region', id);
    window.history.replaceState({}, '', url);
    setRegionId(id);
  };

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
          Loading satellite records…
        </h2>
      </div>
    );
  }

  if (error) {
    return <ErrorScreen error={error} onRetry={loadData} />;
  }

  if (!dataset) return null;

  return (
    <div className="min-h-screen lg:h-screen bg-app-bg text-app-text flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
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

      {/* Top bar: logo, name, study area, how it works, download */}
      <Header regions={regions ?? []} regionId={regionId ?? regions?.[0]?.id ?? null} onRegionChange={changeRegion} />

      {/* Main Single-Screen Workspace (Desktop: one screen, no vertical page scroll) */}
      <main
        id="main-workspace"
        className="flex-1 max-w-[1920px] w-full mx-auto p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:min-h-0 lg:overflow-hidden"
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
