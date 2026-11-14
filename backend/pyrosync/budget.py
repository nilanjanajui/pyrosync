"""Gzip budget analyzer for PyroSync output datasets."""

import gzip
import io
from pathlib import Path

CORE_BUDGET_BYTES = 3 * 1024 * 1024  # 3 MB
SHARD_BUDGET_BYTES = 3 * 1024 * 1024  # 3 MB


def get_gzip_size(file_path: Path) -> int:
    """Read a file and compute its gzipped byte size."""
    with open(file_path, "rb") as f:
        data = f.read()
    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode="wb", compresslevel=9) as gz:
        gz.write(data)
    return len(buf.getvalue())


def check_dataset_budgets(dataset_dir: Path) -> tuple[bool, list[str]]:
    """
    Check core bundle size <= 3 MB gzipped and each hotspot shard <= 3 MB gzipped.
    Returns (passed, list_of_messages).
    """
    core_files = [
        "manifest.json",
        "grid.geojson",
        "boundary.geojson",
        "cell_months.json",
        "harmonization.json",
        "validation.json",
    ]
    messages = []
    total_core_gzip = 0

    for name in core_files:
        p = dataset_dir / name
        if p.exists():
            gz_sz = get_gzip_size(p)
            total_core_gzip += gz_sz
            messages.append(
                f"  {name:22} {p.stat().st_size:>9,} raw bytes | {gz_sz:>8,} bytes gzipped"
            )

    passed = True
    messages.append(
        f"Core bundle total gzipped: {total_core_gzip:,} bytes ({total_core_gzip / (1024 * 1024):.2f} MB)"
    )
    if total_core_gzip > CORE_BUDGET_BYTES:
        passed = False
        messages.append(
            f"WARNING: Core bundle exceeds 3 MB limit by {total_core_gzip - CORE_BUDGET_BYTES:,} bytes!"
        )

    hotspots_dir = dataset_dir / "hotspots"
    if hotspots_dir.exists():
        for shard in hotspots_dir.glob("*.json"):
            if shard.name == "index.json":
                continue
            gz_sz = get_gzip_size(shard)
            if gz_sz > SHARD_BUDGET_BYTES:
                passed = False
                messages.append(
                    f"WARNING: Shard {shard.name} exceeds 3 MB limit ({gz_sz:,} bytes gzipped)"
                )

    return passed, messages
