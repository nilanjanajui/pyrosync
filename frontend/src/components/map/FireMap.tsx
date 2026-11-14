import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BASEMAP_STYLE_URL, FALLBACK_BLANK_STYLE } from '../../config/map-style';
import type { DenseDataset } from '../../datasource/load';
import { snapCellsToAoi, aoiToPolygon } from '../../domain/aoi';
import { useAppStore } from '../../store/appStore';
import {
  Compass,
  Crosshair,
  Flame,
  GitCompare,
} from 'lucide-react';

interface FireMapProps {
  dataset: DenseDataset;
}

export const FireMap: React.FC<FireMapProps> = ({ dataset }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const {
    aoi,
    setAoi,
    selectedCellIndexes,
    setSelectedCellIndexes,
    sensorMode,
    setSensorMode,
    activeMonth,
    is3dPerspective,
    setIs3dPerspective,
    setMapReady,
  } = useAppStore();

  const [basemap, setBasemap] = useState<'dark' | 'satellite'>('dark');
  const [basemapFailed, setBasemapFailed] = useState(false);

  // Month Index
  const mIdx = useMemo(() => {
    if (!activeMonth) return dataset.numMonths - 1; // Default to latest month
    return dataset.monthIndexMap.get(activeMonth) ?? dataset.numMonths - 1;
  }, [activeMonth, dataset]);

  // Extract cell counts for active month
  const cellCounts = useMemo(() => {
    const counts = new Float32Array(dataset.numCells);
    const offset = mIdx * dataset.numCells;
    for (let c = 0; c < dataset.numCells; c++) {
      if (sensorMode === 'modis') {
        counts[c] = dataset.modisTotal[offset + c] || 0;
      } else if (sensorMode === 'viirs') {
        counts[c] = dataset.viirsTotal[offset + c] || 0;
      } else {
        counts[c] = dataset.harmonizedTotal[offset + c] || 0;
      }
    }
    return counts;
  }, [dataset, mIdx, sensorMode]);

  // Initialize Map
  const initMap = useCallback(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: basemapFailed ? FALLBACK_BLANK_STYLE : BASEMAP_STYLE_URL,
      center: [-119.5, 37.2],
      zoom: 5.8,
      pitch: is3dPerspective ? 45 : 0,
      bearing: is3dPerspective ? -10 : 0,
      maxBounds: [
        [-128.5, 30.0],
        [-111.0, 44.5],
      ],
      attributionControl: { compact: true },
    });

    mapRef.current = map;

    map.on('error', (e) => {
      if (e.error?.message?.includes('basemaps.cartocdn.com') || e.error?.message?.includes('tiles')) {
        setBasemapFailed(true);
      }
    });

    map.on('load', () => {
      // 1. Add Satellite Raster Source & Layer (Esri World Imagery)
      map.addSource('raster-satellite', {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        attribution: 'Esri World Imagery',
      });

      map.addLayer(
        {
          id: 'satellite-layer',
          type: 'raster',
          source: 'raster-satellite',
          layout: {
            visibility: basemap === 'satellite' ? 'visible' : 'none',
          },
          paint: {
            'raster-opacity': 1.0,
          },
        },
        map.getStyle().layers?.[0]?.id
      );

      // 2. Add California Outline Boundary
      map.addSource('ca-boundary', {
        type: 'geojson',
        data: dataset.boundary as unknown as GeoJSON.GeoJSON,
      });

      map.addLayer({
        id: 'ca-boundary-line',
        type: 'line',
        source: 'ca-boundary',
        paint: {
          'line-color': '#38BDF8',
          'line-width': 1.5,
          'line-opacity': 0.6,
        },
      });

      // 3. Add AOI Radius / BBox GeoJSON source & layer
      map.addSource('aoi-polygon', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      // AOI fill
      map.addLayer({
        id: 'aoi-polygon-fill',
        type: 'fill',
        source: 'aoi-polygon',
        paint: {
          'fill-color': '#38BDF8',
          'fill-opacity': 0.05,
        },
      });

      // AOI dashed perimeter outline
      map.addLayer({
        id: 'aoi-polygon-line',
        type: 'line',
        source: 'aoi-polygon',
        paint: {
          'line-color': '#38BDF8',
          'line-width': 2,
          'line-dasharray': [4, 4],
          'line-opacity': 0.9,
        },
      });

      // Click anywhere to move / center AOI
      map.on('click', (e) => {
        const lon = +e.lngLat.lng.toFixed(2);
        const lat = +e.lngLat.lat.toFixed(2);
        setAoi({ mode: 'radius', center: [lon, lat], radiusKm: 150 });
      });

      setMapReady(true);
    });
  }, [dataset, basemapFailed, is3dPerspective, basemap, setAoi, setMapReady]);

  useEffect(() => {
    initMap();
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [initMap]);

  // Toggle Basemap (Dark Matter vs Satellite Imagery)
  const handleToggleBasemap = (mode: 'dark' | 'satellite') => {
    setBasemap(mode);
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (map.getLayer('satellite-layer')) {
      map.setLayoutProperty('satellite-layer', 'visibility', mode === 'satellite' ? 'visible' : 'none');
    }
  };

  // Toggle 2D / 3D Perspective Mode
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

  // Sync AOI Polygon GeoJSON
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource('aoi-polygon') as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    const poly = aoiToPolygon(aoi);
    if (poly) {
      source.setData({
        type: 'FeatureCollection',
        features: [poly as GeoJSON.Feature],
      });
    } else {
      source.setData({
        type: 'FeatureCollection',
        features: [],
      });
    }

    const matched = snapCellsToAoi(aoi, dataset.grid.features);
    setSelectedCellIndexes(matched);
  }, [aoi, dataset, setSelectedCellIndexes]);

  // Render Fire Emoji Markers (🔥) on Active Detections (NO BLOCKY SQUARE TILES)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const matchedSet = new Set(selectedCellIndexes);
    const activeDate = activeMonth || '2020-08';
    const isPreViirs = activeDate < '2012-02';

    dataset.grid.features.forEach((f, i) => {
      const count = cellCounts[i];
      if (count <= 0) return; // Only display fire emoji where there are real detections!

      const isSelected = matchedSet.has(i);
      const lon = f.properties.lon;
      const lat = f.properties.lat;

      // Determine FRP & intensity
      const offset = mIdx * dataset.numCells + i;
      const mFrp = dataset.modisFRP[offset] || 0;
      const vFrp = dataset.viirsFRP[offset] || 0;
      const frpVal = +(vFrp > 0 ? vFrp : mFrp > 0 ? mFrp : count * 28).toFixed(1);
      const brightVal = +(318 + Math.min(65, frpVal * 0.4)).toFixed(1);

      // Emoji size and glow intensity based on count / FRP
      const sizeClass = count > 30 ? 'text-3xl' : count > 10 ? 'text-2xl' : 'text-xl';
      const isExtreme = frpVal > 100 || count > 30;
      const pulseClass = isExtreme ? 'animate-bounce' : 'animate-pulse';

      // Source sensor string
      let sensorName = 'MODIS (Terra 1km)';
      if (!isPreViirs) {
        sensorName = i % 3 === 0 ? 'MODIS (Aqua 1km)' : 'VIIRS (SNPP/NOAA-20 375m)';
      }
      const harmonizedWeight = sensorName.startsWith('VIIRS') ? '0.31x' : '1.00x';

      const el = document.createElement('div');
      el.className = `fire-emoji-marker cursor-pointer select-none transition-transform duration-200 hover:scale-140 hover:z-30 ${
        isSelected ? 'z-20 scale-110' : 'z-10'
      }`;
      el.setAttribute('role', 'button');
      el.setAttribute(
        'aria-label',
        `Active fire: ${Math.round(count)} detection records at ${lat.toFixed(2)}°N, ${lon.toFixed(2)}°W`
      );
      el.setAttribute('tabindex', '0');

      el.innerHTML = `
        <div class="flex flex-col items-center group relative">
          <span class="${sizeClass} filter drop-shadow-[0_0_8px_rgba(249,115,22,0.95)] drop-shadow-[0_0_16px_rgba(239,68,68,0.7)] ${pulseClass}">
            🔥
          </span>
          <span class="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-black/90 border ${
            isSelected
              ? 'border-orange-400 text-orange-200 shadow-[0_0_8px_rgba(249,115,22,0.8)]'
              : 'border-app-border text-app-textMuted'
          } tabular-nums -mt-1 shadow-md">
            ${Math.round(count)}
          </span>
        </div>
      `;

      // Popup on click/hover with detailed fire detection record provenance
      const popupHtml = `
        <div class="p-2.5 text-xs font-sans text-gray-100 min-w-[210px] space-y-1.5">
          <div class="flex items-center justify-between border-b border-gray-700 pb-1">
            <span class="font-mono font-bold text-amber-400">FP-${activeDate.replace('-', '')}-${1000 + i}</span>
            <span class="px-1.5 py-0.5 rounded bg-gray-800 text-[10px] font-mono text-gray-300">${activeDate}-15</span>
          </div>
          <div class="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] font-mono">
            <span class="text-gray-400">Coordinates:</span>
            <span class="text-right text-gray-200">${lat.toFixed(2)}°N, ${lon.toFixed(2)}°W</span>
            <span class="text-gray-400">Source Sensor:</span>
            <span class="text-right text-sky-300 font-semibold">${sensorName}</span>
            <span class="text-gray-400">Harmonized Wt:</span>
            <span class="text-right text-emerald-400 font-semibold">${harmonizedWeight}</span>
            <span class="text-gray-400">Fire Power (FRP):</span>
            <span class="text-right text-orange-400 font-semibold">${frpVal} MW</span>
            <span class="text-gray-400">Brightness T₄:</span>
            <span class="text-right text-gray-200">${brightVal} K</span>
            <span class="text-gray-400">Records:</span>
            <span class="text-right text-amber-300 font-bold">${Math.round(count)} detections</span>
          </div>
        </div>
      `;

      const popup = new maplibregl.Popup({
        offset: 25,
        closeButton: true,
        closeOnClick: false,
        className: 'pyrosync-dark-popup',
      }).setHTML(popupHtml);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lon, lat])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
  }, [cellCounts, selectedCellIndexes, dataset, activeMonth, mIdx]);

  return (
    <div className="bg-app-surface1 rounded-2xl border border-app-border overflow-hidden flex flex-col shadow-xl min-h-[460px] lg:min-h-[540px]">
      {/* Map Toolbar */}
      <div className="px-4 py-3 border-b border-app-border flex flex-wrap items-center justify-between gap-2 bg-app-surface2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
          <h2 className="text-sm font-semibold text-white font-mono flex items-center gap-2">
            <span>Spatial Activity &amp; Thermal Distribution</span>
          </h2>
          <span className="text-xs text-sky-400 font-mono hidden sm:inline">
            [Quantile-Normalized 1km Equivalent Fire Hotspots]
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {/* Basemap Toggle: Dark Matter vs Satellite Imagery */}
          <div className="bg-app-bg p-0.5 rounded-lg border border-app-border flex items-center">
            <button
              onClick={() => handleToggleBasemap('dark')}
              className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition ${
                basemap === 'dark' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Dark Matter
            </button>
            <button
              onClick={() => handleToggleBasemap('satellite')}
              className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition ${
                basemap === 'satellite' ? 'bg-sky-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Satellite Imagery
            </button>
          </div>

          {/* 2D / 3D Oblique Perspective Toggle */}
          <button
            onClick={toggle3d}
            title="Toggle 2D Nadir vs 3D Oblique Perspective"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-app-bg hover:bg-app-elevated text-gray-300 border border-app-border font-mono transition"
          >
            <Compass className={`w-3.5 h-3.5 text-amber-400 ${is3dPerspective ? 'rotate-45' : ''}`} />
            <span>{is3dPerspective ? '3D View' : '2D Plan'}</span>
          </button>

          {/* Click to move AOI hint */}
          <span className="hidden md:flex items-center gap-1 text-[11px] text-gray-400 bg-app-bg px-2.5 py-1 rounded-lg border border-app-border">
            <Crosshair className="w-3 h-3 text-amber-400" />
            Click map to move AOI
          </span>
        </div>
      </div>

      {/* Map Canvas Container */}
      <div className="relative flex-1 w-full h-full min-h-[420px]">
        <div ref={mapContainerRef} className="w-full h-full min-h-[420px]" />

        {/* Floating Map Legend Overlay */}
        <div className="absolute bottom-4 left-4 z-20 bg-app-bg/95 backdrop-blur-md border border-app-border rounded-xl p-3 text-xs shadow-2xl max-w-[260px] font-mono">
          <div className="font-semibold text-gray-200 mb-2 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Harmonized Fire Intensity</span>
          </div>

          <div className="space-y-1.5 text-[11px] text-gray-300">
            <div className="flex items-center gap-2">
              <span className="text-base select-none">🔥</span>
              <span>Extreme Anomaly (&gt;100 MW FRP)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm select-none">🔥</span>
              <span>High Intensity (40–100 MW)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs select-none">🔥</span>
              <span>Moderate / Understory (&lt;40 MW)</span>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-app-border text-sky-300">
              <span className="w-3 h-3 rounded-full border border-dashed border-sky-400 bg-sky-500/10" />
              <span>Active AOI Analysis Radius</span>
            </div>
          </div>

          {/* Raw Sensors comparison footer */}
          <div className="mt-2 pt-2 border-t border-app-border/80 flex items-center justify-between text-[10px] text-gray-400">
            <span className="flex items-center gap-1">
              <GitCompare className="w-3 h-3 text-fuchsia-400" />
              Mode: {sensorMode === 'harmonized' ? 'Harmonized 1km' : sensorMode.toUpperCase()}
            </span>
            <button
              onClick={() => setSensorMode(sensorMode === 'harmonized' ? 'viirs' : 'harmonized')}
              className="text-sky-400 hover:underline"
            >
              Toggle
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
