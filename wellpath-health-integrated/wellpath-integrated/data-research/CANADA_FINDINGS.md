# Canada cohort — CCHS 2019–2020 findings

**Source:** Statistics Canada, Canadian Community Health Survey (CCHS) 2019–2020 annual PUMF, Stata `.dta`
(via Borealis). **N = 108,252** respondents aged 12+, survey-weighted to **32.1 million Canadians**.
Analyzed by `scratchpad/cchs_analyze.py`.

**What this cohort is for — deliberately different from NHANES.** CCHS is a *self-report population survey*
with **geography** (province + grouped health region) and huge N — but **no lab measurements and no
family-history module**. So this is our **geographical / population-health + lifestyle** cohort; NHANES
stays our clinical + genetics-proxy cohort. Keeping them separate (your call) is correct — different
countries, different instruments, different strengths.

> Results are **survey-weighted** with `WTS_M` (so these are proper national/provincial estimates).
> Self-report caveat applies; physical-activity & fruit/veg modules were sub-sampled (~20–26k).

---

## Variable mapping — CCHS → WellPath fields
| WellPath field | CCHS var | Notes |
|---|---|---|
| province | `geogprv` | 10 provinces + territories group |
| health region | `GEODGHR4` | grouped health region (finer geography) |
| sex | `DHH_SEX` | |
| age group | `dhhgage` | banded |
| weight class | `hwtdgisw` | PUMF collapses to Normal/Under vs Overweight/Obese |
| diabetes | `CCC_095` | self-reported diagnosis |
| high blood pressure | `CCC_065` | self-reported diagnosis |
| smoking status | `smkdvsty` | daily / occasional / former / never |
| physical activity | `paadvacv` | meets/below CPAG guidelines (subsample) |
| fruit/veg servings | `fvcdvtot` | per day (subsample) |
| life stress | `GEN_020` | not at all → extremely |
| household income | `incdghh` | banded (a social determinant) |
| survey weight | `WTS_M` | use for all prevalence estimates |

---

## Result 1 — geography matters (the population-health signal)

Weighted prevalence (%) by province, sorted by diabetes:

| Province | Overweight/Obese | Diabetes | High BP | Smoker | High stress |
|---|---|---|---|---|---|
| Newfoundland & Labrador | 60.2 | **8.5** | 23.6 | 16.2 | 13.3 |
| New Brunswick | 56.8 | 7.7 | 22.1 | 11.2 | 18.7 |
| Ontario | 47.2 | 7.1 | 17.4 | 11.2 | 20.7 |
| Nova Scotia | 53.8 | 7.0 | 20.7 | 12.5 | 18.6 |
| Quebec | 47.7 | 6.6 | 16.6 | 15.0 | 22.7 |
| Alberta | 49.3 | 6.2 | 16.4 | 14.0 | 20.1 |
| PEI | 55.0 | 6.1 | 18.3 | 11.9 | 18.5 |
| Manitoba | 51.2 | 5.1 | 18.3 | 12.5 | 20.0 |
| British Columbia | 43.5 | 4.9 | 15.5 | 7.6 | 20.5 |
| Saskatchewan | 54.0 | 4.6 | 19.5 | 12.7 | 17.0 |
| Territories | 47.8 | 1.6 | 12.7 | 24.4 | 17.4 |

**National:** overweight/obese 48.0%, diabetes 6.5%, high BP 17.2%, smoker 12.1%, high stress 20.7%.

**The spread across provinces IS the "where you live matters" signal:**
- Overweight/obese: 43.5% → 60.2% (16.7-pt gap; BC low, Newfoundland high)
- Diabetes: 1.6% → 8.5% (Newfoundland ~5× the territories)
- Smoking: 7.6% → 24.4% (BC low, territories high)

Newfoundland sits high on obesity/diabetes/BP together; BC low across the board — a coherent regional
pattern a model can use as context.

## Result 2 — lifestyle → condition link holds (weighted)
Diabetes prevalence by weight class: Normal/Underweight **3.7%** vs Overweight/Obese **9.4%** — a clean
2.5× gradient on a modifiable factor, on 100k+ Canadians.

---

## Sample profiles
`data-research/sample_profiles_cchs.csv` — 12 real anonymized Canadians (province, sex, age band, weight
class, diabetes, high BP, smoking, stress, income) for filling demo profiles in a Canadian context.

## Reproduce / extend
- `scratchpad/cchs_analyze.py`. To go finer than province, swap `geogprv` → `GEODGHR4` (health region).
- Add fruit/veg & activity associations on their sub-samples; join `incdghh` for a social-determinant angle.
