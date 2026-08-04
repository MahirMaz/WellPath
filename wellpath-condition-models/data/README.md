# NHANES data requirements

Place de-identified, participant-level NHANES component files in:

`data/raw/nhanes/`

Supported formats are SAS Transport (`.xpt`) and CSV (`.csv`). Files are joined
with the NHANES participant identifier `SEQN`. Each input file must contain no
more than one row per participant. The loader reports and removes exact duplicate
participant rows within a component before enforcing a one-row-per-participant
join.

No data are downloaded automatically. Obtain files from a verified NHANES source
and document the cycle and source before running the analysis.

For the first elevated-HbA1c implementation, the data must include:

- a laboratory component containing `SEQN` and a confirmed HbA1c variable
  (the default candidate is `LBXGH`);
- demographic fields such as age and sex;
- as many confirmed KPI, lifestyle, family-history, income, access, and survey
  design fields as are available.

The configurable candidates and valid ranges live in
`src/feature_mapping.py`. Review them against the codebook for the exact NHANES
cycle before treating any result as final.

Do not place synthetic WellPath application profiles here. Synthetic profiles
may be used only after a real public-data model has been trained, and any
prediction from them must be labelled as a demonstration.
