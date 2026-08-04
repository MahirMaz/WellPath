"""Held-out evaluation, threshold, subgroup, ablation, and survey summaries."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.base import clone
from sklearn.calibration import calibration_curve
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    balanced_accuracy_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)


def classification_metrics(
    y_true: pd.Series | np.ndarray,
    probability: np.ndarray,
    threshold: float,
) -> dict:
    y_true = np.asarray(y_true)
    probability = np.asarray(probability)
    prediction = (probability >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, prediction, labels=[0, 1]).ravel()
    return {
        "roc_auc": roc_auc_score(y_true, probability),
        "precision_recall_auc": average_precision_score(y_true, probability),
        "accuracy": accuracy_score(y_true, prediction),
        "balanced_accuracy": balanced_accuracy_score(y_true, prediction),
        "precision": precision_score(
            y_true, prediction, zero_division=0
        ),
        "recall_sensitivity": recall_score(
            y_true, prediction, zero_division=0
        ),
        "specificity": tn / (tn + fp) if (tn + fp) else np.nan,
        "f1_score": f1_score(y_true, prediction, zero_division=0),
        "brier_score": brier_score_loss(y_true, probability),
        "negative_count": int((y_true == 0).sum()),
        "positive_count": int((y_true == 1).sum()),
        "true_negative": int(tn),
        "false_positive": int(fp),
        "false_negative": int(fn),
        "true_positive": int(tp),
        "threshold": threshold,
        "result_source": "held-out test evaluation",
    }


def evaluate_models(
    models: dict,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    threshold: float,
    *,
    extra_probabilities: dict[str, np.ndarray] | None = None,
) -> tuple[pd.DataFrame, dict[str, np.ndarray]]:
    probabilities = {}
    rows = []
    for name, model in models.items():
        probability = model.predict_proba(X_test)[:, 1]
        probabilities[name] = probability
        rows.append({"model": name, **classification_metrics(y_test, probability, threshold)})
    for name, probability in (extra_probabilities or {}).items():
        probabilities[name] = np.asarray(probability)
        rows.append({"model": name, **classification_metrics(y_test, probability, threshold)})
    return pd.DataFrame(rows), probabilities


def threshold_analysis(
    y_true: pd.Series,
    probability: np.ndarray,
) -> pd.DataFrame:
    rows = []
    y = np.asarray(y_true)
    for threshold in np.round(np.arange(0.10, 0.91, 0.05), 2):
        prediction = (probability >= threshold).astype(int)
        tn, fp, fn, tp = confusion_matrix(y, prediction, labels=[0, 1]).ravel()
        rows.append(
            {
                "threshold": threshold,
                "sensitivity": tp / (tp + fn) if (tp + fn) else np.nan,
                "specificity": tn / (tn + fp) if (tn + fp) else np.nan,
                "precision": tp / (tp + fp) if (tp + fp) else np.nan,
                "false_positive_rate": fp / (fp + tn) if (fp + tn) else np.nan,
                "false_negative_rate": fn / (fn + tp) if (fn + tp) else np.nan,
                "result_source": "held-out test evaluation",
            }
        )
    return pd.DataFrame(rows)


def expected_calibration_error(
    y_true: pd.Series,
    probability: np.ndarray,
    bins: int = 10,
) -> float:
    data = pd.DataFrame({"y": np.asarray(y_true), "p": probability})
    data["bin"] = pd.cut(data["p"], np.linspace(0, 1, bins + 1), include_lowest=True)
    grouped = data.groupby("bin", observed=False)
    errors = grouped.apply(
        lambda group: abs(group["y"].mean() - group["p"].mean()) * len(group)
        if len(group)
        else 0,
        include_groups=False,
    )
    return float(errors.sum() / len(data))


def subgroup_performance(
    data: pd.DataFrame,
    y_true: pd.Series,
    probability: np.ndarray,
    threshold: float,
    *,
    minimum_size: int = 100,
) -> pd.DataFrame:
    audit = data.copy()
    audit["_target"] = np.asarray(y_true)
    audit["_probability"] = probability
    groupers = {}
    if "age" in audit:
        groupers["Age group"] = pd.cut(
            audit["age"],
            bins=[17, 39, 59, np.inf],
            labels=["18–39", "40–59", "60+"],
        )
    if "sex" in audit:
        groupers["Sex"] = audit["sex"].astype("string")
    if "race_ethnicity" in audit:
        groupers["Broad race or ethnicity"] = audit["race_ethnicity"].astype("string")
    if "bmi" in audit:
        groupers["BMI category"] = pd.cut(
            audit["bmi"],
            bins=[0, 18.5, 25, 30, np.inf],
            labels=["Underweight", "Normal", "Overweight", "Obesity category"],
        )

    rows = []
    for dimension, groups in groupers.items():
        for label in groups.dropna().unique():
            mask = groups.eq(label)
            n = int(mask.sum())
            subset_y = audit.loc[mask, "_target"]
            subset_p = audit.loc[mask, "_probability"]
            if n < minimum_size or subset_y.nunique() < 2:
                rows.append(
                    {
                        "subgroup_dimension": dimension,
                        "subgroup": str(label),
                        "sample_size": n,
                        "outcome_prevalence": subset_y.mean() if n else np.nan,
                        "roc_auc": np.nan,
                        "recall": np.nan,
                        "specificity": np.nan,
                        "calibration_error": np.nan,
                        "status": f"not reported — minimum size is {minimum_size} and both outcomes are required",
                        "result_source": "held-out test evaluation",
                    }
                )
                continue
            metrics = classification_metrics(subset_y, subset_p.to_numpy(), threshold)
            rows.append(
                {
                    "subgroup_dimension": dimension,
                    "subgroup": str(label),
                    "sample_size": n,
                    "outcome_prevalence": subset_y.mean(),
                    "roc_auc": metrics["roc_auc"],
                    "recall": metrics["recall_sensitivity"],
                    "specificity": metrics["specificity"],
                    "calibration_error": expected_calibration_error(
                        subset_y, subset_p.to_numpy()
                    ),
                    "status": "reported; similarity does not establish fairness",
                    "result_source": "held-out test evaluation",
                }
            )
    return pd.DataFrame(rows)


def survey_weighted_prevalence(
    data: pd.DataFrame,
    outcome: str,
    weight: str,
    strata: str,
    psu: str,
) -> pd.DataFrame:
    """Estimate weighted prevalence with a stratified-cluster linearized SE."""
    required = [outcome, weight, strata, psu]
    frame = data[required].dropna().copy()
    frame = frame.loc[frame[weight] > 0]
    if frame.empty:
        return pd.DataFrame()

    total_weight = frame[weight].sum()
    estimate = float((frame[weight] * frame[outcome]).sum() / total_weight)
    frame["_linearized"] = frame[weight] * (frame[outcome] - estimate)
    cluster_totals = (
        frame.groupby([strata, psu], observed=True)["_linearized"]
        .sum()
        .reset_index()
    )
    variance_total = 0.0
    usable_strata = 0
    for _, group in cluster_totals.groupby(strata, observed=True):
        clusters = len(group)
        if clusters < 2:
            continue
        usable_strata += 1
        centered = group["_linearized"] - group["_linearized"].mean()
        variance_total += clusters / (clusters - 1) * float((centered**2).sum())
    standard_error = np.sqrt(variance_total) / total_weight if usable_strata else np.nan
    return pd.DataFrame(
        [
            {
                "weighted_prevalence": estimate,
                "standard_error": standard_error,
                "ci_95_lower": max(0.0, estimate - 1.96 * standard_error)
                if np.isfinite(standard_error)
                else np.nan,
                "ci_95_upper": min(1.0, estimate + 1.96 * standard_error)
                if np.isfinite(standard_error)
                else np.nan,
                "unweighted_n": len(frame),
                "usable_strata": usable_strata,
                "result_source": "survey-weighted descriptive analysis",
            }
        ]
    )


def _finish_figure(path: Path) -> None:
    plt.tight_layout()
    plt.savefig(path, dpi=300, bbox_inches="tight")
    plt.show()
    plt.close()


def plot_roc_curves(y_true, probabilities: dict[str, np.ndarray], path: Path) -> None:
    plt.figure(figsize=(8, 6))
    ax = plt.gca()
    for name, probability in probabilities.items():
        fpr, tpr, _ = roc_curve(y_true, probability)
        auc = roc_auc_score(y_true, probability)
        ax.plot(fpr, tpr, label=f"{name} (AUC {auc:.3f})")
    ax.plot([0, 1], [0, 1], label="Chance-level discrimination")
    ax.set_xlabel("False-positive rate")
    ax.set_ylabel("Sensitivity")
    ax.set_title("Held-Out Test ROC Curves")
    ax.legend()
    _finish_figure(path)


def plot_precision_recall_curves(
    y_true,
    probabilities: dict[str, np.ndarray],
    path: Path,
) -> None:
    plt.figure(figsize=(8, 6))
    ax = plt.gca()
    for name, probability in probabilities.items():
        precision, recall, _ = precision_recall_curve(y_true, probability)
        auc = average_precision_score(y_true, probability)
        ax.plot(recall, precision, label=f"{name} (PR AUC {auc:.3f})")
    ax.set_xlabel("Recall / sensitivity")
    ax.set_ylabel("Precision")
    ax.set_title("Held-Out Test Precision–Recall Curves")
    ax.legend()
    _finish_figure(path)


def plot_confusion_matrix(
    y_true,
    probability: np.ndarray,
    threshold: float,
    path: Path,
) -> None:
    matrix = confusion_matrix(y_true, probability >= threshold, labels=[0, 1])
    plt.figure(figsize=(6, 5))
    ax = plt.gca()
    image = ax.imshow(matrix)
    plt.colorbar(image, ax=ax)
    ax.set_xticks([0, 1], ["Below threshold", "Elevated category"])
    ax.set_yticks([0, 1], ["Below threshold", "Elevated category"])
    ax.set_xlabel("Predicted category")
    ax.set_ylabel("Observed category")
    ax.set_title("Selected Model Confusion Matrix")
    for row in range(2):
        for column in range(2):
            ax.text(column, row, str(matrix[row, column]), ha="center", va="center")
    _finish_figure(path)


def plot_calibration(
    y_true,
    probability: np.ndarray,
    path: Path,
) -> None:
    observed, predicted = calibration_curve(y_true, probability, n_bins=10)
    plt.figure(figsize=(7, 6))
    ax = plt.gca()
    ax.plot(predicted, observed, label="Selected model")
    ax.plot([0, 1], [0, 1], label="Perfect calibration")
    ax.set_xlabel("Mean predicted probability")
    ax.set_ylabel("Observed outcome fraction")
    ax.set_title("Held-Out Test Calibration")
    ax.legend()
    _finish_figure(path)


def plot_threshold_sensitivity_specificity(
    threshold_table: pd.DataFrame,
    selected_threshold: float,
    path: Path,
) -> None:
    plt.figure(figsize=(8, 5))
    ax = plt.gca()
    ax.plot(threshold_table["threshold"], threshold_table["sensitivity"], label="Sensitivity")
    ax.plot(threshold_table["threshold"], threshold_table["specificity"], label="Specificity")
    ax.axvline(
        selected_threshold,
        label="Demonstration threshold selected for prototype evaluation",
    )
    ax.set_xlabel("Classification threshold")
    ax.set_ylabel("Metric value")
    ax.set_ylim(0, 1)
    ax.set_title("Sensitivity and Specificity Across Thresholds")
    ax.legend()
    _finish_figure(path)


def plot_feature_set_metric(
    table: pd.DataFrame,
    metric: str,
    title: str,
    path: Path,
) -> None:
    ordered = table.sort_values(metric, ascending=False)
    plt.figure(figsize=(8, 5))
    ax = plt.gca()
    ax.bar(ordered["feature_set"], ordered[metric])
    ax.set_ylim(0, 1)
    ax.set_ylabel(metric.replace("_", " ").upper())
    ax.set_title(title)
    for bar, value in zip(ax.patches, ordered[metric]):
        ax.annotate(
            f"{value:.3f}",
            (bar.get_x() + bar.get_width() / 2, bar.get_height()),
            xytext=(0, 4),
            textcoords="offset points",
            ha="center",
        )
    _finish_figure(path)
