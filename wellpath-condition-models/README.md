# WellPath Condition Models

## Purpose

This standalone Python research project evaluates whether combinations of
WellPath-style KPIs, lifestyle variables, demographics, and family-history
fields can classify an elevated HbA1c category in de-identified public-health
data. It supports the requirement to examine health variables collectively
rather than interpreting one KPI at a time.

The models are exploratory research models. They are not diagnostic tools, are
not clinically validated, and must not be used to make medical decisions.

This directory is separate from the existing WellPath React/Vite application.
It does not connect to the WellPath frontend, backend, database, or synthetic
application-user data.

## Initial outcome

The first implemented outcome is:

`elevated_hba1c = 1` when measured HbA1c is at least 5.7%, otherwise `0`.

Participants without a valid HbA1c value are excluded. This threshold includes
the prediabetes threshold; it is not the same as a confirmed clinical diagnosis.
HbA1c, glucose, diabetes-diagnosis fields, and direct outcome proxies are
forbidden predictors.

The reproducible multi-condition panel in `src/multicondition_analysis.py`
retains this experiment and adds three non-diagnostic, cross-sectional
monitoring signals:

- elevated measured blood pressure: mean valid measured systolic pressure at
  least 130 mmHg or mean valid measured diastolic pressure at least 80 mmHg;
- low HDL: direct HDL below 40 mg/dL for men or below 50 mg/dL for women;
- kidney health: urine albumin-to-creatinine ratio above 30 mg/g.

The blood-pressure measurements, HDL measurement, UACR measurement, and any
field participating in an outcome definition are excluded from that outcome's
predictors. Sex is therefore excluded from the low-HDL model.

## Dataset requirements

The first implementation expects participant-level NHANES files placed manually
in:

`data/raw/nhanes/`

Accepted formats:

- SAS Transport files (`.xpt`)
- CSV files converted from NHANES XPT files

The project never downloads files automatically. Source URLs, cycle, file
versions, and codebooks must be verified and documented by the researcher.

The exact component filenames vary by cycle. At minimum, the elevated-HbA1c
analysis requires a laboratory component containing `SEQN` and the confirmed
HbA1c variable (default candidate `LBXGH`). Demographic, examination,
questionnaire, and survey-design components are then added according to the
fields being evaluated.

Review `src/feature_mapping.py` before each cycle. Candidate names are
configuration starting points, not claims that a variable exists.

## SEQN joins

`SEQN` is the NHANES participant identifier. The loader:

1. requires `SEQN` in every accepted component;
2. removes exact duplicate rows;
3. rejects a component with multiple non-identical rows per participant;
4. outer-joins accepted components one-to-one on `SEQN`;
5. confirms one final row per participant.

`SEQN` is preserved only for joins, the participant-level split, and auditing.
It is never used as a predictor.

## Setup

The Microsoft **Python** and **Jupyter** VS Code extensions are required.

```powershell
cd C:\Users\Mahir\Desktop\WellPath\wellpath-condition-models
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Open `notebooks/condition_prediction_models.ipynb`, select the `.venv` Python
kernel, and run all cells from top to bottom.

Run the multi-condition panel from the project root with:

```powershell
.\.venv\Scripts\python.exe .\run_multicondition_analysis.py
```

The panel uses one outcome-specific 60/20/20 stratified
training/validation/test split. Validation participants are used for algorithm
selection, feature-group comparisons, ablations, threshold selection, and
Platt probability calibration. The final test set is untouched until final
performance reporting. Every algorithm and direct comparison for an outcome
reuses the exact same participant IDs. Complete sklearn pipelines include
training-only imputation, encoding, scaling, and the fitted estimator; the
selected model is wrapped with its validation-fitted calibrator and threshold.
Eligibility requires at least 60% of the full model's predictors to be
observed before training-set imputation. The threshold and participant-ID
hashes are recorded in the model metadata.

Required outcome components currently present are `GHB_J.xpt`, `BPX_J.xpt`,
`HDL_J.xpt`, and `ALB_CR_J.xpt`. Smoking, food-security, and healthcare-access
comparisons remain explicitly unavailable because their required components
are not present.

When `SMQ_J.xpt`, `FSQ_J.xpt`, or `HUQ_J.xpt` is added locally, the panel
discovers and engineers smoking status (`SMQ020` + `SMQ040`), household food
security (`FSDHH`), and routine healthcare-place access (`HUQ030`) with
documented missing-code handling. Recreational activity is mapped through
explicit weekly-minute contracts using `PAQ655 * PAD660` and
`PAQ670 * PAD675`; a verified "No" response is zero, while an incomplete
frequency/duration response remains missing.

## Expanded diet and survey-context experiment

The notebook now inventories every local NHANES column, combines verified
day-one/day-two nutrient recalls, tests diet beyond KPIs and demographics, and
reports complete-case and available-case results separately. It uses
regularized logistic regression for fair feature-set comparisons, also fits
random forest and gradient boosting on the final set, and calculates
1,000-resample confidence intervals.

Available-case eligibility defaults to at least 60% of a model's predictors
being observed before imputation. The notebook also reports a strict global
complete-case cohort and a dedicated shared cohort for KPI + demographics,
diet, and the combined medical/family-risk proxy. A paired comparison tests
whether weight adds predictive information beyond BMI.

DIQ170 is labelled only as a combined medical/family-risk proxy. DIQ175A is not
used as a universal family-history field because it is conditional on reported
perceived risk. Smoking, food security, and healthcare access are reported as
unavailable because SMQ_J, FSQ_J, and HUQ_J are not present.

The registered VS Code kernel is **WellPath NHANES (.venv)**. If it does not
appear immediately, reload VS Code and select
`wellpath-condition-models\.venv\Scripts\python.exe`.

## Reusable Python modules

From the project directory:

```powershell
python -c "from src.data_loader import load_nhanes_directory; print('Loader ready')"
python -c "from src.feature_mapping import leakage_audit; print(leakage_audit(['age', 'hba1c']))"
```

The notebook imports the same modules, so analysis logic is reusable outside the
notebook.

## Analysis modes

### Predictive ML mode

Uses an 80/20 participant-level stratified split with `random_state=42`.
Imputation, scaling, and encoding are fit inside sklearn pipelines using
training data only. Tuning occurs only in stratified five-fold
cross-validation within the training partition. Final metrics use the untouched
test partition and are not nationally representative.

Implemented comparisons:

- fixed DummyClassifier baseline;
- documented additive score;
- unweighted, unpenalized logistic regression as the primary interpretable
  model;
- balanced regularized logistic regression;
- decision tree;
- random forest;
- gradient boosting classifier;
- KPI-only, background-only, and combined feature sets;
- combined-model ablations.

The geography feature set is created only if a safe, approved geographic
variable is explicitly configured and found. Public NHANES geography is not
assumed.

### Survey-weighted descriptive mode

Uses the confirmed NHANES examination/interview weight, masked variance strata,
and PSU fields where available to describe prevalence. These survey-weighted
statistics are population descriptions, not individual predictions. The
correct weight must match the analytic component and cycle.

## Outputs

Generated files are written under:

- `outputs/charts/` — separate 300-DPI matplotlib figures;
- `outputs/tables/` — model, threshold, mapping, missingness, ablation, and
  subgroup CSV files;
- `outputs/models/` — selected fitted pipeline and metadata, only after valid
  real data are available;
- `outputs/predictions/` — optional explicitly labelled demonstration outputs.

When required real data are absent, the notebook writes availability, missing
variable, feature mapping, valid-range, additive-rule, and analysis-status
tables. It does not create model metrics, charts, predictions, or a fitted model
artifact from invented data.

## Association, classification, and diagnosis

- **Association** describes a statistical relationship and does not establish
  causation.
- **Classification** estimates how well a model separates predefined outcome
  categories in a particular dataset.
- **Diagnosis** is a clinical determination. This project does not provide one.

Regional or survey-weighted statistics describe groups. Participant-level model
scores classify records within an exploratory research design. Neither is an
individual clinical decision.

## Connection to WellPath

The public dataset trains and evaluates population-level research models.
WellPath synthetic users may later demonstrate how compatible fields flow
through the application, but their predictions must remain labelled as
demonstrations and may not be used as evidence of real performance.

The integrated-data comparison asks whether background and survey fields add
information beyond existing KPI fields. Even if held-out performance improves,
that does not prove clinical safety, transportability, fairness, or benefit.
WellPath-facing language should describe a **monitoring signal** or an
**elevated pattern**, never a diagnosis.

## Why the models are not clinically validated

The implementation does not establish external validation, prospective
performance, clinical utility, treatment benefit, safe thresholds, subgroup
equity, or deployment monitoring. NHANES cycle-specific variable definitions,
missing-value codes, survey weights, eligibility criteria, measurement timing,
confidence intervals, and reference categories also require review.

Verification status: **research prototype — not clinically validated**.
