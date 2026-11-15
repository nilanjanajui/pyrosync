# PyroSync Data Contract Specification

This document defines the formal, immutable data contract between the Python backend data pipeline (`backend/`) and the client-side web application (`frontend/`).

All data files reside in `frontend/public/datasets/` and are strictly validated using JSON Schemas (`backend/pyrosync/schemas/`) on the backend and Zod schemas (`frontend/src/datasource/schema.ts`) on the frontend.

---

## 1. File Catalog

| File | Type | Compression | Purpose | Required / Optional |
| :--- | :--- | :--- | :--- | :--- |
| `manifest.json` | JSON | Uncompressed | Dataset metadata, coverage dates, sensor bounds, detection totals, and **content hash** | **Required** |
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
   - Total core bundle ≤ 3 MB gzipped.
   - Any individual annual hotspot shard ≤ 3 MB gzipped.

---

## 3. Content Hash & Cache-Busting (datasetHash)

### Purpose

Vercel caches `/datasets/*` as **immutable for one year** (`Cache-Control: public, max-age=31536000, immutable`). The frontend busts this cache via the query string `?v=<manifest.version>` (see `frontend/src/datasource/load.ts`). If `manifest.version` is not bumped when dataset files change, returning visitors will receive stale cached data.

The `datasetHash` field in `manifest.json` closes this loop by making data changes detectable at export time, ensuring the version is always bumped correctly.

### Schema

`manifest.json` carries:

```json
{
  "version": "1.0.1",
  "datasetHash": "a3f9…64hexchars…",
  ...
}
```

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `datasetHash` | `string` (64 hex chars) | Optional\* | SHA-256 digest over the 5 core files, in canonical order |

\* Optional in the **frontend Zod schema** only, so that older datasets without the field still parse. The backend `check` command warns (but does not fail) when the field is absent.

### Hash Computation

The hash is a **SHA-256** digest over the **concatenated raw bytes** of the following five files, read in this exact order:

1. `grid.geojson`
2. `boundary.geojson`
3. `cell_months.json`
4. `harmonization.json`
5. `validation.json`

No normalisation (sorting, whitespace stripping, etc.) is performed — the raw bytes from disk are hashed directly.

> **Important**: `_write_json` in `export.py` must produce deterministic output (no floating timestamps, no random key ordering). The existing implementation uses `json.dumps(data, ensure_ascii=False, allow_nan=False)` without `sort_keys`, but key insertion order in CPython dicts is stable across a single run, making the output deterministic for identical input data.

### Automatic Version Bump

`pyrosync export` reads the **existing** `manifest.json` (if present) and compares its `datasetHash` against the newly computed hash:

| Condition | Action |
|:----------|:-------|
| No prior manifest, or no prior hash | Write new hash; bump patch (e.g. `1.0.0` → `1.0.1`) |
| Hash changed | Bump patch version; write new hash |
| Hash unchanged | Keep existing version; write same hash |
| `--version X.Y.Z` passed | Use the override verbatim; write new hash |

### Enforcement in `check`

`pyrosync check` recomputes the SHA-256 and compares it to `manifest.datasetHash`:

- **Match** → `[PASS] datasetHash matches`
- **Mismatch** → `CHECK FAILED` with a message identifying which files to suspect and instructing the operator to re-run `pyrosync export`
- **Field absent** → `[SKIP]` warning (graceful; legacy datasets)

---

## 4. Frontend Schema (Zod)

`frontend/src/datasource/schema.ts` mirrors the backend JSON Schemas via Zod:

```ts
export const ManifestSchema = z.object({
  version: z.string(),
  ...
  // Optional for backwards compatibility with pre-hash datasets
  datasetHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  ...
});
```

The frontend **does not re-verify** the hash at runtime (that is a backend/CI responsibility). The field is typed as optional so that old cached manifests served from Vercel before the first post-hash export will still parse without throwing a Zod error.


