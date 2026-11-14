"""Data integrity assertions for PyroSync outputs."""

import math
from typing import Any


def assert_totals(manifest_totals: dict[str, int], modis_sum: int, viirs_sum: int) -> None:
    """Assert output totals match manifest totals."""
    assert manifest_totals["modisDetections"] == modis_sum, (
        f"MODIS total mismatch: manifest={manifest_totals['modisDetections']} vs data={modis_sum}"
    )
    assert manifest_totals["viirsDetections"] == viirs_sum, (
        f"VIIRS total mismatch: manifest={manifest_totals['viirsDetections']} vs data={viirs_sum}"
    )


def assert_terra_aqua_sum(modis_block: dict[str, list]) -> None:
    """Assert terra + aqua == n for every MODIS record."""
    n_records = len(modis_block["n"])
    for i in range(n_records):
        n = modis_block["n"][i]
        terra = modis_block["terra"][i]
        aqua = modis_block["aqua"][i]
        assert terra + aqua == n, (
            f"MODIS row {i} violation: terra ({terra}) + aqua ({aqua}) != n ({n})"
        )


def assert_cell_ids_valid(cells_in_data: list[str], grid_cell_ids: set) -> None:
    """Assert every cell id in cell_months exists in grid GeoJSON."""
    for cid in cells_in_data:
        assert cid in grid_cell_ids, f"Cell ID {cid} not found in grid.geojson"


def assert_month_indexes(cell_months: dict[str, Any]) -> None:
    """Assert month indexes are in [0, num_months - 1]."""
    num_months = len(cell_months["months"])
    for sensor in ["modis", "viirs"]:
        if sensor in cell_months:
            for idx in cell_months[sensor]["month"]:
                assert 0 <= idx < num_months, (
                    f"{sensor} month index {idx} out of range [0, {num_months - 1}]"
                )
    if cell_months.get("harmonized"):
        for idx in cell_months["harmonized"]["month"]:
            assert 0 <= idx < num_months, (
                f"harmonized month index {idx} out of range [0, {num_months - 1}]"
            )


def assert_harmonized_values(harmonized_block: dict[str, Any]) -> None:
    """Assert harmonized n values are finite and >= 0, and source codes are valid (0, 1, 2)."""
    if not harmonized_block or "n" not in harmonized_block:
        return
    for i, val in enumerate(harmonized_block["n"]):
        assert not math.isnan(val) and not math.isinf(val), f"Harmonized row {i} non-finite: {val}"
        assert val >= 0.0, f"Harmonized row {i} negative value: {val}"
    # Validate source codes if present
    if "source" in harmonized_block:
        valid_src = {0, 1, 2}
        for i, src in enumerate(harmonized_block["source"]):
            assert src in valid_src, (
                f"Harmonized row {i} invalid source code: {src} (must be 0, 1, or 2)"
            )
        assert len(harmonized_block["source"]) == len(harmonized_block["n"]), (
            "Harmonized 'source' array length must match 'n' array length"
        )


def assert_reconciliation(
    cell_months: dict[str, Any], hotspots_shards: dict[str, dict[str, Any]]
) -> None:
    """
    Assert hotspot shard rows per (sensor, month, cell) equal the cell-month counts exactly.
    hotspots_shards: {"<year>_<sensor>": shard_dict}
    """
    months = cell_months["months"]
    cells = cell_months["cells"]

    # Build lookup of expected cell-month counts: (sensor, month_idx, cell_idx) -> count
    expected = {}
    for sensor in ["modis", "viirs"]:
        block = cell_months[sensor]
        for c_idx, m_idx, n in zip(block["cell"], block["month"], block["n"]):
            expected[(sensor, m_idx, c_idx)] = n

    # Aggregate actual counts from shards
    # shard dict contains: {cell: [], day: [], ...}
    # day -> month index: dayEpoch is 2000-01-01
    from datetime import date

    epoch = date(2000, 1, 1)

    actual = {}
    for shard_key, shard in hotspots_shards.items():
        # shard_key: "<year>_<sensor>"
        _year_str, sensor = shard_key.split("_")
        for c_idx, day_offset in zip(shard["cell"], shard["day"]):
            d = date.fromordinal(epoch.toordinal() + day_offset)
            m_str = d.strftime("%Y-%m")
            if m_str in months:
                m_idx = months.index(m_str)
                key = (sensor, m_idx, c_idx)
                actual[key] = actual.get(key, 0) + 1

    # Compare expected vs actual
    all_keys = set(expected.keys()) | set(actual.keys())
    for key in all_keys:
        exp = expected.get(key, 0)
        act = actual.get(key, 0)
        assert exp == act, (
            f"Reconciliation failure for {key[0]} month {months[key[1]]} cell {cells[key[2]]}: "
            f"cell-months count = {exp} vs hotspot rows = {act}"
        )
