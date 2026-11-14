import React, { useState } from 'react';
import { X, HelpCircle, ChevronDown, ChevronRight, Sliders } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import type { SensorMode } from '../../domain/aggregate';
import copy from '../../copy';

export const HowItWorksDrawer: React.FC = () => {
  const {
    isHarmonizationModalOpen,
    setIsHarmonizationModalOpen,
    sensorMode,
    setSensorMode,
    setAoi,
    dataset,
  } = useAppStore();

  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [lat, setLat] = useState('37.2');
  const [lon, setLon] = useState('-119.5');
  const [rad, setRad] = useState('150');

  if (!isHarmonizationModalOpen) return null;

  const handleApplyCoords = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);
    const parsedRad = Math.max(20, Math.min(1000, parseFloat(rad) || 100));

    if (!isNaN(parsedLat) && !isNaN(parsedLon)) {
      setAoi({
        mode: 'radius',
        center: [parsedLon, parsedLat],
        radiusKm: parsedRad,
      });
      setIsHarmonizationModalOpen(false);
    }
  };

  const validation = dataset?.harmonization?.validation;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-it-works-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
    >
      <div className="bg-app-surface1 border border-app-borderLight rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-6 font-sans text-app-text">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-app-border pb-3">
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-5 h-5 text-amber-400" />
            <h2 id="how-it-works-title" className="text-lg font-bold text-white tracking-tight">
              {copy.drawer.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setIsHarmonizationModalOpen(false)}
            aria-label={copy.drawer.closeButton}
            className="p-1.5 rounded-lg bg-app-surface2 hover:bg-app-elevated border border-app-border text-app-textMuted hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Short Plain-Language Paragraphs */}
        <div className="space-y-4 text-sm text-gray-200 leading-relaxed">
          <div className="bg-app-surface2/60 p-4 rounded-xl border border-app-border/80">
            <h3 className="text-sm font-bold text-amber-400 mb-1">
              1. {copy.drawer.paragraph1Title}
            </h3>
            <p className="text-gray-300 text-xs sm:text-sm">
              {copy.drawer.paragraph1}
            </p>
          </div>

          <div className="bg-app-surface2/60 p-4 rounded-xl border border-app-border/80">
            <h3 className="text-sm font-bold text-amber-400 mb-1">
              2. {copy.drawer.paragraph2Title}
            </h3>
            <p className="text-gray-300 text-xs sm:text-sm">
              {copy.drawer.paragraph2}
            </p>
          </div>

          <div className="bg-app-surface2/60 p-4 rounded-xl border border-app-border/80">
            <h3 className="text-sm font-bold text-amber-400 mb-1">
              3. {copy.drawer.paragraph3Title}
            </h3>
            <p className="text-gray-300 text-xs sm:text-sm">
              {copy.drawer.paragraph3}
            </p>
          </div>
        </div>

        {/* Plain-Language Glossary */}
        <div className="bg-app-bg/80 border border-app-border rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-app-textSubdued">
            {copy.drawer.glossaryTitle}
          </h3>
          <dl className="space-y-2 text-xs sm:text-sm">
            <div>
              <dt className="font-bold text-white inline">{copy.drawer.glossaryHotspotTitle}: </dt>
              <dd className="inline text-gray-300">{copy.drawer.glossaryHotspotDef}</dd>
            </div>
            <div>
              <dt className="font-bold text-white inline">{copy.drawer.glossaryEstimatedTitle}: </dt>
              <dd className="inline text-gray-300">{copy.drawer.glossaryEstimatedDef}</dd>
            </div>
            <div>
              <dt className="font-bold text-white inline">{copy.drawer.glossaryMeasuredTitle}: </dt>
              <dd className="inline text-gray-300">{copy.drawer.glossaryMeasuredDef}</dd>
            </div>
          </dl>
        </div>

        {/* Advanced Disclosure for Scientists & Advanced Users */}
        <div className="border border-app-border rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className="w-full p-3.5 bg-app-surface2 hover:bg-app-elevated flex items-center justify-between text-xs font-semibold text-gray-300 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              <span>{copy.drawer.advancedTitle}</span>
            </span>
            {isAdvancedOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {isAdvancedOpen && (
            <div className="p-4 bg-app-bg/90 space-y-4 text-xs border-t border-app-border">
              <p className="text-gray-400">
                {copy.drawer.advancedDescription}
              </p>

              {/* Raw Sensor Mode Toggle */}
              <div>
                <label className="font-bold text-gray-200 block mb-1.5">
                  {copy.drawer.sensorToggleLabel}
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['harmonized', 'modis', 'viirs'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSensorMode(mode as SensorMode)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        sensorMode === mode
                          ? 'bg-amber-500 text-black border-amber-400 font-bold'
                          : 'bg-app-surface2 text-gray-300 border-app-border hover:bg-app-elevated'
                      }`}
                    >
                      {mode === 'harmonized'
                        ? copy.drawer.harmonizedUnified
                        : mode === 'modis'
                        ? copy.drawer.rawModis
                        : copy.drawer.rawViirs}
                    </button>
                  ))}
                </div>
              </div>

              {/* Coordinate Inputs Form */}
              <form onSubmit={handleApplyCoords} className="space-y-2 pt-2 border-t border-app-border/80">
                <span className="font-bold text-gray-200 block">Custom Coordinate Inspection:</span>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1">
                    <span className="text-gray-400 font-mono">Lat:</span>
                    <input
                      type="number"
                      step="0.1"
                      value={lat}
                      onChange={(e) => setLat(e.target.value)}
                      className="w-16 bg-app-surface2 border border-app-border rounded px-1.5 py-1 text-white font-mono"
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    <span className="text-gray-400 font-mono">Lon:</span>
                    <input
                      type="number"
                      step="0.1"
                      value={lon}
                      onChange={(e) => setLon(e.target.value)}
                      className="w-16 bg-app-surface2 border border-app-border rounded px-1.5 py-1 text-white font-mono"
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    <span className="text-gray-400 font-mono">Radius(km):</span>
                    <input
                      type="number"
                      step="10"
                      value={rad}
                      onChange={(e) => setRad(e.target.value)}
                      className="w-16 bg-app-surface2 border border-app-border rounded px-1.5 py-1 text-white font-mono"
                    />
                  </label>
                  <button
                    type="submit"
                    className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded"
                  >
                    Apply Area
                  </button>
                </div>
              </form>

              {/* Statistical Validation Data */}
              {validation && (
                <div className="pt-2 border-t border-app-border/80 text-[11px] font-mono text-gray-400 space-y-1">
                  <div>Cross-Validation Regional Accuracy: {(validation.wape * 100).toFixed(1)}% typical error</div>
                  <div>Pre-Aqua (2000–2002) Accuracy: {(validation.wapeTerraOnly * 100).toFixed(1)}% typical error</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Close */}
        <div className="flex justify-end pt-2 border-t border-app-border">
          <button
            type="button"
            onClick={() => setIsHarmonizationModalOpen(false)}
            className="px-4 py-2 bg-app-surface2 hover:bg-app-elevated border border-app-border text-white rounded-lg text-sm font-semibold transition-colors"
          >
            {copy.drawer.closeButton}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HowItWorksDrawer;
