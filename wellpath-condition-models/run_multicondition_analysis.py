"""Project-root runner for the NHANES multi-condition analysis."""

from pathlib import Path

from src.multicondition_analysis import run_multicondition_analysis


PROJECT_ROOT = Path(__file__).resolve().parent


def main() -> None:
    run_multicondition_analysis(PROJECT_ROOT)
    output_paths = [
        PROJECT_ROOT / "outputs" / "tables" / "multicondition_model_comparison.csv",
        PROJECT_ROOT / "outputs" / "tables" / "multicondition_model_selection.csv",
        PROJECT_ROOT / "outputs" / "tables" / "multicondition_incremental_value.csv",
        PROJECT_ROOT / "outputs" / "tables" / "multicondition_ablation_analysis.csv",
        PROJECT_ROOT / "outputs" / "tables" / "multicondition_sample_report.csv",
        PROJECT_ROOT / "outputs" / "tables" / "multicondition_variable_discovery.csv",
        PROJECT_ROOT / "outputs" / "tables" / "multicondition_leakage_audit.csv",
        PROJECT_ROOT / "outputs" / "tables" / "multicondition_integrity_audit.csv",
        PROJECT_ROOT / "outputs" / "tables" / "multicondition_component_status.csv",
        PROJECT_ROOT / "outputs" / "tables" / "multicondition_global_feature_importance.csv",
        PROJECT_ROOT / "outputs" / "tables" / "multicondition_summary.json",
        PROJECT_ROOT / "outputs" / "predictions" / "multicondition_participant_explanations.csv",
        PROJECT_ROOT / "outputs" / "models",
        PROJECT_ROOT / "outputs" / "charts",
    ]
    print("\nEXACT OUTPUT PATHS")
    for path in output_paths:
        print(path.resolve())


if __name__ == "__main__":
    main()
