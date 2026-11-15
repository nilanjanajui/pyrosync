# Adding another region

The app reads everything region-specific from `frontend/public/datasets/manifest.json`; no code change is needed.

1. Re-run the pipeline (notebooks Phase 2 to 7) with the new boundary. The seasonal MODIS-to-VIIRS ratios are fitted per region and must not be reused across regions without re-checking them.
2. Export the datasets (`grid.geojson`, `boundary.geojson`, `cell_months.json`, `harmonization.json`, `validation.json`, hotspot shards) with `studyArea` filled in:
   - `name`: shown in the title, chips, and file names.
   - `bbox`: `[west, south, east, north]`, used for the first map view and the "whole area" size.
   - `areaKm2` (optional): land area; if missing, the bounding-box area is used (an upper bound).
   - `presets` (optional): named sub-areas shown as quick-select chips, each `{ id, name, bbox }`.
3. `coverage.start` and `coverage.end` set the timeline, date range and headline period.
4. Run `python -m pyrosync.cli check --data frontend/public/datasets`, then the frontend tests.

Drawing or typing an area outside the loaded dataset shows "No satellite data is loaded for this place" instead of zeros.

## Serving several regions from one site

Put each region's export in its own folder (for example `public/datasets/brazil/`) and list them in
`public/datasets/regions.json`:

```json
[
  { "id": "california", "name": "California", "path": "/datasets" },
  { "id": "brazil", "name": "Brazil", "path": "/datasets/brazil" }
]
```

With two or more entries the header shows a region selector, and `?region=<id>` opens one directly.
Without the file the app serves the single dataset in `/datasets`.

## Sensor dates

`viirsFirstCompleteMonth`, `viirsPartialMonths` and `firstAquaMonth` in the manifest decide which months are
shown as "estimated" and which as "measured". Nothing in the code assumes 2012 or 2002. The MODIS-to-VIIRS
ratios themselves are fitted per region (see above) and must be re-validated for each new region.
