"""Configurable NHANES-to-WellPath feature mapping.

Candidate source names must be confirmed against the codebook for the exact
NHANES cycle. The loader never substitutes an unrelated field when a candidate
is absent.
"""

from __future__ import annotations

from collections.abc import Iterable

import pandas as pd


TARGET_NAME = "elevated_hba1c"
PARTICIPANT_ID = "SEQN"


FEATURE_SPECS = {
    "hba1c": {
        "candidates": ["LBXGH"],
        "group": "target",
        "kind": "continuous",
        "unit": "%",
        "valid_range": (2.0, 20.0),
        "wellpath_field": "",
        "new_survey_field_required": False,
        "interpretation_limitation": (
            "Used only to define elevated_hba1c; never permitted as a predictor."
        ),
    },
    "sleep_hours": {
        "candidates": ["SLD012", "SLD010H"],
        "group": "clinical_kpis",
        "kind": "continuous",
        "unit": "hours/night",
        "valid_range": (0.0, 24.0),
        "wellpath_field": "sleep_hours",
        "new_survey_field_required": False,
        "interpretation_limitation": "Self-reported sleep may be misclassified.",
    },
    "resting_heart_rate": {
        "candidates": ["BPXPLS"],
        "group": "clinical_kpis",
        "kind": "continuous",
        "unit": "beats/minute",
        "valid_range": (30.0, 220.0),
        "wellpath_field": "resting_heart_rate",
        "new_survey_field_required": False,
        "interpretation_limitation": (
            "Single examination pulse is not a longitudinal resting baseline."
        ),
    },
    "systolic_bp": {
        "candidates": ["BPXSY1", "BPXSY2", "BPXSY3"],
        "aggregate": "row_mean",
        "group": "clinical_kpis",
        "kind": "continuous",
        "unit": "mmHg",
        "valid_range": (60.0, 260.0),
        "wellpath_field": "systolic_bp",
        "new_survey_field_required": False,
        "interpretation_limitation": (
            "Examination measurements do not establish a diagnosis by themselves."
        ),
    },
    "diastolic_bp": {
        "candidates": ["BPXDI1", "BPXDI2", "BPXDI3"],
        "aggregate": "row_mean",
        "group": "clinical_kpis",
        "kind": "continuous",
        "unit": "mmHg",
        "valid_range": (30.0, 160.0),
        "wellpath_field": "diastolic_bp",
        "new_survey_field_required": False,
        "interpretation_limitation": (
            "Examination measurements do not establish a diagnosis by themselves."
        ),
    },
    "bmi": {
        "candidates": ["BMXBMI"],
        "group": "clinical_kpis",
        "kind": "continuous",
        "unit": "kg/m²",
        "valid_range": (10.0, 80.0),
        "wellpath_field": "bmi",
        "new_survey_field_required": False,
        "interpretation_limitation": (
            "BMI is a screening measure and does not directly measure body composition."
        ),
    },
    "weight_kg": {
        "candidates": ["BMXWT"],
        "group": "clinical_kpis",
        "kind": "continuous",
        "unit": "kg",
        "valid_range": (20.0, 350.0),
        "wellpath_field": "weight",
        "new_survey_field_required": False,
        "interpretation_limitation": "Weight must be interpreted with body size and context.",
    },
    "vigorous_activity": {
        "candidates": ["PAQ650", "PAQ605"],
        "missing_codes": [7, 9, 77, 99],
        "group": "activity",
        "kind": "categorical",
        "unit": "survey category",
        "valid_range": None,
        "wellpath_field": "active_minutes or activity category",
        "new_survey_field_required": False,
        "interpretation_limitation": (
            "Question wording and coding differ by NHANES cycle."
        ),
    },
    "moderate_activity": {
        "candidates": ["PAQ665", "PAQ620"],
        "missing_codes": [7, 9, 77, 99],
        "group": "activity",
        "kind": "categorical",
        "unit": "survey category",
        "valid_range": None,
        "wellpath_field": "active_minutes or activity category",
        "new_survey_field_required": False,
        "interpretation_limitation": (
            "Question wording and coding differ by NHANES cycle."
        ),
    },
    "sedentary_minutes": {
        "candidates": ["PAD680"],
        "group": "activity",
        "kind": "continuous",
        "unit": "minutes/day",
        "valid_range": (0.0, 1440.0),
        "wellpath_field": "sedentary_minutes",
        "new_survey_field_required": False,
        "interpretation_limitation": "Self-reported sedentary time may be imprecise.",
    },
    "age": {
        "candidates": ["RIDAGEYR"],
        "group": "demographics",
        "kind": "continuous",
        "unit": "years",
        "valid_range": (18.0, 120.0),
        "wellpath_field": "age",
        "new_survey_field_required": True,
        "interpretation_limitation": "Age associations do not determine an individual outcome.",
    },
    "sex": {
        "candidates": ["RIAGENDR"],
        "missing_codes": [7, 9],
        "group": "demographics",
        "kind": "categorical",
        "unit": "NHANES category",
        "valid_range": None,
        "wellpath_field": "sex",
        "new_survey_field_required": True,
        "interpretation_limitation": (
            "Public-use coding may not represent gender identity."
        ),
    },
    "family_history_diabetes": {
        "candidates": ["MCQ300C"],
        "missing_codes": [7, 9, 77, 99],
        "group": "family_history",
        "kind": "categorical",
        "unit": "survey category",
        "valid_range": None,
        "wellpath_field": "family_history_diabetes",
        "new_survey_field_required": True,
        "interpretation_limitation": (
            "Self-reported family history is not genetic testing."
        ),
    },
    "smoking_status": {
        "candidates": ["SMQ040", "SMQ020"],
        "missing_codes": [7, 9, 77, 99],
        "group": "lifestyle",
        "kind": "categorical",
        "unit": "survey category",
        "valid_range": None,
        "wellpath_field": "smoking_status",
        "new_survey_field_required": True,
        "interpretation_limitation": (
            "Candidate fields represent different smoking constructs and require review."
        ),
    },
    "income_context": {
        "candidates": ["INDFMPIR"],
        "group": "background",
        "kind": "continuous",
        "unit": "family income-to-poverty ratio",
        "valid_range": (0.0, 5.0),
        "wellpath_field": "income_context",
        "new_survey_field_required": True,
        "interpretation_limitation": (
            "Income may proxy structural conditions and must not be overinterpreted."
        ),
    },
    "food_security": {
        "candidates": ["FSDHH", "FSDAD"],
        "missing_codes": [7, 9, 77, 99],
        "group": "background",
        "kind": "categorical",
        "unit": "survey category",
        "valid_range": None,
        "wellpath_field": "food_security",
        "new_survey_field_required": True,
        "interpretation_limitation": (
            "Exact household/adult food-security construct requires cycle-codebook review."
        ),
    },
    "healthcare_access": {
        "candidates": ["HUQ030", "HUQ010"],
        "missing_codes": [7, 9, 77, 99],
        "group": "background",
        "kind": "categorical",
        "unit": "survey category",
        "valid_range": None,
        "wellpath_field": "healthcare_access",
        "new_survey_field_required": True,
        "interpretation_limitation": (
            "Candidate access fields have different meanings and require confirmation."
        ),
    },
    "race_ethnicity": {
        "candidates": ["RIDRETH3", "RIDRETH1"],
        "missing_codes": [7, 9, 77, 99],
        "group": "fairness_only",
        "kind": "categorical",
        "unit": "broad public-use category",
        "valid_range": None,
        "wellpath_field": "",
        "new_survey_field_required": False,
        "interpretation_limitation": (
            "Use for subgroup auditing, not as a biological risk explanation."
        ),
    },
    "survey_weight": {
        "candidates": ["WTMEC2YR", "WTINT2YR"],
        "group": "survey_design",
        "kind": "continuous",
        "unit": "NHANES survey weight",
        "valid_range": (0.0, None),
        "wellpath_field": "",
        "new_survey_field_required": False,
        "interpretation_limitation": "Select the weight matching the analytic component.",
    },
    "survey_stratum": {
        "candidates": ["SDMVSTRA"],
        "group": "survey_design",
        "kind": "categorical",
        "unit": "masked variance stratum",
        "valid_range": None,
        "wellpath_field": "",
        "new_survey_field_required": False,
        "interpretation_limitation": "Used only for survey-weighted description.",
    },
    "survey_psu": {
        "candidates": ["SDMVPSU"],
        "group": "survey_design",
        "kind": "categorical",
        "unit": "masked variance PSU",
        "valid_range": None,
        "wellpath_field": "",
        "new_survey_field_required": False,
        "interpretation_limitation": "Used only for survey-weighted description.",
    },
}


LEAKAGE_TERMS = {
    TARGET_NAME,
    "hba1c",
    "LBXGH",
    "glucose",
    "fasting_glucose",
    "diabetes_diagnosis",
    "diagnosed_diabetes",
    "DIQ010",
    "glycohemoglobin",
}


FEATURE_SETS = {
    "KPI-only": [
        "sleep_hours",
        "resting_heart_rate",
        "systolic_bp",
        "diastolic_bp",
        "bmi",
        "weight_kg",
        "vigorous_activity",
        "moderate_activity",
        "sedentary_minutes",
    ],
    "Background-only": [
        "age",
        "sex",
        "family_history_diabetes",
        "smoking_status",
        "income_context",
        "food_security",
        "healthcare_access",
    ],
}
FEATURE_SETS["Combined"] = list(
    dict.fromkeys(FEATURE_SETS["KPI-only"] + FEATURE_SETS["Background-only"])
)


ABLATION_GROUPS = {
    "family history": ["family_history_diabetes"],
    "demographic variables": ["age", "sex"],
    "lifestyle variables": ["sleep_hours", "smoking_status"],
    "clinical KPIs": [
        "resting_heart_rate",
        "systolic_bp",
        "diastolic_bp",
        "bmi",
        "weight_kg",
    ],
    "activity variables": [
        "vigorous_activity",
        "moderate_activity",
        "sedentary_minutes",
    ],
}


def leakage_audit(predictors: Iterable[str]) -> pd.DataFrame:
    """Return a transparent leakage report for proposed predictor names."""
    rows = []
    for predictor in predictors:
        normalized = predictor.lower()
        matched = sorted(
            term for term in LEAKAGE_TERMS if term.lower() in normalized
        )
        rows.append(
            {
                "predictor": predictor,
                "target_or_direct_proxy": bool(matched),
                "matched_leakage_terms": "; ".join(matched),
                "measured_after_outcome": "manual review required",
                "near_duplicate_outcome": bool(matched),
                "diagnosis_reveals_target": any(
                    token in normalized for token in ("diagnos", "diq010")
                ),
                "allowed": not matched,
            }
        )
    return pd.DataFrame(rows)


def build_wellpath_mapping(
    resolved_sources: dict[str, list[str]] | None = None,
) -> pd.DataFrame:
    """Build the requested public-data-to-WellPath mapping table."""
    resolved_sources = resolved_sources or {}
    rows = []
    for clean_name, spec in FEATURE_SPECS.items():
        if spec["group"] in {"target", "survey_design", "fairness_only"}:
            continue
        sources = resolved_sources.get(clean_name, [])
        rows.append(
            {
                "Public dataset variable": (
                    "; ".join(sources)
                    if sources
                    else "; ".join(spec["candidates"])
                ),
                "Clean feature name": clean_name,
                "Feature group": spec["group"],
                "Existing WellPath field": spec["wellpath_field"],
                "New survey field required": spec["new_survey_field_required"],
                "Used in model": bool(sources),
                "Missing from dataset": not bool(sources),
                "Interpretation limitation": spec["interpretation_limitation"],
            }
        )
    return pd.DataFrame(rows)
