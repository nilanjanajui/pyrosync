import React, { useEffect, useState, useCallback } from 'react';
import { loadDataset, type DenseDataset, type DatasetLoadError } from './datasource/load';
import { SyntheticBanner } from './components/common/SyntheticBanner';
import { ErrorScreen } from './components/common/ErrorScreen';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { Flame, Layers, MapPin, Calendar, CheckCircle2 } from 'lucide-react';

export const App: React.FC = () => {
  const [dataset, setDataset] = useState<DenseDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DatasetLoadError | null>(null);

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
    } catch (err: unknown) {
      console.error('Failed to load dataset:', err);
      setError(err as DatasetLoadError);
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-4">
        <div className="p-4 bg-orange-600/20 border border-orange-500/40 rounded-2xl mb-4 animate-bounce">
          <Flame className="w-12 h-12 text-orange-500" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold tracking-tight">Initializing PyroSync Engine...</h2>
        <p className="text-sm text-slate-400 mt-1">Validating static data contract schemas & building dense matrices</p>
      </div>
    );
  }

  if (error) {
    return <ErrorScreen error={error} onRetry={loadData} />;
  }

  if (!dataset) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Persistent Synthetic Data Banner */}
      <SyntheticBanner isSynthetic={dataset.manifest.synthetic} />

      {/* Main App Header */}
      <Header manifest={dataset.manifest} harmonization={dataset.harmonization} />

      {/* Milestone 0 Scaffold Dashboard Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Welcome & Status Card */}
        <section
          aria-labelledby="scaffold-heading"
          className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800 mb-2">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Milestone 0: Scaffold & Data Contract Ready</span>
              </div>
              <h2 id="scaffold-heading" className="text-2xl font-bold tracking-tight text-white">
                Harmonized Satellite Fire Observation Platform
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Data pipeline validated. Dense typed arrays loaded ({dataset.numMonths} months × {dataset.numCells} cells).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="?dataset=malformed"
                className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
              >
                Test Malformed Schema Error Screen
              </a>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                <MapPin className="w-4 h-4 text-orange-400" aria-hidden="true" />
                <span>Study Area</span>
              </div>
              <div className="text-lg font-bold text-white mt-1 truncate" title={dataset.manifest.studyArea.name}>
                {dataset.manifest.studyArea.name}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {dataset.numCells} cells ({dataset.manifest.grid.cellKm} km)
              </div>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                <Calendar className="w-4 h-4 text-sky-400" aria-hidden="true" />
                <span>Temporal Coverage</span>
              </div>
              <div className="text-lg font-bold text-white mt-1">
                {dataset.manifest.coverage.start} — {dataset.manifest.coverage.end}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {dataset.numMonths} calendar months
              </div>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                <Flame className="w-4 h-4 text-red-400" aria-hidden="true" />
                <span>MODIS Total</span>
              </div>
              <div className="text-lg font-bold text-white mt-1">
                {dataset.manifest.totals.modisDetections.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Terra + Aqua (from {dataset.manifest.modisStart})
              </div>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                <Layers className="w-4 h-4 text-amber-400" aria-hidden="true" />
                <span>VIIRS Total</span>
              </div>
              <div className="text-lg font-bold text-white mt-1">
                {dataset.manifest.totals.viirsDetections.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Suomi-NPP (from {dataset.manifest.viirsStart})
              </div>
            </div>
          </div>
        </section>

        {/* Milestone Stubs Placeholder for Next Milestones */}
        <section
          aria-label="Planned Modules"
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              M2: Geospatial Map & AOI Snapping
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Interactive MapLibre GL choropleth, California boundary clipping, terra-draw polygon/rect selection, coordinate entry forms.
            </p>
          </div>

          <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-500" />
              M3: ARIA Burn Calendar & Sensor Modes
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              22-year calendar grid with arrow-key navigation, MODIS/VIIRS/Harmonized mode toggle, pre-launch hatched styling, and blend markers.
            </p>
          </div>
        </section>
      </main>

      {/* Persistent Footer */}
      <Footer manifest={dataset.manifest} />
    </div>
  );
};
export default App;

