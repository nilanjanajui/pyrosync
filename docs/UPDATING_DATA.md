# Updating the PyroSync Dataset

This guide describes the exact steps required to update `frontend/public/datasets/` with new processed data from the Google Drive pipeline outputs.

> **Never edit dataset files by hand.** Always regenerate them with `pyrosync export`, then verify with `pyrosync check`. Manual edits will cause the content hash to drift, and `check` will refuse to pass.

---

## Prerequisites

- Python ≥ 3.11, with the backend virtualenv activated:
  ```bash
  cd backend
  source .venv/bin/activate   # or: python -m venv .venv && pip install -e . && pip install -r requirements-dev.txt
  ```
- The Google Drive data folder downloaded locally (see `docs/PIPELINE.md`).  
  Call this path `$DATA_DIR` (e.g. `~/pyrosync-data`).
- A clean `main` branch with no uncommitted changes to `frontend/public/datasets/`.

---

## Step 1 — Run Export

```bash
cd backend
python -m pyrosync.cli export \
    --data "$DATA_DIR" \
    --out ../frontend/public/datasets
```

The command:
- Reads Parquet/CSV files from `$DATA_DIR` (Phase 2–7 layout).
- Writes or overwrites `grid.geojson`, `boundary.geojson`, `cell_months.json`, `harmonization.json`, `validation.json`, and `manifest.json`.
- Computes a SHA-256 content hash over the five core files.
- **Auto-bumps the patch version** in `manifest.version` if the hash has changed since the last export (e.g. `1.0.3` → `1.0.4`).  
  If the hash is unchanged, the version is kept — no spurious commit is needed.
- Prints a summary of cell counts, detection totals, and file sizes.

**Version override** (use sparingly, e.g. for a minor or major bump):
```bash
python -m pyrosync.cli export --data "$DATA_DIR" --out ../frontend/public/datasets --version 2.0.0
```

---

## Step 2 — Run Check

```bash
python -m pyrosync.cli check --data ../frontend/public/datasets
```

This validates:
1. All required files conform to their JSON Schemas.
2. File sizes are within gzip budget (≤ 3 MB core bundle).
3. The recomputed SHA-256 hash matches `manifest.datasetHash`.

Expected last line: **`ALL CHECKS PASSED.`**

If check fails:
- **Hash mismatch** → You edited a core file by hand. Re-run `export` from scratch.
- **Budget exceeded** → The dataset grew; check for unexpected data growth in the pipeline.
- **Schema error** → A pipeline phase changed its output format; update the schema and Zod types accordingly before deploying.

---

## Step 3 — Review Printed Totals and Sizes

Before committing, verify the numbers in the export summary look reasonable:

| Metric | Expected range (real data) |
|:-------|:--------------------------|
| Cells | ~4,527 |
| Months | 254 (2000-11 through 2021-12) |
| MODIS detections | ~279,000–300,000 |
| VIIRS detections | ~780,000–820,000 |
| Harmonized records | ~700,000–900,000 |
| `cell_months.json` raw | ~20–35 MB |
| `grid.geojson` raw | ~15–25 MB |
| Total core bundle (gzip) | ≤ 3 MB |

If any number is wildly off (e.g. MODIS detections = 0, or cells = 30), the pipeline input data may be wrong or mispointed. **Stop and investigate before committing.**

---

## Step 4 — Commit the Dataset Files and Push

```bash
cd ..   # repo root
git add frontend/public/datasets/
git status   # review which files changed
git commit -m "data: update dataset to v$(cat frontend/public/datasets/manifest.json | python3 -c 'import sys,json; print(json.load(sys.stdin)[\"version\"])')"
git push origin main
```

> **Do not** push before `check` passes. A failed check on a live dataset means the hash in `manifest.json` does not match the files, which can cause subtle data integrity errors in the UI.

---

## Step 5 — Verify on the Live Site

After Vercel deploys (usually 1–2 minutes):

1. Open `https://your-vercel-url/datasets/manifest.json` in the browser.
2. Confirm `"version"` shows the new version number.
3. Confirm `"datasetHash"` is a 64-character hex string.
4. Open the app and check the top bar shows the correct date range and detection totals.

---

## Step 6 — Rollback (if needed)

If the new data is wrong, roll back via Vercel:

1. Go to your Vercel project → **Deployments** tab.
2. Find the most recent good deployment.
3. Click the `…` menu → **Promote to Production**.

This instantly serves the old `frontend/public/datasets/` without a code change.

Alternatively, roll back via Git:
```bash
git revert HEAD --no-edit
git push origin main
```

---

## What NOT to Do

| ❌ Don't | ✅ Do instead |
|:---------|:-------------|
| Edit `grid.geojson`, `cell_months.json`, etc. in a text editor | Re-run `pyrosync export` from source data |
| Commit datasets without running `check` | Always run `check` before `git add` |
| Bump `manifest.version` by hand | Let `export` auto-bump, or use `--version` |
| Delete or modify `frontend/public/datasets/hotspots/` | Leave hotspot shards untouched (see `docs/DECISIONS.md`) |
| Push to `main` before the Vercel preview build passes | Wait for CI to go green |

---

## Hotspot Shards

The shards in `frontend/public/datasets/hotspots/` contain **legacy synthetic data** (30 cells, ~10k MODIS / ~18k VIIRS rows). The main UI does not load them. See `docs/DECISIONS.md § DEC-010` for the full decision record and future options (regenerate or remove).

**Do not update or regenerate the shards without reading that section and asking the team.**
