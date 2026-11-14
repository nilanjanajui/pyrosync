"""Tests for synthetic dataset generator and schema conformity."""

import json
from pathlib import Path

import jsonschema
import pytest

from pyrosync.cli import load_schema
from pyrosync.synth import generate_synthetic_dataset


def test_synthetic_generation_and_schemas(tmp_path: Path):
    out_dir = tmp_path / "datasets"
    res = generate_synthetic_dataset(out_dir, seed=123, num_cells=15)

    assert res["modis_total"] > 0
    assert res["viirs_total"] > 0
    assert (out_dir / "manifest.json").exists()
    assert (out_dir / "cell_months.json").exists()
    assert (out_dir / "grid.geojson").exists()
    assert (out_dir / "boundary.geojson").exists()
    assert (out_dir / "harmonization.json").exists()
    assert (out_dir / "hotspots" / "index.json").exists()

    # Verify manifest against JSON Schema
    with open(out_dir / "manifest.json") as f:
        manifest = json.load(f)
    manifest_schema = load_schema("manifest.json")
    jsonschema.validate(instance=manifest, schema=manifest_schema)
    assert manifest["synthetic"] is True

    # Verify cell_months against JSON Schema
    with open(out_dir / "cell_months.json") as f:
        cell_months = json.load(f)
    cm_schema = load_schema("cell_months.json")
    jsonschema.validate(instance=cell_months, schema=cm_schema)

    # Verify harmonization against JSON Schema
    with open(out_dir / "harmonization.json") as f:
        harmonization = json.load(f)
    harm_schema = load_schema("harmonization.json")
    jsonschema.validate(instance=harmonization, schema=harm_schema)


def test_malformed_synthetic_copy(tmp_path: Path):
    out_dir = tmp_path / "datasets"
    generate_synthetic_dataset(out_dir, seed=42)

    malformed_manifest = out_dir / "malformed" / "manifest.json"
    assert malformed_manifest.exists()
    with open(malformed_manifest) as f:
        corrupted = json.load(f)
    manifest_schema = load_schema("manifest.json")

    # Corrupted manifest should fail schema validation because studyArea is missing
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(instance=corrupted, schema=manifest_schema)
