"""Load and join manually supplied NHANES XPT or CSV components."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from .feature_mapping import FEATURE_SPECS, PARTICIPANT_ID


@dataclass
class LoadResult:
    data: pd.DataFrame
    file_report: pd.DataFrame
    availability_report: pd.DataFrame
    resolved_sources: dict[str, list[str]]


def discover_nhanes_files(raw_dir: Path) -> list[Path]:
    """Return local XPT/CSV inputs without downloading anything."""
    raw_dir = Path(raw_dir)
    if not raw_dir.exists():
        return []
    return sorted(
        path
        for path in raw_dir.iterdir()
        if path.is_file() and path.suffix.lower() in {".xpt", ".csv"}
    )


def read_component(path: Path) -> pd.DataFrame:
    """Read one NHANES component and require the participant identifier."""
    path = Path(path)
    if path.suffix.lower() == ".xpt":
        frame = pd.read_sas(path, format="xport", encoding="utf-8")
    elif path.suffix.lower() == ".csv":
        frame = pd.read_csv(path)
    else:
        raise ValueError(f"Unsupported NHANES file type: {path.suffix}")

    frame.columns = [str(column).strip() for column in frame.columns]
    if PARTICIPANT_ID not in frame.columns:
        raise ValueError(f"{path.name} does not contain required {PARTICIPANT_ID}")

    frame[PARTICIPANT_ID] = pd.to_numeric(
        frame[PARTICIPANT_ID], errors="coerce"
    )
    frame = frame.dropna(subset=[PARTICIPANT_ID])
    frame = frame.drop_duplicates()
    duplicate_ids = frame[PARTICIPANT_ID].duplicated(keep=False)
    if duplicate_ids.any():
        raise ValueError(
            f"{path.name} has multiple non-identical rows for "
            f"{int(duplicate_ids.sum())} participant rows"
        )
    return frame


def _join_components(components: list[tuple[Path, pd.DataFrame]]) -> pd.DataFrame:
    if not components:
        return pd.DataFrame(columns=[PARTICIPANT_ID])

    merged = components[0][1].copy()
    for path, component in components[1:]:
        overlap = [
            column
            for column in component.columns
            if column in merged.columns and column != PARTICIPANT_ID
        ]
        component = component.drop(columns=overlap)
        merged = merged.merge(
            component,
            on=PARTICIPANT_ID,
            how="outer",
            validate="one_to_one",
        )
    if merged[PARTICIPANT_ID].duplicated().any():
        raise AssertionError("Final participant table is not one row per SEQN")
    return merged


def resolve_feature_sources(
    columns: list[str] | pd.Index,
) -> tuple[dict[str, list[str]], pd.DataFrame]:
    """Resolve only exact configured variable names present in the data."""
    available = set(columns)
    resolved = {}
    rows = []
    for clean_name, spec in FEATURE_SPECS.items():
        present = [
            candidate for candidate in spec["candidates"] if candidate in available
        ]
        if spec.get("aggregate") != "row_mean" and present:
            present = present[:1]
        resolved[clean_name] = present
        rows.append(
            {
                "clean_feature": clean_name,
                "requested_candidates": "; ".join(spec["candidates"]),
                "resolved_source_variables": "; ".join(present),
                "available": bool(present),
                "feature_group": spec["group"],
                "unit": spec["unit"],
                "configured_missing_codes": "; ".join(
                    str(code) for code in spec.get("missing_codes", [])
                ),
                "status": "available" if present else "missing — not substituted",
            }
        )
    return resolved, pd.DataFrame(rows)


def load_nhanes_directory(raw_dir: Path) -> LoadResult:
    """Load all eligible local files, join on SEQN, and report availability."""
    files = discover_nhanes_files(raw_dir)
    components = []
    report_rows = []
    for path in files:
        try:
            frame = read_component(path)
            components.append((path, frame))
            report_rows.append(
                {
                    "file": path.name,
                    "status": "loaded",
                    "rows": len(frame),
                    "columns": len(frame.columns),
                    "message": "",
                }
            )
        except Exception as exc:
            report_rows.append(
                {
                    "file": path.name,
                    "status": "rejected",
                    "rows": 0,
                    "columns": 0,
                    "message": str(exc),
                }
            )

    merged = _join_components(components)
    resolved, availability = resolve_feature_sources(merged.columns)
    file_report = pd.DataFrame(
        report_rows,
        columns=["file", "status", "rows", "columns", "message"],
    )
    return LoadResult(merged, file_report, availability, resolved)


def materialize_clean_features(
    raw_data: pd.DataFrame,
    resolved_sources: dict[str, list[str]],
) -> pd.DataFrame:
    """Create clean feature columns from confirmed source columns only."""
    clean = pd.DataFrame(index=raw_data.index)
    if PARTICIPANT_ID in raw_data:
        clean[PARTICIPANT_ID] = raw_data[PARTICIPANT_ID]

    for clean_name, sources in resolved_sources.items():
        if not sources:
            continue
        numeric = raw_data[sources].apply(pd.to_numeric, errors="coerce")
        if FEATURE_SPECS[clean_name].get("aggregate") == "row_mean":
            clean[clean_name] = numeric.mean(axis=1, skipna=True)
        else:
            clean[clean_name] = numeric.iloc[:, 0]
    return clean
