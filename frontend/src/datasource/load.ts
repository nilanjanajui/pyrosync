/**
 * Data Loader with Strict Zod Validation and Dense Typed Array Construction.
 */
import { z } from 'zod';
import {
  ManifestSchema,
  GridGeoJsonSchema,
  BoundaryGeoJsonSchema,
  CellMonthsSchema,
  HarmonizationSchema,
  ValidationSchema,
  type Manifest,
  type GridGeoJson,
  type BoundaryGeoJson,
  type CellMonths,
  type Harmonization,
  type ValidationData,
} from './schema';

export interface DatasetLoadError {
  file: string;
  field?: string;
  message: string;
  rawDetails?: string;
}

export interface DenseDataset {
  manifest: Manifest;
  grid: GridGeoJson;
  boundary: BoundaryGeoJson;
  harmonization: Harmonization;
  validation: ValidationData | null;
  months: string[];
  cells: string[];
  cellIndexMap: Map<string, number>;
  monthIndexMap: Map<string, number>;
  numMonths: number;
  numCells: number;

  // Dense flat matrices: size = numMonths * numCells
  // index = monthIndex * numCells + cellIndex
  modisTotal: Float32Array;
  modisTerra: Float32Array;
  modisAqua: Float32Array;
  modisFRP: Float32Array;
  viirsTotal: Float32Array;
  viirsFRP: Float32Array;
  harmonizedTotal: Float32Array;
  /** Source code per matrix cell: 0=observed_viirs, 1=predicted_modis_viirs, 2=predicted_terra_only, 255=no_data */
  harmonizedSource: Uint8Array;

  // Masks: Uint8Array of length numMonths (1 = sensor operating / valid data, 0 = null / unoperated)
  modisMask: Uint8Array;
  viirsMask: Uint8Array;
  harmonizedMask: Uint8Array;

  hasHarmonizedBlock: boolean;
}

async function fetchAndValidate<T>(
  url: string,
  fileName: string,
  schema: { parse: (data: unknown) => T },
  optional = false
): Promise<T | null> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    if (optional) return null;
    throw {
      file: fileName,
      message: `Network error loading ${fileName}: ${(err as Error).message}`,
    } as DatasetLoadError;
  }

  if (!response.ok) {
    if (optional && response.status === 404) return null;
    throw {
      file: fileName,
      message: `Failed to fetch ${fileName} (HTTP ${response.status})`,
    } as DatasetLoadError;
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (err) {
    throw {
      file: fileName,
      message: `Malformed JSON in ${fileName}: ${(err as Error).message}`,
    } as DatasetLoadError;
  }

  try {
    return schema.parse(json);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      const issue = err.issues[0];
      const fieldPath = issue ? issue.path.join('.') : undefined;
      const msg = issue ? `${issue.message} at ${fieldPath || 'root'}` : err.message;
      throw {
        file: fileName,
        field: fieldPath,
        message: `Schema validation failed for ${fileName}: ${msg}`,
        rawDetails: JSON.stringify(err.issues, null, 2),
      } as DatasetLoadError;
    }
    throw {
      file: fileName,
      message: `Validation failed for ${fileName}: ${(err as Error).message}`,
    } as DatasetLoadError;
  }
}

export async function loadDataset(basePath = '/datasets'): Promise<DenseDataset> {
  const versionParam = `?t=${Date.now()}`;

  // 1. Fetch & validate manifest
  const manifest = await fetchAndValidate<Manifest>(
    `${basePath}/manifest.json${versionParam}`,
    'manifest.json',
    ManifestSchema
  );
  if (!manifest) {
    throw { file: 'manifest.json', message: 'Required manifest.json could not be loaded' };
  }

  const vQuery = `?v=${manifest.version}`;

  // 2. Fetch required files in parallel
  const [grid, boundary, cellMonths, harmonization, validation] = await Promise.all([
    fetchAndValidate<GridGeoJson>(`${basePath}/grid.geojson${vQuery}`, 'grid.geojson', GridGeoJsonSchema),
    fetchAndValidate<BoundaryGeoJson>(`${basePath}/boundary.geojson${vQuery}`, 'boundary.geojson', BoundaryGeoJsonSchema),
    fetchAndValidate<CellMonths>(`${basePath}/cell_months.json${vQuery}`, 'cell_months.json', CellMonthsSchema),
    fetchAndValidate<Harmonization>(`${basePath}/harmonization.json${vQuery}`, 'harmonization.json', HarmonizationSchema),
    fetchAndValidate<ValidationData>(`${basePath}/validation.json${vQuery}`, 'validation.json', ValidationSchema, true),
  ]);

  if (!grid) throw { file: 'grid.geojson', message: 'Missing grid.geojson' };
  if (!boundary) throw { file: 'boundary.geojson', message: 'Missing boundary.geojson' };
  if (!cellMonths) throw { file: 'cell_months.json', message: 'Missing cell_months.json' };
  if (!harmonization) throw { file: 'harmonization.json', message: 'Missing harmonization.json' };

  // 3. Build index mappings
  const months = cellMonths.months;
  const cells = cellMonths.cells;
  const numMonths = months.length;
  const numCells = cells.length;

  const cellIndexMap = new Map<string, number>();
  cells.forEach((id, idx) => cellIndexMap.set(id, idx));

  const monthIndexMap = new Map<string, number>();
  months.forEach((m, idx) => monthIndexMap.set(m, idx));

  // 4. Build dense flat Float32Array matrices
  const matrixSize = numMonths * numCells;
  const modisTotal = new Float32Array(matrixSize);
  const modisTerra = new Float32Array(matrixSize);
  const modisAqua = new Float32Array(matrixSize);
  const modisFRP = new Float32Array(matrixSize);
  const viirsTotal = new Float32Array(matrixSize);
  const viirsFRP = new Float32Array(matrixSize);
  const harmonizedTotal = new Float32Array(matrixSize);
  // 255 = no data / sensor not operating for this cell-month
  const harmonizedSource = new Uint8Array(matrixSize).fill(255);

  // Unroll MODIS sparse columns
  const mBlock = cellMonths.modis;
  for (let i = 0; i < mBlock.cell.length; i++) {
    const cIdx = mBlock.cell[i];
    const mIdx = mBlock.month[i];
    const offset = mIdx * numCells + cIdx;
    modisTotal[offset] = mBlock.n[i];
    modisTerra[offset] = mBlock.terra[i];
    modisAqua[offset] = mBlock.aqua[i];
    modisFRP[offset] = mBlock.frp[i];
  }

  // Unroll VIIRS sparse columns
  const vBlock = cellMonths.viirs;
  for (let i = 0; i < vBlock.cell.length; i++) {
    const cIdx = vBlock.cell[i];
    const mIdx = vBlock.month[i];
    const offset = mIdx * numCells + cIdx;
    viirsTotal[offset] = vBlock.n[i];
    viirsFRP[offset] = vBlock.frp[i];
  }

  // Unroll Harmonized sparse columns if present
  let hasHarmonizedBlock = false;
  if (cellMonths.harmonized && cellMonths.harmonized.n.length > 0) {
    hasHarmonizedBlock = true;
    const hBlock = cellMonths.harmonized;
    for (let i = 0; i < hBlock.cell.length; i++) {
      const cIdx = hBlock.cell[i];
      const mIdx = hBlock.month[i];
      const offset = mIdx * numCells + cIdx;
      harmonizedTotal[offset] = hBlock.n[i];
      harmonizedSource[offset] = hBlock.source[i];
    }
  }

  // 5. Operating Period Masks
  const modisMask = new Uint8Array(numMonths);
  const viirsMask = new Uint8Array(numMonths);
  const harmonizedMask = new Uint8Array(numMonths);

  const viirsStartIdx = monthIndexMap.get(manifest.viirsStart) ?? -1;

  for (let m = 0; m < numMonths; m++) {
    // MODIS operates across full study range (starting 2000-11)
    modisMask[m] = 1;
    // VIIRS operates from 2012-01 onwards
    if (viirsStartIdx >= 0 && m >= viirsStartIdx) {
      viirsMask[m] = 1;
    }
    // Harmonized covers full record if available or fallback scale configured
    harmonizedMask[m] = 1;
  }

  return {
    manifest,
    grid,
    boundary,
    harmonization,
    validation,
    months,
    cells,
    cellIndexMap,
    monthIndexMap,
    numMonths,
    numCells,
    modisTotal,
    modisTerra,
    modisAqua,
    modisFRP,
    viirsTotal,
    viirsFRP,
    harmonizedTotal,
    harmonizedSource,
    modisMask,
    viirsMask,
    harmonizedMask,
    hasHarmonizedBlock,
  };
}

