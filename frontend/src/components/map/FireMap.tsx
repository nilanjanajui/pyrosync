import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BASEMAP_STYLE_URL, FALLBACK_BLANK_STYLE, SATELLITE_TILES_URL } from '../../config/map-style';
import { CIVIDIS } from '../../config/colors';
import type { DenseDataset } from '../../datasource/load';
import { snapCellsToAoi, aoiBBox, type RegionKey } from '../../domain/aoi';
import { studyGeometry, studyName, studyPresets, peakMonth, monthLabel, formatLatLon } from '../../domain/study';
import { useAppStore } from '../../store/appStore';
import { Play, Pause, ChevronLeft, ChevronRight, Square, RotateCcw, Flame, Grid as GridIcon, Satellite, Moon } from 'lucide-react';
import { getEra } from '../../domain/era';
import { isPredictedMonth } from '../../domain/aggregate';
import copy from '../../copy';
import { LocationSearch } from './LocationSearch';

interface FireMapProps {
  dataset: DenseDataset;
}

type ViewMode = 'glow' | 'grid';
type MapLayerMode = 'dark' | 'satellite';

/** Register crisp fire emoji icon in MapLibre's sprite registry */
function registerFireEmoji(map: maplibregl.Map) {
  if (map.hasImage('fire-emoji')) return;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 36;
    canvas.height = 36;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.font = '26px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔥', 18, 19);
    const imgData = ctx.getImageData(0, 0, 36, 36);
    map.addImage('fire-emoji', imgData);
  } catch {
    // Ignore canvas image errors in headless environments
  }
}

/** Build Cividis expression for grid choropleth */
function buildCividisChoropleth(maxCount: number): maplibregl.ExpressionSpecification {
  if (maxCount <= 0) return ['literal', 'rgba(0, 0, 0, 0)'];
  const stops: (number | string)[] = [];
  CIVIDIS.forEach((color, i) => {
    const t = i / (CIVIDIS.length - 1);
    const val = t === 0 ? 0 : Math.pow(t, 1.4) * maxCount;
    stops.push(val, color);
  });
  return [
    'interpolate',
    ['linear'],
    ['coalesce', ['feature-state', 'count'], 0],
    ...stops,
  ] as maplibregl.ExpressionSpecification;
}

export const FireMap: React.FC<FireMapProps> = ({ dataset }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const {
    aoi,
    setAoi,
    setSelectedCellIndexes,
    sensorMode,
    activeMonth,
    setActiveMonth,
    setMapReady,
    mapReady,
    fitRequest,
  } = useAppStore();
  const study = useMemo(() => studyGeometry(dataset), [dataset]);
  const presets = useMemo(() => studyPresets(dataset), [dataset]);
  const peak = useMemo(() => peakMonth(dataset), [dataset]);
  const maxCountRef = useRef(0);

  const [activeRegion, setActiveRegion] = useState<RegionKey>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('glow');
  const [mapLayer, setMapLayer] = useState<MapLayerMode>('dark');
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<[number, number] | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [basemapFailed, setBasemapFailed] = useState(false);
  const [searchedPlaceName, setSearchedPlaceName] = useState<string | null>(null);
  const cellCountsRef = useRef<Float32Array>(new Float32Array(0));

  // Month Index
  const mIdx = useMemo(() => {
    if (!activeMonth) return dataset.numMonths - 1;
    return dataset.monthIndexMap.get(activeMonth) ?? dataset.numMonths - 1;
  }, [activeMonth, dataset]);

  // Extract cell counts for active month
  const { cellCounts, maxCellCount, activePointsGeoJson } = useMemo(() => {
    const counts = new Float32Array(dataset.numCells);
    const offset = mIdx * dataset.numCells;
    let max = 0;
    const pointFeatures: GeoJSON.Feature<GeoJSON.Point>[] = [];

    for (let c = 0; c < dataset.numCells; c++) {
      let count = 0;
      if (sensorMode === 'modis') {
        count = dataset.modisTotal[offset + c] || 0;
      } else if (sensorMode === 'viirs') {
        count = dataset.viirsTotal[offset + c] || 0;
      } else {
        count = dataset.harmonizedTotal[offset + c] || 0;
      }
      counts[c] = count;
      if (count > max) max = count;

      if (count > 0) {
        const f = dataset.grid.features[c];
        pointFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [f.properties.lon, f.properties.lat],
          },
          properties: {
            id: f.properties.id,
            count: count,
            lat: f.properties.lat,
            lon: f.properties.lon,
          },
        });
      }
    }

    const pointsGeoJson: GeoJSON.FeatureCollection<GeoJSON.Point> = {
      type: 'FeatureCollection',
      features: pointFeatures,
    };

    return { cellCounts: counts, maxCellCount: max, activePointsGeoJson: pointsGeoJson };
  }, [dataset, mIdx, sensorMode]);

  cellCountsRef.current = cellCounts;
  maxCountRef.current = maxCellCount;

  // Initialize MapLibre
  const initMap = useCallback(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: basemapFailed ? FALLBACK_BLANK_STYLE : BASEMAP_STYLE_URL,
      bounds: [
        [study.bbox[0], study.bbox[1]],
        [study.bbox[2], study.bbox[3]],
      ],
      fitBoundsOptions: { padding: 48 },
      minZoom: 1,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');

    mapRef.current = map;

    map.on('error', (e) => {
      if (e.error?.message?.includes('basemaps.cartocdn.com') || e.error?.message?.includes('tiles')) {
        setBasemapFailed(true);
      }
    });

    map.on('load', () => {
      registerFireEmoji(map);

      // 0. Add Satellite Raster Source
      map.addSource('satellite-tiles', {
        type: 'raster',
        tiles: [SATELLITE_TILES_URL],
        tileSize: 256,
        attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics',
        maxzoom: 19,
      });

      map.addLayer({
        id: 'satellite-tiles-layer',
        type: 'raster',
        source: 'satellite-tiles',
        layout: { visibility: 'none' },
        paint: {
          'raster-saturation': -0.1,
          'raster-contrast': 0.15,
        },
      });

      // 1. Add the study-area boundary
      map.addSource('ca-boundary', {
        type: 'geojson',
        data: dataset.boundary as unknown as GeoJSON.GeoJSON,
      });

      map.addLayer({
        id: 'ca-boundary-fill',
        type: 'fill',
        source: 'ca-boundary',
        paint: { 'fill-color': '#f59e0b', 'fill-opacity': 0.03 },
      });

      map.addLayer({
        id: 'ca-boundary-line',
        type: 'line',
        source: 'ca-boundary',
        paint: {
          'line-color': '#f59e0b',
          'line-width': 1.5,
          'line-opacity': 0.45,
        },
      });

      // 2. Add 10 km Grid GeoJSON Source
      map.addSource('ca-grid', {
        type: 'geojson',
        data: dataset.grid as unknown as GeoJSON.GeoJSON,
        promoteId: 'id',
      });

      // 3. Grid Fill Layer (Only fills active cells with counts > 0)
      map.addLayer({
        id: 'ca-grid-fill',
        type: 'fill',
        source: 'ca-grid',
        layout: {
          visibility: 'none',
        },
        paint: {
          'fill-color': buildCividisChoropleth(maxCountRef.current),
          'fill-opacity': [
            'case',
            ['>', ['coalesce', ['feature-state', 'count'], 0], 0],
            ['case', ['boolean', ['feature-state', 'selected'], true], 0.85, 0.3],
            0,
          ],
        },
      });

      // 4. Subtle outline for active/selected cells (no wireframe mesh on whole state)
      map.addLayer({
        id: 'ca-grid-stroke',
        type: 'line',
        source: 'ca-grid',
        paint: {
          'line-color': '#f59e0b',
          'line-width': [
            'case',
            ['>', ['coalesce', ['feature-state', 'count'], 0], 0],
            1.0,
            0,
          ],
          'line-opacity': 0.5,
        },
      });

      // 5. Active Fire Points GeoJSON Source (for thermal heatmap & emojis)
      map.addSource('ca-fire-points', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      // 6. Thermal Infrared Blended Heatmap Layer (Realistic fire glow)
      map.addLayer({
        id: 'ca-fire-heat',
        type: 'heatmap',
        source: 'ca-fire-points',
        layout: {
          visibility: 'visible',
        },
        paint: {
          'heatmap-weight': [
            'interpolate',
            ['linear'],
            ['get', 'count'],
            0, 0,
            1, 0.25,
            10, 0.55,
            50, 0.85,
            200, 1.0,
          ],
          'heatmap-intensity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4, 1.1,
            7, 1.8,
            10, 2.8,
          ],
          // Realistic thermal infrared radiation spectrum:
          // Transparent -> Infrared Red -> Fiery Orange -> Flame Yellow -> White-Hot Core
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(0, 0, 0, 0)',
            0.12, 'rgba(185, 28, 28, 0.5)',
            0.35, 'rgba(234, 88, 12, 0.75)',
            0.6, 'rgba(249, 115, 22, 0.9)',
            0.8, 'rgba(250, 204, 21, 0.98)',
            0.95, '#ffffff',
          ],
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4, 18,
            7, 30,
            10, 48,
          ],
          'heatmap-opacity': 0.9,
        },
      });

      // 7. Fire Emojis 🔥 / Hotspot Symbol Layer
      map.addLayer({
        id: 'ca-fire-emojis',
        type: 'symbol',
        source: 'ca-fire-points',
        layout: {
          visibility: 'visible',
          'icon-image': 'fire-emoji',
          'icon-size': [
            'interpolate',
            ['linear'],
            ['get', 'count'],
            1, 0.55,
            10, 0.75,
            50, 1.05,
            300, 1.4,
          ],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });

      // 8. Drawing Bounding Box Source & Layer
      map.addSource('draw-bbox', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      map.addLayer({
        id: 'draw-bbox-line',
        type: 'line',
        source: 'draw-bbox',
        paint: {
          'line-color': '#f59e0b',
          'line-width': 2,
          'line-dasharray': [3, 3],
        },
      });

      // 9. Search Marker Source & Layer
      map.addSource('search-pin', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      map.addLayer({
        id: 'search-pin-circle',
        type: 'circle',
        source: 'search-pin',
        paint: {
          'circle-radius': 8,
          'circle-color': '#f59e0b',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Hover Tooltip on 10 km cell
      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: 'pyrosync-cell-popup',
      });

      map.on('mousemove', 'ca-grid-stroke', (e) => {
        if (!e.features || e.features.length === 0) return;
        const f = e.features[0];
        const cellId = f.properties?.id;
        const cIdx = dataset.cellIndexMap.get(cellId);
        const count = cIdx !== undefined ? cellCountsRef.current[cIdx] : 0;
        if (count <= 0) return;

        map.getCanvas().style.cursor = 'pointer';
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div class="p-2 text-xs font-sans text-gray-100 font-medium bg-gray-900/95 border border-amber-500/40 rounded-lg shadow-xl">
              <div class="flex items-center gap-1.5 mb-1">
                <span class="text-base">🔥</span>
                <span class="text-amber-400 font-bold text-sm">${Math.round(count).toLocaleString()}</span>
                <span class="text-gray-300">fire detections</span>
              </div>
              <div class="text-[11px] text-gray-400">${formatLatLon(f.properties?.lat, f.properties?.lon)}</div>
            </div>`
          )
          .addTo(map);
      });

      map.on('mouseleave', 'ca-grid-stroke', () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
      });

      // Click cell to inspect or select
      map.on('click', 'ca-grid-stroke', (e) => {
        if (!e.features || e.features.length === 0) return;
        const f = e.features[0];
        const lon = f.properties?.lon;
        const lat = f.properties?.lat;
        if (lon !== undefined && lat !== undefined) {
          setAoi({ mode: 'radius', center: [lon, lat], radiusKm: 30 });
          setActiveRegion('draw');
          setSearchedPlaceName(`${lat.toFixed(2)}°, ${lon.toFixed(2)}°`);
        }
      });

      setMapReady(true);
    });
  }, [dataset, study, basemapFailed, setAoi, setMapReady]);

  // Create the map once per dataset
  useEffect(() => {
    initMap();
    return () => {
      setMapReady(false);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [initMap, setMapReady]);

  // Sync counts and fire points to map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const matched = snapCellsToAoi(aoi, dataset.grid.features);
    const matchedSet = new Set(matched);
    setSelectedCellIndexes(matched);

    dataset.grid.features.forEach((f, i) => {
      map.setFeatureState(
        { source: 'ca-grid', id: f.properties.id },
        { count: cellCounts[i], selected: matchedSet.has(i) }
      );
    });

    const ptsSource = map.getSource('ca-fire-points') as maplibregl.GeoJSONSource | undefined;
    if (ptsSource) {
      ptsSource.setData(activePointsGeoJson);
    }

    if (map.getLayer('ca-grid-fill')) {
      map.setPaintProperty('ca-grid-fill', 'fill-color', buildCividisChoropleth(maxCellCount));
    }
  }, [aoi, cellCounts, maxCellCount, activePointsGeoJson, dataset, mapReady, setSelectedCellIndexes]);

  // Sync Map Layer Mode (Dark Canvas vs Satellite)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (map.getLayer('satellite-tiles-layer')) {
      map.setLayoutProperty('satellite-tiles-layer', 'visibility', mapLayer === 'satellite' ? 'visible' : 'none');
    }
  }, [mapLayer, mapReady]);

  // Sync View Mode (Fire Glow + Emojis vs Grid Choropleth)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const isGlow = viewMode === 'glow';
    if (map.getLayer('ca-fire-heat')) {
      map.setLayoutProperty('ca-fire-heat', 'visibility', isGlow ? 'visible' : 'none');
    }
    if (map.getLayer('ca-fire-emojis')) {
      map.setLayoutProperty('ca-fire-emojis', 'visibility', isGlow ? 'visible' : 'none');
    }
    if (map.getLayer('ca-grid-fill')) {
      map.setLayoutProperty('ca-grid-fill', 'visibility', isGlow ? 'none' : 'visible');
    }
  }, [viewMode, mapReady]);

  // Handle location search selection
  const handleSelectLocation = (lat: number, lon: number, name: string) => {
    const map = mapRef.current;
    setSearchedPlaceName(name);
    setAoi({ mode: 'radius', center: [lon, lat], radiusKm: 30 });
    setActiveRegion('draw');

    if (map) {
      map.flyTo({
        center: [lon, lat],
        zoom: 8.5,
        essential: true,
        duration: 1200,
      });

      const pinSource = map.getSource('search-pin') as maplibregl.GeoJSONSource | undefined;
      if (pinSource) {
        pinSource.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [lon, lat] },
              properties: { name },
            },
          ],
        });
      }
    }
  };

  // Zoom to a box requested elsewhere
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !fitRequest) return;
    const [w, s, e, n] = fitRequest.bbox;
    map.fitBounds([[w, s], [e, n]], { padding: 60, duration: 600, maxZoom: 9 });
    setActiveRegion('draw');
  }, [fitRequest, mapReady]);

  // Handle region preset selection
  const handleSelectRegion = (key: RegionKey) => {
    setActiveRegion(key);
    setIsDrawing(false);
    setSearchedPlaceName(null);

    const map = mapRef.current;
    if (map) {
      const pinSource = map.getSource('search-pin') as maplibregl.GeoJSONSource | undefined;
      if (pinSource) pinSource.setData({ type: 'FeatureCollection', features: [] });
    }

    if (key === 'draw') {
      setIsDrawing(true);
      return;
    }

    const preset = presets.find((p) => p.id === key);
    const nextAoi = preset ? ({ mode: 'bbox', bbox: preset.bbox } as const) : ({ mode: 'state' } as const);
    setAoi(nextAoi);

    const box = aoiBBox(nextAoi, study);
    if (box && mapRef.current) {
      mapRef.current.fitBounds([[box[0], box[1]], [box[2], box[3]]], { padding: 48, duration: 600 });
    }
  };

  // Drawing BBox interaction on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!isDrawing) {
      map.getCanvas().style.cursor = '';
      map.dragPan.enable();
      return;
    }

    map.getCanvas().style.cursor = 'crosshair';
    map.dragPan.disable();

    const onMouseDown = (e: maplibregl.MapMouseEvent) => {
      setDrawStart([e.lngLat.lng, e.lngLat.lat]);
    };

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (!drawStart) return;
      const w = Math.min(drawStart[0], e.lngLat.lng);
      const e_ = Math.max(drawStart[0], e.lngLat.lng);
      const s = Math.min(drawStart[1], e.lngLat.lat);
      const n = Math.max(drawStart[1], e.lngLat.lat);

      const source = map.getSource('draw-bbox') as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [
                  [[w, s], [e_, s], [e_, n], [w, n], [w, s]],
                ],
              },
              properties: {},
            },
          ],
        });
      }
    };

    const onMouseUp = (e: maplibregl.MapMouseEvent) => {
      if (!drawStart) return;
      const w = Math.min(drawStart[0], e.lngLat.lng);
      const e_ = Math.max(drawStart[0], e.lngLat.lng);
      const s = Math.min(drawStart[1], e.lngLat.lat);
      const n = Math.max(drawStart[1], e.lngLat.lat);

      setDrawStart(null);
      setIsDrawing(false);

      const source = map.getSource('draw-bbox') as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData({ type: 'FeatureCollection', features: [] });
      }

      if (Math.abs(e_ - w) > 0.1 && Math.abs(n - s) > 0.1) {
        setAoi({ mode: 'bbox', bbox: [w, s, e_, n] });
      }
    };

    map.on('mousedown', onMouseDown);
    map.on('mousemove', onMouseMove);
    map.on('mouseup', onMouseUp);

    return () => {
      map.dragPan.enable();
      map.off('mousedown', onMouseDown);
      map.off('mousemove', onMouseMove);
      map.off('mouseup', onMouseUp);
    };
  }, [isDrawing, drawStart, setAoi]);

  // Timeline playback loop
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const nextIdx = (mIdx + 1) % dataset.numMonths;
      setActiveMonth(dataset.months[nextIdx]);
    }, 600);
    return () => clearInterval(interval);
  }, [isPlaying, mIdx, dataset, setActiveMonth]);

  const activeDateObj = new Date(`${dataset.months[mIdx]}-01T00:00:00Z`);
  const activeMonthNameYear = activeDateObj.toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const isEstimated = isPredictedMonth(dataset.months[mIdx]);

  return (
    <div className="bg-app-surface1 rounded-xl border border-app-border overflow-hidden flex flex-col shadow-sm h-full font-sans">
      {/* 1. Header Controls Bar: Location Search + View Toggles + Region Chips */}
      <div className="p-3 border-b border-app-border flex flex-col gap-2.5 bg-app-surface2/50">
        {/* Top Row: Location Search Bar + Map Layer (Dark/Satellite) + View Mode (Glow/Grid) */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Location Search Bar */}
          <LocationSearch onSelectLocation={handleSelectLocation} studyBBox={study.bbox} />

          {/* Right Controls: Satellite/Dark Toggle & Glow/Grid Mode */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Satellite vs Dark Toggle */}
            <div className="inline-flex rounded-lg p-0.5 bg-app-surface1 border border-app-border">
              <button
                type="button"
                onClick={() => setMapLayer('dark')}
                aria-pressed={mapLayer === 'dark'}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors min-h-[38px] ${
                  mapLayer === 'dark' ? 'bg-amber-500 text-black shadow-sm' : 'text-gray-300 hover:text-white'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>{copy.map.layerDark}</span>
              </button>
              <button
                type="button"
                onClick={() => setMapLayer('satellite')}
                aria-pressed={mapLayer === 'satellite'}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors min-h-[38px] ${
                  mapLayer === 'satellite' ? 'bg-amber-500 text-black shadow-sm' : 'text-gray-300 hover:text-white'
                }`}
              >
                <Satellite className="w-3.5 h-3.5" />
                <span>{copy.map.layerSatellite}</span>
              </button>
            </div>

            {/* View Mode Toggle: Blended Fire Glow vs Grid */}
            <div className="inline-flex rounded-lg p-0.5 bg-app-surface1 border border-app-border">
              <button
                type="button"
                onClick={() => setViewMode('glow')}
                aria-pressed={viewMode === 'glow'}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors min-h-[38px] ${
                  viewMode === 'glow' ? 'bg-amber-500 text-black shadow-sm' : 'text-gray-300 hover:text-white'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>{copy.map.viewGlow}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                aria-pressed={viewMode === 'grid'}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors min-h-[38px] ${
                  viewMode === 'grid' ? 'bg-amber-500 text-black shadow-sm' : 'text-gray-300 hover:text-white'
                }`}
              >
                <GridIcon className="w-3.5 h-3.5" />
                <span>{copy.map.viewGrid}</span>
              </button>
            </div>

            {/* Quick jump to August 2020 peak */}
            <button
              type="button"
              onClick={() => setActiveMonth(peak)}
              className="text-xs text-app-textMuted hover:text-amber-400 transition-colors flex items-center gap-1 py-1.5 px-2.5 rounded-lg border border-app-border/80 bg-app-surface1 hover:bg-app-elevated min-h-[38px]"
            >
              <RotateCcw className="w-3 h-3 text-amber-400" />
              <span>{copy.map.jumpToPeak(monthLabel(peak))}</span>
            </button>
          </div>
        </div>

        {/* Bottom Row: Region Chips Bar */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-app-border/40">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-app-textSubdued uppercase mr-1">Area:</span>
            {[{ id: 'all', name: copy.regions.all(studyName(dataset)) }, ...presets].map(({ id: key, name }) => {
              const isActive = activeRegion === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectRegion(key)}
                  className={`px-3 py-1.5 min-h-[40px] rounded-lg text-xs sm:text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    isActive
                      ? 'bg-amber-500 text-black font-bold shadow-sm'
                      : 'bg-app-surface1 text-gray-300 hover:text-white hover:bg-app-elevated border border-app-border'
                  }`}
                >
                  {name}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => handleSelectRegion('draw')}
              className={`px-3 py-1.5 min-h-[40px] rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                isDrawing
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 animate-pulse font-bold'
                  : activeRegion === 'draw'
                  ? 'bg-amber-500 text-black font-bold'
                  : 'bg-app-surface1 text-gray-300 hover:text-white hover:bg-app-elevated border border-app-border'
              }`}
            >
              <Square className="w-3.5 h-3.5" />
              <span>{isDrawing ? copy.regions.drawingActive : copy.regions.draw}</span>
            </button>
          </div>

          {searchedPlaceName && (
            <div className="text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <span>📍</span>
              <span>{searchedPlaceName}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Map Canvas (Left 65% Main Exploration) */}
      <div className="relative flex-1 w-full min-h-[400px]">
        <div ref={mapContainerRef} className="w-full h-full min-h-[400px]" />

        {/* Floating Map Legend */}
        <div className="absolute bottom-4 left-4 z-10 bg-app-surface1/95 backdrop-blur-md border border-app-border rounded-lg p-2.5 shadow-xl text-xs font-sans">
          <div className="font-semibold text-white mb-1.5 flex items-center justify-between gap-3">
            <span>{copy.map.legendTitle}</span>
            {viewMode === 'glow' ? (
              <span className="text-[11px] text-amber-400 font-normal flex items-center gap-1">
                <span>🔥</span> Fire glow
              </span>
            ) : (
              <span className="text-[11px] text-gray-400 font-normal">10 km grid</span>
            )}
          </div>

          {viewMode === 'glow' ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-app-textSubdued tabular-nums">Low</span>
                <div className="w-32 h-2.5 rounded-sm overflow-hidden flex border border-black/40 bg-gradient-to-r from-red-800 via-orange-500 via-yellow-400 to-white" />
                <span className="text-[11px] text-amber-300 tabular-nums font-bold">Intense</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-gray-300">
                <span>🔥</span>
                <span>Icons mark active fire hotspots</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-app-textSubdued tabular-nums">0</span>
              <div className="w-28 h-2.5 rounded-sm overflow-hidden flex border border-black/40">
                {CIVIDIS.map((hex, i) => (
                  <div key={i} className="flex-1 h-full" style={{ backgroundColor: hex }} />
                ))}
              </div>
              <span className="text-[11px] text-amber-300 tabular-nums font-bold">
                {Math.round(maxCellCount).toLocaleString()}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-app-border/80 text-[11px] text-app-textMuted">
            <span className="w-3 h-3 rounded-sm border-2 border-amber-400 bg-amber-500/10" />
            <span>{copy.map.legendSelectedAoi}</span>
          </div>
        </div>
      </div>

      {/* 3. Month Slider with Play/Pause & Satellite Era Boundary */}
      <div className="p-3.5 bg-app-surface1 border-t border-app-border">
        {/* Month Header and Status */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              aria-label={isPlaying ? copy.map.pause : copy.map.play}
              className="w-8 h-8 rounded-lg bg-amber-500 hover:bg-amber-400 text-black flex items-center justify-center transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={() => {
                const prev = Math.max(0, mIdx - 1);
                setActiveMonth(dataset.months[prev]);
              }}
              aria-label={copy.map.stepBack}
              className="w-8 h-8 rounded-lg bg-app-surface2 hover:bg-app-elevated border border-app-border text-white flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                const next = Math.min(dataset.numMonths - 1, mIdx + 1);
                setActiveMonth(dataset.months[next]);
              }}
              aria-label={copy.map.stepForward}
              className="w-8 h-8 rounded-lg bg-app-surface2 hover:bg-app-elevated border border-app-border text-white flex items-center justify-center transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <span className="text-base font-bold text-white ml-2 tracking-tight">
              {activeMonthNameYear}
            </span>
          </div>

          {/* Era Indicator Badge */}
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              isEstimated
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
            }`}
          >
            {isEstimated ? copy.map.sliderEstimated : copy.map.sliderMeasured}
          </span>
        </div>

        {/* Range Slider Track */}
        <div className="relative pt-1">
          <input
            type="range"
            min={0}
            max={dataset.numMonths - 1}
            value={mIdx}
            onChange={(e) => {
              const idx = parseInt(e.target.value, 10);
              setActiveMonth(dataset.months[idx]);
            }}
            aria-label="Select timeline month"
            className="w-full h-2 bg-app-surface2 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />

          {/* Slider Labels Marking Timeline Eras */}
          <div className="flex justify-between items-center text-[11px] text-app-textSubdued tabular-nums mt-1">
            <span>{dataset.months[0]}</span>
            <span className="font-semibold text-amber-300">{copy.map.measuredFrom(getEra().blendStart)}</span>
            <span>{dataset.months[dataset.numMonths - 1]}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FireMap;

