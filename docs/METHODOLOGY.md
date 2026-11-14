# PyroSync Scientific & Data Processing Methodology

## 1. NASA Active Fire Data Sources

PyroSync aggregates satellite observations from two primary sensor instruments operated by NASA:

1. **MODIS (Moderate Resolution Imaging Spectroradiometer)**:
   - Instruments on board the **Terra** (EOS AM-1, morning pass ~10:30 AM local) and **Aqua** (EOS PM-1, afternoon pass ~1:30 PM local) satellites.
   - Spatial resolution: 1 km at nadir.
   - Temporal span: November 2000 to December 2021.
   - Products: MODIS Collection 6.1 active fire detections (`MOD14` / `MYD14`).
   - Platform availability: Terra operational from 2000-11; Aqua operational from July 2002. Months prior to Aqua are strictly Terra-only.

2. **VIIRS (Visible Infrared Imaging Radiometer Suite)**:
   - Instrument on board the **Suomi-NPP** (National Polar-orbiting Partnership) satellite.
   - Spatial resolution: 375 m at nadir (I-bands: 375 m thermal anomaly).
   - Temporal span: Operational starting 2012-01-20 (January 2012 partial month; first complete calendar month is 2012-02).
   - Products: VIIRS VNP14IMGTDL 375 m active fire product.

---

## 2. Filtering & Vegetation-Fire Subset (Phase 2)

As documented in `notebooks/phase2_cleaning.ipynb`, raw satellite fire products contain non-vegetation thermal anomalies such as gas flares, volcanic activity, industrial thermal exhausts, and offshore reflections.

PyroSync isolates true terrestrial vegetation burning through a strict filter:
- **Detection Type Filter**: Retains only records where detection `type == 0` (presumed vegetation fire). Records with `type == 1` (active volcano), `type == 2` (other static land source / industrial flares), or `type == 3` (offshore detections) are excluded.
- **Geographic Boundary Clipping**: Cleaned active fires are spatially matched against the US Census Bureau TIGER/Line 2024 California boundary polygon (`STATEFP == "06"`). Only detections strictly within California are retained.
- **Confidence Classification**:
  - MODIS numeric confidence (0–100%) mapped to categories: Low ($[0, 30)$), Nominal ($[30, 80)$), High ($[80, 100]$).
  - VIIRS categorical flags mapped: `l` $\to$ Low, `n` $\to$ Nominal, `h` $\to$ High.

---

## 3. Spatial Equal-Area Grid System (Phase 3)

- **Projection**: Cylindrical Equal Area (EPSG:6933), preserving true surface area across all latitudes.
- **Resolution**: 10 km $\times$ 10 km cells ($100\text{ km}^2$ per cell).
- **Extent**: 4,527 cells intersecting the California state boundary.
- **Cell Identification**: Cells are indexed by integer grid coordinates `ix_iy`, where $ix = \lfloor x / 10000 \rfloor$ and $iy = \lfloor y / 10000 \rfloor$ in EPSG:6933 coordinates.
- **Centroids**: Calculated in EPSG:6933 and projected to WGS84 (EPSG:4326) rounded to 4 decimal places for point-in-polygon queries.

---

## 4. Aggregation Semantics

- **Aggregation Unit**: Cell $\times$ calendar month.
- **Detection Count ($N$)**: The number of satellite detection records in that 10 km cell during that calendar month. A detection record is an observation of a thermal anomaly at the time of satellite overpass; it is **not** a count of distinct wildfires.
- **Zero vs. Null**:
  - Zero ($0$) denotes that the sensor was operational during that month and recorded zero detection records.
  - Null (No Data) denotes that the sensor was not yet in orbit or operational (e.g. VIIRS before 2012-01).
- **Fire Radiative Power (FRP)**: Total radiative power (MW) summed across all detections in that cell-month. FRP is a secondary diagnostic and is not scaled or harmonized.

---

## 5. Harmonization & Sensor Blending

Because VIIRS has a 375 m pixel size compared to MODIS's 1 km pixel size, VIIRS detects roughly 3 to 4.5 times more thermal anomalies than MODIS for the same fire events.

1. **Native Record Transition**: From `2012-02` onward, harmonized series defaults to native high-resolution VIIRS observations.
2. **Pre-Blend Scaling**: For months before `2012-02`, MODIS counts are scaled to estimate equivalent VIIRS detection levels:
   $$\text{Harmonized Count} = \text{MODIS Count} \times \text{Scale Factor}$$
   Priority for scaling factors: `terraOnly` (for pre-Aqua months) $>$ `bySeason` $>$ `global`.
3. **Rounding**: Whole numbers in charts and visualizations; one decimal place in CSV exports (`.toFixed(1)`).

