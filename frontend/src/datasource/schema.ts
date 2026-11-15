import { z } from 'zod';

const YearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const ManifestSchema = z.object({
  version: z.string(),
  generatedAtUtc: z.string(),
  synthetic: z.boolean(),
  /**
   * SHA-256 hex digest over the 5 core dataset files, written by `pyrosync export`.
   * Optional so that older datasets (without the hash) still parse successfully.
   */
  datasetHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  studyArea: z.object({
    name: z.string(),
    bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    /** Optional: land area of the study area in km² (used for the "whole area" size). */
    areaKm2: z.number().positive().optional(),
    /** Optional: named sub-regions shown as quick-select chips. */
    presets: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
        })
      )
      .optional(),
  }),
  coverage: z.object({
    start: z.string(),
    end: z.string(),
  }),
  modisStart: z.string(),
  viirsStart: YearMonth,
  viirsFirstCompleteMonth: YearMonth,
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

/** Source code per harmonized cell-month record.
 * 0 = observed VIIRS (2012-02 to 2021-12)
 * 1 = predicted MODIS→VIIRS (2002-07 to 2012-01)
 * 2 = predicted Terra-only (2000-11 to 2002-06)
 */
export const HarmonizedSourceCode = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
]);
export type HarmonizedSourceCodeType = z.infer<typeof HarmonizedSourceCode>;

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
  harmonized: z
    .object({
      cell: z.array(z.number().int().nonnegative()),
      month: z.array(z.number().int().nonnegative()),
      n: z.array(z.number().nonnegative()),
      /** Per-record source code (integer 0 | 1 | 2) */
      source: z.array(HarmonizedSourceCode),
    })
    .optional(),
});

export type CellMonths = z.infer<typeof CellMonthsSchema>;

/** Per-month source code and validation status arrays */
export const PerMonthSourcesSchema = z.object({
  months: z.array(z.string()),
  source: z.array(HarmonizedSourceCode),
  status: z.array(z.enum(['validated', 'predicted_unvalidated'])),
});

/** Seasonal VIIRS/MODIS ratio object (DJF/MAM/JJA/SON) */
export const SeasonalRatiosSchema = z.object({
  DJF: z.number(),
  MAM: z.number(),
  JJA: z.number(),
  SON: z.number(),
});

export const HarmonizationSchema = z.object({
  status: z.enum(['provisional', 'validated']),
  method: z.string(),
  version: z.string(),
  blendStart: YearMonth,
  firstAquaMonth: YearMonth,

  /** VIIRS/MODIS seasonal ratios for MODIS+Aqua era (2002-07 → 2012-01) */
  seasonalRatios: SeasonalRatiosSchema,

  /** VIIRS/MODIS seasonal ratios for Terra-only era (2000-11 → 2002-06) */
  terraOnlyRatios: SeasonalRatiosSchema,

  /** Per-month source flags across the full record */
  perMonthSources: PerMonthSourcesSchema,

  /** Corrected bootstrap CIs on seasonal ratios */
  bootstrapCi: z.object({
    seasons: z.array(z.string()),
    lo95: z.array(z.number()),
    hi95: z.array(z.number()),
  }),

  description: z.string(),

  validation: z.object({
    notes: z.string(),
    /** LOYO-CV region-month WAPE (combined) */
    wape: z.number(),
    /** LOYO-CV WAPE for Terra-only era */
    wapeTerraOnly: z.number(),
    /** Forward test bias (train ≤2019, test 2020-21). Negative = under-predict. */
    forwardTestBias: z.number(),
    biasTable: z.object({
      bins: z.array(z.string()),
      biasPercent: z.array(z.number()),
    }),
    uncertainty: z.object({
      label: z.string(),
      note: z.string(),
      state: z.object({
        seasons: z.array(z.string()),
        lo5: z.array(z.number()),
        hi95: z.array(z.number()),
      }),
      regions: z.array(
        z.object({
          region: z.string(),
          seasons: z.array(z.string()),
          lo5: z.array(z.number()),
          hi95: z.array(z.number()),
        })
      ),
    }),
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
      modis: z
        .object({
          path: z.string(),
          rows: z.number().int().nonnegative(),
          bytesGzip: z.number().int().nonnegative(),
        })
        .optional(),
      viirs: z
        .object({
          path: z.string(),
          rows: z.number().int().nonnegative(),
          bytesGzip: z.number().int().nonnegative(),
        })
        .optional(),
    })
  ),
});

export type HotspotsIndex = z.infer<typeof HotspotsIndexSchema>;
