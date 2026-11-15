# PyroSync Data Pipeline

This document describes the end-to-end pipeline that transforms raw NASA FIRMS active-fire detections into the frontend dataset artefacts served at `frontend/public/datasets/`.

---

## Pipeline Overview

```
NASA FIRMS raw CSVs
       │
   Phase 2  Cleaning & filtering (type==0 vegetation fires, California boundary)
       │        notebooks/phase2_cleaning.ipynb
       │        → data/cleaned/phase2/modis_vegetation.parquet
       │          data/cleaned/phase2/viirs_vegetation.parquet
       │
   Phase 3  Spatial aggregation onto 10 km equal-area grid (EPSG:6933)
       │        notebooks/phase3_aggregation.ipynb
       │        → data/aggregated/phase3/california_grid_10km.parquet  (4,527 cells)
       │          data/aggregated/phase3/modis_cell_month.parquet      (MODIS counts)
       │          data/aggregated/phase3/viirs_cell_month.parquet      (VIIRS counts)
       │          data/aggregated/phase3/panel_cell_month_2012_2021.parquet
       │          data/aggregated/phase3/phase3_monthly_summary.csv
       │
   Phase 4  Sensor comparison & ratio analysis (2012-02 to 2021-12 overlap window)
       │        notebooks/phase4_evaluation.ipynb
       │        → data/evaluation/phase4/ratio_by_season.csv
       │
   Phase 5  Model selection (leave-one-year-out cross-validation)
       │        notebooks/phase5_harmonization.ipynb
       │        → data/harmonization/phase5/final_model_parameters.json
       │          data/harmonization/phase5/cv_results.csv
       │          data/harmonization/phase5/cv_wape_by_year.csv
       │          data/harmonization/phase5/forward_test_results.csv
       │          data/harmonization/phase5/ratio_bootstrap_ci.csv
       │          data/harmonization/phase5/selected_model_bias_by_modis_bin.csv
       │
   Phase 6  Apply model — predict pre-2012 VIIRS-equivalent counts
       │        notebooks/phase6_application.ipynb
       │        → data/harmonization/phase6/harmonized_monthly_state.csv
       │          data/harmonization/phase6/harmonized_monthly_region.csv
       │          data/harmonization/phase6/predicted_cell_month_pre2012.parquet
       │          data/harmonization/phase6/prediction_bands.csv
       │          data/harmonization/phase6/aoi_error_by_block.csv
       │          data/harmonization/phase6/phase6_metadata.json
       │
   Phase 7  Product assembly (app-ready tables)
       │        notebooks/phase7_product.ipynb
       │        → data/product/phase7/cells.csv       (4,527 cells + region)
       │          data/product/phase7/months.csv      (254 months + source label)
       │          data/product/phase7/series_long.csv (region×month state series)
       │          data/product/phase7/climatology.csv (region×month quantiles)
       │          data/product/phase7/app_config.json (era dates, error curves)
       │
   pyrosync export  ETL — produces frontend dataset artefacts
            → frontend/public/datasets/manifest.json
              frontend/public/datasets/grid.geojson
              frontend/public/datasets/boundary.geojson
              frontend/public/datasets/cell_months.json
              frontend/public/datasets/harmonization.json
              frontend/public/datasets/validation.json
```

---

## Running the Export

After completing Phase 2–7 notebooks (outputs in `data/`), run:

```bash
cd backend
source .venv/bin/activate
python -m pyrosync.cli export --data ../data --out ../frontend/public/datasets
python -m pyrosync.cli check --data ../frontend/public/datasets
```

The export reads the following inputs (never modifies them):

| Input file | Description |
|---|---|
| `data/aggregated/phase3/california_grid_10km.parquet` | 4,527 cells with WKB polygon geometry (EPSG:6933) |
| `data/aggregated/phase3/modis_cell_month.parquet` | MODIS detection counts per cell-month |
| `data/aggregated/phase3/viirs_cell_month.parquet` | VIIRS detection counts per cell-month |
| `data/harmonization/phase5/final_model_parameters.json` | Seasonal ratios, bootstrap CIs |
| `data/harmonization/phase5/cv_results.csv` | Model comparison by WAPE |
| `data/harmonization/phase5/cv_wape_by_year.csv` | Per-year cross-validation performance |
| `data/harmonization/phase5/forward_test_results.csv` | Temporal generalization test |
| `data/harmonization/phase5/selected_model_bias_by_modis_bin.csv` | Bias decomposition |
| `data/harmonization/phase6/phase6_metadata.json` | Fitted seasonal ratios, WAPE metrics |
| `data/harmonization/phase6/predicted_cell_month_pre2012.parquet` | Pre-2012 cell-month predictions |
| `data/harmonization/phase6/prediction_bands.csv` | 5th–95th percentile prediction bands by season |
| `data/harmonization/phase6/aoi_error_by_block.csv` | WAPE vs area size curve |
| `data/product/phase7/app_config.json` | Era boundary dates, error curve |
| `data/product/phase7/months.csv` | Month list with source labels |
| `data/product/phase7/cells.csv` | Cell list with region assignments |
| `data/boundaries/california_boundary_2024.geojson` | California state boundary (WGS-84) |

---

## Output Format

### `manifest.json`
Dataset-level metadata. The UI reads **all** region-specific configuration from this file — no coordinates, dates or region names are hard-coded in `frontend/src/`.

Key fields:
- `synthetic: false` — real data, hides demo badges
- `studyArea.bbox` — computed from actual grid extent
- `grid.cells` — 4,527
- `totals.modisDetections` — 279,986
- `totals.viirsDetections` — 797,147
- Era dates: `viirsStart`, `viirsFirstCompleteMonth`, `firstAquaMonth`

### `grid.geojson`
4,527 10 km × 10 km cell polygons reprojected from EPSG:6933 to WGS-84. Coordinates rounded to 6 decimal places (≈ 11 cm precision). Each feature has properties: `id`, `lat`, `lon`, `overlapPct`.

### `cell_months.json`
Sparse COO (coordinate) arrays for three sensors. Arrays use integer indices into the `months` and `cells` lists to avoid repeating strings.

```
harmonized.source codes:
  0 = observed VIIRS           (2012-02 to 2021-12)
  1 = predicted MODIS → VIIRS  (2002-07 to 2012-01)
  2 = predicted Terra-only     (2000-11 to 2002-06)
```

Total harmonized records: 48,149 (observed VIIRS cell-months + pre-2012 predicted cell-months).

### `harmonization.json`
Full provenance of the seasonal ratio model:
- Fitted seasonal ratios for MODIS+Aqua era and Terra-only era
- Per-month source flags and status (validated / predicted_unvalidated)
- Bootstrap 95% CIs on seasonal ratios
- WAPE (CV): 0.129 combined, 0.130 Terra-only
- Forward test bias: −9.6%
- Prediction bands by season (5th–95th percentile ratio)
- Bias table by MODIS detection bin

### `validation.json`
Four tables exposed in the "How it works" drawer:
1. Cross-validation model comparison
2. CV WAPE by held-out year
3. Forward test (trained ≤2019, tested 2020–2021)
4. Typical prediction error by area size

---

## Data Integrity

After every export run:

```bash
python -m pyrosync.cli check --data ../frontend/public/datasets
```

This validates all JSON files against their JSON Schema and reports gzip payload sizes. The core bundle must remain below 3 MB gzip.

---

## Reconciliation Invariant

For any AOI and date range, the number of MODIS (or VIIRS) rows in `cell_months.json` must equal the sum of that sensor's counts in the monthly series. This is enforced by `backend/pyrosync/assertions.py` and tested in `backend/tests/`.

---

## Notes

- **Never fabricate data**: only `data/` → `frontend/public/datasets/`. No interpolation.
- **No FRP in product**: Fire Radiative Power is excluded from the main product (`frp: []`). It is a secondary diagnostic not scaled or validated.
- **Detection ≠ fire**: A detection count is not a unique fire event. Zero detections means no satellite record, not proof of no fire. Months before sensor launch are null, never zero.
- **Notebooks are read-only**: Never modify `notebooks/`. Re-running them regenerates `data/`; then re-run `pyrosync export`.

