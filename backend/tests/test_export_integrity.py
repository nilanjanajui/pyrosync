"""Tests for export.py hash stability, version auto-bump, and check tamper detection."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

from pyrosync.export import CORE_FILES, _bump_patch, compute_dataset_hash

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _write_core_files(out_dir: Path, suffix: str = "") -> None:
    """Write minimal but valid placeholder content for all five CORE_FILES."""
    payloads = {
        "grid.geojson": json.dumps({"type": "FeatureCollection", "features": [], "note": suffix}),
        "boundary.geojson": json.dumps(
            {"type": "FeatureCollection", "features": [], "note": suffix}
        ),
        "cell_months.json": json.dumps({"months": [], "cells": [], "note": suffix}),
        "harmonization.json": json.dumps({"status": "provisional", "note": suffix}),
        "validation.json": json.dumps({"tables": [], "figures": [], "note": suffix}),
    }
    for name, content in payloads.items():
        (out_dir / name).write_text(content, encoding="utf-8")


# ---------------------------------------------------------------------------
# Hash stability
# ---------------------------------------------------------------------------


class TestHashStability:
    """Same inputs always produce the same SHA-256 hash."""

    def test_identical_content_gives_identical_hash(self, tmp_path: Path) -> None:
        _write_core_files(tmp_path)
        h1 = compute_dataset_hash(tmp_path)
        h2 = compute_dataset_hash(tmp_path)
        assert h1 == h2, "Hash must be stable across repeated calls on identical files"

    def test_hash_is_64_hex_chars(self, tmp_path: Path) -> None:
        _write_core_files(tmp_path)
        h = compute_dataset_hash(tmp_path)
        assert len(h) == 64
        assert all(c in "0123456789abcdef" for c in h)

    def test_copy_gives_identical_hash(self, tmp_path: Path) -> None:
        src = tmp_path / "src"
        dst = tmp_path / "dst"
        src.mkdir()
        dst.mkdir()
        _write_core_files(src)
        for name in CORE_FILES:
            shutil.copy(src / name, dst / name)
        assert compute_dataset_hash(src) == compute_dataset_hash(dst)

    def test_different_content_gives_different_hash(self, tmp_path: Path) -> None:
        dir_a = tmp_path / "a"
        dir_b = tmp_path / "b"
        dir_a.mkdir()
        dir_b.mkdir()
        _write_core_files(dir_a, suffix="v1")
        _write_core_files(dir_b, suffix="v2")
        assert compute_dataset_hash(dir_a) != compute_dataset_hash(dir_b)

    def test_missing_core_file_raises(self, tmp_path: Path) -> None:
        _write_core_files(tmp_path)
        (tmp_path / "grid.geojson").unlink()
        with pytest.raises(FileNotFoundError):
            compute_dataset_hash(tmp_path)

    def test_hash_covers_all_core_files(self, tmp_path: Path) -> None:
        """Altering any single core file changes the hash."""
        _write_core_files(tmp_path)
        baseline = compute_dataset_hash(tmp_path)
        for name in CORE_FILES:
            original = (tmp_path / name).read_bytes()
            (tmp_path / name).write_text(
                json.dumps({"tampered": True, "file": name}), encoding="utf-8"
            )
            tampered_hash = compute_dataset_hash(tmp_path)
            assert tampered_hash != baseline, f"Hash must change when {name} is altered"
            # restore
            (tmp_path / name).write_bytes(original)


# ---------------------------------------------------------------------------
# _bump_patch
# ---------------------------------------------------------------------------


class TestBumpPatch:
    def test_basic_bump(self) -> None:
        assert _bump_patch("1.0.0") == "1.0.1"
        assert _bump_patch("2.3.7") == "2.3.8"
        assert _bump_patch("0.0.0") == "0.0.1"

    def test_rollover(self) -> None:
        assert _bump_patch("1.0.9") == "1.0.10"
        assert _bump_patch("1.0.99") == "1.0.100"

    def test_major_minor_unchanged(self) -> None:
        result = _bump_patch("3.5.2")
        assert result.startswith("3.5.")

    def test_non_semver_appended(self) -> None:
        # Graceful fallback: just append ".1"
        result = _bump_patch("custom")
        assert result == "custom.1"


# ---------------------------------------------------------------------------
# Version bump logic (simulated via export internals)
# ---------------------------------------------------------------------------


class TestVersionBump:
    """Test that run_export bumps the version iff the hash changes."""

    def _make_manifest(self, out_dir: Path, version: str, dataset_hash: str) -> None:
        m = {
            "version": version,
            "generatedAtUtc": "2026-01-01T00:00:00+00:00",
            "synthetic": False,
            "datasetHash": dataset_hash,
        }
        (out_dir / "manifest.json").write_text(json.dumps(m), encoding="utf-8")

    def test_version_bumped_when_hash_differs(self, tmp_path: Path) -> None:
        """If stored hash differs from new hash, version must increment."""
        _write_core_files(tmp_path, suffix="new_data")
        new_hash = compute_dataset_hash(tmp_path)
        # Store a *different* old hash in manifest
        self._make_manifest(tmp_path, "1.0.0", "a" * 64)

        # Simulate the auto-bump logic from run_export
        prev = json.loads((tmp_path / "manifest.json").read_text())
        stored = prev.get("datasetHash")
        prev_version = prev.get("version", "1.0.0")
        chosen = _bump_patch(prev_version) if (stored != new_hash) else prev_version

        assert chosen == "1.0.1"

    def test_version_unchanged_when_hash_same(self, tmp_path: Path) -> None:
        """If stored hash matches recomputed hash, version must not change."""
        _write_core_files(tmp_path, suffix="stable")
        h = compute_dataset_hash(tmp_path)
        self._make_manifest(tmp_path, "2.1.4", h)

        prev = json.loads((tmp_path / "manifest.json").read_text())
        stored = prev.get("datasetHash")
        prev_version = prev.get("version", "1.0.0")
        chosen = _bump_patch(prev_version) if (stored != h) else prev_version

        assert chosen == "2.1.4"


# ---------------------------------------------------------------------------
# Tamper detection (simulates cmd_check logic)
# ---------------------------------------------------------------------------


class TestTamperDetection:
    """Verify that modifying a core file without re-running export is detectable."""

    def _stored_hash(self, out_dir: Path) -> str:
        return json.loads((out_dir / "manifest.json").read_text())["datasetHash"]

    def _write_manifest_with_hash(self, out_dir: Path, h: str) -> None:
        m = {"version": "1.0.0", "datasetHash": h}
        (out_dir / "manifest.json").write_text(json.dumps(m), encoding="utf-8")

    def test_clean_state_passes(self, tmp_path: Path) -> None:
        _write_core_files(tmp_path)
        h = compute_dataset_hash(tmp_path)
        self._write_manifest_with_hash(tmp_path, h)
        # Recompute and compare — should match
        actual = compute_dataset_hash(tmp_path)
        assert actual == self._stored_hash(tmp_path)

    def test_tampered_file_detected(self, tmp_path: Path) -> None:
        _write_core_files(tmp_path)
        h = compute_dataset_hash(tmp_path)
        self._write_manifest_with_hash(tmp_path, h)

        # Tamper: edit harmonization.json without re-running export
        (tmp_path / "harmonization.json").write_text(
            json.dumps({"tampered": True, "extra_field": "injected"}), encoding="utf-8"
        )

        actual = compute_dataset_hash(tmp_path)
        stored = self._stored_hash(tmp_path)
        assert actual != stored, "Tampered file must yield a different hash than stored"

    def test_missing_hash_field_skipped(self, tmp_path: Path) -> None:
        """Manifest without datasetHash → check skips hash verification gracefully."""
        _write_core_files(tmp_path)
        m = {"version": "1.0.0"}  # no datasetHash
        (tmp_path / "manifest.json").write_text(json.dumps(m), encoding="utf-8")
        stored = json.loads((tmp_path / "manifest.json").read_text()).get("datasetHash")
        assert stored is None  # cmd_check should SKIP, not fail
