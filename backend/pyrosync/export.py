"""PyroSync ETL export — real data pipeline.

Reads processed Phase 2–7 Parquet/CSV files from ``data/`` and writes the
frontend dataset artefacts to ``frontend/public/datasets/``.

Output files
------------
manifest.json       Dataset-level metadata
grid.geojson        4,527 10 km cells as GeoJSON polygons (WGS-84)
boundary.geojson    California state boundary (WGS-84)
cell_months.json    Sparse COO arrays: MODIS, VIIRS, harmonized counts
harmonization.json  Model parameters, ratios, validation metrics
validation.json     Tables exposed in "How it works" drawer
"""

from __future__ import annotations

import gzip
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import geopandas as gpd
import pandas as pd
from shapely import wkb

# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

VERSION = "1.0.0"


def run_export(data_dir: Path, out_dir: Path) -> None:
    """Execute the full ETL export pipeline."""
    data_dir = data_dir.resolve()
    out_dir = out_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n[export] Reading from: {data_dir}")
    print(f"[export] Writing to:   {out_dir}\n")

    # ------------------------------------------------------------------
    # 1. Load inputs
    # ------------------------------------------------------------------
    print("[1/7] Loading input files …")
    grid_raw = pd.read_parquet(data_dir / "aggregated/phase3/california_grid_10km.parquet")
    modis_cm = pd.read_parquet(data_dir / "aggregated/phase3/modis_cell_month.parquet")
    viirs_cm = pd.read_parquet(data_dir / "aggregated/phase3/viirs_cell_month.parquet")
    pre2012 = pd.read_parquet(
        data_dir / "harmonization/phase6/predicted_cell_month_pre2012.parquet"
    )
    p5 = json.loads((data_dir / "harmonization/phase5/final_model_parameters.json").read_text())
    p6_meta = json.loads((data_dir / "harmonization/phase6/phase6_metadata.json").read_text())
    app_cfg = json.loads((data_dir / "product/phase7/app_config.json").read_text())
    months_df = pd.read_csv(data_dir / "product/phase7/months.csv")
    cells_df = pd.read_csv(data_dir / "product/phase7/cells.csv")
    aoi_err = pd.read_csv(data_dir / "harmonization/phase6/aoi_error_by_block.csv")
    pred_bands = pd.read_csv(data_dir / "harmonization/phase6/prediction_bands.csv")
    cv_results = pd.read_csv(data_dir / "harmonization/phase5/cv_results.csv")
    cv_wape_yr = pd.read_csv(data_dir / "harmonization/phase5/cv_wape_by_year.csv")
    fwd_test = pd.read_csv(data_dir / "harmonization/phase5/forward_test_results.csv")
    bias_bin = pd.read_csv(data_dir / "harmonization/phase5/selected_model_bias_by_modis_bin.csv")
    boundary_path = data_dir / "boundaries/california_boundary_2024.geojson"

    print("    ✓ All input files loaded")

    # ------------------------------------------------------------------
    # 2. Build grid.geojson
    # ------------------------------------------------------------------
    print("[2/7] Building grid.geojson …")
    geoms = [wkb.loads(g) for g in grid_raw["geometry"]]
    gdf = gpd.GeoDataFrame(grid_raw.drop(columns=["geometry"]), geometry=geoms, crs="EPSG:6933")
    gdf_wgs = gdf.to_crs("EPSG:4326")

    features = []
    for _, row in gdf_wgs.iterrows():
        geom = row.geometry.__geo_interface__
        # Round coordinates to 6 dp (≈11 cm precision, saves ~40% payload)
        geom = _round_geom(geom, 6)
        features.append(
            {
                "type": "Feature",
                "geometry": geom,
                "properties": {
                    "id": str(row["cell_id"]),
                    "lat": round(float(row["lat"]), 6),
                    "lon": round(float(row["lon"]), 6),
                    "overlapPct": round(float(row["california_overlap_pct"]), 2),
                },
            }
        )

    grid_geojson: dict[str, Any] = {"type": "FeatureCollection", "features": features}
    _write_json(out_dir / "grid.geojson", grid_geojson)
    print(f"    ✓ grid.geojson: {len(features):,} cells")

    # ------------------------------------------------------------------
    # 3. Build boundary.geojson
    # ------------------------------------------------------------------
    print("[3/7] Copying boundary.geojson …")
    boundary = json.loads(boundary_path.read_text())
    _write_json(out_dir / "boundary.geojson", boundary)
    print("    ✓ boundary.geojson written")

    # ------------------------------------------------------------------
    # 4. Build cell_months.json
    # ------------------------------------------------------------------
    print("[4/7] Building cell_months.json …")

    # Canonical month and cell lists (from product/phase7)
    months_list = list(months_df["month"])  # e.g. ["2000-11", "2000-12", ...]
    cells_list = list(cells_df["cell_id"].astype(str))  # e.g. ["-1131_393", ...]

    month_idx = {m: i for i, m in enumerate(months_list)}
    cell_idx = {c: i for i, c in enumerate(cells_list)}

    n_months = len(months_list)
    n_cells = len(cells_list)

    # --- MODIS block ---
    # Normalise datetime column
    modis_cm = modis_cm.copy()
    modis_cm["month_str"] = pd.to_datetime(modis_cm["month"]).dt.strftime("%Y-%m")
    modis_cm = modis_cm[modis_cm["month_str"].isin(month_idx)]
    modis_cm = modis_cm[modis_cm["cell_id"].astype(str).isin(cell_idx)]

    m_cell = [cell_idx[str(c)] for c in modis_cm["cell_id"]]
    m_month = [month_idx[m] for m in modis_cm["month_str"]]
    m_n = [int(v) for v in modis_cm["modis_all_n"]]
    m_terra = [int(v) for v in modis_cm["modis_terra_n"]]
    m_aqua = [int(v) for v in modis_cm["modis_aqua_n"]]

    modis_total = int(modis_cm["modis_all_n"].sum())

    # --- VIIRS block ---
    viirs_cm = viirs_cm.copy()
    viirs_cm["month_str"] = pd.to_datetime(viirs_cm["month"]).dt.strftime("%Y-%m")
    viirs_cm = viirs_cm[viirs_cm["month_str"].isin(month_idx)]
    viirs_cm = viirs_cm[viirs_cm["cell_id"].astype(str).isin(cell_idx)]

    v_cell = [cell_idx[str(c)] for c in viirs_cm["cell_id"]]
    v_month = [month_idx[m] for m in viirs_cm["month_str"]]
    v_n = [int(v) for v in viirs_cm["viirs_all_n"]]

    viirs_total = int(viirs_cm["viirs_all_n"].sum())

    # --- Harmonized block ---
    # source=0: observed VIIRS (2012-02 onwards)
    # source=1: predicted MODIS→VIIRS (2002-07 to 2012-01)
    # source=2: predicted Terra-only (2000-11 to 2002-06)
    h_records = []

    # Observed VIIRS cell-months → source=0
    for c_i, m_i, n_v in zip(v_cell, v_month, v_n):
        h_records.append((c_i, m_i, float(n_v), 0))

    # Predicted pre-2012 → source=1 or 2
    pre2012 = pre2012.copy()
    pre2012["month_str"] = pd.to_datetime(pre2012["month"]).dt.strftime("%Y-%m")
    pre2012 = pre2012[pre2012["month_str"].isin(month_idx)]
    pre2012 = pre2012[pre2012["cell_id"].astype(str).isin(cell_idx)]

    for _, row in pre2012.iterrows():
        ci = cell_idx[str(row["cell_id"])]
        mi = month_idx[row["month_str"]]
        src = 2 if row["terra_only"] else 1
        h_records.append((ci, mi, float(row["pred"]), src))

    # Sort for deterministic output
    h_records.sort(key=lambda r: (r[1], r[0]))

    h_cell = [r[0] for r in h_records]
    h_month = [r[1] for r in h_records]
    h_n = [round(r[2], 4) for r in h_records]
    h_source = [r[3] for r in h_records]

    cell_months: dict[str, Any] = {
        "months": months_list,
        "cells": cells_list,
        "modis": {
            "cell": m_cell,
            "month": m_month,
            "n": m_n,
            "terra": m_terra,
            "aqua": m_aqua,
            "frp": [],  # FRP excluded from main UI product per spec
        },
        "viirs": {
            "cell": v_cell,
            "month": v_month,
            "n": v_n,
            "frp": [],
        },
        "harmonized": {
            "cell": h_cell,
            "month": h_month,
            "n": h_n,
            "source": h_source,
        },
    }

    _write_json(out_dir / "cell_months.json", cell_months)
    print(
        f"    ✓ cell_months.json: {n_cells:,} cells × {n_months} months | "
        f"MODIS {modis_total:,} | VIIRS {viirs_total:,} | "
        f"harmonized {len(h_records):,} records"
    )

    # ------------------------------------------------------------------
    # 5. Build harmonization.json
    # ------------------------------------------------------------------
    print("[5/7] Building harmonization.json …")

    # Per-month source flags
    months_src = list(months_df["source"])
    source_code_map = {
        "observed VIIRS": 0,
        "predicted (MODIS to VIIRS)": 1,
        "predicted (Terra-only)": 2,
    }
    per_month_source = [source_code_map.get(s, 1) for s in months_src]
    per_month_status = [
        "validated" if s == "observed VIIRS" else "predicted_unvalidated" for s in months_src
    ]

    # Bootstrap CI on seasonal ratios
    seasons_order = ["DJF", "MAM", "JJA", "SON"]
    bs_ci = p5["bootstrap_ci"]
    bs_lo = []
    bs_hi = []
    for season in seasons_order:
        entry = next((x for x in bs_ci if x["parameter"] == f"ratio_{season}"), None)
        if entry:
            bs_lo.append(round(entry["p2.5"], 4))
            bs_hi.append(round(entry["p97.5"], 4))
        else:
            bs_lo.append(None)
            bs_hi.append(None)

    # Bias table from modis-bin CSV
    bias_bins = list(bias_bin["modis_bin"].astype(str))
    bias_pcts = [round(float(v), 1) for v in bias_bin["bias_pct"]]

    # Uncertainty (prediction_bands) - state level
    state_bands = pred_bands[pred_bands["level_model"] == "region_sel"]

    def _bands_for(df: pd.DataFrame) -> dict:
        seasons_b = list(df["season"])
        return {
            "seasons": seasons_b,
            "lo5": [round(float(v), 4) for v in df["q05"]],
            "hi95": [round(float(v), 4) for v in df["q95"]],
        }

    # Forward test bias for selected model
    sel_fwd = fwd_test[fwd_test["model"] == "Seasonal ratio"].iloc[0]
    fwd_bias = round(float(sel_fwd["total_bias_pct"]) / 100.0, 4)  # store as fraction

    harmonization: dict[str, Any] = {
        "status": "provisional",
        "method": "Seasonal ratio (MODIS → VIIRS-equivalent)",
        "version": VERSION,
        "blendStart": "2012-02",
        "firstAquaMonth": "2002-07",
        "seasonalRatios": {s: round(p6_meta["ratio_terra_plus_aqua"][s], 6) for s in seasons_order},
        "terraOnlyRatios": {s: round(p6_meta["ratio_terra_only"][s], 6) for s in seasons_order},
        "perMonthSources": {
            "months": months_list,
            "source": per_month_source,
            "status": per_month_status,
        },
        "bootstrapCi": {
            "seasons": seasons_order,
            "lo95": bs_lo,
            "hi95": bs_hi,
        },
        "description": (
            "VIIRS-equivalent active-fire detection counts estimated from MODIS "
            "using a leave-one-year-out cross-validated seasonal ratio model. "
            "Observed VIIRS counts (2012-02 onward) are used as-is. "
            "No validation against fire perimeters was performed."
        ),
        "validation": {
            "notes": (
                "Leave-one-year-out region-month cross-validation on the 2012-02 to "
                "2021-12 overlap window. Forward test: trained ≤2019, tested on 2020-21."
            ),
            "wape": round(p6_meta["cv_wape_selected"], 6),
            "wapeTerraOnly": round(p6_meta["cv_wape_terra_only"], 6),
            "forwardTestBias": fwd_bias,
            "biasTable": {
                "bins": bias_bins,
                "biasPercent": bias_pcts,
            },
            "uncertainty": {
                "label": "Typical prediction error (5th–95th percentile ratio of predicted/actual)",
                "note": (
                    "Applies only to estimated months before 2012-02. "
                    "Observed months have no error band."
                ),
                "state": _bands_for(state_bands),
                "regions": [],
            },
        },
    }

    _write_json(out_dir / "harmonization.json", harmonization)
    print("    ✓ harmonization.json written")

    # ------------------------------------------------------------------
    # 6. Build validation.json
    # ------------------------------------------------------------------
    print("[6/7] Building validation.json …")

    # CV results table
    cv_rows = [
        [row["model"], round(row["rm_WAPE"], 4), round(row["total_bias_pct"], 2)]
        for _, row in cv_results.iterrows()
    ]

    # CV WAPE by year
    cv_yr_rows = [
        [str(row[cv_wape_yr.columns[0]]), round(row[cv_wape_yr.columns[1]], 4)]
        for _, row in cv_wape_yr.iterrows()
    ]

    # AOI error table
    aoi_rows = [
        [
            int(row["block_km"]),
            int(row["block_cells"]),
            round(row["WAPE_month"], 4),
            round(row["WAPE_year"], 4),
        ]
        for _, row in aoi_err.iterrows()
    ]

    # Forward test
    fwd_rows = [
        [row["model"], round(row["rm_WAPE"], 4), round(row["total_bias_pct"], 2)]
        for _, row in fwd_test.iterrows()
    ]

    validation: dict[str, Any] = {
        "tables": [
            {
                "id": "cv_model_comparison",
                "title": "Cross-validation model comparison",
                "note": (
                    "Leave-one-year-out region-month WAPE on 2012-02 to 2021-12. "
                    "Selected model: Seasonal ratio."
                ),
                "columns": ["Model", "WAPE", "Total bias %"],
                "rows": cv_rows,
            },
            {
                "id": "cv_wape_by_year",
                "title": "Cross-validation WAPE by held-out year",
                "note": "Each year removed in turn; region-month WAPE computed on that year.",
                "columns": list(cv_wape_yr.columns),
                "rows": cv_yr_rows,
            },
            {
                "id": "forward_test",
                "title": "Forward test (trained ≤2019, tested 2020-2021)",
                "note": "Assesses temporal generalization. Negative bias = under-prediction.",
                "columns": ["Model", "WAPE", "Total bias %"],
                "rows": fwd_rows,
            },
            {
                "id": "aoi_error_by_size",
                "title": "Typical prediction error by area size",
                "note": (
                    "WAPE falls as larger areas are summed. "
                    "Values apply only to estimated months (before 2012-02)."
                ),
                "columns": ["Block size (km)", "Cells", "Monthly WAPE", "Annual WAPE"],
                "rows": aoi_rows,
            },
        ],
        "figures": [],
    }

    _write_json(out_dir / "validation.json", validation)
    print("    ✓ validation.json written")

    # ------------------------------------------------------------------
    # 7. Build manifest.json
    # ------------------------------------------------------------------
    print("[7/7] Building manifest.json …")

    bounds = _grid_bounds(gdf_wgs)  # [minLon, minLat, maxLon, maxLat]

    manifest: dict[str, Any] = {
        "version": VERSION,
        "generatedAtUtc": datetime.now(UTC).isoformat(),
        "synthetic": False,
        "studyArea": {
            "name": "California",
            "bbox": bounds,
            "areaKm2": 423_970,
            "presets": [
                {"id": "north", "name": "North", "bbox": [-124.5, 38.8, -119.5, 42.0]},
                {"id": "central", "name": "Central", "bbox": [-123.0, 35.5, -118.0, 38.8]},
                {"id": "south", "name": "South", "bbox": [-121.0, 32.5, -114.1, 35.5]},
            ],
        },
        "coverage": {
            "start": app_cfg["data_start"],
            "end": app_cfg["data_end"],
        },
        "modisStart": app_cfg["data_start"],
        "viirsStart": "2012-01",
        "viirsFirstCompleteMonth": app_cfg["first_observed_month"],
        "viirsPartialMonths": ["2012-01"],
        "firstAquaMonth": "2002-07",
        "grid": {
            "cellKm": 10,
            "crs": "EPSG:6933",
            "cells": n_cells,
        },
        "totals": {
            "modisDetections": modis_total,
            "viirsDetections": viirs_total,
        },
        "sources": [
            "MODIS Collection 6.1 (Terra and Aqua)",
            "VIIRS VNP14IMGTDL (Suomi-NPP 375m)",
        ],
        "filters": "Presumed vegetation fires (type == 0).",
    }

    _write_json(out_dir / "manifest.json", manifest)
    print("    ✓ manifest.json written")

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    print("\n[export] ✅ Done!")
    print(f"  Cells:            {n_cells:,}")
    print(f"  Months:           {n_months}")
    print(f"  MODIS detections: {modis_total:,}")
    print(f"  VIIRS detections: {viirs_total:,}")
    print(f"  Harmonized rows:  {len(h_records):,}")
    _print_sizes(out_dir)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _round_geom(geom: dict, dp: int) -> dict:
    """Recursively round all coordinate values in a GeoJSON geometry dict."""

    def _round_coords(coords: Any) -> Any:
        if isinstance(coords[0], (int, float)):
            return [round(v, dp) for v in coords]
        return [_round_coords(c) for c in coords]

    return {**geom, "coordinates": _round_coords(geom["coordinates"])}


def _grid_bounds(gdf_wgs: gpd.GeoDataFrame) -> list[float]:
    """Return [minLon, minLat, maxLon, maxLat] rounded to 4 dp."""
    b = gdf_wgs.total_bounds  # [minx, miny, maxx, maxy]
    return [
        round(float(b[0]), 4),
        round(float(b[1]), 4),
        round(float(b[2]), 4),
        round(float(b[3]), 4),
    ]


def _write_json(path: Path, data: Any) -> None:
    """Write JSON (no indent for large files, indent for small ones)."""
    text = json.dumps(data, ensure_ascii=False, allow_nan=False)
    path.write_text(text, encoding="utf-8")


def _print_sizes(out_dir: Path) -> None:
    print("\n  Output file sizes:")
    for f in sorted(out_dir.iterdir()):
        if f.is_file():
            raw = f.stat().st_size
            gz = len(gzip.compress(f.read_bytes()))
            print(f"    {f.name:35s}  {raw / 1024:8.1f} kB  ({gz / 1024:.1f} kB gzip)")
