"""Cleaning and leakage-safe sklearn preprocessing."""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from .feature_mapping import FEATURE_SPECS


def replace_missing_codes(frame: pd.DataFrame) -> pd.DataFrame:
    """Replace only feature-configured refused/don't-know codes with NaN.

    Cycle-specific codebooks remain authoritative and must be reviewed.
    """
    clean = frame.copy()
    for feature, spec in FEATURE_SPECS.items():
        missing_codes = spec.get("missing_codes", [])
        if feature in clean.columns and missing_codes:
            clean[feature] = clean[feature].replace(missing_codes, np.nan)
    return clean


def enforce_valid_ranges(frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Set invalid physiological values to NaN and document every rule."""
    clean = frame.copy()
    rows = []
    for feature, spec in FEATURE_SPECS.items():
        bounds = spec.get("valid_range")
        if bounds is None:
            continue
        lower, upper = bounds
        if feature not in clean.columns:
            rows.append(
                {
                    "feature": feature,
                    "unit": spec["unit"],
                    "minimum_valid": lower,
                    "maximum_valid": upper,
                    "available_in_loaded_data": False,
                    "values_set_to_missing": 0,
                }
            )
            continue
        series = pd.to_numeric(clean[feature], errors="coerce")
        invalid = pd.Series(False, index=series.index)
        if lower is not None:
            invalid |= series < lower
        if upper is not None:
            invalid |= series > upper
        clean.loc[invalid, feature] = np.nan
        rows.append(
            {
                "feature": feature,
                "unit": spec["unit"],
                "minimum_valid": lower,
                "maximum_valid": upper,
                "available_in_loaded_data": True,
                "values_set_to_missing": int(invalid.sum()),
            }
        )
    return clean, pd.DataFrame(rows)


def missingness_report(frame: pd.DataFrame) -> pd.DataFrame:
    """Return variable-level missing counts and percentages."""
    if frame.empty:
        return pd.DataFrame(
            columns=["variable", "missing_count", "total_count", "missing_percent"]
        )
    return pd.DataFrame(
        {
            "variable": frame.columns,
            "missing_count": frame.isna().sum().values,
            "total_count": len(frame),
            "missing_percent": frame.isna().mean().mul(100).values,
        }
    ).sort_values("missing_percent", ascending=False, ignore_index=True)


def infer_feature_types(
    features: list[str],
) -> tuple[list[str], list[str]]:
    continuous = [
        feature
        for feature in features
        if FEATURE_SPECS[feature]["kind"] == "continuous"
    ]
    categorical = [
        feature
        for feature in features
        if FEATURE_SPECS[feature]["kind"] == "categorical"
    ]
    return continuous, categorical


def build_preprocessor(
    continuous_features: list[str],
    categorical_features: list[str],
    *,
    scale_continuous: bool,
) -> ColumnTransformer:
    """Create train-fitted imputation/encoding with documented references."""
    transformers = []
    if continuous_features:
        continuous_steps = [("imputer", SimpleImputer(strategy="median"))]
        if scale_continuous:
            continuous_steps.append(("scaler", StandardScaler()))
        transformers.append(
            ("continuous", Pipeline(continuous_steps), continuous_features)
        )
    if categorical_features:
        transformers.append(
            (
                "categorical",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        (
                            "one_hot",
                            OneHotEncoder(
                                handle_unknown="ignore",
                                drop="first",
                                sparse_output=False,
                            ),
                        ),
                    ]
                ),
                categorical_features,
            )
        )
    return ColumnTransformer(transformers, remainder="drop")
