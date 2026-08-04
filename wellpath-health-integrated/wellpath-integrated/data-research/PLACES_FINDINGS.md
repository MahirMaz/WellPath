# US geography layer — CDC PLACES (2025 release)

**Source:** CDC PLACES, County Data 2025 release (`data.cdc.gov`, resource `swc5-untb`), crude adult
prevalence for **2,956 US counties**. Analyzed by `scratchpad/places_analyze.py`.

**What it is:** *area-level* model-based estimates — one row per county, not per person. This is the
**geographical enrichment layer**: you take a person's location (ZIP/county FIPS) and **join** these local
rates as features. (NHANES persons can't be joined — NHANES hides geography — but real WellPath users with a
postal/ZIP code can be.)

---

## Result 1 — huge geographic variation
Crude adult prevalence (%) across counties:

| Measure | min | p10 | median | p90 | max | pop-weighted mean |
|---|---|---|---|---|---|---|
| Diabetes | 4.9 | 10.4 | 13.3 | 17.3 | **27.1** | 12.1 |
| Obesity | 16.7 | 31.2 | 37.9 | 42.8 | 52.9 | 33.3 |
| High blood pressure | 17.3 | 32.0 | 38.5 | 45.8 | 59.8 | 34.4 |
| Current smoking | 6.4 | 11.7 | 15.5 | 20.2 | 39.8 | 12.8 |
| Physical inactivity | 12.1 | 21.6 | 28.1 | 35.7 | 49.5 | 25.2 |

Diabetes ranges **4.9% → 27.1%** — a **5× swing** depending on county.

**Highest-diabetes counties** (the "diabetes belt"): Greene AL 27.1%, Sharkey MS 25.2%, Tensas LA 25.1%,
Randolph GA 24.9%, Humphreys MS 24.7%.
**Lowest:** Madison ID 4.9%, Chittenden VT 6.6%, Gallatin MT 6.7%, Douglas CO 6.8%, Utah UT 6.9%.

## Result 2 — risk factors co-vary geographically (why geography is a useful feature)
County-level correlations:

| | Diabetes | Obesity | Inactivity | High BP | Smoking |
|---|---|---|---|---|---|
| **Diabetes** | 1.00 | 0.67 | 0.85 | **0.89** | 0.71 |
| Obesity | 0.67 | 1.00 | 0.75 | 0.66 | 0.72 |
| Inactivity | 0.85 | 0.75 | 1.00 | 0.75 | 0.78 |
| High BP | 0.89 | 0.66 | 0.75 | 1.00 | 0.69 |
| Smoking | 0.71 | 0.72 | 0.78 | 0.69 | 1.00 |

Diabetes tracks high-BP (0.89) and inactivity (0.85) across counties — places with one problem tend to have
the others, which is exactly what makes a "your area's baseline risk" feature informative.

---

## How to use in WellPath
1. From a user's postal/ZIP → county FIPS.
2. Join `data-research/places_county_wide.csv` (2,956 counties × 5 measures) → attach local prevalence.
3. Feed those as **context features / baseline offsets** to the risk model, or show "your area vs national"
   in the UI.

## Reproduce
- `scratchpad/places_analyze.py`. Add more measures by extending the `measureid in (...)` filter
  (e.g. `SLEEP`, `DEPRESSION`, `ACCESS2`). Finer geography: PLACES also ships census-tract & ZCTA files.
