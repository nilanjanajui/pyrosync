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

  // Map 3D Perspective Mode (true = 45° oblique tactical drone view, false = 2D nadir plan view)
  is3dPerspective: boolean;
  setIs3dPerspective: (is3d: boolean) => void;

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

  dateStart: '2000-11',
  dateEnd: '2021-12',
  setDateRange: (start, end) => set({ dateStart: start, dateEnd: end }),

  activeMonth: '2020-08', // Default to a prominent historical peak month
  setActiveMonth: (month) => set({ activeMonth: month }),

  is3dPerspective: true, // Default to stunning 3D tactical perspective
  setIs3dPerspective: (is3d) => set({ is3dPerspective: is3d }),

  isHarmonizationModalOpen: false,
  setIsHarmonizationModalOpen: (open) => set({ isHarmonizationModalOpen: open }),

  isExportModalOpen: false,
  setIsExportModalOpen: (open) => set({ isExportModalOpen: open }),

  liveAnnouncement: '',
  setLiveAnnouncement: (msg) => set({ liveAnnouncement: msg }),

  mapReady: false,
  setMapReady: (ready) => set({ mapReady: ready }),
}));
