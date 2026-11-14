import { z } from 'zod';

export const ManifestSchema = z.object({
  version: z.string(),
  generatedAtUtc: z.string(),
  synthetic: z.boolean(),
  studyArea: z.object({
    name: z.string(),
    bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  }),
  coverage: z.object({
    start: z.string(),
    end: z.string(),
  }),
  modisStart: z.string(),
  viirsStart: z.literal('2012-01'),
  viirsFirstCompleteMonth: z.literal('2012-02'),
  viirsPartialMonths: z.array(z.string()),
  firstAquaMonth: z.string(),
  grid: z.object({
    cellKm: z.literal(10),
    crs: z.literal('EPSG:6933'),
    cells: z.number().int().positive(),
  }),
  totals: z.object({
    modisDetections: z.number().int().nonnegative(),
    viirsDetections: z.number().int().nonnegative(),
  }),
  sources: z.array(z.string()),
  filters: z.string(),
});

export type Manifest = z.infer<typeof ManifestSchema>;

export const GridFeatureSchema = z.object({
  type: z.literal('Feature'),
  geometry: z.object({
    type: z.enum(['Polygon', 'MultiPolygon']),
    coordinates: z.array(z.any()),
  }),
  properties: z.object({
    id: z.string(),
    lat: z.number(),
    lon: z.number(),
    overlapPct: z.number().min(0).max(100),
  }),
});

export const GridGeoJsonSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(GridFeatureSchema),
});

export type GridGeoJson = z.infer<typeof GridGeoJsonSchema>;
export type GridFeature = z.infer<typeof GridFeatureSchema>;

export const BoundaryGeoJsonSchema = z.object({
  type: z.enum(['FeatureCollection', 'Feature']),
  features: z.array(z.any()).optional(),
  geometry: z.any().optional(),
  properties: z.any().optional(),
});

export type BoundaryGeoJson = z.infer<typeof BoundaryGeoJsonSchema>;

export const CellMonthsSchema = z.object({
  months: z.array(z.string()),
  cells: z.array(z.string()),
  modis: z.object({
    cell: z.array(z.number().int().nonnegative()),
    month: z.array(z.number().int().nonnegative()),
    n: z.array(z.number().int().nonnegative()),
    terra: z.array(z.number().int().nonnegative()),
    aqua: z.array(z.number().int().nonnegative()),
    frp: z.array(z.number().nonnegative()),
  }),
  viirs: z.object({
    cell: z.array(z.number().int().nonnegative()),
    month: z.array(z.number().int().nonnegative()),
    n: z.array(z.number().int().nonnegative()),
    frp: z.array(z.number().nonnegative()),
  }),
  harmonized: z.object({
    cell: z.array(z.number().int().nonnegative()),
    month: z.array(z.number().int().nonnegative()),
    n: z.array(z.number().nonnegative()),
    monthSource: z.array(z.enum(['native_viirs', 'scaled_modis', 'model'])),
  }).optional(),
});

export type CellMonths = z.infer<typeof CellMonthsSchema>;

export const HarmonizationSchema = z.object({
  status: z.enum(['provisional', 'validated']),
  method: z.string(),
  version: z.string(),
  blendStart: z.literal('2012-02'),
  scale: z.object({
    global: z.number().nullable(),
    terraOnly: z.number().nullable(),
    bySeason: z.record(z.string(), z.number()).nullable(),
  }),
  description: z.string(),
  validation: z.object({
    notes: z.string(),
    metrics: z.record(z.string(), z.any()),
  }),
});

export type Harmonization = z.infer<typeof HarmonizationSchema>;

export const ValidationSchema = z.object({
  tables: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      note: z.string(),
      columns: z.array(z.string()),
      rows: z.array(z.array(z.union([z.string(), z.number(), z.null(), z.boolean()]))),
    })
  ),
  figures: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      src: z.string(),
      alt: z.string(),
    })
  ),
});

export type ValidationData = z.infer<typeof ValidationSchema>;

export const HotspotsIndexSchema = z.object({
  version: z.string(),
  quantization: z.object({
    latScale: z.literal(10000),
    lonScale: z.literal(10000),
    frpScale: z.literal(10),
    dayEpoch: z.literal('2000-01-01'),
  }),
  columns: z.array(z.string()),
  files: z.record(
    z.string(),
    z.object({
      modis: z.object({
        path: z.string(),
        rows: z.number().int().nonnegative(),
        bytesGzip: z.number().int().nonnegative(),
      }).optional(),
      viirs: z.object({
        path: z.string(),
        rows: z.number().int().nonnegative(),
        bytesGzip: z.number().int().nonnegative(),
      }).optional(),
    })
  ),
});

export type HotspotsIndex = z.infer<typeof HotspotsIndexSchema>;

