"""Model construction, training-only tuning, and additive score rules."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import (
    GridSearchCV,
    StratifiedKFold,
    cross_val_predict,
    train_test_split,
)
from sklearn.pipeline import Pipeline
from sklearn.tree import DecisionTreeClassifier

from .feature_mapping import FEATURE_SETS, PARTICIPANT_ID, TARGET_NAME
from .preprocessing import build_preprocessor, infer_feature_types


RANDOM_STATE = 42


@dataclass
class SplitData:
    X_train: pd.DataFrame
    X_test: pd.DataFrame
    y_train: pd.Series
    y_test: pd.Series
    train_ids: pd.Series
    test_ids: pd.Series


@dataclass
class ModelSpec:
    estimator: object
    parameter_grid: dict
    scale_continuous: bool


ADDITIVE_SCORE_RULES = pd.DataFrame(
    [
        ("age", "Age ≥ 45 years", 1),
        ("bmi", "BMI ≥ 25 kg/m²", 1),
        ("systolic_bp", "Systolic blood pressure ≥ 130 mmHg", 1),
        ("diastolic_bp", "Diastolic blood pressure ≥ 80 mmHg", 1),
        ("resting_heart_rate", "Resting heart rate ≥ 80 beats/minute", 1),
        ("sleep_hours", "Sleep duration < 7 or > 9 hours/night", 1),
        ("sedentary_minutes", "Sedentary behaviour ≥ 480 minutes/day", 1),
        ("family_history_diabetes", "Configured yes category equals 1", 1),
        ("smoking_status", "Configured current-smoking category equals 1", 1),
    ],
    columns=["feature", "point_rule", "points"],
)


def construct_elevated_hba1c(
    frame: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.Series]:
    """Exclude missing HbA1c and create the ≥5.7% exploratory target."""
    if "hba1c" not in frame.columns:
        return frame.iloc[0:0].copy(), pd.Series(dtype="int64", name=TARGET_NAME)
    valid = pd.to_numeric(frame["hba1c"], errors="coerce").notna()
    eligible = frame.loc[valid].copy()
    target = (
        pd.to_numeric(eligible.pop("hba1c"), errors="coerce") >= 5.7
    ).astype(int)
    target.name = TARGET_NAME
    return eligible, target


def stratified_participant_split(
    frame: pd.DataFrame,
    target: pd.Series,
    features: list[str],
) -> SplitData:
    """Split unique participants once; SEQN is retained only for auditing."""
    if frame[PARTICIPANT_ID].duplicated().any():
        raise ValueError("Participant rows must be unique before splitting")
    ids = frame[PARTICIPANT_ID].copy()
    indices = np.arange(len(frame))
    train_idx, test_idx = train_test_split(
        indices,
        test_size=0.20,
        random_state=RANDOM_STATE,
        stratify=target,
    )
    return SplitData(
        X_train=frame.iloc[train_idx][features].reset_index(drop=True),
        X_test=frame.iloc[test_idx][features].reset_index(drop=True),
        y_train=target.iloc[train_idx].reset_index(drop=True),
        y_test=target.iloc[test_idx].reset_index(drop=True),
        train_ids=ids.iloc[train_idx].reset_index(drop=True),
        test_ids=ids.iloc[test_idx].reset_index(drop=True),
    )


def available_feature_sets(columns: list[str] | pd.Index) -> dict[str, list[str]]:
    available = set(columns)
    sets = {
        name: [feature for feature in features if feature in available]
        for name, features in FEATURE_SETS.items()
    }
    return {name: features for name, features in sets.items() if features}


def _model_specs() -> dict[str, ModelSpec]:
    return {
        "DummyClassifier baseline": ModelSpec(
            DummyClassifier(strategy="prior"),
            {},
            False,
        ),
        "Logistic regression": ModelSpec(
            LogisticRegression(
                C=np.inf,
                l1_ratio=0.0,
                max_iter=3000,
                random_state=RANDOM_STATE,
            ),
            {},
            True,
        ),
        "Regularized logistic regression": ModelSpec(
            LogisticRegression(
                solver="liblinear",
                l1_ratio=0.0,
                class_weight="balanced",
                max_iter=3000,
                random_state=RANDOM_STATE,
            ),
            {
                "model__C": [0.1, 1.0, 10.0],
                "model__l1_ratio": [0.0, 1.0],
            },
            True,
        ),
        "Decision tree": ModelSpec(
            DecisionTreeClassifier(
                class_weight="balanced",
                random_state=RANDOM_STATE,
            ),
            {
                "model__max_depth": [3, 5, None],
                "model__min_samples_leaf": [10, 25, 50],
            },
            False,
        ),
        "Random forest": ModelSpec(
            RandomForestClassifier(
                n_estimators=300,
                class_weight="balanced",
                random_state=RANDOM_STATE,
                n_jobs=-1,
            ),
            {
                "model__max_depth": [5, None],
                "model__min_samples_leaf": [5, 20],
                "model__max_features": ["sqrt", 0.7],
            },
            False,
        ),
        "Gradient boosting classifier": ModelSpec(
            GradientBoostingClassifier(random_state=RANDOM_STATE),
            {
                "model__n_estimators": [100, 200],
                "model__learning_rate": [0.03, 0.1],
                "model__max_depth": [2, 3],
            },
            False,
        ),
    }


def make_pipeline(
    estimator: object,
    features: list[str],
    *,
    scale_continuous: bool,
) -> Pipeline:
    continuous, categorical = infer_feature_types(features)
    return Pipeline(
        [
            (
                "preprocess",
                build_preprocessor(
                    continuous,
                    categorical,
                    scale_continuous=scale_continuous,
                ),
            ),
            ("model", estimator),
        ]
    )


def fit_model_suite(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    features: list[str],
) -> tuple[dict[str, Pipeline], pd.DataFrame]:
    """Tune only within training folds and return fitted final estimators."""
    cv = StratifiedKFold(
        n_splits=5,
        shuffle=True,
        random_state=RANDOM_STATE,
    )
    fitted = {}
    rows = []
    for name, spec in _model_specs().items():
        pipeline = make_pipeline(
            clone(spec.estimator),
            features,
            scale_continuous=spec.scale_continuous,
        )
        if spec.parameter_grid:
            search = GridSearchCV(
                pipeline,
                spec.parameter_grid,
                scoring="roc_auc",
                cv=cv,
                n_jobs=1,
                refit=True,
                return_train_score=False,
            )
            search.fit(X_train, y_train)
            fitted[name] = search.best_estimator_
            rows.append(
                {
                    "model": name,
                    "result_source": "5-fold cross-validation on training data",
                    "mean_cv_roc_auc": search.best_score_,
                    "best_parameters": search.best_params_,
                }
            )
        else:
            pipeline.fit(X_train, y_train)
            cv_scores = GridSearchCV(
                pipeline,
                {},
                scoring="roc_auc",
                cv=cv,
                n_jobs=1,
                refit=True,
            )
            cv_scores.fit(X_train, y_train)
            fitted[name] = cv_scores.best_estimator_
            rows.append(
                {
                    "model": name,
                    "result_source": "5-fold cross-validation on training data",
                    "mean_cv_roc_auc": cv_scores.best_score_,
                    "best_parameters": {},
                }
            )
    return fitted, pd.DataFrame(rows)


def apply_additive_score(frame: pd.DataFrame) -> tuple[pd.Series, pd.DataFrame]:
    """Apply fixed, documented prototype rules without test-set optimization."""
    score = pd.Series(0, index=frame.index, dtype="int64")
    applied = []

    def apply(feature: str, condition: pd.Series) -> None:
        if feature in frame:
            score.loc[condition.fillna(False)] += 1
            applied.append(feature)

    if "age" in frame:
        apply("age", frame["age"] >= 45)
    if "bmi" in frame:
        apply("bmi", frame["bmi"] >= 25)
    if "systolic_bp" in frame:
        apply("systolic_bp", frame["systolic_bp"] >= 130)
    if "diastolic_bp" in frame:
        apply("diastolic_bp", frame["diastolic_bp"] >= 80)
    if "resting_heart_rate" in frame:
        apply("resting_heart_rate", frame["resting_heart_rate"] >= 80)
    if "sleep_hours" in frame:
        apply(
            "sleep_hours",
            (frame["sleep_hours"] < 7) | (frame["sleep_hours"] > 9),
        )
    if "sedentary_minutes" in frame:
        apply("sedentary_minutes", frame["sedentary_minutes"] >= 480)
    if "family_history_diabetes" in frame:
        apply(
            "family_history_diabetes",
            frame["family_history_diabetes"].eq(1),
        )
    if "smoking_status" in frame:
        apply("smoking_status", frame["smoking_status"].eq(1))

    rules = ADDITIVE_SCORE_RULES.copy()
    rules["included"] = rules["feature"].isin(applied)
    rules["status"] = np.where(
        rules["included"],
        "applied",
        "excluded because variable was unavailable",
    )
    return score, rules


def additive_score_probability(
    train_score: pd.Series,
    y_train: pd.Series,
    score_to_apply: pd.Series,
) -> np.ndarray:
    """Map score to outcome rate using training participants only."""
    rates = (
        pd.DataFrame({"score": train_score, "target": y_train})
        .groupby("score")["target"]
        .mean()
    )
    global_rate = float(y_train.mean())
    return score_to_apply.map(rates).fillna(global_rate).to_numpy()


def select_demonstration_threshold(
    pipeline: Pipeline,
    X_train: pd.DataFrame,
    y_train: pd.Series,
) -> tuple[float, pd.DataFrame]:
    """Select a prototype threshold from out-of-fold training predictions."""
    cv = StratifiedKFold(
        n_splits=5,
        shuffle=True,
        random_state=RANDOM_STATE,
    )
    probabilities = cross_val_predict(
        clone(pipeline),
        X_train,
        y_train,
        cv=cv,
        method="predict_proba",
        n_jobs=1,
    )[:, 1]
    rows = []
    for threshold in np.round(np.arange(0.10, 0.91, 0.05), 2):
        predictions = (probabilities >= threshold).astype(int)
        positives = y_train.eq(1)
        negatives = y_train.eq(0)
        sensitivity = (
            (predictions[positives] == 1).mean() if positives.any() else np.nan
        )
        specificity = (
            (predictions[negatives] == 0).mean() if negatives.any() else np.nan
        )
        rows.append(
            {
                "threshold": threshold,
                "sensitivity": sensitivity,
                "specificity": specificity,
                "balanced_accuracy": np.nanmean([sensitivity, specificity]),
                "result_source": "out-of-fold predictions on training data",
            }
        )
    report = pd.DataFrame(rows)
    selected = float(
        report.loc[report["balanced_accuracy"].idxmax(), "threshold"]
    )
    return selected, report
