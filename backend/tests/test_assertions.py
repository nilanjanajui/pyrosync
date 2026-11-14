"""Tests for assertion invariants and reconciliation failure detection."""

import pytest

from pyrosync.assertions import (
    assert_reconciliation,
    assert_terra_aqua_sum,
    assert_totals,
)


def test_assert_totals_failure():
    manifest_totals = {"modisDetections": 100, "viirsDetections": 200}
    # Pass
    assert_totals(manifest_totals, 100, 200)

    # Fail
    with pytest.raises(AssertionError, match="MODIS total mismatch"):
        assert_totals(manifest_totals, 99, 200)

    with pytest.raises(AssertionError, match="VIIRS total mismatch"):
        assert_totals(manifest_totals, 100, 201)


def test_assert_terra_aqua_sum_failure():
    # Pass
    valid_modis = {
        "cell": [0, 1],
        "month": [0, 1],
        "n": [5, 10],
        "terra": [3, 4],
        "aqua": [2, 6],
    }
    assert_terra_aqua_sum(valid_modis)

    # Fail by 1
    invalid_modis = {
        "cell": [0],
        "month": [0],
        "n": [5],
        "terra": [3],
        "aqua": [3],  # 3 + 3 = 6 != 5
    }
    with pytest.raises(AssertionError, match="violation"):
        assert_terra_aqua_sum(invalid_modis)


def test_assert_reconciliation_failure_when_off_by_one():
    cell_months = {
        "months": ["2015-05"],
        "cells": ["0_0"],
        "modis": {
            "cell": [0],
            "month": [0],
            "n": [2],
        },
        "viirs": {
            "cell": [],
            "month": [],
            "n": [],
        },
    }
    # Hotspot shard has 2 records matching expected
    matching_shard = {
        "cell": [0, 0],
        "day": [5610, 5611],  # 2015-05 days
    }
    shards = {"2015_modis": matching_shard}
    assert_reconciliation(cell_months, shards)

    # Hotspot shard is off by one (only 1 record) -> must fail!
    off_by_one_shard = {
        "cell": [0],
        "day": [5610],
    }
    shards_corrupt = {"2015_modis": off_by_one_shard}
    with pytest.raises(AssertionError, match="Reconciliation failure"):
        assert_reconciliation(cell_months, shards_corrupt)
