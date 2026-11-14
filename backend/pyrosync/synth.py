"""Deterministic synthetic dataset generator for PyroSync test suites."""

import json
import random
import shutil
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

from pyrosync.assertions import (
    assert_cell_ids_valid,
    assert_harmonized_values,
    assert_month_indexes,
    assert_reconciliation,
    assert_terra_aqua_sum,
    assert_totals,
)


def generate_months(start: str = "2000-11", end: str = "2021-12") -> list[str]:
    """Generate list of YYYY-MM strings between start and end inclusive."""
    sy, sm = map(int, start.split("-"))
    ey, em = map(int, end.split("-"))
    months = []
    y, m = sy, sm
    while (y < ey) or (y == ey and m <= em):
        months.append(f"{y:04d}-{m:02d}")
        m += 1
        if m > 12:
            m = 1
            y += 1
    return months


def generate_synthetic_dataset(
    out_dir: Path,
    seed: int = 42,
    num_cells: int = 30,  # Compact grid for fast synthetic test suite
) -> dict[str, Any]:
    """
    Generate a deterministic synthetic dataset with known edge cases.
    """
    random.seed(seed)
    out_dir.mkdir(parents=True, exist_ok=True)
    hotspots_dir = out_dir / "hotspots"
    hotspots_dir.mkdir(parents=True, exist_ok=True)

    months = generate_months("2000-11", "2021-12")
    num_months = len(months)

    # 1. Generate Synthetic 10km Grid around California coordinates
    # Bounding box roughly [-124.0, 32.5, -114.5, 42.0]
    cells = []
    grid_features = []
    base_lon = -120.0
    base_lat = 37.0
    # 5 rows x 6 cols = 30 cells
    for iy in range(5):
        for ix in range(6):
            cell_id = f"{ix}_{iy}"
            cells.append(cell_id)
            c_lon = round(base_lon + ix * 0.1, 4)
            c_lat = round(base_lat + iy * 0.1, 4)
            # Create a simple square polygon
            poly = [
                [
                    [round(c_lon - 0.05, 4), round(c_lat - 0.05, 4)],
                    [round(c_lon + 0.05, 4), round(c_lat - 0.05, 4)],
                    [round(c_lon + 0.05, 4), round(c_lat + 0.05, 4)],
                    [round(c_lon - 0.05, 4), round(c_lat + 0.05, 4)],
                    [round(c_lon - 0.05, 4), round(c_lat - 0.05, 4)],
                ]
            ]
            grid_features.append(
                {
                    "type": "Feature",
                    "geometry": {"type": "Polygon", "coordinates": poly},
                    "properties": {
                        "id": cell_id,
                        "lat": c_lat,
                        "lon": c_lon,
                        "overlapPct": 100.0,
                    },
                }
            )

    grid_geojson = {
        "type": "FeatureCollection",
        "features": grid_features,
    }

    # 2. California Boundary GeoJSON
    boundary_geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [-124.48, 32.53],
                            [-114.13, 32.53],
                            [-114.13, 42.01],
                            [-124.48, 42.01],
                            [-124.48, 32.53],
                        ]
                    ],
                },
                "properties": {"name": "California"},
            }
        ],
    }

    # 3. Generate Cell-Months and Hotspots simultaneously for 100% reconciliation
    # Index lookups
    viirs_start_idx = months.index("2012-01")
    viirs_complete_idx = months.index("2012-02")
    aqua_start_idx = months.index("2002-07")  # First Aqua month

    modis_cm = {"cell": [], "month": [], "n": [], "terra": [], "aqua": [], "frp": []}
    viirs_cm = {"cell": [], "month": [], "n": [], "frp": []}
    harmonized_cm = {"cell": [], "month": [], "n": [], "source": []}

    # Hotspot shards partitioned by year: {"<year>_<sensor>": {cell, day, lat, lon, frp, sat, satCodes, dn}}
    epoch = date(2000, 1, 1)
    hotspot_shards = {}

    def get_shard(year: int, sensor: str) -> dict[str, Any]:
        key = f"{year}_{sensor}"
        if key not in hotspot_shards:
            hotspot_shards[key] = {
                "cell": [],
                "day": [],
                "lat": [],
                "lon": [],
                "frp": [],
                "sat": [],
                "satCodes": ["Terra", "Aqua"] if sensor == "modis" else ["Suomi-NPP"],
                "dn": [],
            }
        return hotspot_shards[key]

    modis_total_detections = 0
    viirs_total_detections = 0

    # Edge cases design:
    # Cell 0: Empty cell (0 detections for all time to test empty queries)
    # Cell 1: Quiet cell with median 0 in winter months (Dec/Jan)
    # Cell 2..29: Active fire cells with seasonal pattern (peaks in July-Oct)

    for m_idx, m_str in enumerate(months):
        year, month_num = map(int, m_str.split("-"))
        # Seasonal multiplier (peak in summer/fall: months 7-10)
        is_peak_season = 7 <= month_num <= 10
        base_rate = 3 if is_peak_season else 0.4

        for c_idx in range(1, len(cells)):
            feat = grid_features[c_idx]
            c_lat = feat["properties"]["lat"]
            c_lon = feat["properties"]["lon"]

            # Edge case: Month with median 0 for cell 1
            if c_idx == 1 and month_num in [1, 2, 12]:
                m_count = (
                    1 if (year == 2017 and month_num == 1) else 0
                )  # 1 non-zero year out of 22 -> median = 0
            else:
                # Random count based on season
                if random.random() < (0.8 if is_peak_season else 0.25):
                    m_count = random.randint(1, 8 if is_peak_season else 2)
                else:
                    m_count = 0

            # --- MODIS generation ---
            if m_count > 0:
                # Terra vs Aqua split
                if m_idx < aqua_start_idx:
                    # Terra only era: Aqua = 0, Terra = n
                    terra_n = m_count
                    aqua_n = 0
                else:
                    terra_n = random.randint(0, m_count)
                    aqua_n = m_count - terra_n

                frp_total = round(sum(random.uniform(10.0, 60.0) for _ in range(m_count)), 1)
                modis_cm["cell"].append(c_idx)
                modis_cm["month"].append(m_idx)
                modis_cm["n"].append(m_count)
                modis_cm["terra"].append(terra_n)
                modis_cm["aqua"].append(aqua_n)
                modis_cm["frp"].append(frp_total)
                modis_total_detections += m_count

                # Add individual hotspot records to shard
                shard = get_shard(year, "modis")
                # Distribute days across month
                for i in range(m_count):
                    day_of_month = random.randint(1, 28)
                    hotspot_date = date(year, month_num, day_of_month)
                    day_offset = (hotspot_date - epoch).days
                    sat_code = 0 if i < terra_n else 1  # 0: Terra, 1: Aqua
                    shard["cell"].append(c_idx)
                    shard["day"].append(day_offset)
                    shard["lat"].append(round((c_lat + random.uniform(-0.03, 0.03)) * 10000))
                    shard["lon"].append(round((c_lon + random.uniform(-0.03, 0.03)) * 10000))
                    shard["frp"].append(round(random.uniform(10.0, 60.0) * 10))
                    shard["sat"].append(sat_code)
                    shard["dn"].append(random.choice([0, 1]))

            # --- VIIRS generation (operating period >= 2012-01) ---
            if m_idx >= viirs_start_idx:
                # 2012-01 is partial month (low count)
                if m_idx == viirs_start_idx:
                    v_count = random.randint(0, 2)
                else:
                    # VIIRS typically detects ~3-4x more hotspots due to 375m resolution
                    v_count = (
                        round(m_count * random.uniform(2.5, 4.5))
                        if m_count > 0
                        else (1 if random.random() < 0.1 else 0)
                    )

                if v_count > 0:
                    v_frp_total = round(sum(random.uniform(5.0, 40.0) for _ in range(v_count)), 1)
                    viirs_cm["cell"].append(c_idx)
                    viirs_cm["month"].append(m_idx)
                    viirs_cm["n"].append(v_count)
                    viirs_cm["frp"].append(v_frp_total)
                    viirs_total_detections += v_count

                    shard = get_shard(year, "viirs")
                    for _ in range(v_count):
                        day_of_month = (
                            random.randint(20, 31)
                            if m_idx == viirs_start_idx
                            else random.randint(1, 28)
                        )
                        hotspot_date = date(year, month_num, day_of_month)
                        day_offset = (hotspot_date - epoch).days
                        shard["cell"].append(c_idx)
                        shard["day"].append(day_offset)
                        shard["lat"].append(round((c_lat + random.uniform(-0.03, 0.03)) * 10000))
                        shard["lon"].append(round((c_lon + random.uniform(-0.03, 0.03)) * 10000))
                        shard["frp"].append(round(random.uniform(5.0, 40.0) * 10))
                        shard["sat"].append(0)
                        shard["dn"].append(random.choice([0, 1]))

            # --- Harmonized series generation ---
            # Source codes: 0 = observed VIIRS (>=2012-02),
            #               1 = predicted MODIS->VIIRS (2002-07 to 2012-01),
            #               2 = predicted Terra-only (2000-11 to 2002-06)
            if m_idx >= viirs_complete_idx:
                # Observed VIIRS
                harm_n = (
                    float(v_count) if m_idx >= viirs_start_idx and "v_count" in locals() else 0.0
                )
                harm_src = 0
            elif m_idx >= aqua_start_idx:
                # Predicted MODIS->VIIRS (combined MODIS era, 2002-07 to 2012-01)
                harm_n = round(m_count * 4.2, 1)
                harm_src = 1
            else:
                # Predicted Terra-only era (2000-11 to 2002-06)
                harm_n = round(m_count * 6.9, 1)  # Terra-only seasonal avg
                harm_src = 2

            if harm_n > 0:
                harmonized_cm["cell"].append(c_idx)
                harmonized_cm["month"].append(m_idx)
                harmonized_cm["n"].append(harm_n)
                harmonized_cm["source"].append(harm_src)

    # Build per-month source arrays for harmonization metadata
    # Source codes: 0=observed_viirs, 1=predicted_modis_viirs, 2=predicted_terra_only
    per_month_sources_list = []
    per_month_status_list = []
    per_month_src_int = []
    for m_idx, m_str in enumerate(months):
        if m_idx >= viirs_complete_idx:
            per_month_src_int.append(0)
            per_month_sources_list.append(m_str)
            per_month_status_list.append("validated")
        elif m_idx >= aqua_start_idx:
            per_month_src_int.append(1)
            per_month_sources_list.append(m_str)
            per_month_status_list.append("predicted_unvalidated")
        else:
            per_month_src_int.append(2)
            per_month_sources_list.append(m_str)
            per_month_status_list.append("predicted_unvalidated")

    # Write hotspots index and shards
    shards_meta = {}
    for shard_key, shard_data in hotspot_shards.items():
        year_str, sensor = shard_key.split("_")
        shard_filename = f"{year_str}_{sensor}.json"
        shard_path = hotspots_dir / shard_filename
        with open(shard_path, "w") as f:
            json.dump(shard_data, f)

        # Calculate gzip size
        import gzip
        import io

        buf = io.BytesIO()
        with gzip.GzipFile(fileobj=buf, mode="wb", compresslevel=9) as gz:
            gz.write(shard_path.read_bytes())
        gz_bytes = len(buf.getvalue())

        if year_str not in shards_meta:
            shards_meta[year_str] = {}
        shards_meta[year_str][sensor] = {
            "path": f"hotspots/{shard_filename}",
            "rows": len(shard_data["cell"]),
            "bytesGzip": gz_bytes,
        }

    hotspots_index = {
        "version": "1.0.0",
        "quantization": {
            "latScale": 10000,
            "lonScale": 10000,
            "frpScale": 10,
            "dayEpoch": "2000-01-01",
        },
        "columns": ["cell", "day", "lat", "lon", "frp", "sat", "dn"],
        "files": shards_meta,
    }
    with open(hotspots_dir / "index.json", "w") as f:
        json.dump(hotspots_index, f, indent=2)

    # 4. Manifest
    manifest = {
        "version": "1.0.0-synthetic",
        "generatedAtUtc": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "synthetic": True,
        "studyArea": {
            "name": "California (Synthetic Test Fixture)",
            "bbox": [-124.48, 32.53, -114.13, 42.01],
        },
        "coverage": {
            "start": "2000-11",
            "end": "2021-12",
        },
        "modisStart": "2000-11",
        "viirsStart": "2012-01",
        "viirsFirstCompleteMonth": "2012-02",
        "viirsPartialMonths": ["2012-01"],
        "firstAquaMonth": "2002-07",
        "grid": {
            "cellKm": 10,
            "crs": "EPSG:6933",
            "cells": len(cells),
        },
        "totals": {
            "modisDetections": modis_total_detections,
            "viirsDetections": viirs_total_detections,
        },
        "sources": [
            "MODIS Collection 6.1 (Terra and Aqua)",
            "VIIRS VNP14IMGTDL (Suomi-NPP 375m)",
        ],
        "filters": "Presumed vegetation fires (type == 0).",
    }

    # 5. Harmonization metadata
    harmonization = {
        "status": "provisional",
        "method": "Seasonal ratio model (VIIRS-equivalent counts). Observed VIIRS from 2012-02; predicted from MODIS with seasonal ratios before that.",
        "version": "0.1.0-synth",
        "blendStart": "2012-02",
        "firstAquaMonth": "2002-07",
        "seasonalRatios": {
            "DJF": 3.315,
            "MAM": 3.175,
            "JJA": 4.275,
            "SON": 4.476,
        },
        "terraOnlyRatios": {
            "DJF": 7.714,
            "MAM": 5.906,
            "JJA": 8.145,
            "SON": 8.977,
        },
        "perMonthSources": {
            "months": per_month_sources_list,
            "source": per_month_src_int,
            "status": per_month_status_list,
        },
        "bootstrapCi": {
            "seasons": ["DJF", "MAM", "JJA", "SON"],
            "lo95": [2.9, 2.7, 3.8, 3.9],
            "hi95": [3.8, 3.7, 4.8, 5.1],
        },
        "description": (
            "Synthetic demonstration dataset. Harmonized value = VIIRS-equivalent active-fire "
            "detection count. Observed VIIRS from 2012-02; predicted from MODIS with seasonal "
            "ratios (MODIS+Aqua era) or Terra-only ratios (2000-11 to 2002-06)."
        ),
        "validation": {
            "notes": (
                "Synthetic benchmark fixtures. Real validation: LOYO-CV region-month WAPE=0.129 "
                "(combined), 0.130 (Terra-only). Forward test (train <=2019, test 2020-21): "
                "-9.6% (under-predict). Cell-level predictions biased at low counts; only valid "
                "when summed over an area."
            ),
            "wape": 0.129,
            "wapeTerraOnly": 0.130,
            "forwardTestBias": -0.096,
            "biasTable": {
                "bins": ["MODIS=0", "MODIS=1-2", "MODIS=3-10", "MODIS>10"],
                "biasPercent": [-100.0, 78.0, 75.0, 12.0],
            },
            "uncertainty": {
                "label": "Typical error (5th–95th percentile)",
                "note": (
                    "Empirical prediction bands from leave-one-year-out cross-validation. "
                    "NOT confidence intervals. Do not center on point estimate."
                ),
                "state": {
                    "seasons": ["DJF", "MAM", "JJA", "SON"],
                    "lo5": [0.72, 0.69, 0.78, 0.74],
                    "hi95": [1.38, 1.41, 1.32, 1.36],
                },
                "regions": [
                    {
                        "region": "NorCal",
                        "seasons": ["DJF", "MAM", "JJA", "SON"],
                        "lo5": [0.65, 0.61, 0.70, 0.68],
                        "hi95": [1.52, 1.58, 1.42, 1.48],
                    },
                    {
                        "region": "SoCal",
                        "seasons": ["DJF", "MAM", "JJA", "SON"],
                        "lo5": [0.70, 0.68, 0.75, 0.71],
                        "hi95": [1.42, 1.44, 1.35, 1.40],
                    },
                ],
            },
        },
    }

    # 6. Validation tables & figures
    validation = {
        "tables": [
            {
                "id": "synthetic_summary",
                "title": "Synthetic Sensor Summary",
                "note": "Reconciliation check between sensors across 2000-2021",
                "columns": ["Sensor", "Total Detections", "Active Years", "Operating Status"],
                "rows": [
                    ["MODIS (Terra+Aqua)", modis_total_detections, "2000-2021", "Operational"],
                    ["VIIRS (Suomi-NPP)", viirs_total_detections, "2012-2021", "Operational"],
                ],
            }
        ],
        "figures": [],
    }

    # Cell-Months final dictionary
    cell_months = {
        "months": months,
        "cells": cells,
        "modis": modis_cm,
        "viirs": viirs_cm,
        "harmonized": harmonized_cm,
    }

    # Run all invariant assertions
    grid_ids = {f["properties"]["id"] for f in grid_features}
    assert_totals(manifest["totals"], modis_total_detections, viirs_total_detections)
    assert_terra_aqua_sum(modis_cm)
    assert_cell_ids_valid(cells, grid_ids)
    assert_month_indexes(cell_months)
    assert_harmonized_values(harmonized_cm)
    assert_reconciliation(cell_months, hotspot_shards)

    # Save files to disk
    with open(out_dir / "manifest.json", "w") as f:
        json.dump(manifest, f, indent=2)
    with open(out_dir / "grid.geojson", "w") as f:
        json.dump(grid_geojson, f)
    with open(out_dir / "boundary.geojson", "w") as f:
        json.dump(boundary_geojson, f)
    with open(out_dir / "cell_months.json", "w") as f:
        json.dump(cell_months, f)
    with open(out_dir / "harmonization.json", "w") as f:
        json.dump(harmonization, f, indent=2)
    with open(out_dir / "validation.json", "w") as f:
        json.dump(validation, f, indent=2)

    # Create deliberately malformed copy in malformed/
    malformed_dir = out_dir / "malformed"
    malformed_dir.mkdir(parents=True, exist_ok=True)
    # Copy valid files then corrupt manifest.json
    for fname in ["grid.geojson", "boundary.geojson", "cell_months.json", "harmonization.json"]:
        shutil.copy2(out_dir / fname, malformed_dir / fname)
    corrupted_manifest = dict(manifest)
    del corrupted_manifest["studyArea"]  # Missing required field
    with open(malformed_dir / "manifest.json", "w") as f:
        json.dump(corrupted_manifest, f, indent=2)

    return {
        "manifest": manifest,
        "cells": cells,
        "months": months,
        "modis_total": modis_total_detections,
        "viirs_total": viirs_total_detections,
    }
