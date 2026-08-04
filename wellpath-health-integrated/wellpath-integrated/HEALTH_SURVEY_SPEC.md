# WellPath Health Survey — Variable Specification (v0.2, draft for review)

A **standalone survey feature** (not an onboarding gate — user profiles already exist). Its job is to
showcase the project's **data-collection methodology** from the Deloitte discovery call: define health
variables → capture them → produce a dataset you can slice/dice.

**Storage:** all answers write to a **new flexible `survey_responses` table**
(`response_id, patient_id, question_key, answer_value, submitted_at`). We do **not** write into the
seeded `patient_intake_assessment` / `patient_profiles` tables, so the demo patients stay intact.
Optionally, a computed **wellness/risk summary** is shown at the end.

**Units:** metric only (cm, kg). **Length:** comprehensive — all categories included.

---

## Intent (the survey's spine)

> **Identify which lifestyle, functional, and demographic factors associate with elevated
> cardiometabolic / overall-wellness risk, so WellPath can recommend prevention *before* a condition
> becomes clinical.**

Four buckets, so inputs can be correlated against outcomes:
1. **Modifiable inputs** — lifestyle & functional behaviours (the levers).
2. **Background risk** — demographics, geography, **family history / genetics proxy** (non-modifiable).
3. **Clinical snapshot** — self-reported body/vitals (near-term outcome signal).
4. **Goal** — what the person wants, so recommendations stay relevant.

The contrast between bucket 1 (changeable) and bucket 2 (inherited) is the prevention story.

---

## Design principles
- **Sensitive questions (⚠) are optional + carry a one-line "why we ask."**
- **Coarse-grain for privacy** — geography = first 3 postal characters only.
- **Band, don't demand precision** — bands + "Don't know", mapped to a midpoint server-side.
- **Derive, don't ask** — BMI from height+weight; diet_score from 3 sub-questions.
- **Config-driven** — the whole survey is one JSON/JS array of steps → questions.

---

## Step 0 — Welcome (no data)
Purpose, ~5 min, "answers are stored for anonymized analysis and a personalized summary."

## Step 1 — Consent
| key | label | type | notes |
|-----|-------|------|-------|
| `consent_data_use` | "I agree WellPath can store my answers for anonymized research and to show me a summary." | radio (Agree / Decline) | Decline → survey ends politely, nothing stored. |

## Step 2 — About you  *(demographics / population)*
| key | label | type | req | ⚠ | why we ask |
|-----|-------|------|-----|---|------------|
| `age` | Age (years) | number | ✔ | | Core risk factor. |
| `sex_at_birth` | Sex at birth | select (Female / Male / Intersex / Prefer not) | ✔ | | Physiology-adjusted risk. |
| `gender_identity` | Gender identity | text | | | Optional; representation. |
| `ethnicity` | Ethnic background (select all) | multi-select | | ⚠ | Some conditions vary by population group (also a coarse ancestry/genetic signal). |
| `region_prefix` | First 3 characters of postal code | text(3) | | ⚠ | Regional health patterns; coarse for privacy. |
| `occupation_activity` | Your typical workday is… | select (Mostly sitting / Mixed / Mostly on feet / Heavy physical) | | | Baseline functional activity. |

## Step 3 — Body basics  *(anthropometric / clinical self-report, metric)*
| key | label | type | req | ⚠ | notes |
|-----|-------|------|-----|---|-------|
| `height_cm` | Height (cm) | number | ✔ | | → BMI |
| `weight_kg` | Weight (kg) | number | ✔ | | → BMI |
| *(derived)* | BMI | computed = kg / (m²) | | | |
| `resting_hr` | Resting heart rate, bpm (if known) | number + "Don't know" | | | |
| `bp_known` | Do you know your blood pressure? | radio (Yes / No) | | | branch |
| `systolic_bp` | Systolic (top) | number | | ⚠ | if bp_known=Yes |
| `diastolic_bp` | Diastolic (bottom) | number | | ⚠ | if bp_known=Yes |
| `conditions` | Diagnosed conditions? (select all) | multi (None / Hypertension / Type 2 diabetes / High cholesterol / Other) | | ⚠ | Optional. |
| `medications` | Regular medications | text | | ⚠ | Optional. |

## Step 4 — Family history & genetics  *(non-modifiable / hereditary risk)*
Family history is the clinically accepted, survey-able proxy for genetic risk — no lab data required.
| key | label | type | ⚠ | why we ask |
|-----|-------|------|---|------------|
| `family_known` | Do you know your biological family's medical history? | select (Yes mostly / Somewhat / No — adopted/unknown) | ⚠ | "Unknown" is itself a valid data state. |
| `family_conditions` | Parent/sibling diagnosed with… (select all) | multi (Type 2 diabetes / Heart disease / High blood pressure / Stroke / High cholesterol / Breast or ovarian cancer / Colorectal cancer / Alzheimer's or dementia / None / Unsure) | ⚠ | First-degree family history = strongest self-report genetic signal. |
| `family_early_onset` | Did a close relative develop heart disease early (father/brother <55, mother/sister <65)? | radio (Yes / No / Unsure) | ⚠ | Early onset flags strong hereditary loading (real clinical criterion). |
| `known_hereditary` | Any known inherited condition in your family? (select all) | multi (Familial high cholesterol / Sickle cell / BRCA / Cystic fibrosis / Other / None / Unsure) | ⚠ | Captures named monogenic risks. |
| `genetic_test_done` | Ever done a DNA test (23andMe, AncestryDNA, clinical)? | radio (Yes / No) | | Captures the few with real genomic data. |
| `genetic_test_flags` | Did it flag any health risks? | text | ⚠ | if genetic_test_done=Yes; optional. |

## Step 5 — Lifestyle
| key | label | type | ⚠ | notes |
|-----|-------|------|---|-------|
| `sleep_hours` | Average sleep per night (hrs) | number 3–10 (0.5 steps) | | |
| `sleep_quality` | How rested do you usually feel? | scale 1–5 | | |
| `diet_veg` | Fruit/veg servings per day | select (0–1 / 2–3 / 4–5 / 6+) | | → diet_score |
| `diet_fastfood` | Fast food / takeout per week | select (0 / 1–2 / 3–4 / 5+) | | → diet_score |
| `diet_sugary` | Sugary drinks per day | select (0 / 1 / 2 / 3+) | | → diet_score |
| *(derived)* | Diet score 0–10 | computed from the 3 above | | |
| `alcohol` | Alcohol consumption | select (None / Occasional / Weekly / Daily) | ⚠ | |
| `smoking` | Smoking / vaping | select (Never / Former / Current) | ⚠ | |
| `stress_level` | Typical stress level | scale 0–10 | | |
| `sedentary_hours` | Hours per day sitting | number 0–16 | | |

## Step 6 — Movement / functional
| key | label | type | notes |
|-----|-------|------|-------|
| `daily_steps` | Typical daily steps | select (<3k / 3–5k / 5–8k / 8–12k / 12k+ / Don't know) | band → midpoint |
| `active_minutes` | Active minutes per day | select (<15 / 15–30 / 30–60 / 60+ / Don't know) | band → midpoint |
| `workouts_per_week` | Structured workouts per week | number 0–7 | |
| `exercise_days_per_week` | Days per week you exercise at all | number 0–7 | |
| `exercise_types` | Kind of activity (select all) | multi (Walking / Running / Strength / Cycling / Yoga-Pilates / Sports / None) | |
| `mobility_limits` | Any mobility limitations? | text | Optional. |

## Step 7 — Your goal
| key | label | type | notes |
|-----|-------|------|-------|
| `primary_focus` | What do you most want to improve? | select (Weight Management / Cardiovascular Health / Diabetes Prevention / Sleep Improvement / Fitness Improvement / Stress Management / General Wellness / Blood Pressure Control / Recovery Monitoring / Lifestyle Coaching) | Matches the 10 seeded focuses. |
| `motivation` | In a sentence, why now? | text | Optional. |

## Step 8 — Review & submit
Summary grouped by section, "Edit" links back to each step, **Finish** → one POST → optional
computed wellness/risk summary screen.

---

## Derived / computed variables (backend)
- **BMI** = weight_kg / (height_cm/100)²
- **diet_score (0–10)** = blend of `diet_veg` (+), `diet_fastfood` (−), `diet_sugary` (−), rescaled 0–10
- **Step / active-minute bands** → midpoints (e.g. "8–12k" → 10000)
- *(optional)* **wellness/risk summary** = simple weighted score across lifestyle + clinical + background buckets, for the closing screen

## Total: ~35 questions across 8 steps (many optional).
