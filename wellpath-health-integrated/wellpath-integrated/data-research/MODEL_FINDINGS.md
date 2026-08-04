# Multivariate modelling — correlations & insights across the KPIs *together*

Goes beyond the single-variable stats: regression + ML on all KPIs at once, to see what independently
drives risk and how the KPIs relate. Scripts: `scratchpad/nhanes_model.py`, `scratchpad/cchs_model.py`
(statsmodels + scikit-learn). Unweighted (association-focused, not national estimates).

---

## A. US — NHANES (family history + clinical + lifestyle, person-level)

### A1. Which KPIs correlate with blood sugar (HbA1c), and in which direction
Ranked Spearman correlation (all significant unless noted):

**Raises blood sugar (+):** age **+0.49**, systolic BP +0.34, waist +0.33, BMI +0.26,
**family history of diabetes +0.20**, resting-BP/diastolic +0.08, family history heart +0.07, smoking +0.06.
**Protective (−):** **vigorous activity −0.22**, moderate activity −0.08, sleep hours −0.06, female −0.04.

### A2. How the KPIs cluster (KPI↔KPI)
BMI↔waist +0.91 (redundant — pick one), age↔systolic +0.51, systolic↔diastolic +0.44,
moderate↔vigorous activity +0.36, age↔vigorous activity **−0.33** (older = less vigorous exercise).

### A3. What *independently* drives prediabetes+ — logistic regression (controls for everything at once)
N=3,892 · outcome HbA1c ≥ 5.7 (45%) · pseudo-R² 0.20. Odds ratios (continuous = per 1 SD):

| Predictor | OR | Reading |
|---|---|---|
| age | **2.67*** | biggest single driver |
| **family history of diabetes** | **2.00*** | **doubles the odds — independent of BMI/lifestyle** |
| BMI | 1.63*** | |
| resting heart rate | 1.20*** | independent signal |
| systolic BP | 1.12** | |
| sex = female | 0.68*** | women lower |
| sleep hours | 0.88*** | more sleep → lower |
| vigorous activity | 0.81* | protective |
| diet / smoking / cholesterol / income / family-history-heart | n.s. | **effect runs *through* BMI & activity** |

**Insight:** family history **doubles diabetes-range risk even after** accounting for weight, activity, diet and
age — it's genuinely hereditary signal, not just "heavier families." And diet/smoking drop out once BMI &
activity are in the model, i.e. they act *through* body composition — so BMI + activity + family history are
the KPIs that carry the independent information.

### A4. All-KPI ML vs the simple score
Random forest on all KPIs: **5-fold CV AUC 0.782** vs the simple additive score's 0.713 — ML adds ~0.07.
Permutation importance: age ≫ BMI > family history > systolic BP. Same drivers, confirmed.

### A5. Bonus — what moves blood pressure (OLS on systolic, standardized β)
age **+9.3 mmHg/SD**, BMI +2.6, female −2.4, **higher income −1.3** (social gradient), poor diet +0.8.

---

## B. Canada — CCHS (the geography question, modelled)

### B1. Individual drivers of diabetes (logistic, N=86,893, prev 9.8%)
obesity **OR 2.70***, age OR 3.09***, high stress OR 1.23***, lower income raises risk (income OR 0.87*** per
level), female protective (0.66***), current smoker 0.78*** (reverse-causation — people quit after diagnosis).

### B2. Does *geography* add signal beyond the individual KPIs? (the real question)
Province effects **after** controlling for the individual factors above (ref = Ontario):
- **Newfoundland's raw #1 diabetes rate mostly disappears** → OR 1.09 (n.s.). Its excess is explained by
  having more obesity / older residents — *composition*, not place.
- **BC (OR 0.60***) and the Territories (OR 0.40***) stay significantly lower** → a real residual place effect.
- Adding province to the model lifts prediction by only **+0.003 AUC** (0.773 → 0.776).

**Insight:** ~90% of the "where you live matters" signal is really *"who lives there"* — geography is largely a
**proxy for the individual KPIs you already collect**. Collect BMI/age/activity/family-history and you capture
most of it; the small residual (BC, North) is the genuine environmental/access part worth a geography feature.

---

## What this means for WellPath
1. **Prioritise family history in the survey** — it's the one non-body, non-lifestyle KPI that adds
   *independent* predictive power (OR 2.0). It earns its place.
2. **BMI + activity are the workhorse modifiables** — diet/smoking mostly act through them, so a good BMI +
   activity capture already encodes a lot.
3. **Geography is a cheap proxy, not a must-have** — nice-to-have context, but individual KPIs carry ~all of it.
4. A simple additive score is already good (0.71); a full model reaches ~0.78 — worth it if you want the extra.
