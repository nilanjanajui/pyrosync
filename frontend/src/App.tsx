import React, { useEffect, useState, useCallback } from 'react';
import { loadDataset, type DatasetLoadError } from './datasource/load';
import { SyntheticBanner } from './components/common/SyntheticBanner';
import { ErrorScreen } from './components/common/ErrorScreen';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { FireMap } from './components/map/FireMap';
import { AoiControls } from './components/aoi/AoiControls';
import { BurnCalendar } from './components/calendar/BurnCalendar';
import { SensorToggle } from './components/calendar/SensorToggle';
import { MonthDetailPanel } from './components/calendar/MonthDetailPanel';
import { Flame } from 'lucide-react';
import { useAppStore } from './store/appStore';
import { snapCellsToAoi } from './domain/aoi';

export const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DatasetLoadError | null>(null);

  const { dataset, setDataset, aoi, setSelectedCellIndexes, activeMonth } = useAppStore();

  // Check URL query parameters for test dataset paths (e.g. ?dataset=malformed)
  const queryParams = new URLSearchParams(window.location.search);
  const customDataset = queryParams.get('dataset');
  const basePath = customDataset === 'malformed' ? '/datasets/malformed' : '/datasets';

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadDataset(basePath);
      setDataset(data);
      // Initialize cell selection (state-wide = all cells)
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

  // Sync AOI → cell indexes whenever AOI changes after initial load
  useEffect(() => {
    if (!dataset) return;
    const indexes = snapCellsToAoi(aoi, dataset.grid.features);
    setSelectedCellIndexes(indexes);
  }, [aoi, dataset, setSelectedCellIndexes]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-4">
        <div className="p-4 bg-orange-600/20 border border-orange-500/40 rounded-2xl mb-4 animate-bounce">
          <Flame className="w-12 h-12 text-orange-500" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold tracking-tight">Initializing PyroSync Engine...</h2>
        <p className="text-sm text-slate-400 mt-1">Validating static data contract schemas &amp; building dense matrices</p>
      </div>
    );
  }

  if (error) {
    return <ErrorScreen error={error} onRetry={loadData} />;
  }

  if (!dataset) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Skip link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-orange-600 focus:text-white focus:rounded focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>

      {/* Persistent Synthetic Data Banner */}
      <SyntheticBanner isSynthetic={dataset.manifest.synthetic} />

      {/* Main App Header */}
      <Header manifest={dataset.manifest} harmonization={dataset.harmonization} />

      {/* Main layout */}
      <main id="main-content" className="flex-1 max-w-screen-2xl w-full mx-auto p-4 sm:p-5 space-y-5">

        {/* Top section: Map + Controls */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
          {/* Map */}
          <section aria-labelledby="map-heading" className="space-y-2">
            <h2 id="map-heading" className="text-sm font-semibold text-slate-300">
              California 10 km Grid — Harmonized Fire Activity
            </h2>
            <div className="h-[420px] rounded-xl overflow-hidden border border-slate-800">
              <FireMap dataset={dataset} />
            </div>
            <p className="text-xs text-slate-500">
              Click a grid cell to set a 15 km radius AOI, or use the controls to the right for custom selection.
              Choropleth shows cumulative harmonized VIIRS-equivalent detection records across all years.
            </p>
          </section>

          {/* Controls sidebar */}
          <aside aria-label="Area of interest and sensor controls" className="space-y-4">
            <AoiControls />
            <SensorToggle harmonization={dataset.harmonization} />
          </aside>
        </div>

        {/* Calendar + Detail panel */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5">
          <BurnCalendar />
          {activeMonth ? (
            <MonthDetailPanel />
          ) : (
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5 flex items-center justify-center">
              <p className="text-xs text-slate-500 text-center">
                Click any calendar cell to see detailed statistics for that month.
              </p>
            </div>
          )}
        </div>

      </main>

      {/* Persistent Footer */}
      <Footer manifest={dataset.manifest} />
    </div>
  );
};
export default App;
