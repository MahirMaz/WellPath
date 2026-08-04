"""Interpretable model summaries and cautious prototype inference."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy.stats import norm
from sklearn.inspection import permutation_importance

from .feature_mapping import FEATURE_SPECS


def _reference_categories(preprocessor) -> dict[str, str]:
    references = {}
    try:
        categorical_pipeline = preprocessor.named_transformers_["categorical"]
        encoder = categorical_pipeline.named_steps["one_hot"]
        categorical_columns = preprocessor.transformers_[1][2]
        for feature, categories in zip(categorical_columns, encoder.categories_):
            references[feature] = str(categories[0])
    except (KeyError, IndexError, AttributeError):
        pass
    return references


def logistic_regression_coefficients(
    pipeline,
    X_train: pd.DataFrame,
    y_train: pd.Series,
) -> pd.DataFrame:
    """Return coefficients and approximate unpenalized Wald intervals.

    Confidence intervals are emitted only when the observed Fisher information
    can be inverted and the fitted estimator is unpenalized.
    """
    preprocessor = pipeline.named_steps["preprocess"]
    model = pipeline.named_steps["model"]
    names = list(preprocessor.get_feature_names_out())
    coefficients = model.coef_[0]
    transformed = np.asarray(preprocessor.transform(X_train), dtype=float)
    probabilities = model.predict_proba(transformed)[:, 1]
    design = np.column_stack([np.ones(len(transformed)), transformed])
    weights = probabilities * (1 - probabilities)
    fisher = design.T @ (design * weights[:, None])
    covariance = np.linalg.pinv(fisher)
    standard_errors = np.sqrt(np.clip(np.diag(covariance)[1:], 0, None))
    z = norm.ppf(0.975)
    references = _reference_categories(preprocessor)

    rows = []
    for name, coefficient, standard_error in zip(
        names, coefficients, standard_errors
    ):
        clean_display = name.replace("continuous__", "").replace("categorical__", "")
        source_feature = next(
            (
                feature
                for feature in FEATURE_SPECS
                if clean_display == feature or clean_display.startswith(f"{feature}_")
            ),
            clean_display,
        )
        is_continuous = FEATURE_SPECS.get(source_feature, {}).get("kind") == "continuous"
        unit = (
            f"per 1 training-standard-deviation increase ({FEATURE_SPECS[source_feature]['unit']})"
            if is_continuous
            else f"category versus reference {references.get(source_feature, 'not identified')}"
        )
        lower = coefficient - z * standard_error
        upper = coefficient + z * standard_error
        rows.append(
            {
                "feature_name": clean_display,
                "source_feature": source_feature,
                "coefficient": coefficient,
                "adjusted_odds_ratio": np.exp(coefficient),
                "ci_95_lower": np.exp(lower),
                "ci_95_upper": np.exp(upper),
                "reference_category": references.get(source_feature, ""),
                "continuous_unit_or_contrast": unit,
                "ci_status": (
                    "approximate Wald interval from unpenalized training fit; review model assumptions"
                ),
                "result_source": "training-data model interpretation",
            }
        )
    return pd.DataFrame(rows)


def permutation_importance_table(
    pipeline,
    X_test: pd.DataFrame,
    y_test: pd.Series,
) -> pd.DataFrame:
    result = permutation_importance(
        pipeline,
        X_test,
        y_test,
        scoring="roc_auc",
        n_repeats=20,
        random_state=42,
        n_jobs=1,
    )
    return (
        pd.DataFrame(
            {
                "feature": X_test.columns,
                "importance_mean_roc_auc_decrease": result.importances_mean,
                "importance_standard_deviation": result.importances_std,
                "result_source": "permutation importance on held-out test data",
            }
        )
        .sort_values("importance_mean_roc_auc_decrease", ascending=False)
        .reset_index(drop=True)
    )


def plot_logistic_forest(table: pd.DataFrame, path: Path) -> None:
    chart = table.sort_values("adjusted_odds_ratio", ascending=False).reset_index(drop=True)
    y = np.arange(len(chart))
    plt.figure(figsize=(10, max(6, len(chart) * 0.35)))
    ax = plt.gca()
    ax.hlines(y, chart["ci_95_lower"], chart["ci_95_upper"])
    ax.scatter(chart["adjusted_odds_ratio"], y)
    ax.axvline(1.0)
    ax.set_yticks(y, chart["feature_name"])
    ax.invert_yaxis()
    ax.set_xscale("log")
    ax.set_xlabel("Adjusted odds ratio (log scale)")
    ax.set_title("Training-Fit Logistic Regression Associations")
    plt.tight_layout()
    plt.savefig(path, dpi=300, bbox_inches="tight")
    plt.show()
    plt.close()


def predict_monitoring_signal(
    patient_record: dict,
    pipeline,
    metadata: dict,
) -> dict:
    """Return a cautious demonstration signal from a fitted research model."""
    required = list(metadata["feature_names"])
    missing = [
        feature
        for feature in required
        if feature not in patient_record or pd.isna(patient_record[feature])
    ]
    frame = pd.DataFrame([{feature: patient_record.get(feature, np.nan) for feature in required}])
    probability = float(pipeline.predict_proba(frame)[:, 1][0])
    if probability < 0.33:
        band = "Low monitoring signal"
    elif probability < 0.67:
        band = "Moderate monitoring signal"
    else:
        band = "Elevated monitoring signal"

    contributions = []
    model = pipeline.named_steps["model"]
    if hasattr(model, "coef_"):
        transformed = np.asarray(
            pipeline.named_steps["preprocess"].transform(frame),
            dtype=float,
        )[0]
        names = pipeline.named_steps["preprocess"].get_feature_names_out()
        values = transformed * model.coef_[0]
        order = np.argsort(np.abs(values))[::-1][:5]
        contributions = [
            {"feature": str(names[index]), "log_odds_contribution": float(values[index])}
            for index in order
        ]
    else:
        local_differences = []
        for feature in required:
            perturbed = frame.copy()
            perturbed.loc[0, feature] = np.nan
            reference_probability = float(
                pipeline.predict_proba(perturbed)[:, 1][0]
            )
            local_differences.append(
                {
                    "feature": feature,
                    "probability_difference_from_training_imputed_reference": (
                        probability - reference_probability
                    ),
                }
            )
        contributions = sorted(
            local_differences,
            key=lambda row: abs(
                row[
                    "probability_difference_from_training_imputed_reference"
                ]
            ),
            reverse=True,
        )[:5]

    return {
        "predicted_probability": probability,
        "demonstration_risk_band": band,
        "classification_threshold_used": metadata["threshold"],
        "top_contributing_features": contributions,
        "missing_required_features": missing,
        "model_version": metadata["model_name"],
        "disclaimer": (
            "Synthetic or individual examples are demonstrations only. "
            "This research prototype is not clinically validated and does not provide a diagnosis."
        ),
    }
