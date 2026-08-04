# US cohort — NHANES 2017–2018 findings

**Source:** CDC NHANES 2017–2018, public files, merged on the person id `SEQN`. Adults 18+ → **N = 5,856**.
Person-level: each row is one real person with demographics + **measured** clinical labs + lifestyle +
**family history** (our genetics proxy). Downloaded/merged by `scratchpad/nhanes_pipeline.py`.

> Caveat: results are **unweighted** (NHANES ships survey weights for national estimates). For building &
> testing an algorithm and generating demo profiles this is fine; add weights before quoting national rates.

---

## Variable mapping — NHANES → WellPath survey/profile fields

| WellPath field | NHANES var(s) | File | Notes |
|---|---|---|---|
| age | RIDAGEYR | DEMO_J | |
| sex | RIAGENDR | DEMO_J | 1=Male, 2=Female |
| ethnicity | RIDRETH3 | DEMO_J | maps to White/Black/Asian/Mexican/Other Hispanic/Other |
| (context) income | INDFMPIR | DEMO_J | income-to-poverty ratio (a social determinant) |
| height_cm / weight_kg / bmi | BMXHT / BMXWT / BMXBMI | BMX_J | measured, not self-report |
| waist_cm | BMXWAIST | BMX_J | central adiposity |
| systolic / diastolic | mean(BPXSY1,2) / mean(BPXDI1,2) | BPX_J | 0-readings dropped |
| resting_hr | BPXPLS | BPX_J | 60-sec pulse |
| total_chol | LBXTC | TCHOL_J | mg/dL |
| **hba1c** | LBXGH | GHB_J | the diabetes **outcome** marker |
| smoker | SMQ020 + SMQ040 | SMQ_J | → Never / Former / Current |
| alcohol_drinks | ALQ130 | ALQ_J | avg drinks/day on drinking days |
| sleep_hours | SLD012 | SLQ_J | |
| activity | PAQ650 (vigorous), PAQ665 (moderate), PAD680 (sedentary min) | PAQ_J | |
| diet_self / diet_score10 | DBQ700 | DBQ_J | 1 excellent … 5 poor → rescaled 0–10 |
| **fh_diabetes** | MCQ300C | MCQ_J | close relative had diabetes — **genetics proxy** |
| **fh_heart** | MCQ300A | MCQ_J | close relative heart attack/angina **before 50** (premature = strong signal) |
| dx_diabetes | DIQ010 | DIQ_J | already diagnosed |
| told_high_bp / told_high_chol | BPQ020 / BPQ080 | BPQ_J | |

Coverage of key fields is high: bmi 92.8%, systolic 89.1%, hba1c 89.8%, family history 93.7%.

---

## Result 1 — the genetics proxy works (this is the important one)

**Family history of diabetes predicts a *measured* biomarker (HbA1c).** No genome required:

| Family history of diabetes | n | mean HbA1c | % prediabetes+ (HbA1c ≥ 5.7) |
|---|---|---|---|
| No | 2,540 | 5.65 | **33.0%** |
| Yes | 2,406 | 6.09 | **50.1%** |

Family history alone lifts the prediabetes+ rate from 33% → 50%. That's the whole "inherited baseline risk"
idea, validated on real measured data — and it's a survey question, not a lab test.

Family-history prevalence in this cohort: diabetes **47.8%**, premature heart attack **13.0%**, asthma 23.3%.

## Result 2 — lifestyle signals are real too
- **Vigorous activity ↔ BMI:** active 28.4 vs inactive 30.1 BMI.
- **Smoking ↔ systolic BP:** Never 125.1, Current 126.0, Former 130.2 — note *former* is highest, an
  **age-confounding** artifact (people quit as they age); a good reminder to adjust for age.

## Result 3 — a simple, transparent algorithm already separates risk well
An additive risk score (age, BMI, current smoking, inactivity, high sedentary time, poor diet,
family history of diabetes, family history of premature heart attack) vs **measured** prediabetes+ (HbA1c ≥ 5.7):

- N = 4,795, outcome prevalence 45.6%, **AUC = 0.713** (no ML, just added risk factors).

| Risk-score bucket | n | % prediabetes+ |
|---|---|---|
| 0–1 (low) | 328 | 7.3% |
| 2–3 | 1,203 | 27.1% |
| 4–5 | 1,958 | 48.2% |
| 6+ (high) | 1,306 | 68.3% |

A clean monotonic gradient (7% → 68%). This is exactly the demo story: *combine lifestyle + inherited +
demographic factors → a risk score that tracks a real health outcome.*

---

## Sample profiles for the app
`data-research/sample_profiles_nhanes.csv` — 12 real anonymized people mapped to WellPath fields
(age, sex, ethnicity, BMI, BP, resting HR, cholesterol, HbA1c, smoking, sleep, diet, family history,
diagnoses). Use these (or sample more) to fill demo patient profiles with realistic, correlated data.

## Reproduce / extend
- `scratchpad/nhanes_pipeline.py` does download→merge→map→analyze→sample.
- To grow N: add the 2015–2016 cycle (suffix `_I`) or the combined 2017–2020 files and stack them.
