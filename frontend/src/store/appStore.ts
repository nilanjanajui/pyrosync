/**
 * Global application state store.
 * Uses Zustand for lightweight, type-safe state management.
 */
import { create } from 'zustand';
import type { DenseDataset } from '../datasource/load';
import type { Aoi } from '../domain/aoi';
import type { SensorMode } from '../domain/aggregate';

export interface AppState {
  // Data
  dataset: DenseDataset | null;
  setDataset: (ds: DenseDataset) => void;

  // AOI
  aoi: Aoi;
  setAoi: (aoi: Aoi) => void;
  /** Cell indexes (into dataset.cells) that are inside the current AOI */
  selectedCellIndexes: number[];
  setSelectedCellIndexes: (indexes: number[]) => void;

  // Sensor mode for calendar/chart
  sensorMode: SensorMode;
  setSensorMode: (mode: SensorMode) => void;

  // Date range filter
  dateStart: string; // YYYY-MM
  dateEnd: string; // YYYY-MM
  setDateRange: (start: string, end: string) => void;

  // Active month (for drill-down panel)
  activeMonth: string | null;
  setActiveMonth: (month: string | null) => void;

  // UI state
  mapReady: boolean;
  setMapReady: (ready: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  dataset: null,
  setDataset: (ds) => set({ dataset: ds }),

  aoi: { mode: 'state' },
  setAoi: (aoi) => set({ aoi }),
  selectedCellIndexes: [],
  setSelectedCellIndexes: (indexes) => set({ selectedCellIndexes: indexes }),

  sensorMode: 'harmonized',
  setSensorMode: (mode) => set({ sensorMode: mode }),

  dateStart: '2000-11',
  dateEnd: '2021-12',
  setDateRange: (start, end) => set({ dateStart: start, dateEnd: end }),

  activeMonth: null,
  setActiveMonth: (month) => set({ activeMonth: month }),

  mapReady: false,
  setMapReady: (ready) => set({ mapReady: ready }),
}));

