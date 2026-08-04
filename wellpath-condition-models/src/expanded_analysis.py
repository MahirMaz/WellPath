"""Expanded, leakage-safe NHANES elevated-HbA1c research experiment.

This module intentionally treats HbA1c >= 5.7% as a cross-sectional
classification outcome, not as a diagnosis or a prediction of future disease.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import statsmodels.api as sm
from sklearn.base import clone
from sklearn.calibration import calibration_curve
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    balanced_accuracy_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import GridSearchCV, StratifiedKFold, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from .data_loader import (
    discover_nhanes_files,
    load_nhanes_directory,
    materialize_clean_features,
    read_component,
)
from .modeling import construct_elevated_hba1c
from .preprocessing import enforce_valid_ranges, replace_missing_codes


RANDOM_STATE = 42
BOOTSTRAP_RESAMPLES = 1000
DEMONSTRATION_THRESHOLD = 0.50
DEFAULT_AVAILABLE_CASE_MIN_PREDICTOR_FRACTION = 0.60

NUTRIENTS = {
    "diet_calories": ("DR1TKCAL", "DR2TKCAL", "Energy (kcal)"),
    "diet_carbohydrate_g": ("DR1TCARB", "DR2TCARB", "Carbohydrate (gm)"),
    "diet_total_sugar_g": ("DR1TSUGR", "DR2TSUGR", "Total sugars (gm)"),
    "diet_fiber_g": ("DR1TFIBE", "DR2TFIBE", "Dietary fiber (gm)"),
    "diet_protein_g": ("DR1TPROT", "DR2TPROT", "Protein (gm)"),
    "diet_total_fat_g": ("DR1TTFAT", "DR2TTFAT", "Total fat (gm)"),
    "diet_saturated_fat_g": ("DR1TSFAT", "DR2TSFAT", "Total saturated fatty acids (gm)"),
    "diet_sodium_mg": ("DR1TSODI", "DR2TSODI", "Sodium (mg)"),
    "diet_potassium_mg": ("DR1TPOTA", "DR2TPOTA", "Potassium (mg)"),
    "diet_cholesterol_mg": ("DR1TCHOL", "DR2TCHOL", "Cholesterol (mg)"),
    "diet_alcohol_g": ("DR1TALCO", "DR2TALCO", "Alcohol (gm)"),
}

DIET_BEHAVIORS = {
    "meals_away_from_home_7d": ("DBD895", "# of meals not home prepared"),
    "fast_food_meals_7d": ("DBD900", "# of meals from fast food or pizza place"),
    "ready_to_eat_meals_30d": ("DBD905", "# of ready-to-eat foods in past 30 days"),
    "frozen_meals_30d": ("DBD910", "# of frozen meals/pizza in past 30 days"),
    "self_rated_diet_quality": ("DBQ700", "How healthy is the diet"),
}

CORE_KPIS = [
    "sleep_hours", "resting_heart_rate", "systolic_bp", "diastolic_bp",
    "bmi", "weight_kg", "vigorous_activity", "moderate_activity",
    "sedentary_minutes",
]
DEMOGRAPHICS = ["age", "sex", "income_context"]
CATEGORICAL = {
    "sex", "vigorous_activity", "moderate_activity",
    "self_rated_diet_quality", "medical_or_family_diabetes_risk",
}
BINARY_VARIABLES = {"medical_or_family_diabetes_risk"}
FORBIDDEN_TERMS = (
    "hba1c", "lbxgh", "glucose", "diq010", "diq160", "diabetes_diagnosis",
    "prediabetes", "insulin", "medication", "glycohemoglobin",
)


def _save(frame: pd.DataFrame, path: Path) -> pd.DataFrame:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, index=False)
    return frame


def create_file_inventory(raw_dir: Path, table_dir: Path) -> pd.DataFrame:
    """Create one audit row per source column, with file-level details repeated."""
    rows = []
    for path in discover_nhanes_files(raw_dir):
        try:
            frame = read_component(path)
            names = "; ".join(frame.columns)
            for column in frame.columns:
                rows.append({
                    "filename": path.name,
                    "number_of_rows": len(frame),
                    "number_of_columns": len(frame.columns),
                    "seqn_exists": "SEQN" in frame.columns,
                    "all_column_names": names,
                    "column_name": column,
                    "column_dtype": str(frame[column].dtype),
                    "status": "loaded",
                    "message": "",
                })
        except Exception as exc:
            rows.append({
                "filename": path.name, "number_of_rows": 0,
                "number_of_columns": 0, "seqn_exists": False,
                "all_column_names": "", "column_name": "", "column_dtype": "",
                "status": "rejected", "message": str(exc),
            })
    return _save(pd.DataFrame(rows), table_dir / "nhanes_file_inventory.csv")


def _discovery_rows(available: set[str]) -> pd.DataFrame:
    definitions = []

    def add(concept, file, code, label, coding, missing, decision, notes):
        present = code in available if code else False
        if not present and decision == "usable":
            decision = "unavailable"
            notes = f"Requested source field is not loaded. {notes}".strip()
            file = code = label = coding = missing = ""
        definitions.append({
            "requested_concept": concept, "matching_source_file": file,
            "matching_variable_code": code, "variable_label": label,
            "response_coding": coding, "missing_value_codes": missing,
            "decision": decision, "notes": notes,
        })

    for clean, (d1, d2, label) in NUTRIENTS.items():
        concept = clean.replace("diet_", "").replace("_g", "").replace("_mg", "").replace("_", " ").title()
        overall_available = d1 in available or d2 in available
        for source_file, source_day, source_column in [
            ("DR1TOT_J", "day 1", d1),
            ("DR2TOT_J", "day 2", d2),
        ]:
            source_available = source_column in available
            definitions.append({
                "requested_concept": concept,
                "participant_feature": clean,
                "source_day": source_day,
                "matching_source_file": source_file if source_available else "",
                "matching_variable_code": source_column,
                "variable_label": label if source_available else "",
                "response_coding": (
                    "Continuous daily intake; participant feature averages available recall days"
                    if source_available else ""
                ),
                "missing_value_codes": ". = missing" if source_available else "",
                "decision": "usable" if source_available else "unavailable",
                "concept_available": overall_available,
                "notes": (
                    "Source column loaded. One or two 24-hour recalls are imperfect measures of usual diet."
                    if source_available else
                    f"{source_column} is not loaded; the participant feature remains available only if the other recall-day column exists."
                ),
            })
    add("Added sugars", "", "", "", "", "", "unavailable",
        "No verified added-sugars total was found in the loaded files.")
    for clean, (code, label) in DIET_BEHAVIORS.items():
        coding = "Continuous frequency"
        missing = "7777/9999; structural missing"
        if code == "DBQ700":
            coding = "1 Excellent, 2 Very good, 3 Good, 4 Fair, 5 Poor"
            missing = "7 refused; 9 don't know; structural missing"
        elif code in {"DBD895", "DBD900"}:
            coding = "0-21 meals; 5555 means more than 21 and is set missing"
        else:
            coding = "0-90 times; 6666 means more than 90 and is set missing"
        add(clean.replace("_", " ").title(), "DBQ_J", code, label, coding,
            missing, "usable", "Official 2017-2018 NHANES codebook wording.")
    add("Family history of diabetes", "DIQ_J", "DIQ175A", "Family history",
        "10 = selected; 99 = don't know", "99; structural skip",
        "ambiguous" if "DIQ175A" in available else "unavailable",
        "Asked only among people who said they felt at risk; not a universal family-history measure.")
    for concept in ["Parent with diabetes", "Sibling with diabetes",
                    "Family history of heart disease", "Family history of hypertension"]:
        add(concept, "", "", "", "", "", "unavailable",
            "No defensible field was found in the loaded components.")
    add("Medical or family-history risk for diabetes", "DIQ_J", "DIQ170",
        "Ever told have health risk for diabetes", "1 yes; 2 no",
        "7 refused; 9 don't know; structural missing", "usable",
        "Combined medical/family-risk proxy; it is not pure family history.")
    for concept in ["Current smoker", "Former smoker", "Never smoker",
                    "Cigarettes per day", "Years smoked"]:
        add(concept, "", "", "", "", "", "unavailable",
            "SMQ_J is not present; no unrelated substitute was used.")
    for concept in ["Household food-security category", "Worry about food running out",
                    "Food not lasting", "Reduced meals", "Unable to afford balanced meals"]:
        add(concept, "", "", "", "", "", "unavailable",
            "FSQ_J is not present; no unrelated substitute was used.")
    for concept in ["Has a regular healthcare location", "Has a regular healthcare provider",
                    "Time since last healthcare visit", "Health insurance",
                    "Delayed care", "Could not afford care"]:
        add(concept, "", "", "", "", "", "unavailable",
            "HUQ_J/health-insurance components are not present; no substitute was used.")
    result = pd.DataFrame(definitions)
    for column in ["participant_feature", "source_day", "concept_available"]:
        if column not in result:
            result[column] = ""
    ordered = [
        "requested_concept", "participant_feature", "source_day",
        "matching_source_file", "matching_variable_code", "variable_label",
        "response_coding", "missing_value_codes", "decision",
        "concept_available", "notes",
    ]
    return result[ordered]


def create_discovery_reports(columns: Iterable[str], table_dir: Path) -> tuple[pd.DataFrame, pd.DataFrame, str]:
    available = set(columns)
    discovery = _save(
        _discovery_rows(available),
        table_dir / "variable_discovery_report.csv",
    )
    rows = [
        {
            "candidate_variable": "DIQ175A",
            "official_wording": "Why do you think you are at risk for diabetes or prediabetes? Response option: Family history.",
            "assessment": "Ambiguous / not suitable as a universal family-history predictor",
            "reason": "Asked only after reported perceived risk; 7,752 of 8,897 rows are structurally missing.",
            "selected_for_model": False,
        },
        {
            "candidate_variable": "DIQ170",
            "official_wording": "Ever told by a health professional of health conditions or a medical or family history that increases diabetes risk.",
            "assessment": "Combined medical/family-risk proxy found",
            "reason": "The wording combines medical conditions and family history and cannot isolate relatives.",
            "selected_for_model": "DIQ170" in available,
        },
        {
            "candidate_variable": "MCQ_J and other questionnaire files",
            "official_wording": "No direct universal family-history field found in loaded files.",
            "assessment": "No direct family-history variable found",
            "reason": "MCQ_J is absent and no participant diagnosis was repurposed.",
            "selected_for_model": False,
        },
    ]
    status = (
        "Combined medical/family-risk proxy found"
        if "DIQ170" in available
        else "No defensible family-history variable found"
    )
    family = pd.DataFrame(rows)
    family.insert(0, "selected_status", status)
    _save(family, table_dir / "family_history_variable_review.csv")
    return discovery, family, status


def engineer_expanded_features(raw_dir: Path) -> tuple[pd.DataFrame, dict[str, list[str]], pd.DataFrame]:
    loaded = load_nhanes_directory(raw_dir)
    clean = materialize_clean_features(loaded.data, loaded.resolved_sources)
    clean = replace_missing_codes(clean)
    clean, _ = enforce_valid_ranges(clean)
    clean, target = construct_elevated_hba1c(clean)
    clean["elevated_hba1c"] = target.to_numpy()

    all_raw = loaded.data.set_index("SEQN")

    def numeric_source(column: str) -> pd.Series:
        if column in all_raw.columns:
            return pd.to_numeric(all_raw[column], errors="coerce")
        return pd.Series(np.nan, index=all_raw.index, dtype=float, name=column)

    for clean_name, (d1, d2, _) in NUTRIENTS.items():
        if d1 not in all_raw.columns and d2 not in all_raw.columns:
            continue
        one = numeric_source(d1)
        two = numeric_source(d2)
        both = pd.concat([one.rename("d1"), two.rename("d2")], axis=1)
        feature = both.mean(axis=1, skipna=True)
        clean[clean_name] = clean["SEQN"].map(feature)
    first_pair = next(iter(NUTRIENTS.values()))
    recall = pd.concat([
        numeric_source(first_pair[0]).notna().rename("day_1_available"),
        numeric_source(first_pair[1]).notna().rename("day_2_available"),
    ], axis=1).sum(axis=1)
    clean["diet_recall_days_available"] = clean["SEQN"].map(recall).astype("Int64")

    for clean_name, (code, _) in DIET_BEHAVIORS.items():
        if code not in all_raw:
            continue
        values = pd.to_numeric(all_raw[code], errors="coerce")
        values = values.mask(values.abs() < 1e-60, 0)
        if code in {"DBD895", "DBD900"}:
            values = values.replace([5555, 7777, 9999], np.nan)
        elif code in {"DBD905", "DBD910"}:
            values = values.replace([6666, 7777, 9999], np.nan)
        else:
            values = values.replace([7, 9], np.nan)
        clean[clean_name] = clean["SEQN"].map(values)
    if "DIQ170" in all_raw:
        proxy = pd.to_numeric(all_raw["DIQ170"], errors="coerce").replace([7, 9], np.nan)
        proxy = proxy.map({1.0: 1.0, 2.0: 0.0})
        clean["medical_or_family_diabetes_risk"] = clean["SEQN"].map(proxy)

    clean = clean.reset_index(drop=True)
    if clean["SEQN"].duplicated().any():
        raise AssertionError("SEQN join did not preserve one participant row.")
    groups = {
        "core_kpis": [x for x in CORE_KPIS if x in clean],
        "demographics": [x for x in DEMOGRAPHICS if x in clean],
        "diet_nutrients": [x for x in NUTRIENTS if x in clean],
        "diet_behaviours": [x for x in DIET_BEHAVIORS if x in clean],
        "family_history": [],
        "medical_family_risk_proxy": (
            ["medical_or_family_diabetes_risk"]
            if "medical_or_family_diabetes_risk" in clean else []
        ),
        "smoking": [], "food_security": [], "healthcare_access": [],
    }
    return clean, groups, loaded.file_report


def build_experiments(groups: dict[str, list[str]]) -> dict[str, list[str]]:
    kpi, demo = groups["core_kpis"], groups["demographics"]
    diet_n, diet_b = groups["diet_nutrients"], groups["diet_behaviours"]
    proxy = groups["medical_family_risk_proxy"]
    experiments = {
        "Model 0: Age only": ["age"],
        "Model 1: Age + BMI": ["age", "bmi"],
        "Baseline 3: Age + BMI + systolic BP": ["age", "bmi", "systolic_bp"],
        "Model 2: Core KPIs": kpi,
        "Model 3: Core KPIs + demographics": kpi + demo,
        "Model 4: + diet nutrients": kpi + demo + diet_n,
        "Model 5: + diet behaviours": kpi + demo + diet_b,
        "Model 6: + all verified diet": kpi + demo + diet_n + diet_b,
    }
    if proxy:
        experiments["Model 7P: + medical/family-risk proxy"] = kpi + demo + proxy
    full = list(dict.fromkeys(kpi + demo + diet_n + diet_b + proxy))
    experiments["Model 11: Full verified"] = full
    experiments["Model 12: Full without diet"] = [x for x in full if x not in diet_n + diet_b]
    experiments["Model 13: Full without family/proxy"] = [x for x in full if x not in proxy]
    if "bmi" in full and "weight_kg" in full:
        experiments["Model 14: Full with BMI only"] = [
            x for x in full if x != "weight_kg"
        ]
    return {name: list(dict.fromkeys(features)) for name, features in experiments.items() if features}


def leakage_audit(experiments: dict[str, list[str]], table_dir: Path) -> pd.DataFrame:
    rows = []
    for model, features in experiments.items():
        for feature in features:
            hits = [term for term in FORBIDDEN_TERMS if term in feature.lower()]
            rows.append({
                "model": model, "predictor": feature,
                "matched_forbidden_terms": "; ".join(hits),
                "direct_target_or_proxy": bool(hits),
                "allowed": not hits,
                "review_note": "Passed name-based audit" if not hits else "STOP: forbidden predictor",
            })
    result = _save(pd.DataFrame(rows), table_dir / "target_leakage_audit.csv")
    if not result["allowed"].all():
        raise ValueError("Direct target leakage found; training stopped.")
    return result


def _pipeline(features: list[str], estimator=None) -> Pipeline:
    categorical = [x for x in features if x in CATEGORICAL]
    continuous = [x for x in features if x not in categorical]
    transformers = []
    if continuous:
        transformers.append(("continuous", Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("scale", StandardScaler()),
        ]), continuous))
    if categorical:
        transformers.append(("categorical", Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("one_hot", OneHotEncoder(handle_unknown="ignore", drop="first", sparse_output=False)),
        ]), categorical))
    if estimator is None:
        estimator = LogisticRegression(
            solver="liblinear", l1_ratio=0.0, class_weight="balanced",
            max_iter=3000, random_state=RANDOM_STATE,
        )
    return Pipeline([("preprocess", ColumnTransformer(transformers)), ("model", estimator)])


def _metrics(y: np.ndarray, probability: np.ndarray, threshold: float = DEMONSTRATION_THRESHOLD) -> dict:
    prediction = (probability >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, prediction, labels=[0, 1]).ravel()
    return {
        "roc_auc": roc_auc_score(y, probability),
        "pr_auc": average_precision_score(y, probability),
        "balanced_accuracy": balanced_accuracy_score(y, prediction),
        "recall": recall_score(y, prediction, zero_division=0),
        "specificity": tn / (tn + fp) if (tn + fp) else np.nan,
        "precision": precision_score(y, prediction, zero_division=0),
        "f1": f1_score(y, prediction, zero_division=0),
        "brier_score": brier_score_loss(y, probability),
    }


def _bootstrap_intervals(y, probability, threshold, seed_offset=0) -> dict:
    rng = np.random.default_rng(RANDOM_STATE + seed_offset)
    n = len(y)
    values = {key: [] for key in ["roc_auc", "pr_auc", "recall", "specificity"]}
    for _ in range(BOOTSTRAP_RESAMPLES):
        idx = rng.integers(0, n, n)
        yb = y[idx]
        if len(np.unique(yb)) < 2:
            continue
        pb = probability[idx]
        roc, ap = _fast_rank_metrics(yb, pb)
        pred = pb >= threshold
        positive = yb == 1
        negative = ~positive
        values["roc_auc"].append(roc)
        values["pr_auc"].append(ap)
        values["recall"].append(float(pred[positive].mean()))
        values["specificity"].append(float((~pred[negative]).mean()))
    result = {}
    for key, vals in values.items():
        result[f"{key}_ci_lower"] = np.quantile(vals, 0.025)
        result[f"{key}_ci_upper"] = np.quantile(vals, 0.975)
    result["bootstrap_resamples"] = BOOTSTRAP_RESAMPLES
    return result


def _fast_rank_metrics(y: np.ndarray, probability: np.ndarray) -> tuple[float, float]:
    """Fast bootstrap ROC AUC and average precision for a binary outcome."""
    y = np.asarray(y, dtype=np.int8)
    probability = np.asarray(probability, dtype=float)
    order = np.argsort(probability, kind="mergesort")
    ys, ps = y[order], probability[order]
    starts = np.r_[0, np.flatnonzero(np.diff(ps)) + 1]
    group_pos = np.add.reduceat(ys, starts)
    sizes = np.diff(np.r_[starts, len(ys)])
    group_neg = sizes - group_pos
    neg_before = np.cumsum(group_neg) - group_neg
    n_pos, n_neg = group_pos.sum(), group_neg.sum()
    auc = float(np.sum(group_pos * (neg_before + 0.5 * group_neg)) / (n_pos * n_neg))
    desc = np.argsort(-probability, kind="mergesort")
    yd = y[desc]
    cumulative_positive = np.cumsum(yd)
    precision_at_rank = cumulative_positive / np.arange(1, len(yd) + 1)
    ap = float(np.sum(precision_at_rank * yd) / n_pos)
    return auc, ap


def _fit_logistic(X_train, y_train, features):
    cv = StratifiedKFold(5, shuffle=True, random_state=RANDOM_STATE)
    search = GridSearchCV(
        _pipeline(features),
        {"model__C": [1.0]},
        scoring="roc_auc", cv=cv, n_jobs=1, refit=True,
    )
    search.fit(X_train[features], y_train)
    return search.best_estimator_, float(search.best_score_), search.best_params_


def run_model_experiments(
    data: pd.DataFrame,
    experiments: dict[str, list[str]],
    table_dir: Path,
    model_dir: Path,
    *,
    available_case_min_predictor_fraction: float = DEFAULT_AVAILABLE_CASE_MIN_PREDICTOR_FRACTION,
) -> tuple[pd.DataFrame, dict, dict, pd.DataFrame, pd.DataFrame]:
    """Run strict, shared-cohort, and availability-threshold comparisons."""
    if not 0 < available_case_min_predictor_fraction <= 1:
        raise ValueError(
            "available_case_min_predictor_fraction must be greater than 0 and at most 1"
        )
    target = data["elevated_hba1c"].astype(int)
    union = list(dict.fromkeys(x for features in experiments.values() for x in features))
    complete_mask = data[union].notna().all(axis=1)
    complete_idx = np.flatnonzero(complete_mask)
    cc_train, cc_test = train_test_split(
        complete_idx, test_size=0.2, random_state=RANDOM_STATE,
        stratify=target.iloc[complete_idx],
    )
    rows, predictions, fitted = [], {}, {}
    sample_rows = []
    available_indices: dict[str, np.ndarray] = {}
    available_splits: dict[str, tuple[np.ndarray, np.ndarray]] = {}

    def record(
        model_name,
        comparison,
        features,
        train_idx,
        test_idx,
        estimator_name="Regularized logistic regression",
        *,
        availability_fraction_required=1.0,
        availability_predictor_count=None,
        availability_rule="Strict complete-case",
    ):
        X_train, X_test = data.iloc[train_idx], data.iloc[test_idx]
        y_train = target.iloc[train_idx].to_numpy()
        y_test = target.iloc[test_idx].to_numpy()
        if estimator_name == "Regularized logistic regression":
            pipeline, cv_auc, params = _fit_logistic(X_train, y_train, features)
        else:
            est = (
                RandomForestClassifier(
                    n_estimators=150, max_features="sqrt", min_samples_leaf=5,
                    class_weight="balanced", random_state=RANDOM_STATE, n_jobs=-1,
                )
                if estimator_name == "Random forest"
                else GradientBoostingClassifier(
                    n_estimators=150, learning_rate=0.05, max_depth=2,
                    random_state=RANDOM_STATE,
                )
            )
            pipeline = _pipeline(features, est)
            cv = StratifiedKFold(5, shuffle=True, random_state=RANDOM_STATE)
            search = GridSearchCV(pipeline, {}, scoring="roc_auc", cv=cv, n_jobs=1)
            search.fit(X_train[features], y_train)
            pipeline, cv_auc, params = search.best_estimator_, float(search.best_score_), {}
        probability = pipeline.predict_proba(X_test[features])[:, 1]
        met = _metrics(y_test, probability)
        cis = _bootstrap_intervals(y_test, probability, DEMONSTRATION_THRESHOLD, len(rows))
        key = (comparison, model_name, estimator_name)
        predictions[key] = {
            "y": y_test, "probability": probability, "test_idx": np.asarray(test_idx),
            "train_idx": np.asarray(train_idx),
            "threshold": DEMONSTRATION_THRESHOLD,
        }
        fitted[key] = pipeline
        required_count = int(
            np.ceil(availability_fraction_required * len(features))
        )
        rows.append({
            "comparison": comparison, "model": model_name,
            "estimator": estimator_name, "features": "; ".join(features),
            "number_of_participants": len(train_idx) + len(test_idx),
            "positive_class_prevalence": target.iloc[np.r_[train_idx, test_idx]].mean(),
            "training_count": len(train_idx), "test_count": len(test_idx),
            "cv_roc_auc_training_only": cv_auc,
            "best_parameters": json.dumps(params), "demonstration_threshold": DEMONSTRATION_THRESHOLD,
            "predictor_availability_fraction_required": availability_fraction_required,
            "required_nonmissing_predictors": required_count,
            "availability_rule": availability_rule,
            **met, **cis,
        })
        if availability_predictor_count is None:
            availability_predictor_count = data[features].notna().sum(axis=1)
        eligible = availability_predictor_count >= required_count
        sample_rows.append({
            "comparison": comparison, "model": model_name, "estimator": estimator_name,
            "starting_participant_count": len(data),
            "participants_excluded_target_missing": 0,
            "predictor_availability_fraction_required": availability_fraction_required,
            "required_nonmissing_predictors": required_count,
            "participants_excluded_predictor_availability_rule": int((~eligible).sum()),
            "participants_excluded_all_predictors_missing": int(
                data[features].notna().sum(axis=1).eq(0).sum()
            ),
            "participants_excluded_complete_case_rule": (
                int((~complete_mask).sum()) if comparison == "Complete-case" else 0
            ),
            "final_training_count": len(train_idx), "final_test_count": len(test_idx),
            "positive_outcome_count": int(target.iloc[np.r_[train_idx, test_idx]].sum()),
            "negative_outcome_count": int(len(train_idx) + len(test_idx) - target.iloc[np.r_[train_idx, test_idx]].sum()),
        })
        return pipeline

    for model_name, features in experiments.items():
        record(
            model_name, "Complete-case", features, cc_train, cc_test,
            availability_fraction_required=1.0,
            availability_predictor_count=data[features].notna().sum(axis=1),
            availability_rule="Strict complete-case across every predictor used by the full experiment set",
        )
        required_count = int(
            np.ceil(available_case_min_predictor_fraction * len(features))
        )
        eligible_idx = np.flatnonzero(
            data[features].notna().sum(axis=1).ge(required_count)
        )
        available_indices[model_name] = eligible_idx
        tr, te = train_test_split(
            eligible_idx, test_size=0.2, random_state=RANDOM_STATE,
            stratify=target.iloc[eligible_idx],
        )
        available_splits[model_name] = (tr, te)
        record(
            model_name, "Available-case", features, tr, te,
            availability_fraction_required=available_case_min_predictor_fraction,
            availability_predictor_count=data[features].notna().sum(axis=1),
            availability_rule=(
                f"At least {available_case_min_predictor_fraction:.0%} of this model's predictors observed before imputation"
            ),
        )

    shared_models: dict[str, list[str]] = {}
    for name in [
        "Model 3: Core KPIs + demographics",
        "Model 6: + all verified diet",
        "Model 7P: + medical/family-risk proxy",
    ]:
        if name in experiments:
            shared_models[name] = experiments[name]
    shared_full_features = list(dict.fromkeys(
        experiments.get("Model 6: + all verified diet", [])
        + experiments.get("Model 7P: + medical/family-risk proxy", [])
    ))
    shared_full_name = "Shared full: KPIs + demographics + diet + proxy"
    if shared_full_features:
        shared_models[shared_full_name] = shared_full_features
    shared_union = list(dict.fromkeys(
        feature for features in shared_models.values() for feature in features
    ))
    shared_idx = np.flatnonzero(data[shared_union].notna().all(axis=1))
    shared_train, shared_test = train_test_split(
        shared_idx, test_size=0.2, random_state=RANDOM_STATE,
        stratify=target.iloc[shared_idx],
    )
    for model_name, features in shared_models.items():
        record(
            model_name, "Shared-comparison", features, shared_train, shared_test,
            availability_fraction_required=1.0,
            availability_predictor_count=data[features].notna().sum(axis=1),
            availability_rule=(
                "Complete observations for the shared KPI + demographics + diet + proxy comparison only; unrelated optional groups excluded"
            ),
        )

    for comparison, train_idx, test_idx in [
        ("Complete-case", cc_train, cc_test),
        ("Available-case", *available_splits["Model 11: Full verified"]),
    ]:
        for estimator in ["Random forest", "Gradient boosting"]:
            fraction = (
                1.0 if comparison == "Complete-case"
                else available_case_min_predictor_fraction
            )
            record(
                "Model 11: Full verified", comparison,
                experiments["Model 11: Full verified"], train_idx, test_idx, estimator,
                availability_fraction_required=fraction,
                availability_predictor_count=data[
                    experiments["Model 11: Full verified"]
                ].notna().sum(axis=1),
                availability_rule=(
                    "Strict complete-case across every predictor used by the full experiment set"
                    if comparison == "Complete-case" else
                    f"At least {available_case_min_predictor_fraction:.0%} of this model's predictors observed before imputation"
                ),
            )

    # Dummy sanity check on the complete-case split.
    y_train = target.iloc[cc_train].to_numpy()
    y_test = target.iloc[cc_test].to_numpy()
    prob = np.repeat(y_train.mean(), len(y_test))
    met = _metrics(y_test, prob)
    rows.append({
        "comparison": "Complete-case", "model": "Sanity check: prior dummy",
        "estimator": "Dummy classifier", "features": "",
        "number_of_participants": len(cc_train) + len(cc_test),
        "positive_class_prevalence": target.iloc[np.r_[cc_train, cc_test]].mean(),
        "training_count": len(cc_train), "test_count": len(cc_test),
        "cv_roc_auc_training_only": 0.5, "best_parameters": "{}",
        "demonstration_threshold": DEMONSTRATION_THRESHOLD, **met,
        "predictor_availability_fraction_required": 1.0,
        "required_nonmissing_predictors": len(union),
        "availability_rule": "Strict complete-case sanity check",
        **_bootstrap_intervals(y_test, prob, DEMONSTRATION_THRESHOLD, 99),
    })

    comparison = _save(pd.DataFrame(rows), table_dir / "expanded_model_comparison.csv")
    sample = _save(pd.DataFrame(sample_rows), table_dir / "model_sample_size_report.csv")
    full_available_count = len(available_indices["Model 11: Full verified"])
    full_available_required = int(np.ceil(
        available_case_min_predictor_fraction
        * len(experiments["Model 11: Full verified"])
    ))
    cohort_report = _save(pd.DataFrame([
        {
            "cohort": "Strict complete-case",
            "participant_count": len(complete_idx),
            "predictor_scope": "; ".join(union),
            "minimum_predictor_fraction": 1.0,
            "required_nonmissing_predictors": len(union),
            "notes": "Used for the global complete-case comparison.",
        },
        {
            "cohort": "Shared-comparison",
            "participant_count": len(shared_idx),
            "predictor_scope": "; ".join(shared_union),
            "minimum_predictor_fraction": 1.0,
            "required_nonmissing_predictors": len(shared_union),
            "notes": "Used only for KPI + demographics, diet, proxy, and shared-full direct comparisons.",
        },
        {
            "cohort": "Available-case full model",
            "participant_count": full_available_count,
            "predictor_scope": "; ".join(experiments["Model 11: Full verified"]),
            "minimum_predictor_fraction": available_case_min_predictor_fraction,
            "required_nonmissing_predictors": full_available_required,
            "notes": "Eligibility checked before training-only imputation.",
        },
    ]), table_dir / "comparison_cohort_report.csv")
    model_dir.mkdir(parents=True, exist_ok=True)
    final_key = ("Complete-case", "Model 11: Full verified", "Random forest")
    joblib.dump(fitted[final_key], model_dir / "expanded_full_model_random_forest.joblib")
    metadata = {
        "outcome": "Measured HbA1c >= 5.7% classification; not a diagnosis",
        "features": experiments["Model 11: Full verified"],
        "comparison": "Complete-case",
        "threshold": DEMONSTRATION_THRESHOLD,
        "random_state": RANDOM_STATE,
        "bootstrap_resamples": BOOTSTRAP_RESAMPLES,
        "available_case_min_predictor_fraction": available_case_min_predictor_fraction,
    }
    (model_dir / "expanded_model_metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return comparison, predictions, fitted, sample, cohort_report


def incremental_analysis(predictions: dict, table_dir: Path) -> pd.DataFrame:
    pairs = [
        ("Complete-case", "Model 2: Core KPIs", "Model 3: Core KPIs + demographics", "Add demographics"),
        ("Shared-comparison", "Model 3: Core KPIs + demographics", "Model 6: + all verified diet", "Add all verified diet"),
        ("Shared-comparison", "Model 3: Core KPIs + demographics", "Model 7P: + medical/family-risk proxy", "Add medical/family-risk proxy"),
        ("Shared-comparison", "Model 3: Core KPIs + demographics", "Shared full: KPIs + demographics + diet + proxy", "Add all shared verified groups"),
        ("Complete-case", "Model 1: Age + BMI", "Model 11: Full verified", "Full versus age + BMI"),
        ("Complete-case", "Model 14: Full with BMI only", "Model 11: Full verified", "Add weight beyond BMI"),
    ]
    rows = []
    for cohort, before, after, label in pairs:
        kb = (cohort, before, "Regularized logistic regression")
        ka = (cohort, after, "Regularized logistic regression")
        if kb not in predictions or ka not in predictions:
            continue
        b, a = predictions[kb], predictions[ka]
        if not np.array_equal(b["test_idx"], a["test_idx"]):
            raise AssertionError(
                f"Direct comparison does not share test participants: {before} vs {after}"
            )
        y, pb, pa = b["y"], b["probability"], a["probability"]
        mb, ma = _metrics(y, pb), _metrics(y, pa)
        row = {
            "comparison": label, "comparison_cohort": cohort,
            "base_model": before, "expanded_model": after,
            "held_out_participants": len(y),
            "same_test_participants": True,
            "delta_roc_auc": ma["roc_auc"] - mb["roc_auc"],
            "delta_pr_auc": ma["pr_auc"] - mb["pr_auc"],
            "delta_recall": ma["recall"] - mb["recall"],
            "delta_brier_score": ma["brier_score"] - mb["brier_score"],
        }
        rng = np.random.default_rng(RANDOM_STATE + len(rows))
        vals = {k: [] for k in ["delta_roc_auc", "delta_pr_auc", "delta_recall", "delta_brier_score"]}
        for _ in range(BOOTSTRAP_RESAMPLES):
            idx = rng.integers(0, len(y), len(y))
            yb = y[idx]
            if len(np.unique(yb)) < 2:
                continue
            pbb, pab = pb[idx], pa[idx]
            auc_b, ap_b = _fast_rank_metrics(yb, pbb)
            auc_a, ap_a = _fast_rank_metrics(yb, pab)
            positive = yb == 1
            recall_b = float((pbb[positive] >= DEMONSTRATION_THRESHOLD).mean())
            recall_a = float((pab[positive] >= DEMONSTRATION_THRESHOLD).mean())
            vals["delta_roc_auc"].append(auc_a - auc_b)
            vals["delta_pr_auc"].append(ap_a - ap_b)
            vals["delta_recall"].append(recall_a - recall_b)
            vals["delta_brier_score"].append(
                float(np.mean((pab - yb) ** 2) - np.mean((pbb - yb) ** 2))
            )
        for key, value in vals.items():
            row[f"{key}_ci_lower"] = np.quantile(value, 0.025)
            row[f"{key}_ci_upper"] = np.quantile(value, 0.975)
        meaningful = (
            row["delta_roc_auc"] >= 0.01
            and row["delta_roc_auc_ci_lower"] > 0
        )
        row["interpretation"] = (
            "Meaningful added predictive information"
            if meaningful else
            "No clear meaningful improvement; gain is small and/or uncertainty includes no improvement"
        )
        rows.append(row)
    return _save(pd.DataFrame(rows), table_dir / "incremental_value_analysis.csv")


def model_integrity_audit(
    predictions: dict,
    fitted: dict,
    incremental: pd.DataFrame,
    ablation: pd.DataFrame,
    leakage: pd.DataFrame,
    table_dir: Path,
) -> pd.DataFrame:
    """Verify pipeline boundaries, held-out splits, leakage, and paired cohorts."""
    rows = []
    leakage_passed = bool(leakage["allowed"].all())
    for key, prediction in predictions.items():
        comparison, model_name, estimator = key
        pipeline = fitted[key]
        train_idx = np.asarray(prediction["train_idx"])
        test_idx = np.asarray(prediction["test_idx"])
        rows.append({
            "audit_type": "model",
            "comparison": comparison,
            "model": model_name,
            "estimator": estimator,
            "training_only_preprocessing": (
                isinstance(pipeline, Pipeline)
                and "preprocess" in pipeline.named_steps
                and "model" in pipeline.named_steps
            ),
            "untouched_held_out_test_set": (
                len(np.intersect1d(train_idx, test_idx)) == 0
                and len(test_idx) == len(prediction["y"])
            ),
            "no_hba1c_or_diagnosis_leakage": leakage_passed,
            "same_participants_for_direct_comparison": np.nan,
            "comparison_partner": "",
            "status": "verified",
        })
    for _, delta in incremental.iterrows():
        cohort = delta["comparison_cohort"]
        before_key = (
            cohort, delta["base_model"], "Regularized logistic regression"
        )
        after_key = (
            cohort, delta["expanded_model"], "Regularized logistic regression"
        )
        same = bool(np.array_equal(
            predictions[before_key]["test_idx"],
            predictions[after_key]["test_idx"],
        ))
        rows.append({
            "audit_type": "direct_incremental_comparison",
            "comparison": cohort,
            "model": delta["expanded_model"],
            "estimator": "Regularized logistic regression",
            "training_only_preprocessing": True,
            "untouched_held_out_test_set": (
                len(np.intersect1d(
                    predictions[before_key]["train_idx"],
                    predictions[before_key]["test_idx"],
                )) == 0
                and len(np.intersect1d(
                    predictions[after_key]["train_idx"],
                    predictions[after_key]["test_idx"],
                )) == 0
            ),
            "no_hba1c_or_diagnosis_leakage": leakage_passed,
            "same_participants_for_direct_comparison": same,
            "comparison_partner": delta["base_model"],
            "status": "verified" if same else "failed",
        })
    for _, reduced in ablation.iterrows():
        if not str(reduced["status"]).startswith("evaluated"):
            continue
        rows.append({
            "audit_type": "ablation_comparison",
            "comparison": "Complete-case",
            "model": f"Full model without {reduced['removed_group']}",
            "estimator": "Regularized logistic regression",
            "training_only_preprocessing": True,
            "untouched_held_out_test_set": True,
            "no_hba1c_or_diagnosis_leakage": leakage_passed,
            "same_participants_for_direct_comparison": bool(
                reduced["same_training_participants_as_full_model"]
                and reduced["same_test_participants_as_full_model"]
            ),
            "comparison_partner": "Model 11: Full verified",
            "status": "verified",
        })
    audit = pd.DataFrame(rows)
    required = [
        "training_only_preprocessing",
        "untouched_held_out_test_set",
        "no_hba1c_or_diagnosis_leakage",
    ]
    if not audit[required].all().all():
        raise AssertionError("Model integrity audit failed.")
    direct = audit["audit_type"].eq("direct_incremental_comparison")
    if direct.any() and not audit.loc[
        direct, "same_participants_for_direct_comparison"
    ].astype(bool).all():
        raise AssertionError("Direct comparisons do not share test participants.")
    return _save(audit, table_dir / "model_integrity_audit.csv")


def ablation_analysis(data, experiments, predictions, table_dir) -> tuple[pd.DataFrame, dict]:
    full_features = experiments["Model 11: Full verified"]
    full_key = ("Complete-case", "Model 11: Full verified", "Regularized logistic regression")
    base = predictions[full_key]
    train_idx = np.asarray(base["train_idx"])
    test_idx = np.asarray(base["test_idx"])
    groups = {
        "Diet nutrients": [x for x in NUTRIENTS if x in full_features],
        "Diet behaviours": [x for x in DIET_BEHAVIORS if x in full_features],
        "Family history": [],
        "Medical/family-risk proxy": ["medical_or_family_diabetes_risk"] if "medical_or_family_diabetes_risk" in full_features else [],
        "Smoking": [], "Food security": [], "Healthcare access": [],
        "Demographics": [x for x in DEMOGRAPHICS if x in full_features],
        "Core KPIs": [x for x in CORE_KPIS if x in full_features],
        "Activity variables": [x for x in ["vigorous_activity", "moderate_activity", "sedentary_minutes"] if x in full_features],
        "Sleep": ["sleep_hours"] if "sleep_hours" in full_features else [],
        "Blood pressure": [x for x in ["systolic_bp", "diastolic_bp"] if x in full_features],
        "BMI and weight": [x for x in ["bmi", "weight_kg"] if x in full_features],
    }
    y = data["elevated_hba1c"].astype(int)
    full_metrics = _metrics(base["y"], base["probability"])
    rows, fitted = [], {}
    for group, removed in groups.items():
        if not removed:
            rows.append({
                "removed_group": group, "status": "not available in full model",
                "removed_features": "", "delta_roc_auc": np.nan,
                "delta_pr_auc": np.nan, "delta_recall": np.nan,
                "delta_brier_score": np.nan,
                "training_participants": len(train_idx),
                "test_participants": len(test_idx),
                "same_training_participants_as_full_model": bool(
                    np.array_equal(train_idx, np.asarray(base["train_idx"]))
                ),
                "same_test_participants_as_full_model": bool(
                    np.array_equal(test_idx, np.asarray(base["test_idx"]))
                ),
            })
            continue
        features = [x for x in full_features if x not in removed]
        model, _, _ = _fit_logistic(data.iloc[train_idx], y.iloc[train_idx].to_numpy(), features)
        prob = model.predict_proba(data.iloc[test_idx][features])[:, 1]
        met = _metrics(base["y"], prob)
        rows.append({
            "removed_group": group, "status": "evaluated on same held-out participants",
            "removed_features": "; ".join(removed),
            "delta_roc_auc": met["roc_auc"] - full_metrics["roc_auc"],
            "delta_pr_auc": met["pr_auc"] - full_metrics["pr_auc"],
            "delta_recall": met["recall"] - full_metrics["recall"],
            "delta_brier_score": met["brier_score"] - full_metrics["brier_score"],
            "training_participants": len(train_idx),
            "test_participants": len(test_idx),
            "same_training_participants_as_full_model": bool(
                np.array_equal(train_idx, np.asarray(base["train_idx"]))
            ),
            "same_test_participants_as_full_model": bool(
                np.array_equal(test_idx, np.asarray(base["test_idx"]))
            ),
        })
        fitted[group] = model
    result = pd.DataFrame(rows)
    assert result["same_training_participants_as_full_model"].all()
    assert result["same_test_participants_as_full_model"].all()
    return _save(result, table_dir / "expanded_ablation_analysis.csv"), fitted


def _association(data, variable, adjusted):
    columns = [variable] + (["age", "sex", "bmi"] if adjusted else [])
    work = data[columns + ["elevated_hba1c"]].dropna().copy()
    if len(work) < 50 or work["elevated_hba1c"].nunique() < 2:
        return None
    x = pd.to_numeric(work[variable], errors="coerce")
    is_binary = variable in BINARY_VARIABLES
    if is_binary:
        observed = set(x.dropna().unique())
        if not observed.issubset({0, 1}) or len(observed) < 2:
            return None
        work[variable] = x
        effect_scale = "Yes versus No"
    else:
        sd = x.std()
        if not np.isfinite(sd) or sd == 0:
            return None
        work[variable] = (x - x.mean()) / sd
        effect_scale = "Per 1 standard deviation"
    X = pd.get_dummies(work[columns], columns=["sex"] if adjusted else [], drop_first=True, dtype=float)
    X = sm.add_constant(X.astype(float), has_constant="add")
    try:
        fit = sm.Logit(work["elevated_hba1c"].astype(float), X).fit(disp=False)
        coef = fit.params[variable]
        ci = fit.conf_int().loc[variable]
        return {
            "variable": variable, "participants": len(work),
            "effect_scale": effect_scale,
            "odds_ratio": np.exp(coef),
            "odds_ratio_per_1_sd": np.exp(coef) if not is_binary else np.nan,
            "odds_ratio_yes_vs_no": np.exp(coef) if is_binary else np.nan,
            "ci_lower": np.exp(ci.iloc[0]), "ci_upper": np.exp(ci.iloc[1]),
            "p_value": fit.pvalues[variable],
            "elevated_group_median": data.loc[data["elevated_hba1c"].eq(1), variable].median(),
            "non_elevated_group_median": data.loc[data["elevated_hba1c"].eq(0), variable].median(),
            "missing_percent": data[variable].isna().mean() * 100,
            "interpretation": "Exploratory association, not a causal effect",
        }
    except Exception:
        return None


def diet_associations(data, groups, table_dir):
    diet = groups["diet_nutrients"] + groups["diet_behaviours"]
    unadjusted = pd.DataFrame(filter(None, (_association(data, x, False) for x in diet)))
    adjusted = pd.DataFrame(filter(None, (_association(data, x, True) for x in diet)))
    _save(unadjusted, table_dir / "diet_unadjusted_associations.csv")
    _save(adjusted, table_dir / "diet_adjusted_associations.csv")
    return unadjusted, adjusted


def family_analysis(data, incremental, table_dir, status):
    if "medical_or_family_diabetes_risk" not in data:
        result = pd.DataFrame([{
            "family_history_status": status,
            "message": "No direct family-history variable was found in the available NHANES 2017-2018 files. This variable must be collected through the WellPath onboarding survey or evaluated using another dataset.",
        }])
    else:
        rows = []
        for value, label in [(0.0, "No"), (1.0, "Yes")]:
            subset = data[data["medical_or_family_diabetes_risk"].eq(value)]
            rows.append({
                "family_history_status": status,
                "analysis_label": "Reported medical or family-history diabetes risk",
                "response": label, "participant_count": len(subset),
                "elevated_hba1c_prevalence": subset["elevated_hba1c"].mean(),
                "warning": "This is not genetics or pure family history.",
            })
        result = pd.DataFrame(rows)
        ua = _association(data, "medical_or_family_diabetes_risk", False)
        ad = _association(data, "medical_or_family_diabetes_risk", True)
        if ua:
            result["unadjusted_effect_scale"] = ua["effect_scale"]
            result["unadjusted_odds_ratio_yes_vs_no"] = ua["odds_ratio_yes_vs_no"]
            result["unadjusted_ci_lower"] = ua["ci_lower"]
            result["unadjusted_ci_upper"] = ua["ci_upper"]
        if ad:
            result["adjusted_effect_scale"] = ad["effect_scale"]
            result["adjusted_odds_ratio_yes_vs_no"] = ad["odds_ratio_yes_vs_no"]
            result["adjusted_ci_lower"] = ad["ci_lower"]
            result["adjusted_ci_upper"] = ad["ci_upper"]
        match = incremental[incremental["comparison"].eq("Add medical/family-risk proxy")]
        if not match.empty:
            result["incremental_roc_auc"] = match.iloc[0]["delta_roc_auc"]
            result["incremental_interpretation"] = match.iloc[0]["interpretation"]
    return _save(result, table_dir / "family_history_analysis.csv")


def survey_recommendations(groups, incremental, table_dir):
    delta = {row["comparison"]: row for _, row in incremental.iterrows()}
    diet_value = delta.get("Add all verified diet", {}).get("interpretation", "Not evaluated")
    proxy_value = delta.get("Add medical/family-risk proxy", {}).get("interpretation", "Not evaluated")
    rows = [
        ("Family history of diabetes", "No direct universal variable", "No", proxy_value, "Unavailable", "Collect directly if desired; DIQ170 is combined.", "Sensitive family medical information", "Optional onboarding survey", "Not evaluated directly in loaded NHANES files"),
        ("Smoking status", "SMQ_J absent", "No", "Not evaluated", "Unavailable", "Required source file was absent.", "Sensitive health behaviour", "Optional onboarding survey", "No dataset evidence in this run"),
        ("Fast-food frequency", "DBD900", "Yes", diet_value, "Optional", "Available but self-reported.", "Low-to-moderate sensitivity", "Optional context", "Seven-day behaviour may vary"),
        ("Meals away from home", "DBD895", "Yes", diet_value, "Optional", "Available but self-reported.", "Low-to-moderate sensitivity", "Optional context", "Seven-day behaviour may vary"),
        ("Food security", "FSQ_J absent", "No", "Not evaluated", "Unavailable", "Required source file was absent.", "High socioeconomic sensitivity", "Optional survey only with clear purpose", "No dataset evidence in this run"),
        ("Healthcare access", "HUQ_J absent", "No", "Not evaluated", "Unavailable", "Required source file was absent.", "Sensitive access/insurance information", "Optional survey", "No dataset evidence in this run"),
        ("Income context", "INDFMPIR", "Yes", "Included with demographics", "Optional", "May add context but can proxy structural inequity.", "High financial sensitivity", "Avoid unless essential", "Do not use punitively"),
        ("Sleep", "SLD012", "Yes", "Included in KPI models", "Keep", "Existing KPI and feasible to collect.", "Health data", "Monitoring signal", "Self-report is imprecise"),
        ("Activity", "PAQ650; PAQ665; PAD680", "Yes", "Included in KPI models", "Keep", "Existing KPI group.", "Health/behaviour data", "Monitoring signal", "Self-report is imprecise"),
        ("Blood pressure", "BPXSY1-3; BPXDI1-3", "Yes", "Included in KPI models", "Keep", "Objective examination KPI.", "Health data", "Monitoring signal", "Single visit is not a diagnosis"),
        ("Resting heart rate", "BPXPLS", "Yes", "Included in KPI models", "Keep", "Objective examination KPI.", "Health data", "Monitoring signal", "Single examination measure"),
        ("BMI or weight", "BMXBMI; BMXWT", "Yes", "Strong baseline contribution", "Keep", "Meaningful baseline predictors.", "Sensitive body measurement", "Monitoring signal", "BMI does not measure body composition"),
    ]
    columns = ["Candidate survey field", "NHANES source variable", "Dataset evidence available",
               "Incremental model value", "Recommendation", "Reason",
               "Privacy or sensitivity concern", "App usage", "Limitation"]
    return _save(pd.DataFrame(rows, columns=columns), table_dir / "wellpath_survey_recommendations.csv")


def _bar(frame, label, value, title, ylabel, path, error=None):
    fig = plt.figure(figsize=(10, 6))
    x = np.arange(len(frame))
    if error:
        low = frame[value] - frame[error[0]]
        high = frame[error[1]] - frame[value]
        plt.bar(x, frame[value], yerr=np.vstack([low, high]), capsize=3)
    else:
        plt.bar(x, frame[value])
    plt.xticks(x, frame[label], rotation=70, ha="right")
    plt.title(title)
    plt.ylabel(ylabel)
    plt.tight_layout()
    fig.savefig(path, dpi=300, bbox_inches="tight")
    plt.close(fig)


def create_figures(data, groups, comparison, incremental, ablation, adjusted_diet,
                   predictions, fitted, sample, family, chart_dir):
    chart_dir.mkdir(parents=True, exist_ok=True)
    cc = comparison[
        comparison["comparison"].eq("Complete-case")
        & comparison["estimator"].eq("Regularized logistic regression")
    ].copy()
    specs = [
        ("roc_auc", "ROC AUC by Feature Set", "ROC AUC", "01_roc_auc_by_feature_set.png", ("roc_auc_ci_lower", "roc_auc_ci_upper")),
        ("pr_auc", "Precision-Recall AUC by Feature Set", "PR AUC", "02_pr_auc_by_feature_set.png", ("pr_auc_ci_lower", "pr_auc_ci_upper")),
        ("recall", "Recall by Feature Set at the Demonstration Threshold", "Recall", "03_recall_by_feature_set.png", ("recall_ci_lower", "recall_ci_upper")),
        ("brier_score", "Brier Score by Feature Set (Lower Is Better)", "Brier score", "04_brier_by_feature_set.png", None),
    ]
    for value, title, ylabel, filename, error in specs:
        _bar(cc, "model", value, title, ylabel, chart_dir / filename, error)
    _bar(incremental, "comparison", "delta_roc_auc",
         "Incremental ROC AUC Gain from Added Groups", "Change in ROC AUC",
         chart_dir / "05_incremental_auc_gain.png")
    _bar(incremental, "comparison", "delta_recall",
         "Incremental Recall Gain from Added Groups", "Change in recall",
         chart_dir / "06_incremental_recall_gain.png")
    evaluated = ablation[ablation["status"].str.startswith("evaluated")].copy()
    _bar(evaluated, "removed_group", "delta_roc_auc",
         "Ablation: ROC AUC Change After Removing Each Group", "Change in ROC AUC",
         chart_dir / "07_ablation_auc_change.png")
    _bar(evaluated, "removed_group", "delta_brier_score",
         "Ablation: Brier-Score Change After Removing Each Group", "Change in Brier score",
         chart_dir / "08_ablation_brier_change.png")

    full_key = ("Complete-case", "Model 11: Full verified", "Regularized logistic regression")
    model = fitted[full_key]
    names = model.named_steps["preprocess"].get_feature_names_out()
    coef = model.named_steps["model"].coef_[0]
    order = np.argsort(np.abs(coef))[-20:]
    fig = plt.figure(figsize=(9, 7))
    plt.barh(np.asarray(names)[order], np.exp(coef[order]))
    plt.axvline(1)
    plt.title("Full Logistic Model: Exponentiated Standardized Coefficients")
    plt.xlabel("Exponentiated coefficient (descriptive; no confidence intervals)")
    plt.tight_layout()
    fig.savefig(
        chart_dir / "09_full_logistic_exponentiated_coefficients.png",
        dpi=300, bbox_inches="tight",
    )
    plt.close(fig)
    (chart_dir / "09_full_logistic_odds_ratios.png").unlink(missing_ok=True)

    rf_key = ("Complete-case", "Model 11: Full verified", "Random forest")
    rf = fitted[rf_key]
    pred = predictions[rf_key]
    features = groups["core_kpis"] + groups["demographics"] + groups["diet_nutrients"] + groups["diet_behaviours"] + groups["medical_family_risk_proxy"]
    imp = permutation_importance(
        rf, data.iloc[pred["test_idx"]][features], pred["y"],
        scoring="roc_auc", n_repeats=10, random_state=RANDOM_STATE,
    )
    order = np.argsort(imp.importances_mean)[-20:]
    fig = plt.figure(figsize=(9, 7))
    plt.barh(np.asarray(features)[order], imp.importances_mean[order])
    plt.title("Final Random Forest: Held-Out Permutation Importance")
    plt.xlabel("Decrease in ROC AUC")
    plt.tight_layout()
    fig.savefig(chart_dir / "10_final_tree_permutation_importance.png", dpi=300, bbox_inches="tight")
    plt.close(fig)

    observed, predicted = calibration_curve(pred["y"], pred["probability"], n_bins=10, strategy="quantile")
    fig = plt.figure(figsize=(7, 6))
    plt.plot(predicted, observed, marker="o", label="Final random forest")
    plt.plot([0, 1], [0, 1], linestyle="--", label="Ideal calibration")
    plt.xlabel("Mean predicted probability")
    plt.ylabel("Observed proportion")
    plt.title("Calibration of the Final Complete-Case Model")
    plt.legend()
    plt.tight_layout()
    fig.savefig(chart_dir / "11_final_model_calibration.png", dpi=300, bbox_inches="tight")
    plt.close(fig)

    cm = confusion_matrix(pred["y"], pred["probability"] >= DEMONSTRATION_THRESHOLD)
    fig = plt.figure(figsize=(6, 5))
    plt.imshow(cm)
    for i in range(2):
        for j in range(2):
            plt.text(j, i, str(cm[i, j]), ha="center", va="center")
    plt.xticks([0, 1], ["Below 5.7%", "At least 5.7%"])
    plt.yticks([0, 1], ["Below 5.7%", "At least 5.7%"])
    plt.xlabel("Predicted class")
    plt.ylabel("Observed class")
    plt.title("Final Model Confusion Matrix at Threshold 0.50")
    plt.tight_layout()
    fig.savefig(chart_dir / "12_demonstration_confusion_matrix.png", dpi=300, bbox_inches="tight")
    plt.close(fig)

    diet_features = groups["diet_nutrients"] + groups["diet_behaviours"]
    missing = pd.DataFrame({"feature": diet_features, "missing_percent": [data[x].isna().mean() * 100 for x in diet_features]})
    _bar(missing, "feature", "missing_percent", "Diet-Feature Availability and Missingness",
         "Missing (%)", chart_dir / "13_diet_feature_missingness.png")

    fig = plt.figure(figsize=(10, 5))
    plt.axis("off")
    text = (
        "Family-history decision\n\n"
        "DIQ175A: Ambiguous — only asked as a reason for perceived risk.\n"
        "DIQ170: Selected only as 'Reported medical or family-history diabetes risk'.\n"
        "Direct universal family-history variable: Not found.\n\n"
        "The proxy is not genetics and is not pure family history."
    )
    plt.text(0.03, 0.95, text, va="top", fontsize=13)
    plt.title("Family-History Variable Review")
    fig.savefig(chart_dir / "14_family_history_decision.png", dpi=300, bbox_inches="tight")
    plt.close(fig)

    if not adjusted_diet.empty:
        ordered = adjusted_diet.sort_values("odds_ratio_per_1_sd")
        fig = plt.figure(figsize=(9, 7))
        xerr = np.vstack([
            ordered["odds_ratio_per_1_sd"] - ordered["ci_lower"],
            ordered["ci_upper"] - ordered["odds_ratio_per_1_sd"],
        ])
        plt.errorbar(ordered["odds_ratio_per_1_sd"], ordered["variable"], xerr=xerr, fmt="o", capsize=3)
        plt.axvline(1, linestyle="--")
        plt.title("Adjusted Diet Associations with Elevated HbA1c")
        plt.xlabel("Odds ratio per 1 SD (95% CI)")
        plt.tight_layout()
        fig.savefig(chart_dir / "15_adjusted_diet_associations.png", dpi=300, bbox_inches="tight")
        plt.close(fig)
    _bar(sample[sample["estimator"].eq("Regularized logistic regression")],
         "model", "final_training_count", "Training Sample Size by Model and Comparison",
         "Training participants", chart_dir / "16_model_sample_sizes.png")


def run_expanded_analysis(
    project_root: Path,
    *,
    available_case_min_predictor_fraction: float = DEFAULT_AVAILABLE_CASE_MIN_PREDICTOR_FRACTION,
) -> dict:
    project_root = Path(project_root)
    raw_dir = project_root / "data" / "raw" / "nhanes"
    table_dir = project_root / "outputs" / "tables"
    chart_dir = project_root / "outputs" / "charts"
    model_dir = project_root / "outputs" / "models"
    inventory = create_file_inventory(raw_dir, table_dir)
    data, groups, file_report = engineer_expanded_features(raw_dir)
    discovery, family_review, family_status = create_discovery_reports(
        set(inventory["column_name"].dropna()), table_dir
    )
    experiments = build_experiments(groups)
    audit = leakage_audit(experiments, table_dir)
    comparison, predictions, fitted, sample, cohort_report = run_model_experiments(
        data, experiments, table_dir, model_dir,
        available_case_min_predictor_fraction=available_case_min_predictor_fraction,
    )
    incremental = incremental_analysis(predictions, table_dir)
    ablation, _ = ablation_analysis(data, experiments, predictions, table_dir)
    integrity = model_integrity_audit(
        predictions, fitted, incremental, ablation, audit, table_dir
    )
    unadjusted, adjusted = diet_associations(data, groups, table_dir)
    family = family_analysis(data, incremental, table_dir, family_status)
    recommendations = survey_recommendations(groups, incremental, table_dir)
    create_figures(
        data, groups, comparison, incremental, ablation, adjusted,
        predictions, fitted, sample, family, chart_dir,
    )
    best_cc = comparison[
        comparison["comparison"].eq("Complete-case")
        & ~comparison["estimator"].eq("Dummy classifier")
    ].sort_values("roc_auc", ascending=False).iloc[0]
    best_ac = comparison[
        comparison["comparison"].eq("Available-case")
    ].sort_values("roc_auc", ascending=False).iloc[0]
    diet_delta = incremental[incremental["comparison"].eq("Add all verified diet")]
    proxy_delta = incremental[
        incremental["comparison"].eq("Add medical/family-risk proxy")
    ]
    full_delta = incremental[incremental["comparison"].eq("Full versus age + BMI")]
    weight_delta = incremental[
        incremental["comparison"].eq("Add weight beyond BMI")
    ]
    cohort_sizes = cohort_report.set_index("cohort")["participant_count"]
    summary = {
        "eligible_participants": int(len(data)),
        "positive_participants": int(data["elevated_hba1c"].sum()),
        "negative_participants": int((1 - data["elevated_hba1c"]).sum()),
        "diet_variables_found": groups["diet_nutrients"] + groups["diet_behaviours"],
        "family_history_status": family_status,
        "smoking_variables_found": groups["smoking"],
        "food_security_variables_found": groups["food_security"],
        "healthcare_access_variables_found": groups["healthcare_access"],
        "models_successfully_trained": int(len(comparison)),
        "available_case_min_predictor_fraction": available_case_min_predictor_fraction,
        "complete_case_sample_size": int(cohort_sizes["Strict complete-case"]),
        "shared_comparison_sample_size": int(cohort_sizes["Shared-comparison"]),
        "available_case_full_model_sample_size": int(
            cohort_sizes["Available-case full model"]
        ),
        "best_complete_case_model": best_cc["model"],
        "best_complete_case_estimator": best_cc["estimator"],
        "best_complete_case_roc_auc": float(best_cc["roc_auc"]),
        "best_available_case_model": best_ac["model"],
        "best_available_case_estimator": best_ac["estimator"],
        "best_available_case_roc_auc": float(best_ac["roc_auc"]),
        "diet_incremental_result": (
            diet_delta.iloc[0]["interpretation"] if not diet_delta.empty else "Not evaluated"
        ),
        "diet_delta_roc_auc": (
            float(diet_delta.iloc[0]["delta_roc_auc"]) if not diet_delta.empty else None
        ),
        "diet_delta_roc_auc_ci_lower": (
            float(diet_delta.iloc[0]["delta_roc_auc_ci_lower"])
            if not diet_delta.empty else None
        ),
        "diet_delta_roc_auc_ci_upper": (
            float(diet_delta.iloc[0]["delta_roc_auc_ci_upper"])
            if not diet_delta.empty else None
        ),
        "proxy_incremental_result": (
            proxy_delta.iloc[0]["interpretation"] if not proxy_delta.empty else "Not evaluated"
        ),
        "proxy_delta_roc_auc": (
            float(proxy_delta.iloc[0]["delta_roc_auc"])
            if not proxy_delta.empty else None
        ),
        "proxy_delta_roc_auc_ci_lower": (
            float(proxy_delta.iloc[0]["delta_roc_auc_ci_lower"])
            if not proxy_delta.empty else None
        ),
        "proxy_delta_roc_auc_ci_upper": (
            float(proxy_delta.iloc[0]["delta_roc_auc_ci_upper"])
            if not proxy_delta.empty else None
        ),
        "full_vs_age_bmi_result": (
            full_delta.iloc[0]["interpretation"] if not full_delta.empty else "Not evaluated"
        ),
        "full_vs_age_bmi_delta_roc_auc": (
            float(full_delta.iloc[0]["delta_roc_auc"]) if not full_delta.empty else None
        ),
        "full_vs_age_bmi_delta_roc_auc_ci_lower": (
            float(full_delta.iloc[0]["delta_roc_auc_ci_lower"])
            if not full_delta.empty else None
        ),
        "full_vs_age_bmi_delta_roc_auc_ci_upper": (
            float(full_delta.iloc[0]["delta_roc_auc_ci_upper"])
            if not full_delta.empty else None
        ),
        "weight_beyond_bmi_result": (
            weight_delta.iloc[0]["interpretation"]
            if not weight_delta.empty else "Not evaluated"
        ),
        "weight_beyond_bmi_delta_roc_auc": (
            float(weight_delta.iloc[0]["delta_roc_auc"])
            if not weight_delta.empty else None
        ),
        "weight_beyond_bmi_delta_roc_auc_ci_lower": (
            float(weight_delta.iloc[0]["delta_roc_auc_ci_lower"])
            if not weight_delta.empty else None
        ),
        "weight_beyond_bmi_delta_roc_auc_ci_upper": (
            float(weight_delta.iloc[0]["delta_roc_auc_ci_upper"])
            if not weight_delta.empty else None
        ),
        "safety": "Exploratory elevated-HbA1c classification research prototype; not diagnostic or clinically validated.",
    }
    (table_dir / "expanded_analysis_summary.json").write_text(
        json.dumps(summary, indent=2), encoding="utf-8"
    )
    return {
        "inventory": inventory, "discovery": discovery,
        "family_review": family_review, "groups": groups,
        "experiments": experiments, "audit": audit,
        "comparison": comparison, "incremental": incremental,
        "cohort_report": cohort_report, "integrity_audit": integrity,
        "ablation": ablation, "diet_unadjusted": unadjusted,
        "diet_adjusted": adjusted, "family_analysis": family,
        "sample_size": sample, "recommendations": recommendations,
        "summary": summary, "file_report": file_report,
    }
