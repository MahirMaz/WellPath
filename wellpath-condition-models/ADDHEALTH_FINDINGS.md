# Add Health — longitudinal findings (the dataset you provided)

**Source:** Add Health public-use (ICPSR 21600), Wave IV (2008) + Wave V (2016) biomarkers,
merged on the participant id `AID`. **1,760 people have biomarkers in *both* waves** — the longitudinal
sample. Analyzed by `scratchpad/ah_longitudinal.py`. Research prototype; not diagnostic.

This is the thing NHANES structurally **cannot** do: the *same people* measured years apart, so we can study
change over time and **earlier → later prediction**, not just same-moment association.

---

## 1. Trajectory — HbA1c over ~8 years (same 1,494 people)
- Mean HbA1c: Wave IV **5.56%** → Wave V **5.37%** (avg change −0.20).
- 13% of people saw their HbA1c rise; of those normal (<5.7) at Wave IV, ~4% had crossed into
  prediabetes+ by Wave V.

**Honest caveat:** the slight average *decrease* is suspicious and almost certainly partly a
**cross-wave assay/method difference** (the labs/kits differed between 2008 and 2016; Wave IV even ships an
HbA1c inter-conversion flag). So don't read the absolute change as real population improvement — cross-wave
*levels* aren't perfectly comparable. Trajectories like this are better used for *within-person relative*
ranking than absolute drift. (Also: this is a young cohort, ~33–43 at Wave V, so limited deterioration is expected.)

## 2. Prospective prediction — does Wave IV bloodwork predict FUTURE hypertension?
Outcome: hypertension at Wave V (≥130/80). Predictors: Wave IV metabolic profile, 8 years earlier.

| Model | AUC |
|---|---|
| Age + sex only | 0.640 |
| + Wave IV bloodwork (HbA1c, glucose, lipids) | 0.667 |
| **Gain** | **+0.027, 95% CI [+0.012, +0.046]** |

The CI **excludes zero** — a small but statistically clear improvement. The Wave IV markers that predict
hypertension 8 years later:
- **HbA1c (2008)** — OR 1.25 per SD, p=0.007
- **Triglycerides (2008)** — OR 1.25 per SD, p=0.006

**Reading:** your blood sugar and triglycerides *today* carry real signal about your blood pressure ~8 years
*later* — a genuine prospective result. It fits the metabolic-syndrome story (dysglycemia/dyslipidemia tend
to precede hypertension). Effect size is modest, as expected for lifestyle-scale prediction in a young cohort.

---

## 3. Early origins — does an ADOLESCENT profile predict ADULT prediabetes? (the headline)
Adolescents at Wave I (1994–95) linked to their **own** adult HbA1c at Wave IV (2008), ~14 years later.
N = 4,304 · adult elevated-HbA1c (≥5.7) prevalence 32%.

| Model | AUC |
|---|---|
| Teen age + sex | 0.565 |
| + adolescent profile (BMI, health, activity, smoking, depression, parent education) | 0.618 |
| **Gain** | **+0.053, 95% CI [+0.039, +0.074]** (excludes zero) |

**The standout: adolescent BMI predicts adult prediabetes** (OR 1.38 per SD, p<0.001). As a plain contrast —
adult elevated-HbA1c rate by the teenager's BMI third:

| Teen BMI third (1994) | Adult prediabetes+ rate (2008) |
|---|---|
| Leanest | 24% |
| Middle | 31% |
| Heaviest | **41%** |

A teenager in the heaviest third had ~1.7× the adult-prediabetes rate of the leanest — measured 14 years apart
on the same people. Higher parent education (a social-determinant proxy) was mildly protective (OR 0.92, p=0.02).

**Two honest flags:** (a) overall AUC is still modest (0.62) — a teen profile only partly foreshadows adult
risk, as expected since most risk accrues later; (b) adolescent height/weight are **self-reported by teens**
(noisy), which understates the true BMI effect; and (c) teen "ever smoked" came out *protective* (OR 0.79) —
almost certainly confounded (teen smokers tend to be leaner), so treat that one as noise, not a finding.

## Why this matters
Everything before this was **association** ("people with X tend to have Y *now*"). This is **prediction**
("X in 2008 → Y in 2016"), on the same people. That's the qualitative upgrade the client's brief was really
asking for, and it's only possible because Add Health is longitudinal.

## Honest limits
- Public-use **subsample** (n=1,760 with both waves) — fine for a demo, thin for heavy subgroup/interaction work.
- **Cross-wave assay comparability** limits absolute trajectory claims (see caveat above).
- Young cohort → modest metabolic deterioration so far.
- **No genetics** (restricted tier); Wave IV BMI/BP for true baseline anthropometrics live in the large
  Wave IV in-home file (DS0022), not yet merged.

## Natural next steps
- Add **Wave I adolescent predictors** (DS0001) → adult outcome = true "early-origins" prediction.
- Merge Wave IV in-home (DS0022) for **BMI/BP trajectory** across waves.
- Add Wave VI (2022, nested zip) for a third time point once unpacked.
