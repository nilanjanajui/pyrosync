/**
 * Global application state store.
 * Uses Zustand for lightweight, type-safe state management.
 */
import { create } from 'zustand';
import type { DenseDataset } from '../datasource/load';
import type { Aoi } from '../domain/aoi';
import type { SensorMode } from '../domain/aggregate';

export type CalendarDisplayMode = 'counts' | 'anomaly';

export interface AppState {
  // Core Data
  dataset: DenseDataset | null;
  setDataset: (ds: DenseDataset) => void;

  // AOI State
  aoi: Aoi;
  setAoi: (aoi: Aoi) => void;
  selectedCellIndexes: number[];
  setSelectedCellIndexes: (indexes: number[]) => void;

  // Sensor Mode ('harmonized' | 'modis' | 'viirs')
  sensorMode: SensorMode;
  setSensorMode: (mode: SensorMode) => void;

  // Calendar Mode ('counts' | 'anomaly')
  calendarMode: CalendarDisplayMode;
  setCalendarMode: (mode: CalendarDisplayMode) => void;

  // Date Range
  dateStart: string; // YYYY-MM
  dateEnd: string;   // YYYY-MM
  setDateRange: (start: string, end: string) => void;

  // Active Selected Month (YYYY-MM or null)
  activeMonth: string | null;
  setActiveMonth: (month: string | null) => void;

  // Ask the map to zoom to a box (set by the coordinate form)
  fitRequest: { bbox: [number, number, number, number]; id: number } | null;
  requestFit: (bbox: [number, number, number, number]) => void;

  // Modals & Drawers
  isHarmonizationModalOpen: boolean;
  setIsHarmonizationModalOpen: (open: boolean) => void;
  isExportModalOpen: boolean;
  setIsExportModalOpen: (open: boolean) => void;

  // Accessibility Live Announcements
  liveAnnouncement: string;
  setLiveAnnouncement: (msg: string) => void;

  // Map Engine Ready
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

  calendarMode: 'counts',
  setCalendarMode: (mode) => set({ calendarMode: mode }),

  dateStart: '',
  dateEnd: '',
  setDateRange: (start, end) => set({ dateStart: start, dateEnd: end }),

  activeMonth: null, // set to the busiest month when a dataset loads
  setActiveMonth: (month) => set({ activeMonth: month }),

  fitRequest: null,
  requestFit: (bbox) => set((st) => ({ fitRequest: { bbox, id: (st.fitRequest?.id ?? 0) + 1 } })),

  isHarmonizationModalOpen: false,
  setIsHarmonizationModalOpen: (open) => set({ isHarmonizationModalOpen: open }),

  isExportModalOpen: false,
  setIsExportModalOpen: (open) => set({ isExportModalOpen: open }),

  liveAnnouncement: '',
  setLiveAnnouncement: (msg) => set({ liveAnnouncement: msg }),

  mapReady: false,
  setMapReady: (ready) => set({ mapReady: ready }),
}));
