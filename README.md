# PyroSync — NASA Space Apps Challenge 2026
> **Harmonization of MODIS and VIIRS Hot Spots**

[![PyroSync CI Pipeline](https://github.com/nilanjanajui/pyrosync/actions/workflows/ci.yml/badge.svg)](https://github.com/nilanjanajui/pyrosync/actions/workflows/ci.yml)

PyroSync is an open-source, client-side analytical platform for emergency managers, climate scientists, and land managers to explore harmonized satellite active-fire records across California from November 2000 through December 2021.

---

## Architecture & Design Highlights
- **Static-First Computation**: Precomputed 10 km equal-area cell-month matrices (EPSG:6933, 4,527 cells). The web application unpacks sparse JSON payloads into dense `Float32Array` buffers for instant (< 10 ms) interactive AOI queries entirely within the browser.
- **Lazy Hotspot Shards**: Hotspot-level records are partitioned into annual quantized shards, loaded on-demand only when a user requests a granular hotspot CSV download.
- **Bi-Directional Schema Mirroring**: JSON Schemas in `backend/pyrosync/schemas/` define the source of truth and are mirrored by TypeScript Zod schemas in `frontend/src/datasource/schema.ts`.
- **Strict Data Contract & Invariants**:
  - Counts and hotspot rows strictly reconcile 1:1.
  - Zero means "monitored zero detections", never "no data".
  - Months before sensor launch are `null`.
  - Harmonized data carries full provenance badges and blend transition markers.

---

## Getting Started

### 1. Frontend Development
```bash
cd frontend
npm ci
npm run dev
```

### 2. Backend & Data Pipeline
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
pip install -r requirements-dev.txt

# Generate synthetic test dataset with edge cases
python -m pyrosync.cli synth --out ../frontend/public/datasets

# Export real data from the pipeline outputs in data/
# (Requires Phase 2-7 Parquet/CSV files in data/; see docs/PIPELINE.md)
python -m pyrosync.cli export --data ../data --out ../frontend/public/datasets

# Validate schemas and gzip budgets (< 3 MB)
python -m pyrosync.cli check --data ../frontend/public/datasets
```

### 3. Testing Suites
```bash
# Backend pytest & lint
cd backend
pytest
ruff check pyrosync/ tests/

# Frontend tests & build
cd frontend
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

---

## Updating the Dataset

When new pipeline outputs are available, follow the steps in **[docs/UPDATING_DATA.md](docs/UPDATING_DATA.md)** to safely regenerate, verify, and deploy the dataset. The pipeline enforces a content hash (`datasetHash` in `manifest.json`) that auto-bumps the cache-busting version and prevents silent data drift.

---

## Dataset Limitations & Caveats
1. **Coverage Boundary**: The historical dataset ends at **December 2021** (`2021-12`). PyroSync never presents historical records as real-time or current.
2. **Detection Semantics**: Satellite active-fire observations represent thermal anomaly detection records during satellite overpass, not counts of individual or unique wildfires.
3. **Partial Observation**: VIIRS Suomi-NPP began preliminary observations on January 20, 2012. `2012-01` is marked as a partial month; its first complete observation month is `2012-02`.

---

## License
MIT License. See [LICENSE](LICENSE) for details.
