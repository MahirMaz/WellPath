# WellPath Public-Health Data Visualizations

## Project purpose

This standalone Jupyter Notebook project visualizes supplied exploratory public-health research outputs associated with WellPath. It does not connect to the WellPath application, backend, or database, and it does not recalculate the supplied research findings.

The supplied values require verification against the original NHANES, CDC PLACES, and Statistics Canada CCHS datasets and analysis scripts before they are presented as final findings. Nothing in this project should be described as clinically validated.

## Required VS Code extensions

- Python by Microsoft
- Jupyter by Microsoft

## Setup

1. Open a terminal in this project directory.
2. Create or activate a Python virtual environment:

   ```powershell
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

3. Install the dependencies:

   ```powershell
   pip install -r requirements.txt
   ```

4. Open `wellpath_research_visualizations.ipynb` in VS Code.
5. Select the Python interpreter from the virtual environment as the notebook kernel.
6. Choose **Run All** to execute every cell from top to bottom.

## Outputs

- Central supplied results: `data/research_results.csv`
- High-resolution charts: `research-output/charts/`
- Research-to-product mapping table: `research-output/tables/wellpath_research_mapping.csv`

All output folders are created automatically by the notebook.

## Separation from the WellPath application

This project is intentionally separate from the WellPath React/Vite application. It does not modify application navigation, use frontend code, connect to the backend or MySQL database, or supply values to the application.
