import React, { useState } from 'react';
import { Globe, RotateCcw } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import type { Aoi } from '../../domain/aoi';

interface RegionPreset {
  id: string;
  name: string;
  lat: number;
  lon: number;
  radiusKm: number;
  aoi: Aoi;
}

const REGION_PRESETS: RegionPreset[] = [
  {
    id: 'statewide',
    name: 'Statewide California',
    lat: 37.2,
    lon: -119.5,
    radiusKm: 650,
    aoi: { mode: 'state' },
  },
  {
    id: 'norcal',
    name: 'Sierra Nevada / NorCal',
    lat: 39.8,
    lon: -120.9,
    radiusKm: 280,
    aoi: { mode: 'radius', center: [-120.9, 39.8], radiusKm: 280 },
  },
  {
    id: 'central',
    name: 'Central Coast / Valley',
    lat: 36.5,
    lon: -120.2,
    radiusKm: 240,
    aoi: { mode: 'radius', center: [-120.2, 36.5], radiusKm: 240 },
  },
  {
    id: 'socal',
    name: 'Southern California',
    lat: 34.2,
    lon: -117.8,
    radiusKm: 220,
    aoi: { mode: 'radius', center: [-117.8, 34.2], radiusKm: 220 },
  },
];

export const AoiFilterBar: React.FC = () => {
  const { aoi, setAoi, activeMonth, setActiveMonth } = useAppStore();

  const [lat, setLat] = useState<string>('37.2');
  const [lon, setLon] = useState<string>('-119.5');
  const [radius, setRadius] = useState<string>('300');

  const activePreset = REGION_PRESETS.find((p) => {
    if (p.aoi.mode === 'state' && aoi.mode === 'state') return true;
    if (
      p.aoi.mode === 'radius' &&
      aoi.mode === 'radius' &&
      Math.abs(p.aoi.center[0] - aoi.center[0]) < 0.1 &&
      Math.abs(p.aoi.center[1] - aoi.center[1]) < 0.1
    ) {
      return true;
    }
    return false;
  });

  const handleSelectPreset = (preset: RegionPreset) => {
    setLat(preset.lat.toFixed(1));
    setLon(preset.lon.toFixed(1));
    setRadius(preset.radiusKm.toString());
    setAoi(preset.aoi);
  };

  const handleApplyCoordinates = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);
    const parsedRadius = Math.max(20, Math.min(1000, parseFloat(radius) || 100));

    if (isNaN(parsedLat) || isNaN(parsedLon)) return;

    setAoi({
      mode: 'radius',
      center: [parsedLon, parsedLat],
      radiusKm: parsedRadius,
    });
  };

  const handleResetToPeak = () => {
    // California's historic record wildfire month: August 2020
    setActiveMonth('2020-08');
  };

  const formattedMonth = activeMonth
    ? new Date(`${activeMonth}-01T00:00:00Z`).toLocaleString('en-US', {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).toUpperCase()
    : 'AUG 2020';

  return (
    <section className="bg-app-surface1/80 border-b border-app-border px-4 py-2.5 lg:px-6">
      <div className="max-w-[1920px] mx-auto flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        {/* Region Presets */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 xl:pb-0">
          <span className="text-xs font-mono uppercase tracking-wider text-app-textMuted flex items-center gap-1.5 shrink-0 mr-1">
            <Globe className="w-3.5 h-3.5 text-sky-400" />
            AOI Region:
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {REGION_PRESETS.map((preset) => {
              const isActive = activePreset?.id === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono transition border ${
                    isActive
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm font-bold'
                      : 'bg-app-surface2 text-app-textMuted border-app-border hover:bg-app-elevated hover:text-app-text'
                  }`}
                >
                  {preset.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Lat/Lon Bounding & Radius Inspector */}
        <form onSubmit={handleApplyCoordinates} className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-app-surface2 px-2.5 py-1 rounded-xl border border-app-border">
            <span className="text-app-textSubdued font-mono">LAT:</span>
            <input
              type="number"
              step="0.1"
              min="30"
              max="45"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              className="w-16 bg-app-bg border border-app-border rounded-lg px-2 py-0.5 text-app-text font-mono focus:outline-none focus:border-sky-500"
            />
            <span className="text-app-textSubdued font-mono ml-1">LON:</span>
            <input
              type="number"
              step="0.1"
              min="-126"
              max="-112"
              value={lon}
              onChange={(e) => setLon(e.target.value)}
              className="w-16 bg-app-bg border border-app-border rounded-lg px-2 py-0.5 text-app-text font-mono focus:outline-none focus:border-sky-500"
            />
            <span className="text-app-textSubdued font-mono ml-1">RAD(km):</span>
            <input
              type="number"
              step="25"
              min="20"
              max="1000"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              className="w-16 bg-app-bg border border-app-border rounded-lg px-2 py-0.5 text-app-text font-mono focus:outline-none focus:border-sky-500"
            />
            <button
              type="submit"
              className="ml-1 px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 font-mono font-medium transition"
            >
              Inspect AOI
            </button>
          </div>

          {/* Active Time Slice Indicator */}
          <div className="flex items-center gap-2 bg-app-surface2 px-3 py-1 rounded-xl border border-app-border">
            <span className="text-app-textSubdued">Active Slice:</span>
            <span className="font-mono font-bold text-amber-400">{formattedMonth}</span>
            <button
              type="button"
              onClick={handleResetToPeak}
              title="Reset to 2020 Historic Record Peak"
              className="text-app-textMuted hover:text-white transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};

