/**
 * FireMap — Tactical 3D Geospatial Command Center View
 * Inspired by NASA mission control & high-altitude reconnaissance telemetry.
 *
 * Features:
 *  - 3D oblique perspective camera (pitch: 45°, bearing: -10°) with 2D/3D toggle
 *  - Carto Dark Matter vector basemap + resilient offline slate-900 canvas fallback
 *  - 10 km equal-area grid choropleth with Cividis sequential ramp
 *  - Glowing tactical fire perimeter & contour lines
 *  - Heads-Up Display (HUD) overlay: telemetry statistics, index counter, and
 *    tactical California inset locator mini-map with live GPS coordinates
 *  - Direct AOI snapping & interactive click-to-select
 */
import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BASEMAP_STYLE_URL, FALLBACK_BLANK_STYLE } from '../../config/map-style';
import { CIVIDIS } from '../../config/colors';
import type { DenseDataset } from '../../datasource/load';
import { snapCellsToAoi, aoiBBox, estimateAoiAreaKm2, isAoiTooSmall } from '../../domain/aoi';
import { useAppStore } from '../../store/appStore';
import {
  Compass,
  Crosshair,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

interface FireMapProps {
  dataset: DenseDataset;
}

/** Build Cividis expression for grid choropleth */
function buildChoroplethExpression(maxCount: number): maplibregl.ExpressionSpecification {
  if (maxCount <= 0) return ['literal', '#11181E'];
  const stops: (number | string)[] = [];
  CIVIDIS.forEach((color, i) => {
    // Logarithmic curve to avoid blowout on extreme fire months
    const t = i / (CIVIDIS.length - 1);
    const val = t === 0 ? 0 : Math.pow(t, 1.8) * maxCount;
    stops.push(val, color);
  });
  return [
    'interpolate',
    ['linear'],
    ['feature-state', 'count'],
    ...stops,
  ] as maplibregl.ExpressionSpecification;
}

export const FireMap: React.FC<FireMapProps> = ({ dataset }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const {
    aoi,
    setAoi,
    selectedCellIndexes,
    setSelectedCellIndexes,
    activeMonth,
    sensorMode,
    is3dPerspective,
    setIs3dPerspective,
    setMapReady,
  } = useAppStore();

  const [basemapFailed, setBasemapFailed] = useState(false);
  const [aoiTab, setAoiTab] = useState<'state' | 'bbox' | 'radius'>('state');

  // Manual Bbox Form state
  const [bboxWest, setBboxWest] = useState('-122.5');
  const [bboxSouth, setBboxSouth] = useState('37.5');
  const [bboxEast, setBboxEast] = useState('-121.5');
  const [bboxNorth, setBboxNorth] = useState('38.5');

  // Manual Radius Form state
  const [radLon, setRadLon] = useState('-120.0');
  const [radLat, setRadLat] = useState('37.5');
  const [radiusKm, setRadiusKm] = useState('50');

  // Compute cell counts for active view (either activeMonth, or cumulative across all months)
  const cellCounts = useMemo(() => {
    const counts = new Float32Array(dataset.numCells);
    const mIdx = activeMonth ? dataset.monthIndexMap.get(activeMonth) : undefined;

    if (mIdx !== undefined && mIdx >= 0) {
      // Month-specific counts
      const offsetBase = mIdx * dataset.numCells;
      for (let c = 0; c < dataset.numCells; c++) {
        if (sensorMode === 'modis') {
          counts[c] = dataset.modisTotal[offsetBase + c];
        } else if (sensorMode === 'viirs') {
          counts[c] = dataset.viirsTotal[offsetBase + c];
        } else {
          counts[c] = dataset.harmonizedTotal[offsetBase + c];
        }
      }
    } else {
      // Cumulative across all months
      for (let m = 0; m < dataset.numMonths; m++) {
        const offsetBase = m * dataset.numCells;
        for (let c = 0; c < dataset.numCells; c++) {
          if (sensorMode === 'modis') {
            counts[c] += dataset.modisTotal[offsetBase + c];
          } else if (sensorMode === 'viirs') {
            counts[c] += dataset.viirsTotal[offsetBase + c];
          } else {
            counts[c] += dataset.harmonizedTotal[offsetBase + c];
          }
        }
      }
    }
    return counts;
  }, [dataset, activeMonth, sensorMode]);

  const maxCellCount = useMemo(() => {
    let max = 0;
    for (let i = 0; i < cellCounts.length; i++) {
      if (cellCounts[i] > max) max = cellCounts[i];
    }
    return max;
  }, [cellCounts]);

  const totalDetectionsInAoi = useMemo(() => {
    let sum = 0;
    for (const cIdx of selectedCellIndexes) {
      sum += cellCounts[cIdx];
    }
    return sum;
  }, [selectedCellIndexes, cellCounts]);

  const aoiArea = useMemo(() => estimateAoiAreaKm2(aoi), [aoi]);
  const isSmallAoi = useMemo(() => isAoiTooSmall(aoi), [aoi]);

  // Center coordinate for tactical HUD
  const centerCoord = useMemo(() => {
    if (aoi.mode === 'radius') return aoi.center;
    if (aoi.mode === 'bbox') {
      return [(aoi.bbox[0] + aoi.bbox[2]) / 2, (aoi.bbox[1] + aoi.bbox[3]) / 2] as [number, number];
    }
    return [-119.5, 37.2] as [number, number]; // CA center
  }, [aoi]);

  // Initialize Map
  const initMap = useCallback(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: basemapFailed ? FALLBACK_BLANK_STYLE : BASEMAP_STYLE_URL,
      center: [-119.5, 37.2],
      zoom: 5.7,
      pitch: is3dPerspective ? 45 : 0,
      bearing: is3dPerspective ? -10 : 0,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on('error', (e) => {
      if (!basemapFailed && e.error?.message?.toLowerCase().includes('style')) {
        setBasemapFailed(true);
        map.setStyle(FALLBACK_BLANK_STYLE);
      }
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-left');

    map.on('load', () => {
      // 1. California Boundary Glow Base
      map.addSource('ca-boundary', {
        type: 'geojson',
        data: dataset.boundary as GeoJSON.GeoJSON,
      });

      // Ambient boundary fill
      map.addLayer({
        id: 'ca-boundary-glow',
        type: 'line',
        source: 'ca-boundary',
        paint: {
          'line-color': '#F97316',
          'line-width': 4,
          'line-opacity': 0.15,
          'line-blur': 3,
        },
      });

      map.addLayer({
        id: 'ca-boundary-line',
        type: 'line',
        source: 'ca-boundary',
        paint: {
          'line-color': '#38BDF8',
          'line-width': 1.2,
          'line-opacity': 0.6,
        },
      });

      // 2. 10 km Equal-Area Grid with promoteId for setFeatureState
      map.addSource('ca-grid', {
        type: 'geojson',
        data: dataset.grid as GeoJSON.GeoJSON,
        promoteId: 'id',
      });

      // Purple/violet topographic isoline grid texture (inspired by user's reference image)
      map.addLayer({
        id: 'ca-grid-isolines',
        type: 'line',
        source: 'ca-grid',
        paint: {
          'line-color': '#a855f7',
          'line-width': 0.6,
          'line-opacity': 0.18,
          'line-dasharray': [3, 2],
        },
      });

      // Primary Cividis choropleth fill
      map.addLayer({
        id: 'ca-grid-fill',
        type: 'fill',
        source: 'ca-grid',
        paint: {
          'fill-color': buildChoroplethExpression(maxCellCount),
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            0.88,
            ['>', ['feature-state', 'count'], 0],
            0.75,
            0.05,
          ],
        },
      });

      // Glowing tactical perimeter stroke for selected / active fire cells
      map.addLayer({
        id: 'ca-grid-glow-perimeter',
        type: 'line',
        source: 'ca-grid',
        paint: {
          'line-color': '#F97316',
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            3.5,
            0,
          ],
          'line-blur': 2,
          'line-opacity': 0.8,
        },
      });

      map.addLayer({
        id: 'ca-grid-stroke',
        type: 'line',
        source: 'ca-grid',
        paint: {
          'line-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            '#FFA050',
            '#1E2B35',
          ],
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            1.8,
            0.4,
          ],
          'line-opacity': 0.7,
        },
      });

      // Click cell to toggle 25 km radius AOI
      map.on('click', 'ca-grid-fill', (e) => {
        if (!e.features || e.features.length === 0) return;
        const feat = e.features[0];
        const lon = feat.properties?.lon as number;
        const lat = feat.properties?.lat as number;
        if (lon == null || lat == null) return;

        setAoi({ mode: 'radius', center: [lon, lat], radiusKm: 25 });
        setRadLon(lon.toFixed(3));
        setRadLat(lat.toFixed(3));
        setRadiusKm('25');
        setAoiTab('radius');
      });

      map.on('mouseenter', 'ca-grid-fill', () => {
        map.getCanvas().style.cursor = 'crosshair';
      });
      map.on('mouseleave', 'ca-grid-fill', () => {
        map.getCanvas().style.cursor = '';
      });

      setMapReady(true);
    });
  }, [dataset, maxCellCount, basemapFailed, is3dPerspective, setAoi, setMapReady]);

  useEffect(() => {
    initMap();
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync 2D/3D camera perspective toggle
  const toggle3d = () => {
    const next = !is3dPerspective;
    setIs3dPerspective(next);
    const map = mapRef.current;
    if (map) {
      map.easeTo({
        pitch: next ? 45 : 0,
        bearing: next ? -10 : 0,
        duration: 800,
      });
    }
  };

  // Sync AOI & counts into feature-states
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const matched = snapCellsToAoi(aoi, dataset.grid.features);
    const matchedSet = new Set(matched);
    setSelectedCellIndexes(matched);

    dataset.grid.features.forEach((f, i) => {
      map.setFeatureState(
        { source: 'ca-grid', id: f.properties.id },
        { count: cellCounts[i], selected: matchedSet.has(i) }
      );
    });

    // Update fill color expression based on current max
    if (map.getLayer('ca-grid-fill')) {
      map.setPaintProperty('ca-grid-fill', 'fill-color', buildChoroplethExpression(maxCellCount));
    }

    // Camera fly to AOI bounds
    if (aoi.mode !== 'state') {
      const bbox = aoiBBox(aoi);
      if (bbox) {
        map.fitBounds(
          [
            [bbox[0], bbox[1]],
            [bbox[2], bbox[3]],
          ],
          { padding: 60, maxZoom: 9, duration: 800 }
        );
      }
    }
  }, [aoi, cellCounts, maxCellCount, dataset, setSelectedCellIndexes]);

  const handleResetStatewide = () => {
    setAoi({ mode: 'state' });
    setAoiTab('state');
    const map = mapRef.current;
    if (map) {
      map.easeTo({
        center: [-119.5, 37.2],
        zoom: 5.7,
        pitch: is3dPerspective ? 45 : 0,
        bearing: is3dPerspective ? -10 : 0,
        duration: 800,
      });
    }
  };

  const handleApplyBbox = (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseFloat(bboxWest);
    const s = parseFloat(bboxSouth);
    const ee = parseFloat(bboxEast);
    const n = parseFloat(bboxNorth);
    if (!isNaN(w) && !isNaN(s) && !isNaN(ee) && !isNaN(n) && w < ee && s < n) {
      setAoi({ mode: 'bbox', bbox: [w, s, ee, n] });
    }
  };

  const handleApplyRadius = (e: React.FormEvent) => {
    e.preventDefault();
    const lo = parseFloat(radLon);
    const la = parseFloat(radLat);
    const r = parseFloat(radiusKm);
    if (!isNaN(lo) && !isNaN(la) && !isNaN(r) && r > 0) {
      setAoi({ mode: 'radius', center: [lo, la], radiusKm: r });
    }
  };

  return (
    <div className="bg-app-surface1 border border-app-border rounded-xl flex flex-col overflow-hidden shadow-2xl">
      {/* Map Header Toolbar */}
      <div className="px-4 py-2.5 border-b border-app-border bg-app-surface1 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-app-accent" aria-hidden="true" />
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-app-text">
            Spatial Activity · 10 km Equal-Area Grid
          </h2>
          <span className="text-[11px] text-app-textSubdued font-mono">
            ({dataset.grid.features.length.toLocaleString()} cells)
          </span>
        </div>

        {/* Tactical View Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggle3d}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-medium transition-all focus:outline-none focus:ring-1 focus:ring-app-accent ${
              is3dPerspective
                ? 'bg-app-accent/20 border border-app-accent/50 text-app-accent shadow-[0_0_10px_rgba(249,115,22,0.3)]'
                : 'bg-app-surface2 border border-app-border text-app-textMuted hover:text-app-text'
            }`}
            title="Toggle between 3D oblique perspective and 2D nadir plan view"
          >
            <Compass className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{is3dPerspective ? '3D Tactical' : '2D Plan'}</span>
          </button>

          {aoi.mode !== 'state' && (
            <button
              onClick={handleResetStatewide}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-app-surface2 hover:bg-app-elevated border border-app-border text-app-textMuted hover:text-app-text transition-all text-xs font-mono"
              title="Reset Area of Interest to statewide California"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
              <span>Reset Statewide</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Map Canvas with Reference-Image Style HUD Overlays */}
      <div className="relative w-full h-[460px] sm:h-[500px] bg-app-bg overflow-hidden">
        <div
          ref={mapContainerRef}
          className="w-full h-full cursor-crosshair"
          role="application"
          aria-label="California 10km fire detection map. Click any cell to snap area of interest."
          tabIndex={0}
        />

        {/* Tactical HUD Overlay — Inspired directly by User's Reference Image */}
        <div className="absolute top-4 right-4 pointer-events-none z-10 flex flex-col items-end text-right">
          <div className="text-3xl sm:text-4xl font-black font-mono tracking-tighter text-app-text drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] leading-none">
            {activeMonth ? activeMonth.split('-')[1] : '01'}
          </div>
          <div className="bg-app-text text-app-bg px-2 py-0.5 mt-1 font-mono font-black text-xs uppercase tracking-widest">
            {aoi.mode === 'state' ? 'CALIFORNIA' : aoi.mode === 'radius' ? 'AOI RADIUS' : 'AOI BBOX'}
          </div>
          <div className="text-[11px] font-mono text-app-textMuted mt-1">
            {activeMonth || 'Cumulative Record'}
          </div>

          {/* Telemetry Readout */}
          <div className="bg-app-bg/90 backdrop-blur-md border border-app-border rounded-lg p-2.5 mt-2.5 shadow-2xl text-left font-mono space-y-1 w-44">
            <div className="flex items-center justify-between text-xs">
              <span className="text-app-textSubdued">Detections:</span>
              <span className="text-app-text font-bold tabular-nums">
                {Math.round(totalDetectionsInAoi).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-app-textSubdued">Cells:</span>
              <span className="text-app-text font-bold tabular-nums">
                {selectedCellIndexes.length.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-app-textSubdued">Area:</span>
              <span className="text-app-text font-bold tabular-nums">
                ≈{Math.round(aoiArea).toLocaleString()} km²
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-app-border">
              <span className="text-app-textSubdued">Mode:</span>
              <span className="text-app-accent font-semibold">
                {sensorMode.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Right Tactical Inset Mini-Map with GPS Coordinates */}
        <div className="absolute bottom-4 right-4 pointer-events-none z-10 hidden sm:flex flex-col items-end">
          <div className="bg-app-bg/95 backdrop-blur-md border border-app-border rounded-lg p-2 shadow-2xl w-36 flex flex-col items-center">
            {/* California silhouette with locator dot */}
            <div className="w-24 h-24 relative flex items-center justify-center">
              <svg viewBox="0 0 100 120" className="w-full h-full stroke-app-textMuted fill-app-surface2">
                {/* Simplified CA outline */}
                <path
                  d="M15,5 L85,5 L85,35 L95,65 L70,115 L45,115 L25,95 L15,40 Z"
                  strokeWidth="1.5"
                  strokeOpacity="0.4"
                  fillOpacity="0.25"
                />
                {/* Active location crosshair dot */}
                <circle cx="50" cy="55" r="4" fill="#F97316" className="animate-ping" opacity="0.6" />
                <circle cx="50" cy="55" r="3" fill="#F97316" />
              </svg>
              <div className="absolute top-1 right-1 text-[9px] font-mono text-app-textSubdued">
                CA LOCATOR
              </div>
            </div>
            {/* GPS coordinates readout */}
            <div className="text-[10px] font-mono text-app-textSubdued tracking-tight text-center mt-1 border-t border-app-border w-full pt-1">
              [{centerCoord[1].toFixed(4)}°N, {centerCoord[0].toFixed(4)}°W]
            </div>
          </div>
        </div>

        {/* Bottom Left Cividis Legend */}
        <div className="absolute bottom-4 left-4 z-10 bg-app-bg/95 backdrop-blur-md border border-app-border rounded-lg p-2.5 shadow-2xl font-mono text-xs max-w-xs">
          <div className="text-[10px] uppercase text-app-textSubdued tracking-wider mb-1 flex items-center justify-between">
            <span>Detection Records</span>
            <span className="text-[9px] text-app-textSubdued font-normal">(Cividis Scale)</span>
          </div>
          <div
            className="h-2.5 w-44 rounded-sm border border-app-border"
            style={{
              background: `linear-gradient(to right, ${CIVIDIS.join(', ')})`,
            }}
            aria-hidden="true"
          />
          <div className="flex justify-between text-[10px] text-app-textMuted mt-1 tabular-nums">
            <span>0</span>
            <span>{Math.round(maxCellCount / 4).toLocaleString()}</span>
            <span>{Math.round(maxCellCount).toLocaleString()}+</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5 pt-1 border-t border-app-border text-[10px] text-app-textSubdued">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-app-accent" />
              <span>Selected AOI</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-[#11181E] border border-app-border" />
              <span>Zero</span>
            </span>
          </div>
        </div>
      </div>

      {/* AOI Tactical Controls Dock (Directly Below Map) */}
      <div className="p-3 bg-app-surface1 border-t border-app-border space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* AOI Mode Tabs */}
          <div role="tablist" aria-label="Area of interest selection mode" className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-mono text-app-textSubdued font-semibold mr-1">
              AOI:
            </span>
            <button
              role="tab"
              aria-selected={aoiTab === 'state'}
              onClick={handleResetStatewide}
              className={`px-3 py-1 rounded text-xs font-mono font-medium transition-all ${
                aoiTab === 'state'
                  ? 'bg-app-accent text-white shadow-[0_0_8px_rgba(249,115,22,0.3)]'
                  : 'bg-app-surface2 text-app-textMuted hover:text-app-text'
              }`}
            >
              Statewide
            </button>
            <button
              role="tab"
              aria-selected={aoiTab === 'bbox'}
              onClick={() => setAoiTab('bbox')}
              className={`px-3 py-1 rounded text-xs font-mono font-medium transition-all ${
                aoiTab === 'bbox'
                  ? 'bg-app-accent text-white shadow-[0_0_8px_rgba(249,115,22,0.3)]'
                  : 'bg-app-surface2 text-app-textMuted hover:text-app-text'
              }`}
            >
              Bounding Box
            </button>
            <button
              role="tab"
              aria-selected={aoiTab === 'radius'}
              onClick={() => setAoiTab('radius')}
              className={`px-3 py-1 rounded text-xs font-mono font-medium transition-all ${
                aoiTab === 'radius'
                  ? 'bg-app-accent text-white shadow-[0_0_8px_rgba(249,115,22,0.3)]'
                  : 'bg-app-surface2 text-app-textMuted hover:text-app-text'
              }`}
            >
              Center + Radius
            </button>
          </div>

          {/* Quick AOI Summary Info */}
          <div className="flex items-center gap-2 text-xs font-mono text-app-textMuted">
            <span className="text-app-text font-bold">
              {selectedCellIndexes.length.toLocaleString()} cells
            </span>
            <span>·</span>
            <span>≈{Math.round(aoiArea).toLocaleString()} km²</span>
          </div>
        </div>

        {/* Tab Forms */}
        {aoiTab === 'bbox' && (
          <form onSubmit={handleApplyBbox} className="flex flex-wrap items-center gap-2 pt-1 font-mono text-xs">
            <div className="flex items-center gap-1 bg-app-surface2 border border-app-border px-2 py-1 rounded">
              <span className="text-app-textSubdued">W:</span>
              <input
                type="number"
                step="0.1"
                value={bboxWest}
                onChange={(e) => setBboxWest(e.target.value)}
                className="w-16 bg-transparent text-app-text focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1 bg-app-surface2 border border-app-border px-2 py-1 rounded">
              <span className="text-app-textSubdued">E:</span>
              <input
                type="number"
                step="0.1"
                value={bboxEast}
                onChange={(e) => setBboxEast(e.target.value)}
                className="w-16 bg-transparent text-app-text focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1 bg-app-surface2 border border-app-border px-2 py-1 rounded">
              <span className="text-app-textSubdued">S:</span>
              <input
                type="number"
                step="0.1"
                value={bboxSouth}
                onChange={(e) => setBboxSouth(e.target.value)}
                className="w-16 bg-transparent text-app-text focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1 bg-app-surface2 border border-app-border px-2 py-1 rounded">
              <span className="text-app-textSubdued">N:</span>
              <input
                type="number"
                step="0.1"
                value={bboxNorth}
                onChange={(e) => setBboxNorth(e.target.value)}
                className="w-16 bg-transparent text-app-text focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1 bg-app-accent hover:bg-orange-500 text-white rounded font-bold transition-all focus:ring-1 focus:ring-white"
            >
              Apply Box
            </button>
          </form>
        )}

        {aoiTab === 'radius' && (
          <form onSubmit={handleApplyRadius} className="flex flex-wrap items-center gap-2 pt-1 font-mono text-xs">
            <div className="flex items-center gap-1 bg-app-surface2 border border-app-border px-2 py-1 rounded">
              <span className="text-app-textSubdued">Lon:</span>
              <input
                type="number"
                step="0.1"
                value={radLon}
                onChange={(e) => setRadLon(e.target.value)}
                className="w-16 bg-transparent text-app-text focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1 bg-app-surface2 border border-app-border px-2 py-1 rounded">
              <span className="text-app-textSubdued">Lat:</span>
              <input
                type="number"
                step="0.1"
                value={radLat}
                onChange={(e) => setRadLat(e.target.value)}
                className="w-16 bg-transparent text-app-text focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2 bg-app-surface2 border border-app-border px-2 py-1 rounded">
              <span className="text-app-textSubdued">Radius:</span>
              <input
                type="range"
                min="5"
                max="150"
                value={radiusKm}
                onChange={(e) => setRadiusKm(e.target.value)}
                className="w-24 accent-app-accent"
              />
              <span className="w-10 text-right tabular-nums text-app-text">{radiusKm} km</span>
            </div>
            <button
              type="submit"
              className="px-3 py-1 bg-app-accent hover:bg-orange-500 text-white rounded font-bold transition-all focus:ring-1 focus:ring-white"
            >
              Apply Radius
            </button>
          </form>
        )}

        {/* Small AOI Statistical Warning (< 500 km²) */}
        {isSmallAoi && (
          <div
            role="alert"
            className="flex items-start gap-2 bg-amber-950/40 border border-amber-600/50 rounded-lg p-2 text-xs text-amber-300 font-mono"
          >
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <span className="font-bold uppercase">Small AOI Warning (&lt; 500 km²): </span>
              Cell-level predictions carry high variance at low counts (+78% bias for 1–2 detections). Predictions are only statistically reliable when summed over larger geographic regions.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
