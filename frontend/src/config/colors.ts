/**
 * Accessible Color Palettes (WCAG 2.2 AA compliant)
 * Never relies on color alone; paired with text, numbers, and hatched patterns.
 */
import { interpolateCividis, interpolatePuOr } from 'd3-scale-chromatic';

export const COLORS = {
  zeroDetections: '#334155', // Distinct neutral slate-700
  noDataFill: '#1e293b',     // Dark slate-800 with hatching
  noDataHatch: '#64748b',    // Slate-500
  partialMonthMarker: '#38bdf8', // Light sky blue
  blendBoundaryMarker: '#f59e0b', // Amber
  accent: '#f97316',         // Orange-500
  accentMuted: '#ea580c',
  border: '#334155',
  surface: '#1e293b',
  background: '#0f172a',
};

/**
 * Sequential ramp for counts (Cividis: perceptually uniform and colorblind safe).
 * Normalized value in [0, 1].
 */
export function getCountColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  return interpolateCividis(clamped);
}

/**
 * Diverging ramp for anomaly percentiles / ratios (Purple-Orange, never red-green).
 * Normalized value in [0, 1], where 0.5 is historical median.
 */
export function getAnomalyColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  return interpolatePuOr(clamped);
}

