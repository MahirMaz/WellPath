"""Reproducible, leakage-safe NHANES 2017-2018 monitoring-signal panel.

The outcomes are cross-sectional monitoring signals. They are not diagnoses,
causal estimates, or predictions of guaranteed future disease.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, ClassifierMixin
from sklearn.calibration import calibration_curve
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    balanced_accuracy_score,
    brier_score_loss,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from .data_loader import load_nhanes_directory, materialize_clean_features
from .expanded_analysis import (
    DEFAULT_AVAILABLE_CASE_MIN_PREDICTOR_FRACTION,
    DIET_BEHAVIORS,
    NUTRIENTS,
    RANDOM_STATE,
)
from .feature_mapping import FEATURE_SPECS
from .preprocessing import enforce_valid_ranges, replace_missing_codes


BOOTSTRAP_RESAMPLES = 1000
THRESHOLD = 0.50

BASE_OUTCOME_SPECS = {
    "elevated_hba1c": {
        "label": "Elevated HbA1c monitoring signal",
        "definition": "Adult age >=18 with measured HbA1c >=5.7%.",
        "threshold": "LBXGH >= 5.7%",
        "sources": ["LBXGH"],
        "source_file": "GHB_J.xpt",
        "units": "%",
        "codebook_url": "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/GHB_J.htm",
        "clinical_source": "https://www.cdc.gov/diabetes/basics/getting-tested.html",
        "direct_clean_fields": ["hba1c"],
    },
    "elevated_measured_blood_pressure_signal": {
        "label": "Elevated measured blood-pressure monitoring signal",
        "definition": (
            "Adult age >=18 with both averaged systolic and diastolic measures "
            "available; positive when mean valid systolic >=130 mmHg or mean "
            "valid diastolic >=80 mmHg. Measurement-only signal; it does not "
            "include history or antihypertensive medication."
        ),
        "threshold": "mean systolic >=130 mmHg OR mean diastolic >=80 mmHg",
        "sources": [
            "BPXSY1", "BPXSY2", "BPXSY3", "BPXSY4",
            "BPXDI1", "BPXDI2", "BPXDI3", "BPXDI4",
        ],
        "source_file": "BPX_J.xpt",
        "units": "mmHg",
        "codebook_url": "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/BPX_J.htm",
        "clinical_source": "https://www.cdc.gov/nchs/hus/sources-definitions/hypertension.htm",
        "direct_clean_fields": ["systolic_bp", "diastolic_bp"],
    },
    "low_hdl_signal": {
        "label": "Low HDL monitoring signal",
        "definition": (
            "Adult age >=18 with direct HDL measured; positive when HDL is "
            "<40 mg/dL for men or <50 mg/dL for women."
        ),
        "threshold": "LBDHDD <40 mg/dL for men; <50 mg/dL for women",
        "sources": ["LBDHDD", "RIAGENDR"],
        "source_file": "HDL_J.xpt; DEMO_J.xpt",
        "units": "mg/dL; NHANES sex category",
        "codebook_url": "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/HDL_J.htm",
        "clinical_source": "https://www.nhlbi.nih.gov/health/metabolic-syndrome/diagnosis",
        "direct_clean_fields": ["sex"],
    },
    "kidney_uacr_signal": {
        "label": "Kidney-health UACR monitoring signal",
        "definition": (
            "Adult age >=18 with measured urine albumin-to-creatinine ratio; "
            "positive when UACR >30 mg/g."
        ),
        "threshold": "URDACT >30 mg/g",
        "sources": ["URDACT"],
        "source_file": "ALB_CR_J.xpt",
        "units": "mg/g",
        "codebook_url": "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/ALB_CR_J.htm",
        "clinical_source": (
            "https://www.niddk.nih.gov/health-information/professionals/"
            "clinical-tools-patient-management/kidney-disease/"
            "identify-manage-patients/evaluate-ckd/assess-urine-albumin"
        ),
        "direct_clean_fields": [],
    },
}

OPTIONAL_OUTCOME_SPECS = {
    "high_triglycerides_signal": {
        "label": "High triglycerides monitoring signal",
        "definition": (
            "Adult age >=18 in the verified fasting triglyceride component; "
            "positive when triglycerides are >=150 mg/dL."
        ),
        "threshold": "LBXTR >=150 mg/dL",
        "sources": ["LBXTR"],
        "source_file": "TRIGLY_J.xpt",
        "units": "mg/dL",
        "codebook_url": "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/TRIGLY_J.htm",
        "clinical_source": "https://www.nhlbi.nih.gov/health/metabolic-syndrome/diagnosis",
        "direct_clean_fields": [],
    },
    "high_ldl_signal": {
        "label": "High LDL monitoring signal",
        "definition": (
            "Adult age >=18 with verified calculated LDL; positive when LDL is "
            ">=160 mg/dL. This target is enabled only when LBDLDL is present."
        ),
        "threshold": "LBDLDL >=160 mg/dL",
        "sources": ["LBDLDL"],
        "source_file": "TRIGLY_J.xpt",
        "units": "mg/dL",
        "codebook_url": "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/TRIGLY_J.htm",
        "clinical_source": "https://www.nhlbi.nih.gov/files/docs/resources/heart/atp3full.pdf",
        "direct_clean_fields": [],
    },
}
OUTCOME_SPECS = dict(BASE_OUTCOME_SPECS)

SOURCE_METADATA = {
    "LBXGH": ("GHB_J.xpt", "Glycohemoglobin (%)", "%"),
    "LBDHDD": ("HDL_J.xpt", "Direct HDL-Cholesterol (mg/dL)", "mg/dL"),
    "LBXTR": ("TRIGLY_J.xpt", "Triglyceride (mg/dL)", "mg/dL"),
    "LBDLDL": ("TRIGLY_J.xpt", "LDL-Cholesterol, Friedewald (mg/dL)", "mg/dL"),
    "URDACT": ("ALB_CR_J.xpt", "Albumin creatinine ratio (mg/g)", "mg/g"),
    "RIDAGEYR": ("DEMO_J.xpt", "Age in years at screening", "years"),
    "RIAGENDR": ("DEMO_J.xpt", "Gender", "NHANES category"),
    "INDFMPIR": ("DEMO_J.xpt", "Ratio of family income to poverty", "ratio"),
    "SLD012": ("SLQ_J.xpt", "Sleep hours - weekdays or workdays", "hours/night"),
    "BPXPLS": ("BPX_J.xpt", "60 sec. pulse (30 sec. pulse * 2)", "beats/minute"),
    "BMXBMI": ("BMX_J.xpt", "Body Mass Index (kg/m**2)", "kg/m²"),
    "BMXWT": ("BMX_J.xpt", "Weight (kg)", "kg"),
    "PAQ650": ("PAQ_J.xpt", "Vigorous recreational activities", "survey category"),
    "PAQ655": ("PAQ_J.xpt", "Days vigorous recreational activities", "days/week"),
    "PAD660": ("PAQ_J.xpt", "Minutes vigorous recreational activities", "minutes/day"),
    "PAQ665": ("PAQ_J.xpt", "Moderate recreational activities", "survey category"),
    "PAQ670": ("PAQ_J.xpt", "Days moderate recreational activities", "days/week"),
    "PAD675": ("PAQ_J.xpt", "Minutes moderate recreational activities", "minutes/day"),
    "PAD680": ("PAQ_J.xpt", "Minutes sedentary activity", "minutes/day"),
    "SMQ020": ("SMQ_J.xpt", "Smoked at least 100 cigarettes in life", "survey category"),
    "SMQ040": ("SMQ_J.xpt", "Do you now smoke cigarettes?", "survey category"),
    "FSDHH": ("FSQ_J.xpt", "Household food security category", "survey category"),
    "HUQ030": ("HUQ_J.xpt", "Routine place to go for healthcare", "survey category"),
}
for number, ordinal in [(1, "1st"), (2, "2nd"), (3, "3rd"), (4, "4th")]:
    SOURCE_METADATA[f"BPXSY{number}"] = (
        "BPX_J.xpt", f"Systolic: Blood pres ({ordinal} rdg) mm Hg", "mmHg"
    )
    SOURCE_METADATA[f"BPXDI{number}"] = (
        "BPX_J.xpt", f"Diastolic: Blood pres ({ordinal} rdg) mm Hg", "mmHg"
    )
for clean_name, (day1, day2, label) in NUTRIENTS.items():
    unit = label[label.find("(") + 1:label.find(")")] if "(" in label else ""
    SOURCE_METADATA[day1] = ("DR1TOT_J.xpt", label, unit)
    SOURCE_METADATA[day2] = ("DR2TOT_J.xpt", label, unit)

CLEAN_SOURCES = {
    "age": ["RIDAGEYR"],
    "sex": ["RIAGENDR"],
    "income_context": ["INDFMPIR"],
    "sleep_hours": ["SLD012"],
    "resting_heart_rate": ["BPXPLS"],
    "systolic_bp": ["BPXSY1", "BPXSY2", "BPXSY3"],
    "diastolic_bp": ["BPXDI1", "BPXDI2", "BPXDI3"],
    "bmi": ["BMXBMI"],
    "weight_kg": ["BMXWT"],
    "vigorous_recreational_minutes_week": ["PAQ650", "PAQ655", "PAD660"],
    "moderate_recreational_minutes_week": ["PAQ665", "PAQ670", "PAD675"],
    "total_recreational_activity_minutes_week": [
        "PAQ650", "PAQ655", "PAD660", "PAQ665", "PAQ670", "PAD675",
    ],
    "sedentary_minutes": ["PAD680"],
    "smoking_status": ["SMQ020", "SMQ040"],
    "food_security": ["FSDHH"],
    "healthcare_access": ["HUQ030"],
}
for clean_name, (day1, day2, _) in NUTRIENTS.items():
    CLEAN_SOURCES[clean_name] = [day1, day2]

WELLPATH_MAPPING = {
    "age": "age",
    "sex": "sex",
    "income_context": "income_context (optional; sensitive)",
    "sleep_hours": "sleep_hours",
    "resting_heart_rate": "resting_heart_rate",
    "systolic_bp": "systolic_bp",
    "diastolic_bp": "diastolic_bp",
    "bmi": "bmi",
    "weight_kg": "weight",
    "vigorous_recreational_minutes_week": (
        "weekly_vigorous_activity_minutes = verified days/week x minutes/active day"
    ),
    "moderate_recreational_minutes_week": (
        "weekly_moderate_activity_minutes = verified days/week x minutes/active day"
    ),
    "total_recreational_activity_minutes_week": (
        "weekly_recreational_activity_minutes = vigorous weekly minutes + moderate weekly minutes"
    ),
    "sedentary_minutes": "sedentary_minutes",
    "smoking_status": "survey.smoking_status (never/former/current)",
    "food_security": "survey.household_food_security_category",
    "healthcare_access": "survey.has_routine_healthcare_place",
    "diet_calories": "nutrition.average_calories",
    "diet_sodium_mg": "nutrition.average_sodium_mg",
    "diet_potassium_mg": "nutrition.average_potassium_mg",
    "diet_saturated_fat_g": "nutrition.average_saturated_fat_g",
    "diet_total_sugar_g": "nutrition.average_total_sugar_g",
    "diet_fiber_g": "nutrition.average_fibre_g",
}

CATEGORICAL = {"sex", "smoking_status", "food_security", "healthcare_access"}
ENGINEERED_UNITS = {
    "vigorous_recreational_minutes_week": "minutes/week",
    "moderate_recreational_minutes_week": "minutes/week",
    "total_recreational_activity_minutes_week": "minutes/week",
    "smoking_status": "0 never; 1 former; 2 current",
    "food_security": "1 full; 2 marginal; 3 low; 4 very low",
    "healthcare_access": "0 no routine place; 1 one or more routine places",
}
SOURCE_CLEANING_RULES = {
    "SMQ020": "7 Refused and 9 Don't know -> missing",
    "SMQ040": "7 Refused and 9 Don't know -> missing; structural skips resolved with SMQ020",
    "FSDHH": "Retain categories 1-4; all other or missing values -> missing",
    "HUQ030": "7 Refused and 9 Don't know -> missing; 1/3 -> access, 2 -> no routine place",
    "PAQ650": "7 Refused and 9 Don't know -> missing; verified No -> weekly minutes 0",
    "PAQ665": "7 Refused and 9 Don't know -> missing; verified No -> weekly minutes 0",
    "PAQ655": "77 Refused and 99 Don't know -> missing; valid range 1-7 days",
    "PAQ670": "77 Refused and 99 Don't know -> missing; valid range 1-7 days",
    "PAD660": "7777 Refused and 9999 Don't know -> missing; valid range 10-1439 minutes",
    "PAD675": "7777 Refused and 9999 Don't know -> missing; valid range 10-1439 minutes",
}
NUTRITION_FEATURES = [
    "diet_calories", "diet_sodium_mg", "diet_potassium_mg",
    "diet_saturated_fat_g", "diet_total_sugar_g", "diet_fiber_g",
]


def _save(frame: pd.DataFrame, path: Path) -> pd.DataFrame:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, index=False)
    return frame


def _json_value(value: Any) -> Any:
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return None if np.isnan(value) else float(value)
    if isinstance(value, np.ndarray):
        return value.tolist()
    raise TypeError(f"Cannot serialize {type(value)}")


def _id_hash(ids: np.ndarray) -> str:
    values = ",".join(str(int(x)) for x in np.sort(np.asarray(ids)))
    return hashlib.sha256(values.encode("utf-8")).hexdigest()


class ValidationCalibratedPipeline(ClassifierMixin, BaseEstimator):
    """Fitted sklearn pipeline plus a validation-fitted Platt calibrator."""

    def __init__(
        self,
        base_pipeline: Pipeline,
        calibrator: LogisticRegression,
        threshold: float,
    ):
        self.base_pipeline = base_pipeline
        self.calibrator = calibrator
        self.threshold = threshold
        self.classes_ = np.asarray([0, 1])

    @staticmethod
    def _logit(probability: np.ndarray) -> np.ndarray:
        clipped = np.clip(np.asarray(probability), 1e-6, 1 - 1e-6)
        return np.log(clipped / (1 - clipped)).reshape(-1, 1)

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        raw = self.base_pipeline.predict_proba(X)[:, 1]
        calibrated = self.calibrator.predict_proba(self._logit(raw))[:, 1]
        return np.column_stack([1 - calibrated, calibrated])

    def fit(self, X: pd.DataFrame, y: np.ndarray):
        """Return the already fitted validation-calibrated estimator unchanged."""
        return self

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return (self.predict_proba(X)[:, 1] >= self.threshold).astype(int)


def _fit_validation_calibrator(
    base_pipeline: Pipeline,
    X_validation: pd.DataFrame,
    y_validation: np.ndarray,
) -> tuple[ValidationCalibratedPipeline, dict[str, float]]:
    raw_probability = base_pipeline.predict_proba(X_validation)[:, 1]
    logit = ValidationCalibratedPipeline._logit(raw_probability)
    calibrator = LogisticRegression(C=1e6, solver="lbfgs", max_iter=2000)
    calibrator.fit(logit, y_validation)
    temporary = ValidationCalibratedPipeline(base_pipeline, calibrator, THRESHOLD)
    calibrated_probability = temporary.predict_proba(X_validation)[:, 1]
    thresholds = np.round(np.arange(0.05, 0.951, 0.01), 2)
    scores = [
        balanced_accuracy_score(y_validation, calibrated_probability >= threshold)
        for threshold in thresholds
    ]
    best_score = max(scores)
    best_thresholds = thresholds[np.isclose(scores, best_score)]
    threshold = float(best_thresholds[np.argmin(np.abs(best_thresholds - 0.5))])
    fitted = ValidationCalibratedPipeline(base_pipeline, calibrator, threshold)
    return fitted, {
        "method": "Platt logistic calibration on base-probability logit",
        "fit_partition": "validation",
        "coefficient": float(calibrator.coef_[0, 0]),
        "intercept": float(calibrator.intercept_[0]),
        "selected_threshold": threshold,
        "threshold_selection_metric": "validation balanced accuracy",
        "validation_balanced_accuracy_at_threshold": float(best_score),
    }


def _pipeline(features: list[str], estimator: Any) -> Pipeline:
    categorical = [name for name in features if name in CATEGORICAL]
    continuous = [name for name in features if name not in categorical]
    transformers = []
    if continuous:
        transformers.append((
            "continuous",
            Pipeline([
                ("imputer", SimpleImputer(strategy="median")),
                ("scale", StandardScaler()),
            ]),
            continuous,
        ))
    if categorical:
        transformers.append((
            "categorical",
            Pipeline([
                ("imputer", SimpleImputer(strategy="most_frequent")),
                ("one_hot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
            ]),
            categorical,
        ))
    return Pipeline([
        ("preprocess", ColumnTransformer(transformers)),
        ("model", estimator),
    ])


def _calibration_metrics(y: np.ndarray, probability: np.ndarray) -> dict[str, float]:
    bins = pd.DataFrame({"y": y, "p": probability})
    bins["bin"] = pd.qcut(bins["p"], q=10, duplicates="drop")
    grouped = bins.groupby("bin", observed=True).agg(
        count=("y", "size"), observed=("y", "mean"), predicted=("p", "mean")
    )
    if grouped.empty or grouped["count"].sum() == 0:
        ece = abs(float(np.mean(y)) - float(np.mean(probability)))
    else:
        ece = np.average(
            np.abs(grouped["observed"] - grouped["predicted"]),
            weights=grouped["count"],
        )
    return {
        "calibration_ece_10bin": float(ece),
        "mean_predicted_probability": float(np.mean(probability)),
        "observed_prevalence_test": float(np.mean(y)),
        "calibration_assessment_note": (
            "Descriptive final-test ECE only; no calibrator or calibration "
            "regression was fitted on the final test set."
        ),
    }


def _basic_metrics(
    y: np.ndarray,
    probability: np.ndarray,
    threshold: float = THRESHOLD,
) -> dict[str, float]:
    prediction = probability >= threshold
    return {
        "roc_auc": float(roc_auc_score(y, probability)),
        "pr_auc": float(average_precision_score(y, probability)),
        "recall": float(recall_score(y, prediction, zero_division=0)),
        "precision": float(precision_score(y, prediction, zero_division=0)),
        "f1": float(f1_score(y, prediction, zero_division=0)),
        "brier_score": float(brier_score_loss(y, probability)),
    }


def _metrics(
    y: np.ndarray,
    probability: np.ndarray,
    threshold: float = THRESHOLD,
) -> dict[str, float]:
    return {
        **_basic_metrics(y, probability, threshold),
        **_calibration_metrics(y, probability),
    }


def _bootstrap_metrics(
    y: np.ndarray,
    probability: np.ndarray,
    *,
    threshold: float = THRESHOLD,
    resamples: int = BOOTSTRAP_RESAMPLES,
    seed: int = RANDOM_STATE,
) -> dict[str, float]:
    rng = np.random.default_rng(seed)
    values = {key: [] for key in ["roc_auc", "pr_auc", "recall", "precision", "f1", "brier_score"]}
    for _ in range(resamples):
        index = rng.integers(0, len(y), len(y))
        sampled_y = y[index]
        if np.unique(sampled_y).size < 2:
            continue
        sampled_p = probability[index]
        result = _basic_metrics(sampled_y, sampled_p, threshold)
        for key in values:
            values[key].append(result[key])
    intervals = {}
    for key, observed in values.items():
        low, high = np.percentile(observed, [2.5, 97.5])
        intervals[f"{key}_ci_lower"] = float(low)
        intervals[f"{key}_ci_upper"] = float(high)
    intervals["bootstrap_resamples_requested"] = resamples
    intervals["bootstrap_resamples_valid"] = len(values["roc_auc"])
    return intervals


def _paired_delta_ci(
    y: np.ndarray,
    reference: np.ndarray,
    candidate: np.ndarray,
    *,
    resamples: int = BOOTSTRAP_RESAMPLES,
    seed: int = RANDOM_STATE,
) -> dict[str, float]:
    rng = np.random.default_rng(seed)
    roc, pr = [], []
    for _ in range(resamples):
        index = rng.integers(0, len(y), len(y))
        sampled_y = y[index]
        if np.unique(sampled_y).size < 2:
            continue
        roc.append(
            roc_auc_score(sampled_y, candidate[index])
            - roc_auc_score(sampled_y, reference[index])
        )
        pr.append(
            average_precision_score(sampled_y, candidate[index])
            - average_precision_score(sampled_y, reference[index])
        )
    roc_low, roc_high = np.percentile(roc, [2.5, 97.5])
    pr_low, pr_high = np.percentile(pr, [2.5, 97.5])
    return {
        "delta_roc_auc": float(roc_auc_score(y, candidate) - roc_auc_score(y, reference)),
        "delta_roc_auc_ci_lower": float(roc_low),
        "delta_roc_auc_ci_upper": float(roc_high),
        "delta_pr_auc": float(
            average_precision_score(y, candidate)
            - average_precision_score(y, reference)
        ),
        "delta_pr_auc_ci_lower": float(pr_low),
        "delta_pr_auc_ci_upper": float(pr_high),
        "bootstrap_resamples_requested": resamples,
        "bootstrap_resamples_valid": len(roc),
    }


def _configure_outcomes(raw: pd.DataFrame) -> tuple[dict[str, dict], pd.DataFrame]:
    """Enable optional outcomes only when every verified defining field exists."""
    active = dict(BASE_OUTCOME_SPECS)
    rows = []
    for outcome, spec in {**BASE_OUTCOME_SPECS, **OPTIONAL_OUTCOME_SPECS}.items():
        required_fields = list(spec["sources"])
        present_fields = [field for field in required_fields if field in raw.columns]
        required_files = sorted({
            SOURCE_METADATA[field][0] for field in required_fields
        })
        available = len(present_fields) == len(required_fields)
        if outcome in OPTIONAL_OUTCOME_SPECS and available:
            active[outcome] = spec
        rows.append({
            "component_or_outcome": outcome,
            "required_source_files": "; ".join(required_files),
            "required_fields": "; ".join(required_fields),
            "present_fields": "; ".join(present_fields),
            "available": available,
            "enabled_for_analysis": outcome in active and available,
            "status": (
                "available and enabled"
                if outcome in active and available
                else "missing local component or required field"
            ),
        })
    optional_predictors = {
        "smoking_status": ("SMQ_J.xpt", ["SMQ020", "SMQ040"]),
        "food_security": ("FSQ_J.xpt", ["FSDHH"]),
        "healthcare_access": ("HUQ_J.xpt", ["HUQ030"]),
    }
    for feature, (source_file, fields) in optional_predictors.items():
        present = [field for field in fields if field in raw.columns]
        rows.append({
            "component_or_outcome": feature,
            "required_source_files": source_file,
            "required_fields": "; ".join(fields),
            "present_fields": "; ".join(present),
            "available": len(present) == len(fields),
            "enabled_for_analysis": len(present) == len(fields),
            "status": (
                "available and engineered"
                if len(present) == len(fields)
                else "missing local component or required field"
            ),
        })
    OUTCOME_SPECS.clear()
    OUTCOME_SPECS.update(active)
    return active, pd.DataFrame(rows)


def _construct_outcomes(clean: pd.DataFrame, raw: pd.DataFrame) -> pd.DataFrame:
    result = clean.copy()
    raw_indexed = raw.set_index("SEQN")
    result = result.set_index("SEQN")

    hba1c = pd.to_numeric(raw_indexed.get("LBXGH"), errors="coerce")
    adult = result["age"].ge(18)
    result["elevated_hba1c"] = hba1c.ge(5.7).where(hba1c.notna() & adult).astype("Float64")

    systolic_columns = [f"BPXSY{x}" for x in range(1, 5) if f"BPXSY{x}" in raw_indexed]
    diastolic_columns = [f"BPXDI{x}" for x in range(1, 5) if f"BPXDI{x}" in raw_indexed]
    systolic = raw_indexed[systolic_columns].apply(pd.to_numeric, errors="coerce")
    diastolic = raw_indexed[diastolic_columns].apply(pd.to_numeric, errors="coerce")
    systolic = systolic.where(systolic.ge(60) & systolic.le(260))
    diastolic = diastolic.where(diastolic.ge(30) & diastolic.le(160))
    systolic_mean = systolic.mean(axis=1, skipna=True)
    diastolic_mean = diastolic.mean(axis=1, skipna=True)
    result["bp_systolic_outcome_mean"] = systolic_mean
    result["bp_diastolic_outcome_mean"] = diastolic_mean
    valid_bp = systolic_mean.notna() & diastolic_mean.notna()
    hypertension = (
        systolic_mean.ge(130) | diastolic_mean.ge(80)
    ).where(valid_bp)
    result["elevated_measured_blood_pressure_signal"] = hypertension.astype("Float64")

    hdl = pd.to_numeric(raw_indexed.get("LBDHDD"), errors="coerce")
    sex = pd.to_numeric(raw_indexed.get("RIAGENDR"), errors="coerce")
    valid_hdl = hdl.notna() & sex.isin([1, 2])
    low_hdl = ((sex.eq(1) & hdl.lt(40)) | (sex.eq(2) & hdl.lt(50))).where(valid_hdl)
    result["low_hdl_signal"] = low_hdl.astype("Float64")

    uacr = pd.to_numeric(raw_indexed.get("URDACT"), errors="coerce")
    result["kidney_uacr_signal"] = uacr.gt(30).where(uacr.notna()).astype("Float64")
    result["uacr_outcome_value"] = uacr
    if "high_triglycerides_signal" in OUTCOME_SPECS:
        triglycerides = pd.to_numeric(raw_indexed.get("LBXTR"), errors="coerce")
        result["high_triglycerides_signal"] = (
            triglycerides.ge(150).where(triglycerides.notna() & adult).astype("Float64")
        )
    if "high_ldl_signal" in OUTCOME_SPECS:
        ldl = pd.to_numeric(raw_indexed.get("LBDLDL"), errors="coerce")
        result["high_ldl_signal"] = (
            ldl.ge(160).where(ldl.notna() & adult).astype("Float64")
        )
    return result.reset_index()


def _engineer_panel_features(loaded) -> pd.DataFrame:
    """Engineer predictors for every participant without requiring HbA1c."""
    clean = materialize_clean_features(loaded.data, loaded.resolved_sources)
    clean = replace_missing_codes(clean)
    clean, _ = enforce_valid_ranges(clean)
    raw_indexed = loaded.data.set_index("SEQN")

    def numeric_source(column: str) -> pd.Series:
        if column in raw_indexed:
            return pd.to_numeric(raw_indexed[column], errors="coerce")
        return pd.Series(np.nan, index=raw_indexed.index, dtype=float)

    for clean_name, (day1, day2, _) in NUTRIENTS.items():
        if day1 not in raw_indexed and day2 not in raw_indexed:
            continue
        recalls = pd.concat(
            [numeric_source(day1).rename("day1"), numeric_source(day2).rename("day2")],
            axis=1,
        )
        clean[clean_name] = clean["SEQN"].map(recalls.mean(axis=1, skipna=True))
    for clean_name, (code, _) in DIET_BEHAVIORS.items():
        if code not in raw_indexed:
            continue
        values = pd.to_numeric(raw_indexed[code], errors="coerce")
        values = values.mask(values.abs() < 1e-60, 0)
        if code in {"DBD895", "DBD900"}:
            values = values.replace([5555, 7777, 9999], np.nan)
        elif code in {"DBD905", "DBD910"}:
            values = values.replace([6666, 7777, 9999], np.nan)
        else:
            values = values.replace([7, 9], np.nan)
        clean[clean_name] = clean["SEQN"].map(values)

    def weekly_activity(
        indicator_field: str,
        days_field: str,
        minutes_field: str,
    ) -> pd.Series:
        indicator = numeric_source(indicator_field).replace([7, 9], np.nan)
        days = numeric_source(days_field).replace([77, 99], np.nan)
        minutes = numeric_source(minutes_field).replace([7777, 9999], np.nan)
        days = days.where(days.between(1, 7))
        minutes = minutes.where(minutes.between(10, 1439))
        weekly = (days * minutes).where(indicator.eq(1))
        weekly = weekly.mask(indicator.eq(2), 0.0)
        return weekly

    vigorous_weekly = weekly_activity("PAQ650", "PAQ655", "PAD660")
    moderate_weekly = weekly_activity("PAQ665", "PAQ670", "PAD675")
    if {"PAQ650", "PAQ655", "PAD660"}.issubset(raw_indexed.columns):
        clean["vigorous_recreational_minutes_week"] = clean["SEQN"].map(vigorous_weekly)
    if {"PAQ665", "PAQ670", "PAD675"}.issubset(raw_indexed.columns):
        clean["moderate_recreational_minutes_week"] = clean["SEQN"].map(moderate_weekly)
    if (
        "vigorous_recreational_minutes_week" in clean
        and "moderate_recreational_minutes_week" in clean
    ):
        activity = pd.concat(
            [
                vigorous_weekly.rename("vigorous"),
                moderate_weekly.rename("moderate"),
            ],
            axis=1,
        )
        clean["total_recreational_activity_minutes_week"] = clean["SEQN"].map(
            activity.sum(axis=1, min_count=2)
        )

    if {"SMQ020", "SMQ040"}.issubset(raw_indexed.columns):
        ever = numeric_source("SMQ020").replace([7, 9], np.nan)
        current = numeric_source("SMQ040").replace([7, 9], np.nan)
        smoking = pd.Series(np.nan, index=raw_indexed.index, dtype=float)
        smoking = smoking.mask(ever.eq(2), 0.0)
        smoking = smoking.mask(ever.eq(1) & current.eq(3), 1.0)
        smoking = smoking.mask(ever.eq(1) & current.isin([1, 2]), 2.0)
        clean["smoking_status"] = clean["SEQN"].map(smoking)
    if "FSDHH" in raw_indexed.columns:
        food_security = numeric_source("FSDHH")
        food_security = food_security.where(food_security.isin([1, 2, 3, 4]))
        clean["food_security"] = clean["SEQN"].map(food_security)
    if "HUQ030" in raw_indexed.columns:
        routine_place = numeric_source("HUQ030").replace([7, 9], np.nan)
        healthcare_access = routine_place.map({1.0: 1.0, 2.0: 0.0, 3.0: 1.0})
        clean["healthcare_access"] = clean["SEQN"].map(healthcare_access)
    clean = clean.reset_index(drop=True)
    if clean["SEQN"].duplicated().any():
        raise AssertionError("Panel feature table is not one row per participant.")
    return clean


def _feature_groups(data: pd.DataFrame, outcome: str) -> dict[str, list[str]]:
    baseline = [name for name in ["age", "bmi"] if name in data]
    core = [
        name for name in [
            "sleep_hours", "resting_heart_rate", "systolic_bp", "diastolic_bp",
            "bmi", "weight_kg", "vigorous_recreational_minutes_week",
            "moderate_recreational_minutes_week",
            "sedentary_minutes",
        ] if name in data
    ]
    demographics = [name for name in ["age", "sex", "income_context"] if name in data]
    nutrition = [name for name in NUTRITION_FEATURES if name in data]
    social = [
        name for name in ["smoking_status", "food_security", "healthcare_access"]
        if name in data
    ]
    forbidden = set(OUTCOME_SPECS[outcome]["direct_clean_fields"])
    if outcome == "elevated_measured_blood_pressure_signal":
        forbidden.update({"systolic_bp", "diastolic_bp"})
    groups = {
        "simple_baseline": [name for name in baseline if name not in forbidden],
        "core_kpis": [name for name in core if name not in forbidden],
        "demographics_context": [name for name in demographics if name not in forbidden],
        "nutrition": [name for name in nutrition if name not in forbidden],
        "behaviour_social_context": [name for name in social if name not in forbidden],
    }
    groups["full"] = list(dict.fromkeys(
        groups["simple_baseline"]
        + groups["core_kpis"]
        + groups["demographics_context"]
        + groups["nutrition"]
        + groups["behaviour_social_context"]
    ))
    return groups


def _variable_discovery(
    data: pd.DataFrame,
    raw: pd.DataFrame,
    groups_by_outcome: dict[str, dict[str, list[str]]],
) -> pd.DataFrame:
    rows = []
    raw_columns = set(raw.columns)
    for outcome, spec in OPTIONAL_OUTCOME_SPECS.items():
        if outcome in OUTCOME_SPECS:
            continue
        for source in spec["sources"]:
            file_name, label, unit = SOURCE_METADATA[source]
            rows.append({
                "outcome": outcome,
                "role": "optional outcome unavailable",
                "predictor_group": "",
                "engineered_field": outcome,
                "source_file": file_name,
                "source_field": source,
                "source_label": label,
                "units": unit,
                "missing_code_cleaning": SOURCE_CLEANING_RULES.get(
                    source, "NHANES system missing retained as missing"
                ),
                "source_missing_percent": 100.0,
                "engineered_missing_percent": 100.0,
                "proposed_use": (
                    f"{spec['definition']} Not enabled because the verified "
                    "local defining field is absent."
                ),
                "available": False,
                "codebook_url": spec["codebook_url"],
            })
    for outcome, spec in OUTCOME_SPECS.items():
        for source in spec["sources"]:
            file_name, label, unit = SOURCE_METADATA[source]
            rows.append({
                "outcome": outcome,
                "role": "outcome definition",
                "predictor_group": "",
                "engineered_field": outcome,
                "source_file": file_name,
                "source_field": source,
                "source_label": label,
                "units": unit,
                "missing_code_cleaning": SOURCE_CLEANING_RULES.get(
                    source, "NHANES system missing retained as missing"
                ),
                "source_missing_percent": (
                    float(pd.to_numeric(raw[source], errors="coerce").isna().mean() * 100)
                    if source in raw_columns else 100.0
                ),
                "engineered_missing_percent": float(data[outcome].isna().mean() * 100),
                "proposed_use": spec["definition"],
                "available": source in raw_columns,
                "codebook_url": spec["codebook_url"],
            })
        groups = groups_by_outcome[outcome]
        for group, features in groups.items():
            if group == "full":
                continue
            for feature in features:
                for source in CLEAN_SOURCES.get(feature, []):
                    file_name, label, unit = SOURCE_METADATA[source]
                    rows.append({
                        "outcome": outcome,
                        "role": "predictor",
                        "predictor_group": group,
                        "engineered_field": feature,
                        "source_file": file_name,
                        "source_field": source,
                        "source_label": label,
                        "units": unit,
                        "missing_code_cleaning": SOURCE_CLEANING_RULES.get(
                            source, "NHANES system missing retained as missing"
                        ),
                        "source_missing_percent": (
                            float(pd.to_numeric(raw[source], errors="coerce").isna().mean() * 100)
                            if source in raw_columns else 100.0
                        ),
                        "engineered_missing_percent": float(data[feature].isna().mean() * 100),
                        "proposed_use": (
                            "Average valid Day 1 and Day 2 values; one valid day is retained."
                            if feature.startswith("diet_")
                            else (
                                "Verified NHANES days/week multiplied by minutes/"
                                "active day; verified no activity is coded zero."
                            )
                            if feature.endswith("_recreational_minutes_week")
                            else f"{group} predictor"
                        ),
                        "available": source in raw_columns,
                        "codebook_url": (
                            "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/"
                            f"{file_name.removesuffix('.xpt')}.htm"
                        ),
                    })
        for feature in ["smoking_status", "food_security", "healthcare_access"]:
            if feature in data:
                continue
            for source in CLEAN_SOURCES[feature]:
                file_name, label, unit = SOURCE_METADATA[source]
                rows.append({
                    "outcome": outcome,
                    "role": "candidate predictor unavailable",
                    "predictor_group": "behaviour_social_context",
                    "engineered_field": feature,
                    "source_file": file_name,
                    "source_field": source,
                    "source_label": label,
                    "units": unit,
                    "missing_code_cleaning": SOURCE_CLEANING_RULES.get(
                        source, "NHANES system missing retained as missing"
                    ),
                    "source_missing_percent": 100.0,
                    "engineered_missing_percent": 100.0,
                    "proposed_use": (
                        "Engineer when every required local source field exists; "
                        "configured missing/refused/don't-know codes become missing."
                    ),
                    "available": False,
                    "codebook_url": (
                        "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/"
                        f"{file_name.removesuffix('.xpt')}.htm"
                    ),
                })
    return pd.DataFrame(rows).drop_duplicates()


def _leakage_audit(
    groups_by_outcome: dict[str, dict[str, list[str]]],
) -> pd.DataFrame:
    rows = []
    for outcome, groups in groups_by_outcome.items():
        forbidden = set(OUTCOME_SPECS[outcome]["direct_clean_fields"])
        if outcome == "elevated_measured_blood_pressure_signal":
            forbidden.update({"systolic_bp", "diastolic_bp"})
        source_forbidden = set(OUTCOME_SPECS[outcome]["sources"])
        for feature in groups["full"]:
            source_overlap = source_forbidden.intersection(CLEAN_SOURCES.get(feature, []))
            direct = feature in forbidden or bool(source_overlap)
            rows.append({
                "outcome": outcome,
                "predictor": feature,
                "source_variables": "; ".join(CLEAN_SOURCES.get(feature, [])),
                "forbidden_clean_field_match": feature in forbidden,
                "outcome_source_overlap": "; ".join(sorted(source_overlap)),
                "allowed": not direct,
                "review_note": "Passed leakage audit" if not direct else "Direct target definition leakage",
            })
    result = pd.DataFrame(rows)
    if not result["allowed"].all():
        raise AssertionError("Target leakage audit failed.")
    return result


def _model_estimators() -> dict[str, Any]:
    return {
        "Dummy classifier": DummyClassifier(strategy="prior", random_state=RANDOM_STATE),
        "Age-and-BMI baseline": LogisticRegression(
            solver="liblinear", class_weight="balanced", max_iter=3000,
            random_state=RANDOM_STATE,
        ),
        "Logistic regression": LogisticRegression(
            solver="liblinear", class_weight="balanced", max_iter=3000,
            random_state=RANDOM_STATE,
        ),
        "Random forest": RandomForestClassifier(
            n_estimators=400, min_samples_leaf=5, class_weight="balanced_subsample",
            n_jobs=-1, random_state=RANDOM_STATE,
        ),
        "Gradient boosting": GradientBoostingClassifier(
            n_estimators=150, learning_rate=0.05, max_depth=2,
            random_state=RANDOM_STATE,
        ),
    }


def _fit_panel(
    data: pd.DataFrame,
    groups_by_outcome: dict[str, dict[str, list[str]]],
    model_dir: Path,
    *,
    min_predictor_fraction: float,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, dict, list[dict]]:
    comparison_rows, sample_rows, selection_rows = [], [], []
    stored, integrity_rows = {}, []
    model_dir.mkdir(parents=True, exist_ok=True)
    for outcome, groups in groups_by_outcome.items():
        all_features = groups["full"]
        adult = data["age"].ge(18)
        outcome_available = data[outcome].notna()
        enough_predictors = data[all_features].notna().mean(axis=1).ge(min_predictor_fraction)
        cohort_mask = adult & outcome_available & enough_predictors
        indices = np.flatnonzero(cohort_mask.to_numpy())
        y_all = data.loc[cohort_mask, outcome].astype(int).to_numpy()
        if len(indices) < 200 or np.unique(y_all).size < 2:
            raise AssertionError(f"Insufficient eligible sample for {outcome}.")
        development_local, test_local = train_test_split(
            np.arange(len(indices)), test_size=0.20, stratify=y_all,
            random_state=RANDOM_STATE,
        )
        train_local, validation_local = train_test_split(
            development_local,
            test_size=0.25,
            stratify=y_all[development_local],
            random_state=RANDOM_STATE,
        )
        train_idx = indices[train_local]
        validation_idx = indices[validation_local]
        test_idx = indices[test_local]
        train_ids = data.iloc[train_idx]["SEQN"].astype(int).to_numpy()
        validation_ids = data.iloc[validation_idx]["SEQN"].astype(int).to_numpy()
        test_ids = data.iloc[test_idx]["SEQN"].astype(int).to_numpy()
        assert not set(train_ids).intersection(test_ids)
        assert not set(train_ids).intersection(validation_ids)
        assert not set(validation_ids).intersection(test_ids)
        sample_rows.append({
            "outcome": outcome,
            "outcome_label": OUTCOME_SPECS[outcome]["label"],
            "total_joined_participants": len(data),
            "adult_participants": int(adult.sum()),
            "outcome_available_participants": int((adult & outcome_available).sum()),
            "analysis_participants": len(indices),
            "positive_cases": int(y_all.sum()),
            "prevalence": float(y_all.mean()),
            "training_participants": len(train_idx),
            "validation_participants": len(validation_idx),
            "test_participants": len(test_idx),
            "minimum_predictor_availability_fraction": min_predictor_fraction,
            "required_nonmissing_predictor_count": int(np.ceil(len(all_features) * min_predictor_fraction)),
            "full_predictor_count": len(all_features),
            "training_id_hash": _id_hash(train_ids),
            "validation_id_hash": _id_hash(validation_ids),
            "test_id_hash": _id_hash(test_ids),
            "outcome_definition": OUTCOME_SPECS[outcome]["definition"],
        })

        fitted_records = {}
        for model_name, estimator in _model_estimators().items():
            features = (
                groups["simple_baseline"]
                if model_name == "Age-and-BMI baseline"
                else groups["full"]
            )
            pipeline = _pipeline(features, estimator)
            pipeline.fit(data.iloc[train_idx][features], data.iloc[train_idx][outcome].astype(int))
            validation_probability = pipeline.predict_proba(
                data.iloc[validation_idx][features]
            )[:, 1]
            test_probability = pipeline.predict_proba(
                data.iloc[test_idx][features]
            )[:, 1]
            fitted_records[model_name] = {
                "pipeline": pipeline,
                "features": features,
                "validation_probability": validation_probability,
                "test_probability": test_probability,
            }

        y_validation = data.iloc[validation_idx][outcome].astype(int).to_numpy()
        y_test = data.iloc[test_idx][outcome].astype(int).to_numpy()
        selectable = ["Logistic regression", "Random forest", "Gradient boosting"]
        selected_name = max(
            selectable,
            key=lambda name: roc_auc_score(
                y_validation, fitted_records[name]["validation_probability"]
            ),
        )
        selected_record = fitted_records[selected_name]
        calibrated_pipeline, calibration_metadata = _fit_validation_calibrator(
            selected_record["pipeline"],
            data.iloc[validation_idx][selected_record["features"]],
            y_validation,
        )
        calibrated_validation_probability = calibrated_pipeline.predict_proba(
            data.iloc[validation_idx][selected_record["features"]]
        )[:, 1]
        calibrated_test_probability = calibrated_pipeline.predict_proba(
            data.iloc[test_idx][selected_record["features"]]
        )[:, 1]

        selected_metadata = None
        for model_name, record in fitted_records.items():
            selected = model_name == selected_name
            final_model = calibrated_pipeline if selected else record["pipeline"]
            probability = (
                calibrated_test_probability if selected else record["test_probability"]
            )
            threshold = (
                calibration_metadata["selected_threshold"] if selected else THRESHOLD
            )
            performance = {
                **_metrics(y_test, probability, threshold),
                **_bootstrap_metrics(
                    y_test,
                    probability,
                    threshold=threshold,
                    seed=RANDOM_STATE + len(comparison_rows),
                ),
            }
            validation_roc_auc = float(
                roc_auc_score(y_validation, record["validation_probability"])
            )
            validation_pr_auc = float(
                average_precision_score(y_validation, record["validation_probability"])
            )
            row = {
                "outcome": outcome,
                "outcome_label": OUTCOME_SPECS[outcome]["label"],
                "model": model_name,
                "predictor_set": "age_and_bmi" if model_name == "Age-and-BMI baseline" else "full",
                "predictor_count": len(record["features"]),
                "predictors": "; ".join(record["features"]),
                "analysis_participants": len(indices),
                "training_participants": len(train_idx),
                "validation_participants": len(validation_idx),
                "test_participants": len(test_idx),
                "positive_test_cases": int(y_test.sum()),
                "validation_roc_auc_for_selection": validation_roc_auc,
                "validation_pr_auc_for_selection": validation_pr_auc,
                "eligible_for_model_selection": model_name in selectable,
                "selected_on_validation": selected,
                "calibrated_using_validation": selected,
                "classification_threshold": threshold,
                "classification_threshold_source": (
                    "validation balanced-accuracy selection"
                    if selected else "fixed 0.50 for non-selected comparator"
                ),
                "final_performance_partition": "untouched test",
                **performance,
            }
            comparison_rows.append(row)
            selection_rows.append({
                "outcome": outcome,
                "model": model_name,
                "eligible_for_selection": model_name in selectable,
                "validation_roc_auc": validation_roc_auc,
                "validation_pr_auc": validation_pr_auc,
                "selected": selected,
                "selection_rule": (
                    "highest validation ROC AUC among logistic regression, "
                    "random forest, and gradient boosting"
                ),
                "training_participants": len(train_idx),
                "validation_participants": len(validation_idx),
                "final_test_participants_not_used": len(test_idx),
            })
            slug = (
                model_name.lower().replace(" ", "_").replace("-", "_")
                .replace("/", "_")
            )
            model_path = model_dir / f"multicondition_{outcome}_{slug}.joblib"
            joblib.dump(final_model, model_path)
            metadata = {
                "status": "research_prototype",
                "safety": (
                    "Cross-sectional monitoring/risk signal only; not a diagnosis, "
                    "causal estimate, or guaranteed future outcome."
                ),
                "outcome": outcome,
                "outcome_label": OUTCOME_SPECS[outcome]["label"],
                "outcome_definition": OUTCOME_SPECS[outcome]["definition"],
                "thresholds": OUTCOME_SPECS[outcome]["threshold"],
                "outcome_source_variables": OUTCOME_SPECS[outcome]["sources"],
                "outcome_units": OUTCOME_SPECS[outcome]["units"],
                "predictor_names": record["features"],
                "source_variables": {
                    feature: CLEAN_SOURCES.get(feature, []) for feature in record["features"]
                },
                "units": {
                    feature: (
                        ENGINEERED_UNITS.get(feature)
                        or FEATURE_SPECS.get(feature, {}).get("unit")
                        or SOURCE_METADATA[CLEAN_SOURCES[feature][0]][2]
                    )
                    for feature in record["features"]
                },
                "training_sample": len(train_idx),
                "validation_sample": len(validation_idx),
                "test_sample": len(test_idx),
                "training_participant_id_hash": _id_hash(train_ids),
                "validation_participant_id_hash": _id_hash(validation_ids),
                "test_participant_id_hash": _id_hash(test_ids),
                "performance": performance,
                "model_selection": {
                    "selected_on_validation": selected,
                    "validation_roc_auc": validation_roc_auc,
                    "eligible_models": selectable,
                    "final_test_used_for_selection": False,
                },
                "probability_calibration": (
                    calibration_metadata
                    if selected
                    else {
                        "method": "none",
                        "reason": "non-selected comparator",
                        "final_test_used_for_calibration": False,
                    }
                ),
                "missing_data_rules": {
                    "cohort_minimum_predictor_availability_fraction": min_predictor_fraction,
                    "continuous_imputation": "training-set median",
                    "categorical_imputation": "training-set most frequent",
                    "diet": (
                        "Average valid Day 1 and Day 2 recalls; one valid day retained; "
                        "missing Day 2 is never treated as zero."
                    ),
                },
                "preprocessing": (
                    "Base preprocessing and estimator fitted on training participants "
                    "only. For the selected model, the probability calibrator and "
                    "classification threshold were fitted/selected on validation "
                    "participants only. The final test set was untouched until final reporting."
                ),
                "known_limitations": [
                    "Single-cycle cross-sectional NHANES analysis.",
                    "Unweighted predictive evaluation is not a prevalence estimate.",
                    "Self-reported behaviours and dietary recalls have measurement error.",
                    "External validation and prospective clinical validation are absent.",
                    "A positive signal requires appropriate clinical follow-up and confirmation.",
                ],
                "wellpath_field_mapping": {
                    feature: WELLPATH_MAPPING.get(feature, "") for feature in record["features"]
                },
                "codebook_url": OUTCOME_SPECS[outcome]["codebook_url"],
                "clinical_threshold_source": OUTCOME_SPECS[outcome]["clinical_source"],
            }
            metadata_path = model_path.with_suffix(".metadata.json")
            metadata_path.write_text(
                json.dumps(metadata, indent=2, default=_json_value), encoding="utf-8"
            )
            if selected:
                selected_metadata = metadata
            stored[(outcome, model_name)] = {
                "pipeline": final_model,
                "base_pipeline": record["pipeline"],
                "features": record["features"],
                "train_idx": train_idx,
                "validation_idx": validation_idx,
                "test_idx": test_idx,
                "train_ids": train_ids,
                "validation_ids": validation_ids,
                "test_ids": test_ids,
                "y_validation": y_validation,
                "y_test": y_test,
                "probability_validation": record["validation_probability"],
                "probability_test": probability,
                "selected": selected,
            }
            integrity_rows.append({
                "audit_type": "model",
                "outcome": outcome,
                "comparison": model_name,
                "training_only_preprocessing": True,
                "untouched_held_out_test_set": True,
                "participant_level_split": True,
                "stratified_split": True,
                "same_training_participants_as_full_model": True,
                "same_validation_participants_as_full_model": True,
                "same_test_participants_as_full_model": True,
                "train_test_disjoint": not bool(set(train_ids).intersection(test_ids)),
                "leakage_audit_passed": True,
                "final_test_used_for_selection": False,
                "final_test_used_for_calibration": False,
                "training_participants": len(train_idx),
                "validation_participants": len(validation_idx),
                "test_participants": len(test_idx),
            })
        selected_path = model_dir / f"multicondition_{outcome}_selected_calibrated.joblib"
        joblib.dump(calibrated_pipeline, selected_path)
        selected_metadata_path = selected_path.with_suffix(".metadata.json")
        selected_metadata_path.write_text(
            json.dumps(selected_metadata, indent=2, default=_json_value),
            encoding="utf-8",
        )
        stored[(outcome, "Selected calibrated")] = {
            "pipeline": calibrated_pipeline,
            "features": selected_record["features"],
            "selected_model_name": selected_name,
            "calibration_metadata": calibration_metadata,
            "train_idx": train_idx,
            "validation_idx": validation_idx,
            "test_idx": test_idx,
            "train_ids": train_ids,
            "validation_ids": validation_ids,
            "test_ids": test_ids,
            "y_validation": y_validation,
            "y_test": y_test,
            "probability_validation": calibrated_validation_probability,
            "probability_test": calibrated_test_probability,
            "threshold": calibration_metadata["selected_threshold"],
        }
    return (
        pd.DataFrame(comparison_rows),
        pd.DataFrame(sample_rows),
        pd.DataFrame(selection_rows),
        stored,
        integrity_rows,
    )


def _incremental_analysis(
    data: pd.DataFrame,
    groups_by_outcome: dict[str, dict[str, list[str]]],
    stored: dict,
    integrity_rows: list[dict],
) -> pd.DataFrame:
    rows = []
    for outcome, groups in groups_by_outcome.items():
        base = stored[(outcome, "Logistic regression")]
        train_idx = np.asarray(base["train_idx"])
        validation_idx = np.asarray(base["validation_idx"])
        test_idx = np.asarray(base["test_idx"])
        y_validation = base["y_validation"]
        base_features = list(dict.fromkeys(groups["simple_baseline"] + groups["core_kpis"]))
        candidates = {
            "Reference: baseline + core KPIs": base_features,
            "Add demographics/context": list(dict.fromkeys(base_features + groups["demographics_context"])),
            "Add nutrition": list(dict.fromkeys(base_features + groups["nutrition"])),
            "Add behaviour/social context": list(dict.fromkeys(base_features + groups["behaviour_social_context"])),
            "All groups together": groups["full"],
        }
        probabilities = {}
        for comparison, features in candidates.items():
            if comparison == "Add behaviour/social context" and not groups["behaviour_social_context"]:
                rows.append({
                    "outcome": outcome,
                    "comparison": comparison,
                    "status": "not evaluated - required local source files absent",
                    "reference_predictors": "; ".join(base_features),
                    "candidate_predictors": "",
                    "training_participants": len(train_idx),
                    "validation_participants": len(validation_idx),
                    "test_participants": len(test_idx),
                    "same_training_participants_as_full_model": True,
                    "same_validation_participants_as_full_model": True,
                    "same_test_participants_as_full_model": True,
                    "final_test_accessed": False,
                })
                continue
            model = _pipeline(features, LogisticRegression(
                solver="liblinear", class_weight="balanced", max_iter=3000,
                random_state=RANDOM_STATE,
            ))
            model.fit(data.iloc[train_idx][features], data.iloc[train_idx][outcome].astype(int))
            probabilities[comparison] = model.predict_proba(
                data.iloc[validation_idx][features]
            )[:, 1]
        reference = probabilities["Reference: baseline + core KPIs"]
        for comparison, probability in probabilities.items():
            delta = (
                {
                    "delta_roc_auc": 0.0,
                    "delta_roc_auc_ci_lower": 0.0,
                    "delta_roc_auc_ci_upper": 0.0,
                    "delta_pr_auc": 0.0,
                    "delta_pr_auc_ci_lower": 0.0,
                    "delta_pr_auc_ci_upper": 0.0,
                    "bootstrap_resamples_requested": BOOTSTRAP_RESAMPLES,
                    "bootstrap_resamples_valid": BOOTSTRAP_RESAMPLES,
                }
                if comparison.startswith("Reference:")
                else _paired_delta_ci(
                    y_validation, reference, probability,
                    seed=RANDOM_STATE + len(rows),
                )
            )
            clear = (
                delta["delta_roc_auc_ci_lower"] > 0
                or delta["delta_roc_auc_ci_upper"] < 0
            ) if not comparison.startswith("Reference:") else False
            rows.append({
                "outcome": outcome,
                "comparison": comparison,
                "status": "evaluated",
                "reference_predictors": "; ".join(base_features),
                "candidate_predictors": "; ".join(candidates[comparison]),
                "comparison_partition": "validation",
                "reference_roc_auc": float(roc_auc_score(y_validation, reference)),
                "candidate_roc_auc": float(roc_auc_score(y_validation, probability)),
                "clear_predictive_value_by_roc_ci": clear,
                "interpretation": (
                    "Clear positive incremental value"
                    if clear and delta["delta_roc_auc"] > 0
                    else "Clear negative change"
                    if clear
                    else "No clear ROC AUC change"
                ),
                "training_participants": len(train_idx),
                "validation_participants": len(validation_idx),
                "test_participants": len(test_idx),
                "same_training_participants_as_full_model": True,
                "same_validation_participants_as_full_model": True,
                "same_test_participants_as_full_model": True,
                "final_test_accessed": False,
                **delta,
            })
            integrity_rows.append({
                "audit_type": "incremental comparison",
                "outcome": outcome,
                "comparison": comparison,
                "training_only_preprocessing": True,
                "untouched_held_out_test_set": True,
                "participant_level_split": True,
                "stratified_split": True,
                "same_training_participants_as_full_model": True,
                "same_validation_participants_as_full_model": True,
                "same_test_participants_as_full_model": True,
                "train_test_disjoint": True,
                "leakage_audit_passed": True,
                "final_test_used_for_selection": False,
                "final_test_used_for_calibration": False,
                "training_participants": len(train_idx),
                "validation_participants": len(validation_idx),
                "test_participants": len(test_idx),
            })
    result = pd.DataFrame(rows)
    assert result["same_training_participants_as_full_model"].all()
    assert result["same_validation_participants_as_full_model"].all()
    assert result["same_test_participants_as_full_model"].all()
    return result


def _ablation_analysis(
    data: pd.DataFrame,
    groups_by_outcome: dict[str, dict[str, list[str]]],
    stored: dict,
    integrity_rows: list[dict],
) -> pd.DataFrame:
    rows = []
    for outcome, groups in groups_by_outcome.items():
        base = stored[(outcome, "Logistic regression")]
        train_idx = np.asarray(base["train_idx"])
        validation_idx = np.asarray(base["validation_idx"])
        test_idx = np.asarray(base["test_idx"])
        full_features = groups["full"]
        reference = base["probability_validation"]
        y_validation = base["y_validation"]
        removals = {
            "Remove demographics": groups["demographics_context"],
            "Remove core KPIs": groups["core_kpis"],
            "Remove nutrition": groups["nutrition"],
            "Remove smoking/social context": groups["behaviour_social_context"],
            "Remove BMI/body measurements": [
                name for name in ["bmi", "weight_kg"] if name in full_features
            ],
        }
        for comparison, removed in removals.items():
            reduced = [name for name in full_features if name not in removed]
            if not removed:
                rows.append({
                    "outcome": outcome,
                    "comparison": comparison,
                    "status": "not evaluated - group unavailable",
                    "removed_predictors": "",
                    "remaining_predictors": "; ".join(reduced),
                    "training_participants": len(train_idx),
                    "validation_participants": len(validation_idx),
                    "test_participants": len(test_idx),
                    "same_training_participants_as_full_model": True,
                    "same_validation_participants_as_full_model": True,
                    "same_test_participants_as_full_model": True,
                    "final_test_accessed": False,
                })
                continue
            model = _pipeline(reduced, LogisticRegression(
                solver="liblinear", class_weight="balanced", max_iter=3000,
                random_state=RANDOM_STATE,
            ))
            model.fit(data.iloc[train_idx][reduced], data.iloc[train_idx][outcome].astype(int))
            probability = model.predict_proba(
                data.iloc[validation_idx][reduced]
            )[:, 1]
            delta = _paired_delta_ci(
                y_validation, reference, probability,
                seed=RANDOM_STATE + len(rows),
            )
            same_train = np.array_equal(train_idx, base["train_idx"])
            same_validation = np.array_equal(validation_idx, base["validation_idx"])
            same_test = np.array_equal(test_idx, base["test_idx"])
            rows.append({
                "outcome": outcome,
                "comparison": comparison,
                "status": "evaluated",
                "removed_predictors": "; ".join(removed),
                "remaining_predictors": "; ".join(reduced),
                "comparison_partition": "validation",
                "full_model_roc_auc": float(roc_auc_score(y_validation, reference)),
                "reduced_model_roc_auc": float(roc_auc_score(y_validation, probability)),
                "training_participants": len(train_idx),
                "validation_participants": len(validation_idx),
                "test_participants": len(test_idx),
                "same_training_participants_as_full_model": same_train,
                "same_validation_participants_as_full_model": same_validation,
                "same_test_participants_as_full_model": same_test,
                "final_test_accessed": False,
                **delta,
            })
            integrity_rows.append({
                "audit_type": "ablation comparison",
                "outcome": outcome,
                "comparison": comparison,
                "training_only_preprocessing": True,
                "untouched_held_out_test_set": True,
                "participant_level_split": True,
                "stratified_split": True,
                "same_training_participants_as_full_model": same_train,
                "same_validation_participants_as_full_model": same_validation,
                "same_test_participants_as_full_model": same_test,
                "train_test_disjoint": True,
                "leakage_audit_passed": True,
                "final_test_used_for_selection": False,
                "final_test_used_for_calibration": False,
                "training_participants": len(train_idx),
                "validation_participants": len(validation_idx),
                "test_participants": len(test_idx),
            })
    result = pd.DataFrame(rows)
    assert result["same_training_participants_as_full_model"].all()
    assert result["same_validation_participants_as_full_model"].all()
    assert result["same_test_participants_as_full_model"].all()
    return result


def _model_explanations(
    data: pd.DataFrame,
    stored: dict,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Create validation global importance and test-record local sensitivities."""
    global_rows, participant_rows = [], []
    for outcome in OUTCOME_SPECS:
        selected = stored[(outcome, "Selected calibrated")]
        model = selected["pipeline"]
        features = selected["features"]
        validation_idx = selected["validation_idx"]
        test_idx = selected["test_idx"]
        X_validation = data.iloc[validation_idx][features]
        y_validation = selected["y_validation"]
        importance = permutation_importance(
            model,
            X_validation,
            y_validation,
            scoring="roc_auc",
            n_repeats=10,
            random_state=RANDOM_STATE,
            n_jobs=1,
        )
        order = np.argsort(importance.importances_mean)[::-1]
        for rank, position in enumerate(order, start=1):
            feature = features[position]
            global_rows.append({
                "outcome": outcome,
                "selected_model": selected["selected_model_name"],
                "feature": feature,
                "source_variables": "; ".join(CLEAN_SOURCES.get(feature, [])),
                "importance_rank": rank,
                "validation_permutation_roc_auc_decrease_mean": float(
                    importance.importances_mean[position]
                ),
                "validation_permutation_roc_auc_decrease_std": float(
                    importance.importances_std[position]
                ),
                "evaluation_partition": "validation",
                "interpretation": (
                    "Model reliance measure only; it does not establish causation "
                    "or a modifiable treatment effect."
                ),
            })

        X_test = data.iloc[test_idx][features].copy()
        full_probability = model.predict_proba(X_test)[:, 1]
        reference_values = {}
        for feature in features:
            validation_values = X_validation[feature].dropna()
            if validation_values.empty:
                reference = np.nan
            elif feature in CATEGORICAL:
                reference = validation_values.mode().iloc[0]
            else:
                reference = validation_values.median()
            reference_values[feature] = reference
            substituted = X_test.copy()
            substituted[feature] = reference
            reference_probability = model.predict_proba(substituted)[:, 1]
            contribution = full_probability - reference_probability
            for row_number, participant_index in enumerate(test_idx):
                observed = X_test.iloc[row_number][feature]
                participant_rows.append({
                    "outcome": outcome,
                    "selected_model": selected["selected_model_name"],
                    "SEQN": int(data.iloc[participant_index]["SEQN"]),
                    "predicted_monitoring_signal_probability": float(
                        full_probability[row_number]
                    ),
                    "selected_validation_threshold": selected["threshold"],
                    "predicted_signal_at_threshold": bool(
                        full_probability[row_number] >= selected["threshold"]
                    ),
                    "feature": feature,
                    "observed_value": observed,
                    "validation_reference_value": reference,
                    "probability_contribution_vs_reference": float(
                        contribution[row_number]
                    ),
                    "explanation_method": (
                        "Model-output sensitivity: full probability minus the "
                        "probability after replacing this feature with its "
                        "validation median/mode, holding other recorded fields fixed."
                    ),
                    "safety_note": (
                        "Descriptive model explanation only; not causal, diagnostic, "
                        "or a recommended intervention."
                    ),
                })
    return pd.DataFrame(global_rows), pd.DataFrame(participant_rows)


def _charts(
    comparison: pd.DataFrame,
    sample: pd.DataFrame,
    stored: dict,
    chart_dir: Path,
) -> None:
    chart_dir.mkdir(parents=True, exist_ok=True)
    selected_comparison = comparison[comparison["selected_on_validation"]].copy()
    x = np.arange(len(selected_comparison))
    fig = plt.figure(figsize=(9, 5))
    plt.bar(x, selected_comparison["roc_auc"])
    plt.errorbar(
        x, selected_comparison["roc_auc"],
        yerr=np.vstack([
            selected_comparison["roc_auc"] - selected_comparison["roc_auc_ci_lower"],
            selected_comparison["roc_auc_ci_upper"] - selected_comparison["roc_auc"],
        ]),
        fmt="none", capsize=4,
    )
    plt.xticks(x, selected_comparison["outcome_label"], rotation=25, ha="right")
    plt.ylabel("Held-out ROC AUC")
    plt.title("Validation-selected, Calibrated Monitoring-signal Models")
    plt.ylim(0.45, 1)
    plt.tight_layout()
    fig.savefig(chart_dir / "multicondition_roc_auc.png", dpi=300, bbox_inches="tight")
    plt.close(fig)

    x = np.arange(len(sample))
    fig = plt.figure(figsize=(9, 5))
    plt.bar(x, sample["prevalence"])
    plt.xticks(x, sample["outcome_label"], rotation=25, ha="right")
    plt.ylabel("Positive proportion in analysis cohort")
    plt.title("Monitoring-signal Prevalence")
    plt.tight_layout()
    fig.savefig(chart_dir / "multicondition_prevalence.png", dpi=300, bbox_inches="tight")
    plt.close(fig)

    for outcome, spec in OUTCOME_SPECS.items():
        stored_model = stored[(outcome, "Selected calibrated")]
        observed, predicted = calibration_curve(
            stored_model["y_test"], stored_model["probability_test"],
            n_bins=10, strategy="quantile",
        )
        fig = plt.figure(figsize=(6, 5))
        plt.plot(
            predicted,
            observed,
            marker="o",
            label=f"Selected: {stored_model['selected_model_name']}",
        )
        plt.plot([0, 1], [0, 1], linestyle="--", label="Ideal")
        plt.xlabel("Mean predicted probability")
        plt.ylabel("Observed proportion")
        plt.title(f"Calibration: {spec['label']}")
        plt.legend()
        plt.tight_layout()
        fig.savefig(
            chart_dir / f"multicondition_calibration_{outcome}.png",
            dpi=300, bbox_inches="tight",
        )
        plt.close(fig)


def _summary(
    incremental: pd.DataFrame,
    ablation: pd.DataFrame,
    component_status: pd.DataFrame,
) -> dict:
    outcomes = {}
    for outcome, spec in OUTCOME_SPECS.items():
        evaluated = incremental[
            incremental["outcome"].eq(outcome)
            & incremental["status"].eq("evaluated")
            & ~incremental["comparison"].str.startswith("Reference:")
        ]
        domains = {}
        for _, row in evaluated.iterrows():
            domains[row["comparison"]] = {
                "delta_roc_auc": row.get("delta_roc_auc"),
                "ci": [row.get("delta_roc_auc_ci_lower"), row.get("delta_roc_auc_ci_upper")],
                "interpretation": row.get("interpretation"),
            }
        unavailable = incremental[
            incremental["outcome"].eq(outcome)
            & ~incremental["status"].eq("evaluated")
        ]["comparison"].tolist()
        outcomes[outcome] = {
            "label": spec["label"],
            "data_domain_results": domains,
            "unavailable_comparisons": unavailable,
        }
    return {
        "outcomes": outcomes,
        "missing_components_or_fields": component_status.loc[
            ~component_status["available"],
            ["component_or_outcome", "required_source_files", "required_fields"],
        ].to_dict("records"),
        "ablation_assertions_passed": bool(
            ablation["same_training_participants_as_full_model"].all()
            and ablation["same_test_participants_as_full_model"].all()
        ),
        "safety": (
            "All outputs are exploratory monitoring/risk signals, not diagnoses, "
            "causal conclusions, or guarantees of future disease."
        ),
    }


def run_multicondition_analysis(
    project_root: Path,
    *,
    minimum_predictor_availability_fraction: float = (
        DEFAULT_AVAILABLE_CASE_MIN_PREDICTOR_FRACTION
    ),
) -> dict[str, Any]:
    project_root = Path(project_root)
    raw_dir = project_root / "data" / "raw" / "nhanes"
    table_dir = project_root / "outputs" / "tables"
    model_dir = project_root / "outputs" / "models"
    chart_dir = project_root / "outputs" / "charts"
    prediction_dir = project_root / "outputs" / "predictions"
    table_dir.mkdir(parents=True, exist_ok=True)

    loaded = load_nhanes_directory(raw_dir)
    required = {
        "LBXGH", "LBDHDD", "URDACT", "RIDAGEYR", "RIAGENDR",
        "BPXSY1", "BPXDI1",
    }
    missing = required.difference(loaded.data.columns)
    if missing:
        raise FileNotFoundError(f"Required verified NHANES fields are absent: {sorted(missing)}")
    _, component_status = _configure_outcomes(loaded.data)
    for obsolete in model_dir.glob("multicondition_hypertension_signal_*"):
        obsolete.unlink(missing_ok=True)
    (chart_dir / "multicondition_calibration_hypertension_signal.png").unlink(
        missing_ok=True
    )
    clean = _engineer_panel_features(loaded)
    data = _construct_outcomes(clean, loaded.data)
    groups_by_outcome = {
        outcome: _feature_groups(data, outcome) for outcome in OUTCOME_SPECS
    }
    discovery = _variable_discovery(data, loaded.data, groups_by_outcome)
    leakage = _leakage_audit(groups_by_outcome)
    comparison, sample, selection, stored, integrity_rows = _fit_panel(
        data, groups_by_outcome, model_dir,
        min_predictor_fraction=minimum_predictor_availability_fraction,
    )
    incremental = _incremental_analysis(
        data, groups_by_outcome, stored, integrity_rows
    )
    ablation = _ablation_analysis(
        data, groups_by_outcome, stored, integrity_rows
    )
    global_importance, participant_explanations = _model_explanations(data, stored)
    integrity = pd.DataFrame(integrity_rows)
    assert integrity["training_only_preprocessing"].all()
    assert integrity["untouched_held_out_test_set"].all()
    assert integrity["same_training_participants_as_full_model"].all()
    assert integrity["same_validation_participants_as_full_model"].all()
    assert integrity["same_test_participants_as_full_model"].all()
    assert integrity["train_test_disjoint"].all()
    assert integrity["leakage_audit_passed"].all()
    assert (~integrity["final_test_used_for_selection"]).all()
    assert (~integrity["final_test_used_for_calibration"]).all()

    _save(comparison, table_dir / "multicondition_model_comparison.csv")
    _save(selection, table_dir / "multicondition_model_selection.csv")
    _save(incremental, table_dir / "multicondition_incremental_value.csv")
    _save(ablation, table_dir / "multicondition_ablation_analysis.csv")
    _save(sample, table_dir / "multicondition_sample_report.csv")
    _save(discovery, table_dir / "multicondition_variable_discovery.csv")
    _save(leakage, table_dir / "multicondition_leakage_audit.csv")
    _save(integrity, table_dir / "multicondition_integrity_audit.csv")
    _save(component_status, table_dir / "multicondition_component_status.csv")
    _save(
        global_importance,
        table_dir / "multicondition_global_feature_importance.csv",
    )
    _save(
        participant_explanations,
        prediction_dir / "multicondition_participant_explanations.csv",
    )
    _charts(comparison, sample, stored, chart_dir)
    summary = _summary(incremental, ablation, component_status)
    (table_dir / "multicondition_summary.json").write_text(
        json.dumps(summary, indent=2, default=_json_value), encoding="utf-8"
    )

    print("\nMULTI-CONDITION MONITORING-SIGNAL SUMMARY")
    for outcome, details in summary["outcomes"].items():
        print(f"\n{details['label']}:")
        for domain, result in details["data_domain_results"].items():
            print(
                f"  {domain}: {result['interpretation']} "
                f"(delta ROC AUC {result['delta_roc_auc']:+.3f}, "
                f"95% CI {result['ci'][0]:+.3f} to {result['ci'][1]:+.3f})"
            )
        for unavailable in details["unavailable_comparisons"]:
            print(f"  {unavailable}: not evaluated because required source files were absent")
    print("\nThese are research monitoring signals, not diagnoses.")
    missing_rows = component_status[~component_status["available"]]
    if not missing_rows.empty:
        print("\nMISSING LOCAL NHANES COMPONENTS OR FIELDS")
        for _, row in missing_rows.iterrows():
            print(
                f"  {row['component_or_outcome']}: "
                f"{row['required_source_files']} "
                f"(required fields: {row['required_fields']})"
            )
    return {
        "data": data,
        "groups": groups_by_outcome,
        "comparison": comparison,
        "selection": selection,
        "incremental": incremental,
        "ablation": ablation,
        "sample": sample,
        "discovery": discovery,
        "leakage": leakage,
        "integrity": integrity,
        "component_status": component_status,
        "global_feature_importance": global_importance,
        "participant_explanations": participant_explanations,
        "summary": summary,
        "file_report": loaded.file_report,
    }


if __name__ == "__main__":
    run_multicondition_analysis(Path(__file__).resolve().parents[1])
