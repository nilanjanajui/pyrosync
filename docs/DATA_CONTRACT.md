# PyroSync Data Contract Specification

This document defines the formal, immutable data contract between the Python backend data pipeline (`backend/`) and the client-side web application (`frontend/`).

All data files reside in `frontend/public/datasets/` and are strictly validated using JSON Schemas (`backend/pyrosync/schemas/`) on the backend and Zod schemas (`frontend/src/datasource/schema.ts`) on the frontend.

---

## 1. File Catalog

| File | Type | Compression | Purpose | Required / Optional |
| :--- | :--- | :--- | :--- | :--- |
| `manifest.json` | JSON | Uncompressed | Dataset metadata, coverage dates, sensor bounds, and detection totals | **Required** |
| `grid.geojson` | GeoJSON | Uncompressed | 10 km equal-area (EPSG:6933) cell polygons projected to WGS84 | **Required** |
| `boundary.geojson` | GeoJSON | Uncompressed | California study area outline polygon | **Required** |
| `cell_months.json` | JSON | Columnar | Sparse monthly detection counts and FRP sums per cell-month | **Required** |
| `harmonization.json` | JSON | Uncompressed | Provenance, method description, validation metrics, and scaling factors | **Required** |
| `validation.json` | JSON | Uncompressed | Cross-validation summary tables and figure manifests | Optional |
| `hotspots/index.json` | JSON | Uncompressed | Manifest and byte sizes for lazy-loaded annual hotspot shards | **Required for CSV (3)** |
| `hotspots/<year>_<sensor>.json` | JSON | Quantized | Per-year, per-sensor quantized hotspot detection records | **Required for CSV (3)** |

---

## 2. Invariants & Reconciliation Rules

1. **Reconciliation Invariant**: For any Area of Interest (AOI) and date range, the total number of hotspot rows per sensor must equal the sum of that sensor's detection counts in the monthly series (`cell_months.json`).
2. **Detection Semantics**: A detection record is not a unique fire. Zero means "no detection record in this cell-month", not proof of no fire. A month prior to a sensor's operating launch is `null` (no data), never zero.
3. **Coverage Boundary**: The dataset period spans `2000-11` to `2021-12`. `2012-01` is marked as a partial month for VIIRS.
4. **Terra / Aqua Split**: For every MODIS record in `cell_months.json`, $\text{terra} + \text{aqua} == n$.
5. **Size Budgets**:
   - Total core bundle $\le 3\text{ MB}$ gzipped.
   - Any individual annual hotspot shard $\le 3\text{ MB}$ gzipped.

