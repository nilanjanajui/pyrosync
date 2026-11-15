/**
 * Keyboard-friendly alternative to drawing on the map: enter a point and radius, or a bounding box.
 * Works anywhere on Earth (lat -90..90, lon -180..180).
 */
import React, { useId, useState } from 'react';
import { MapPin } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { aoiBBox, type Aoi } from '../../domain/aoi';
import { studyGeometry } from '../../domain/study';
import copy from '../../copy';

type Mode = 'point' | 'box';
type Key = 'lat' | 'lon' | 'radius' | 'w' | 's' | 'e' | 'n';

const field =
  'w-full rounded-md border border-app-border bg-app-surface2 px-2 py-1.5 text-sm text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500';

export const CoordinateForm: React.FC = () => {
  const { dataset, setAoi, requestFit } = useAppStore();
  const id = useId();
  const [mode, setMode] = useState<Mode>('point');
  const [v, setV] = useState<Record<Key, string>>({ lat: '', lon: '', radius: '50', w: '', s: '', e: '', n: '' });
  const [error, setError] = useState<string | null>(null);
  if (!dataset) return null;

  const num = (x: string) => (x.trim() === '' ? NaN : Number(x));
  const okLat = (x: number) => x >= -90 && x <= 90;
  const okLon = (x: number) => x >= -180 && x <= 180;

  const apply = (aoi: Aoi) => {
    setAoi(aoi);
    const box = aoiBBox(aoi, studyGeometry(dataset));
    if (box) requestFit([box[0], box[1], box[2], box[3]]);
    setError(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'point') {
      const [lat, lon, r] = [num(v.lat), num(v.lon), num(v.radius)];
      if ([lat, lon, r].some(isNaN) || !okLat(lat) || !okLon(lon) || r <= 0) {
        return setError('Enter a latitude (-90 to 90), a longitude (-180 to 180) and a radius above 0 km.');
      }
      apply({ mode: 'radius', center: [lon, lat], radiusKm: r });
    } else {
      const [w, s, ee, n] = [num(v.w), num(v.s), num(v.e), num(v.n)];
      if ([w, s, ee, n].some(isNaN) || !okLat(s) || !okLat(n) || !okLon(w) || !okLon(ee)) {
        return setError('Enter all four edges as valid coordinates.');
      }
      if (w >= ee || s >= n) return setError('West must be less than East, and South less than North.');
      apply({ mode: 'bbox', bbox: [w, s, ee, n] });
    }
  };

  const tab = (m: Mode) =>
    `rounded-md px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 ${
      mode === m ? 'bg-amber-500 text-black' : 'bg-app-surface2 text-gray-300 hover:bg-app-elevated'
    }`;

  const input = (k: Key, label: string, step = '0.01') => (
    <div key={k}>
      <label htmlFor={`${id}-${k}`} className="mb-0.5 block text-xs text-app-textMuted">
        {label}
      </label>
      <input
        id={`${id}-${k}`}
        type="number"
        step={step}
        value={v[k]}
        onChange={(e) => setV({ ...v, [k]: e.target.value })}
        className={field}
      />
    </div>
  );

  return (
    <details className="group rounded-xl border border-app-border bg-app-surface1">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 px-4 text-sm font-medium text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
        <MapPin className="h-4 w-4 text-amber-400" aria-hidden="true" />
        {copy.download.coordsTitle}
      </summary>
      <form onSubmit={submit} className="space-y-3 border-t border-app-border p-4" aria-label="Enter coordinates">
        <div role="group" aria-label="Coordinate entry type" className="flex gap-2">
          <button type="button" className={tab('point')} aria-pressed={mode === 'point'} onClick={() => setMode('point')}>
            Point and radius
          </button>
          <button type="button" className={tab('box')} aria-pressed={mode === 'box'} onClick={() => setMode('box')}>
            Box
          </button>
        </div>
        {mode === 'point' ? (
          <div className="grid grid-cols-3 gap-2">
            {input('lat', 'Latitude °')}
            {input('lon', 'Longitude °')}
            {input('radius', 'Radius km', '1')}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {input('w', 'West °')}
            {input('e', 'East °')}
            {input('s', 'South °')}
            {input('n', 'North °')}
          </div>
        )}
        {error && (
          <p role="alert" className="text-xs text-red-300">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="min-h-[44px] w-full rounded-lg bg-amber-500 text-sm font-semibold text-black hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
        >
          Show this area
        </button>
      </form>
    </details>
  );
};

export default CoordinateForm;
