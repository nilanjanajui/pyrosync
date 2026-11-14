"""PyroSync Command Line Interface."""

import argparse
import json
import sys
from pathlib import Path

import jsonschema

from pyrosync.budget import check_dataset_budgets
from pyrosync.synth import generate_synthetic_dataset

SCHEMA_DIR = Path(__file__).parent / "schemas"


def load_schema(schema_name: str) -> dict:
    """Load JSON schema from schemas directory."""
    schema_path = SCHEMA_DIR / schema_name
    if not schema_path.exists():
        raise FileNotFoundError(f"Schema not found: {schema_path}")
    with open(schema_path, "r") as f:
        return json.load(f)


def cmd_synth(args: argparse.Namespace) -> int:
    """Run synthetic dataset generation."""
    out_dir = Path(args.out).resolve()
    print(f"Generating synthetic PyroSync dataset in: {out_dir}")
    res = generate_synthetic_dataset(out_dir, seed=args.seed)
    print(f"Success! Generated {len(res['cells'])} cells, {len(res['months'])} months.")
    print(f"MODIS detections: {res['modis_total']:,} | VIIRS detections: {res['viirs_total']:,}")
    return 0


def cmd_check(args: argparse.Namespace) -> int:
    """Validate dataset files against JSON schemas and size budgets."""
    data_dir = Path(args.data).resolve()
    print(f"Validating dataset files in: {data_dir}")

    schema_map = {
        "manifest.json": "manifest.json",
        "grid.geojson": "grid_geojson.json",
        "boundary.geojson": "boundary_geojson.json",
        "cell_months.json": "cell_months.json",
        "harmonization.json": "harmonization.json",
        "validation.json": "validation.json",
        "hotspots/index.json": "hotspots_index.json",
    }

    errors = []
    for filename, sname in schema_map.items():
        file_path = data_dir / filename
        if not file_path.exists():
            if filename in ["validation.json"]:
                print(f"  Optional file {filename} absent (OK)")
                continue
            errors.append(f"Missing required file: {filename}")
            continue

        try:
            with open(file_path, "r") as f:
                content = json.load(f)
            schema = load_schema(sname)
            jsonschema.validate(instance=content, schema=schema)
            print(f"  [PASS] {filename} conforms to schema")
        except (
            jsonschema.ValidationError,
            jsonschema.SchemaError,
            json.JSONDecodeError,
            OSError,
        ) as e:
            errors.append(f"Schema validation error in {filename}: {e}")

    # Check hotspot shards if present
    hotspots_dir = data_dir / "hotspots"
    if hotspots_dir.exists():
        shard_schema = load_schema("hotspot_shard.json")
        for shard_file in hotspots_dir.glob("*.json"):
            if shard_file.name == "index.json":
                continue
            try:
                with open(shard_file, "r") as f:
                    content = json.load(f)
                jsonschema.validate(instance=content, schema=shard_schema)
                print(f"  [PASS] Shard {shard_file.name} conforms to schema")
            except (
                jsonschema.ValidationError,
                jsonschema.SchemaError,
                json.JSONDecodeError,
                OSError,
            ) as e:
                errors.append(f"Schema validation error in shard {shard_file.name}: {e}")

    # Check budgets
    print("\nAnalyzing gzip payload budgets:")
    budget_passed, budget_msgs = check_dataset_budgets(data_dir)
    for msg in budget_msgs:
        print(msg)

    # Check harmonized density
    cm_path = data_dir / "cell_months.json"
    if cm_path.exists():
        with open(cm_path, "r") as f:
            cm = json.load(f)
        if "harmonized" in cm and "n" in cm["harmonized"]:
            total_possible = len(cm["months"]) * len(cm["cells"])
            dense_count = len(cm["harmonized"]["n"])
            density_pct = (dense_count / total_possible * 100) if total_possible else 0
            print(
                f"\nHarmonization density: {dense_count:,} non-zero records ({density_pct:.1f}% of {total_possible:,} cell-months)"
            )

    if errors or not budget_passed:
        print("\nCHECK FAILED:")
        for err in errors:
            print(f"  - {err}")
        return 1

    print("\nALL CHECKS PASSED.")
    return 0


def cmd_export(args: argparse.Namespace) -> int:
    """ETL export command (Milestone 1)."""
    print("Export command will be executed in Milestone 1.")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(prog="pyrosync", description="PyroSync Data Pipeline CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # synth
    p_synth = subparsers.add_parser("synth", help="Generate synthetic test dataset")
    p_synth.add_argument("--out", default="../frontend/public/datasets", help="Output directory")
    p_synth.add_argument("--seed", type=int, default=42, help="Random seed")
    p_synth.set_defaults(func=cmd_synth)

    # check
    p_check = subparsers.add_parser("check", help="Validate dataset schemas and budgets")
    p_check.add_argument(
        "--data", default="../frontend/public/datasets", help="Dataset directory to check"
    )
    p_check.set_defaults(func=cmd_check)

    # export
    p_export = subparsers.add_parser("export", help="Export Parquet data to JSON datasets")
    p_export.add_argument("--grid", required=True)
    p_export.add_argument("--modis-cm", required=True)
    p_export.add_argument("--viirs-cm", required=True)
    p_export.add_argument("--modis-det", required=True)
    p_export.add_argument("--viirs-det", required=True)
    p_export.add_argument("--boundary", required=True)
    p_export.add_argument("--out", default="../frontend/public/datasets")
    p_export.set_defaults(func=cmd_export)

    args = parser.parse_args()
    sys.exit(args.func(args))


if __name__ == "__main__":
    main()
