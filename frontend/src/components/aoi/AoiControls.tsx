/**
 * AOI Selection Controls — bbox form, center+radius form, state-wide reset.
 * Fully keyboard-accessible: no mouse-only paths.
 */
import React, { useState, useId } from 'react';
import { MapPin, Circle, Map, AlertTriangle } from 'lucide-react';
import type { Aoi } from '../../domain/aoi';
import { isAoiTooSmall, estimateAoiAreaKm2 } from '../../domain/aoi';
import { useAppStore } from '../../store/appStore';

interface AoiControlsProps {
  onAoiChange?: (aoi: Aoi) => void;
}

export const AoiControls: React.FC<AoiControlsProps> = ({ onAoiChange }) => {
  const { aoi, setAoi } = useAppStore();
  const [tab, setTab] = useState<'state' | 'bbox' | 'radius'>('state');
  const id = useId();

  // Bbox form state
  const [west, setWest] = useState('-122.5');
  const [south, setSouth] = useState('37.5');
  const [east, setEast] = useState('-121.5');
  const [north, setNorth] = useState('38.5');

  // Radius form state
  const [lon, setLon] = useState('-122.0');
  const [lat, setLat] = useState('38.0');
  const [radius, setRadius] = useState('50');

  const [error, setError] = useState<string | null>(null);

  const apply = (newAoi: Aoi) => {
    setAoi(newAoi);
    onAoiChange?.(newAoi);
    setError(null);
  };

  const handleStateWide = () => {
    setTab('state');
    apply({ mode: 'state' });
  };

  const handleBbox = (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseFloat(west);
    const s = parseFloat(south);
    const ee = parseFloat(east);
    const n = parseFloat(north);
    if (isNaN(w) || isNaN(s) || isNaN(ee) || isNaN(n)) {
      setError('All bbox fields must be valid numbers.');
      return;
    }
    if (w >= ee || s >= n) {
      setError('West must be < East and South must be < North.');
      return;
    }
    apply({ mode: 'bbox', bbox: [w, s, ee, n] });
  };

  const handleRadius = (e: React.FormEvent) => {
    e.preventDefault();
    const lo = parseFloat(lon);
    const la = parseFloat(lat);
    const r = parseFloat(radius);
    if (isNaN(lo) || isNaN(la) || isNaN(r) || r <= 0) {
      setError('Enter valid center coordinates and a positive radius.');
      return;
    }
    apply({ mode: 'radius', center: [lo, la], radiusKm: r });
  };

  const tooSmall = isAoiTooSmall(aoi);
  const areaKm2 = estimateAoiAreaKm2(aoi);

  const tabClass = (t: string) =>
    `px-3 py-1.5 text-xs font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 ${
      tab === t
        ? 'bg-orange-600 text-white'
        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
    }`;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
        <MapPin className="w-4 h-4 text-orange-400" aria-hidden="true" />
        Area of Interest
      </h3>

      {/* Tab buttons */}
      <div role="tablist" aria-label="AOI selection mode" className="flex gap-2 flex-wrap">
        <button
          role="tab"
          aria-selected={tab === 'state'}
          aria-controls={`${id}-panel`}
          className={tabClass('state')}
          onClick={handleStateWide}
        >
          <Map className="w-3 h-3 inline mr-1" aria-hidden="true" />
          Statewide
        </button>
        <button
          role="tab"
          aria-selected={tab === 'bbox'}
          aria-controls={`${id}-panel`}
          className={tabClass('bbox')}
          onClick={() => setTab('bbox')}
        >
          <MapPin className="w-3 h-3 inline mr-1" aria-hidden="true" />
          Bounding Box
        </button>
        <button
          role="tab"
          aria-selected={tab === 'radius'}
          aria-controls={`${id}-panel`}
          className={tabClass('radius')}
          onClick={() => setTab('radius')}
        >
          <Circle className="w-3 h-3 inline mr-1" aria-hidden="true" />
          Center + Radius
        </button>
      </div>

      {/* Panel content */}
      <div id={`${id}-panel`} role="tabpanel">
        {tab === 'state' && (
          <p className="text-xs text-slate-400">
            All {(423_970).toLocaleString()} km² of California are included.
          </p>
        )}

        {tab === 'bbox' && (
          <form onSubmit={handleBbox} className="space-y-2" aria-label="Bounding box AOI form">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'West (°lon)', val: west, set: setWest, id: `${id}-west` },
                { label: 'East (°lon)', val: east, set: setEast, id: `${id}-east` },
                { label: 'South (°lat)', val: south, set: setSouth, id: `${id}-south` },
                { label: 'North (°lat)', val: north, set: setNorth, id: `${id}-north` },
              ].map(({ label, val, set, id: fid }) => (
                <div key={fid}>
                  <label htmlFor={fid} className="block text-xs text-slate-400 mb-0.5">
                    {label}
                  </label>
                  <input
                    id={fid}
                    type="number"
                    step="0.01"
                    value={val}
                    onChange={(e) => set(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              ))}
            </div>
            <button
              type="submit"
              className="w-full py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              Apply Bounding Box
            </button>
          </form>
        )}

        {tab === 'radius' && (
          <form onSubmit={handleRadius} className="space-y-2" aria-label="Center and radius AOI form">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Longitude (°)', val: lon, set: setLon, id: `${id}-lon` },
                { label: 'Latitude (°)', val: lat, set: setLat, id: `${id}-lat` },
                { label: 'Radius (km)', val: radius, set: setRadius, id: `${id}-r`, min: '1' },
              ].map(({ label, val, set, id: fid, min }) => (
                <div key={fid}>
                  <label htmlFor={fid} className="block text-xs text-slate-400 mb-0.5">
                    {label}
                  </label>
                  <input
                    id={fid}
                    type="number"
                    step="0.1"
                    min={min}
                    value={val}
                    onChange={(e) => set(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              ))}
            </div>
            <button
              type="submit"
              className="w-full py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              Apply Radius
            </button>
          </form>
        )}
      </div>

      {/* Validation error */}
      {error && (
        <p role="alert" className="text-xs text-red-400 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" aria-hidden="true" />
          {error}
        </p>
      )}

      {/* Area + small-AOI warning */}
      {aoi.mode !== 'state' && (
        <div className="text-xs text-slate-400 space-y-1">
          <p>
            Estimated area:{' '}
            <span className="text-slate-200 font-medium">{Math.round(areaKm2).toLocaleString()} km²</span>
          </p>
          {tooSmall && (
            <p role="alert" className="text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" aria-hidden="true" />
              Small AOI — cell-level predictions are biased at low counts. Sum over a larger area for reliable results.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

