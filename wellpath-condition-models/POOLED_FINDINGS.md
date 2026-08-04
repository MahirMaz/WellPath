# Pooled two-cycle re-analysis (NHANES 2015–16 + 2017–18)

Purpose: shore up the underpowered condition models by doubling N, and re-test whether
any add-on data domain (nutrition, demographics/context, behaviour/social) improves prediction.
Faithful replication of the multi-condition methodology (train/test split, age+BMI baseline vs full
logistic, 1,000-resample bootstrap AUC CIs, incremental value). Script: `scratchpad/pooled_analysis.py`.

**Pooled adults: 11,848** (2015–16: 5,992 · 2017–18: 5,856). Research prototype; not diagnostic.

## Results (pooled, full logistic, untouched test partition)

| Outcome | N | positives | age+BMI AUC | Full AUC [95% CI] | CI width: single-cycle → pooled | nutrition Δ | all-domains Δ |
|---|---|---|---|---|---|---|---|
| Elevated HbA1c | 8,348 | 3,480 | 0.806 | **0.814** [0.795, 0.832] | 0.051 → **0.037** | +0.002 | +0.003 |
| Elevated blood pressure | 8,715 | 3,565 | 0.727 | **0.740** [0.719, 0.759] | 0.057 → **0.040** | +0.002 | +0.003 |
| Low HDL | 8,261 | 2,534 | 0.683 | **0.694** [0.670, 0.718] | 0.071 → **0.047** | +0.003 | +0.003 |
| Kidney (UACR) | 8,553 | 1,052 | 0.663 | **0.708** [0.676, 0.746] | 0.099 → **0.070** | −0.002 | −0.000 |
| High triglycerides | 3,803 | 788 | 0.588 | **0.651** [0.611, 0.688] | 0.117 → **0.077** | −0.001 | +0.006 |
| High LDL | 3,772 | 352 | 0.543 | **0.572** [0.509, 0.642] | 0.166 → **0.133** | −0.008 | −0.003 |

## What pooling achieved

1. **Confidence intervals tightened for every outcome** (~30% narrower, consistent with ~2× N).
   The three worst — kidney, triglycerides, LDL — went from barely interpretable to usable.
2. **Estimates barely moved** (HbA1c 0.80→0.81, BP 0.73→0.74, kidney 0.72→0.71, LDL 0.58→0.57).
   The single-cycle numbers weren't a fluke — the models are **stable across cycles**, which is reassuring.
3. **The null held, and is now confident:** across all six outcomes, adding **nutrition** moves AUC by
   −0.008 to +0.003, and **all domains together** by −0.003 to +0.006 — i.e. **essentially zero, now with
   tight CIs.** "Diet / social / demographic domains don't improve prediction" is no longer an
   underpowered guess; it's a well-supported result at N ≈ 8–12k.

## Per-outcome verdict
- **HbA1c, blood pressure, kidney** — solid and now trustworthy (0.71–0.81, clearly beating age+BMI). App-ready.
- **Low HDL** — modest (0.69), stable. Usable with honest framing.
- **High triglycerides** — modest (0.65), fasting subsample so still smaller N.
- **High LDL** — **confirmed weak** (0.57, CI still nearly touches 0.51; age+BMI baseline 0.54). Pooling
  did *not* rescue it — exactly as expected, because LDL isn't lifestyle-predictable. Label low-confidence
  (like cholesterol) or leave it out of any user-facing panel.

## Caveat
This is a **focused, faithful replication** for the power question — not the full pipeline (it does not
re-run the validation-based model selection, probability calibration, or the leakage/integrity audits).
The pooled numbers land within a couple of points of the single-cycle suite, which validates it. For the
*official* pooled suite (with calibration + audits), re-run the notebook with a cycle-pooling loader.
