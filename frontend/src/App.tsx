import React, { useEffect, useState, useCallback } from 'react';
import { loadDataset, type DatasetLoadError } from './datasource/load';
import { SyntheticBanner } from './components/common/SyntheticBanner';
import { ErrorScreen } from './components/common/ErrorScreen';
import { Header } from './components/layout/Header';
import { AoiFilterBar } from './components/layout/AoiFilterBar';
import { DatasetStatusStrip } from './components/layout/DatasetStatusStrip';
import { Footer } from './components/layout/Footer';
import { KpiMetricsGrid } from './components/inspector/KpiMetricsGrid';
import { FireMap } from './components/map/FireMap';
import { AnalyticsCharts } from './components/inspector/AnalyticsCharts';
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
    <div className="min-h-screen bg-app-bg text-app-text flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Screen Reader Skip Link */}
      <a
        href="#main-workspace"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-app-accent focus:text-white focus:rounded focus:text-xs focus:font-mono focus:font-bold"
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

      {/* Persistent Synthetic Demo Banner (Disappears when real data loads) */}
      <SyntheticBanner isSynthetic={dataset.manifest.synthetic} />

      {/* Global Mission Control Header */}
      <Header manifest={dataset.manifest} harmonization={dataset.harmonization} />

      {/* AOI Region & Coordinate Inspector Bar */}
      <AoiFilterBar />

      {/* Dataset Status Strip */}
      <DatasetStatusStrip
        manifest={dataset.manifest}
        harmonization={dataset.harmonization}
        numMonths={dataset.numMonths}
      />

      {/* Primary Analytical Exploration Workspace (7 cols Left : 5 cols Right) */}
      <main
        id="main-workspace"
        className="flex-1 max-w-[1920px] w-full mx-auto p-4 lg:p-6 grid grid-cols-1 xl:grid-cols-12 gap-5"
      >
        {/* Left Column (7 cols): KPIs + Interactive FireMap + Dual Analytics Charts */}
        <div className="xl:col-span-7 flex flex-col gap-5">
          {/* 4 KPI Metrics */}
          <KpiMetricsGrid />

          {/* Interactive FireMap with Fire Emoji Hotspot Markers */}
          <section aria-label="Spatial Activity Exploration">
            <FireMap dataset={dataset} />
          </section>

          {/* Dual Analytics Time-Series Charts */}
          <section aria-label="Analytics Time-Series & Seasonal Profile">
            <AnalyticsCharts />
          </section>
        </div>

        {/* Right Column (5 cols): Harmonized Burning Activity Calendar + Month Inspector */}
        <div className="xl:col-span-5 flex flex-col gap-5">
          {/* 22-Year Burn Activity Calendar Heatmap */}
          <section aria-label="Temporal Activity Exploration">
            <BurnCalendar />
          </section>

          {/* Selected Month Scientific Provenance & Uncertainty Inspector */}
          {activeMonth && (
            <div className="transition-all animate-fadeIn">
              <MonthInspector />
            </div>
          )}
        </div>
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
