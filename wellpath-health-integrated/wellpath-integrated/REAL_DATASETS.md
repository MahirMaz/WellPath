# WellPath — Real Datasets for the Genetic & Geographical Dimensions

Purpose: understand the "genetic" and "geographical/population-health" variables the Deloitte
stakeholder described, and ground them in **real, downloadable datasets** we can use to (a) test the
risk algorithm and (b) generate realistic sample patient profiles later.

---

## 1. Geographical / population-health data — what it actually is

**Concept.** Health risk isn't only individual — it correlates with *where you live*, through two
mechanisms:
1. **Environment & social determinants** — food access, walkability, income, pollution, distance to care.
2. **Population composition** — ancestry/genetic background clusters regionally.

So "people from region X have more diabetes" reflects both. It answers the exact thing she said:
*"people usually from this region suffer with this."*

**How it becomes a data point.** You don't *measure* it on the person. You take their location
(postal prefix / region) and **join** it to *area-level statistics* — e.g. % obese, % with diabetes,
physical-inactivity rate, median income for that area. That joined number becomes a feature.

**In the algorithm.** Geography = context / baseline adjustment. Someone in a high-diabetes-prevalence,
low-walkability area starts from a higher baseline risk and may get different recommendations.

### Real datasets for this layer
| Dataset | Geography | What it gives | Access |
|---|---|---|---|
| **CDC PLACES** | County / census tract / ZIP (US) | Model-based prevalence for 40+ measures (obesity, diabetes, BP, inactivity, smoking) — the area-level numbers you join by location | Free CSV download |
| **CDC BRFSS** | US state | 300+ self-reported variables: lifestyle + chronic conditions + demographics, huge sample | Free |
| **StatsCan CCHS (PUMF)** | Canadian health region (121 regions) | Physical activity, height/weight, smoking, alcohol, chronic conditions, socio-demographics; ~130k respondents | Free public-use microdata (StatsCan / Borealis) |

---

## 2. Genetic data — what it actually is, and why family history is the answer

**Concept.** "Genetic risk" = inherited predisposition. Real genomic data comes as:
- **DNA variants (SNPs)** from a saliva/blood test → a chip reads ~millions of markers.
- **Polygenic risk scores (PRS)** — many SNPs aggregated into one risk number for a condition.
- **High-impact single-gene variants** — BRCA (cancer), familial hypercholesterolemia, etc.

**None of that is collectable in a survey or a prototype** — it needs a lab.

**The practical proxy chain (what real clinics use):**
1. **Family history** — the clinically validated stand-in. It literally captures *"inherited genetic +
   shared-environment contribution."* This is the workhorse.
2. **Ancestry / ethnicity** — variant frequencies cluster by population (a coarse genetic signal).
3. **Consumer DNA test results** — for the few who've done 23andMe etc.

**In the algorithm.** Family history = *non-modifiable baseline risk* that shifts a person's starting
point; lifestyle then modifies from there. That contrast IS the prevention story:
*"your inherited risk is X, but lifestyle can move you by Y."*

**How strong a signal is it?** In NHANES, ~29.5% of US adults report a family history of diabetes, and
the rate of *undiagnosed* diabetes climbs from ~2% (average familial risk) to ~10% (high familial risk).
Family history alone meaningfully stratifies risk — no genome required.

### Real datasets for this layer
| Dataset | What it gives | Access |
|---|---|---|
| **NHANES** (Medical Conditions Questionnaire) | Family history of diabetes / heart attack / angina **plus** real clinical labs + lifestyle in the same person-level rows | Free |
| **PRS Knowledge Base / NHGRI-EBI GWAS Catalog** | 250k+ variant-disease associations, polygenic scores — *true genomics* | Free, but advanced |
| **UK Biobank** | Genotypes + PRS + phenotypes for 500k people | Application/approval required |

> For this project, use **family history (in NHANES)** as the genetics variable. Only reach for
> PRS/GWAS/UK Biobank if you later want actual genomic scoring — it's a big jump in complexity and access.

---

## 3. Recommended data stack (and how it feeds the project)

**Engine dataset → NHANES.** It's the only free, person-level set that carries *all* our layers at once:
demographics + clinical exam (BP, cholesterol, glucose/HbA1c, BMI) + lifestyle (diet, activity, smoking,
alcohol, sleep) + **family history**. Each row ≈ one patient. Perfect for both testing the algorithm and
generating sample profiles.
- Weak spot: NHANES doesn't release fine geography (privacy).

**Geography layer → CDC PLACES (US) or StatsCan CCHS (Canada).** Area-level rates you join by
location to add the "where you live" feature. CCHS is more on-theme for a Canadian pitch; PLACES is the
easiest to join by ZIP/tract.

**Genetics → family-history fields (already in NHANES).**

### The pipeline (matches what she suggested: build dataset → slice/dice → narrow goal)
1. **Download** an NHANES cycle → merge demographics + exam + labs + questionnaire + family history.
2. **Test the algorithm** — does lifestyle + family history + demographics predict an outcome
   (e.g. hypertension / diabetes)? Start with correlations or a simple model.
3. **Join geography** — attach PLACES/CCHS area rates as extra features.
4. **Generate sample profiles** — sample real rows / real distributions to create realistic WellPath
   demo patients that fill the user profiles, grounded in real correlations.

---

## Status — what we've pulled and analyzed (in `data-research/`)

Two **separate cohorts** (different countries/instruments — kept apart on purpose) + a US geography layer:

| Deliverable | Cohort | Role | File |
|---|---|---|---|
| [NHANES_FINDINGS.md](data-research/NHANES_FINDINGS.md) | US, 5,856 adults | clinical + **genetics proxy** (family history) | `sample_profiles_nhanes.csv` |
| [CANADA_FINDINGS.md](data-research/CANADA_FINDINGS.md) | Canada, 108,252 (wt. 32.1M) | **geography** + lifestyle + self-report conditions | `sample_profiles_cchs.csv` |
| [PLACES_FINDINGS.md](data-research/PLACES_FINDINGS.md) | US, 2,956 counties | area-level **geography** enrichment | `places_county_wide.csv` |

Headline validations:
- **Genetics proxy works:** NHANES family-history-of-diabetes → measured HbA1c (prediabetes+ 33% → 50%).
  (Family-history-of-diabetes prevalence here is **47.8%**, higher than the older 29.5% first-degree figure
  because NHANES asks about *any* close biological relative, living or deceased.)
- **Geography matters:** CCHS diabetes 1.6%→8.5% across provinces; PLACES diabetes 4.9%→27.1% across counties.
- **Simple algorithm works:** NHANES additive risk score vs measured prediabetes+, AUC 0.713.

## Person-level datasets that mix geography / family history with the KPIs

You asked for *individual* records combining things like diet + country + blood pressure, or
geography / family history alongside our KPIs. These fit — each row is a person:

| Dataset | Rows / level | Mixes | KPIs it carries | Access |
|---|---|---|---|---|
| **WHO STEPS** (NCD Microdata Repository) | individual, **many countries** | **country** + clinical + lifestyle | diet, **measured BP**, glucose, cholesterol, BMI, waist, tobacco, alcohol, activity | free, register per-country |
| **NHANES** *(we have it)* | individual, US | **family history** + labs + lifestyle | family hx diabetes/heart, HbA1c, BP, cholesterol, BMI, diet, activity, smoking | free |
| **Pima Indians Diabetes** | 768, US (Pima women) | **family-history proxy** + clinical | **DiabetesPedigreeFunction** (hereditary score), glucose, BP, BMI, insulin, age → diabetes | free CSV (Kaggle/UCI) |
| **UCI Heart Disease** | ~920, **4 sites** (US/Hungary/Switzerland/VA) | **geography/country** + clinical | resting BP, cholesterol, fasting glucose, max HR, chest pain → heart disease | free CSV |
| **BRFSS / CDC Diabetes Health Indicators** | 250k+, US (state) | **geography** + lifestyle | diet (fruit/veg), BMI, BP, cholesterol, smoking, activity, income, education → diabetes | free CSV |
| **CCHS** *(we have it)* | 108k, Canada | **geography** (province/health region) + lifestyle | weight class, diabetes, BP, smoking, stress, income | free |
| **UK Biobank** | 500k, UK | **genetics + geography** + labs + lifestyle (everything) | true genomic risk scores + full phenotype | application/approval required |

**Best matches for your examples:**
- *"diet + country + blood pressure"* → **WHO STEPS** (multi-country, measured BP, diet) — the closest single answer.
- *family history + KPIs* → **NHANES** (have it) or **Pima** (a ready-made hereditary-risk score to model against).
- *geography + KPIs, huge N* → **BRFSS** (US) or **CCHS** (have it).

No single free dataset has fine geography **and** family history **and** labs together at person level — that
gap is exactly the "integrate the silos" problem the Deloitte call was about. UK Biobank is the one that has
it all, but it's access-gated.

## Sources
- NHANES data portal — https://wwwn.cdc.gov/Nchs/Nhanes/Search/DataPage.aspx
- NHANES family history & undiagnosed diabetes — https://www.nature.com/articles/gim2006124
- NHANES family history of premature heart disease — https://pmc.ncbi.nlm.nih.gov/articles/PMC6662130/
- CDC BRFSS data & documentation — https://www.cdc.gov/brfss/data_documentation/index.htm
- CDC PLACES methodology — https://www.cdc.gov/places/methodology/index.html
- StatsCan CCHS public-use microdata — https://www150.statcan.gc.ca/n1/en/catalogue/82M0013X
- PRS Knowledge Base / GWAS Catalog — https://www.nature.com/articles/s42003-022-03795-x
