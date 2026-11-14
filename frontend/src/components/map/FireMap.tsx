/**
 * MapLibre GL map with California grid choropleth, boundary, and AOI selection.
 * Basemap: Carto Dark Matter (no API key). Offline fallback: blank slate-900 canvas.
 * Grid uses promoteId: "id" + setFeatureState for performant highlight.
 */
import React, { useRef, useEffect, useCallback, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BASEMAP_STYLE_URL, FALLBACK_BLANK_STYLE } from '../../config/map-style';
import { CIVIDIS } from '../../config/colors';
import type { DenseDataset } from '../../datasource/load';
import type { Aoi } from '../../domain/aoi';
import { snapCellsToAoi, aoiBBox } from '../../domain/aoi';
import { useAppStore } from '../../store/appStore';

interface FireMapProps {
  dataset: DenseDataset;
}

/** Build a maplibre expression array mapping harmonizedTotal sum → Cividis color */
function buildChoroplethExpression(
  monthlyMax: number
): maplibregl.ExpressionSpecification {
  if (monthlyMax <= 0) return ['literal', CIVIDIS[0]];
  const stops: (number | string)[] = [];
  CIVIDIS.forEach((color, i) => {
    stops.push((i / (CIVIDIS.length - 1)) * monthlyMax, color);
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
  const { setSelectedCellIndexes, setMapReady, aoi, setAoi } = useAppStore();
  const [basemapFailed, setBasemapFailed] = useState(false);

  // Compute the total harmonized count per cell across all months for choropleth base
  const cellTotals = React.useMemo(() => {
    const totals = new Float32Array(dataset.numCells);
    for (let m = 0; m < dataset.numMonths; m++) {
      for (let c = 0; c < dataset.numCells; c++) {
        totals[c] += dataset.harmonizedTotal[m * dataset.numCells + c];
      }
    }
    return totals;
  }, [dataset]);

  const maxCellTotal = React.useMemo(() => Math.max(...Array.from(cellTotals)), [cellTotals]);

  const initMap = useCallback(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: basemapFailed ? FALLBACK_BLANK_STYLE : BASEMAP_STYLE_URL,
      bounds: [-124.48, 32.53, -114.13, 42.01],
      fitBoundsOptions: { padding: 20 },
      attributionControl: false,
    });

    mapRef.current = map;

    map.on('error', (e) => {
      // If style fails to load, fall back to blank
      if (!basemapFailed && e.error?.message?.toLowerCase().includes('style')) {
        setBasemapFailed(true);
        map.setStyle(FALLBACK_BLANK_STYLE);
      }
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'top-right'
    );
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-right'
    );

    map.on('load', () => {
      // --- California boundary ---
      map.addSource('ca-boundary', {
        type: 'geojson',
        data: dataset.boundary as GeoJSON.GeoJSON,
      });
      map.addLayer({
        id: 'ca-boundary-fill',
        type: 'fill',
        source: 'ca-boundary',
        paint: {
          'fill-color': '#1e3a4a',
          'fill-opacity': 0.15,
        },
      });
      map.addLayer({
        id: 'ca-boundary-line',
        type: 'line',
        source: 'ca-boundary',
        paint: {
          'line-color': '#38bdf8',
          'line-width': 1.5,
          'line-opacity': 0.7,
        },
      });

      // --- 10 km grid with promoteId ---
      map.addSource('ca-grid', {
        type: 'geojson',
        data: dataset.grid as GeoJSON.GeoJSON,
        promoteId: 'id',
      });

      // Set initial feature-state counts
      dataset.grid.features.forEach((f, i) => {
        map.setFeatureState(
          { source: 'ca-grid', id: f.properties.id },
          { count: cellTotals[i], selected: false }
        );
      });

      map.addLayer({
        id: 'ca-grid-fill',
        type: 'fill',
        source: 'ca-grid',
        paint: {
          'fill-color': buildChoroplethExpression(maxCellTotal),
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            0.85,
            ['>', ['feature-state', 'count'], 0],
            0.65,
            0,
          ],
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
            '#fbbf24',
            '#334155',
          ],
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            1.5,
            0.3,
          ],
          'line-opacity': 0.6,
        },
      });

      // Click to toggle bbox AOI selection
      map.on('click', 'ca-grid-fill', (e) => {
        if (!e.features || e.features.length === 0) return;
        const feat = e.features[0];
        const lon = feat.properties?.lon as number;
        const lat = feat.properties?.lat as number;
        if (lon == null || lat == null) return;

        // Set a small 15km radius AOI centered on clicked cell
        const newAoi: Aoi = { mode: 'radius', center: [lon, lat], radiusKm: 15 };
        setAoi(newAoi);
      });

      map.on('mouseenter', 'ca-grid-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'ca-grid-fill', () => {
        map.getCanvas().style.cursor = '';
      });

      setMapReady(true);
    });
  }, [dataset, cellTotals, maxCellTotal, basemapFailed, setMapReady, setAoi]);

  useEffect(() => {
    initMap();
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync AOI selection → feature states
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const matched = snapCellsToAoi(aoi, dataset.grid.features);
    const matchedSet = new Set(matched);
    setSelectedCellIndexes(matched);

    dataset.grid.features.forEach((f, i) => {
      map.setFeatureState(
        { source: 'ca-grid', id: f.properties.id },
        { count: cellTotals[i], selected: matchedSet.has(i) }
      );
    });

    // Fit map to AOI bounds
    const bbox = aoiBBox(aoi, dataset.boundary.features?.[0] as GeoJSON.Feature<GeoJSON.Polygon>);
    if (bbox && aoi.mode !== 'state') {
      map.fitBounds(
        [
          [bbox[0], bbox[1]],
          [bbox[2], bbox[3]],
        ],
        { padding: 40, maxZoom: 10, duration: 600 }
      );
    }
  }, [aoi, dataset, cellTotals, setSelectedCellIndexes]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden">
      <div
        ref={mapContainerRef}
        className="w-full h-full"
        role="application"
        aria-label="California fire activity map. Click a grid cell to select an area of interest."
        tabIndex={0}
      />
      {basemapFailed && (
        <div className="absolute bottom-2 left-2 text-xs text-amber-400/70 bg-slate-900/80 px-2 py-1 rounded">
          Offline mode — basemap unavailable
        </div>
      )}
      {/* Legend */}
      <div
        aria-label="Map legend: Cividis color scale from low (dark blue) to high (yellow) harmonized detection count"
        className="absolute bottom-6 left-3 bg-slate-900/90 border border-slate-700 rounded-lg p-2 text-xs text-slate-300"
      >
        <div className="flex items-center gap-1 mb-1">
          <span className="text-slate-400">Detections (all years)</span>
        </div>
        <div
          className="h-2 w-32 rounded"
          style={{
            background: `linear-gradient(to right, ${CIVIDIS[0]}, ${CIVIDIS[Math.floor(CIVIDIS.length / 2)]}, ${CIVIDIS[CIVIDIS.length - 1]})`,
          }}
          aria-hidden="true"
        />
        <div className="flex justify-between mt-0.5 text-slate-500">
          <span>Low</span>
          <span>High</span>
        </div>
      </div>
    </div>
  );
};
