/**
 * Sensor mode toggle: MODIS | VIIRS | Harmonized
 * Shows harmonization method label alongside active mode.
 */
import React from 'react';
import type { SensorMode } from '../../domain/aggregate';
import { useAppStore } from '../../store/appStore';
import type { Harmonization } from '../../datasource/schema';

interface SensorToggleProps {
  harmonization: Harmonization;
}

const MODES: { key: SensorMode; label: string; desc: string }[] = [
  { key: 'modis', label: 'MODIS', desc: 'Terra + Aqua (2000-11 → 2021-12)' },
  { key: 'viirs', label: 'VIIRS', desc: 'Suomi-NPP 375m (2012-01 → 2021-12)' },
  {
    key: 'harmonized',
    label: 'Harmonized',
    desc: 'VIIRS-equivalent counts, full record',
  },
];

export const SensorToggle: React.FC<SensorToggleProps> = ({ harmonization }) => {
  const { sensorMode, setSensorMode } = useAppStore();

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
      <h3 className="text-sm font-semibold text-slate-200">Sensor Mode</h3>
      <div role="radiogroup" aria-label="Sensor mode selection" className="flex flex-wrap gap-2">
        {MODES.map(({ key, label, desc }) => (
          <button
            key={key}
            role="radio"
            aria-checked={sensorMode === key}
            onClick={() => setSensorMode(key)}
            className={`flex-1 min-w-[100px] px-3 py-2 rounded-lg border text-xs font-medium text-left transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 ${
              sensorMode === key
                ? 'bg-orange-600/20 border-orange-500 text-orange-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
            }`}
          >
            <div className="font-semibold text-sm">{label}</div>
            <div className="text-slate-500 mt-0.5 leading-tight">{desc}</div>
          </button>
        ))}
      </div>

      {/* Show harmonization method label when in harmonized mode */}
      {sensorMode === 'harmonized' && (
        <div className="text-xs text-slate-400 bg-slate-800/60 rounded-lg p-2.5 space-y-1">
          <p>
            <span className="text-slate-300 font-medium">Method:</span>{' '}
            {harmonization.method}
          </p>
          <p>
            <span className="text-slate-300 font-medium">Status:</span>{' '}
            <span
              className={
                harmonization.status === 'validated'
                  ? 'text-emerald-400'
                  : 'text-amber-400'
              }
            >
              {harmonization.status === 'validated' ? 'Validated' : 'Provisional'}
            </span>
          </p>
          <p>
            <span className="text-slate-300 font-medium">Version:</span>{' '}
            {harmonization.version}
          </p>
          <p>
            <span className="text-slate-300 font-medium">Validation WAPE:</span>{' '}
            {(harmonization.validation.wape * 100).toFixed(1)}% (LOYO-CV region-month)
          </p>
          <p className="text-amber-400/80 text-xs">
            Pre-2012-02 values are MODIS-derived predictions.
            Forward test bias: {(harmonization.validation.forwardTestBias * 100).toFixed(1)}%.
            Cell-level values are biased at low counts; use aggregated totals.
          </p>
        </div>
      )}
    </div>
  );
};

