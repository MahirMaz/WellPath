// ============================================================================
// WellPath Health Survey — question configuration (single source of truth)
// ----------------------------------------------------------------------------
// The whole survey is defined as data so questions can be added / reworded
// without touching the component. See HEALTH_SURVEY_SPEC.md for the rationale.
//
// Question shape:
//   {
//     key,        // unique id, also the answer key
//     label,      // the question
//     help,       // optional sub-text
//     type,       // 'single' | 'multi' | 'scale' | 'number' | 'text'
//     options,    // for single / multi: array of strings
//     scale,      // for scale: { min, max, minLabel, maxLabel }
//     unit,       // for number: suffix shown in the field
//     min, max, step,
//     allowUnknown, // for number: renders a "Don't know" chip
//     placeholder, maxLength, // for text / number
//     required,   // only 4 questions are required (see spec)
//     sensitive,  // shows an "Optional" tag + the `why` note
//     why,        // one-line "why we ask" for sensitive questions
//     showIf,     // (answers) => boolean — conditional visibility
//   }
// ============================================================================

export const SURVEY_META = {
  title: 'WellPath Health Survey',
  subtitle: 'Help us understand the whole picture — clinical, lifestyle, and everyday habits.',
  estMinutes: '3–4 min',
  requiredNote: 'Only 4 questions are required. Everything else is optional — skip anything you’d rather not answer.',
};

export const SURVEY_STEPS = [
  // ---- 1. Consent -----------------------------------------------------------
  {
    id: 'consent',
    title: 'Before we start',
    subtitle: 'Your answers power a personalized summary and anonymized research.',
    questions: [
      {
        key: 'consent_data_use',
        label: 'Do you agree to share your answers?',
        help: 'We store responses for anonymized analysis and to show you a summary at the end. No answer is ever tied to your name.',
        type: 'single',
        options: ['Yes, I agree', 'No, thanks'],
        required: true,
      },
    ],
  },

  // ---- 2. About you ---------------------------------------------------------
  {
    id: 'about',
    title: 'About you',
    subtitle: 'A little context so we can compare like with like.',
    questions: [
      { key: 'age', label: 'How old are you?', type: 'number', unit: 'years', min: 0, max: 120, required: true },
      {
        key: 'sex_at_birth',
        label: 'Sex assigned at birth',
        help: 'Used for physiology-adjusted scoring (e.g. cycle tracking).',
        type: 'single',
        options: ['Female', 'Male', 'Intersex', 'Prefer not to say'],
        required: true,
      },
      {
        key: 'gender_identity',
        label: 'Gender identity',
        type: 'single',
        options: ['Woman', 'Man', 'Non-binary', 'Prefer to self-describe', 'Prefer not to say'],
        sensitive: true,
        why: 'Optional — helps us be inclusive and accurate.',
      },
      {
        key: 'ethnicity',
        label: 'Ethnic background',
        help: 'Select all that apply.',
        type: 'multi',
        options: ['White / European', 'South Asian', 'East Asian', 'Southeast Asian', 'Black / African', 'Latin American', 'Middle Eastern / Arab', 'Indigenous', 'Mixed', 'Other'],
        sensitive: true,
        why: 'Some conditions vary by population group — it’s also a coarse ancestry signal.',
      },
      {
        key: 'region_prefix',
        label: 'First 3 characters of your postal code',
        help: 'e.g. “M5V”. We only keep the first 3 for privacy.',
        type: 'text',
        placeholder: 'M5V',
        maxLength: 3,
        sensitive: true,
        why: 'Regional health patterns — kept coarse so you can’t be identified.',
      },
      {
        key: 'occupation_activity',
        label: 'Your typical workday is…',
        type: 'single',
        options: ['Mostly sitting', 'Mixed', 'Mostly on your feet', 'Heavy physical work'],
        sensitive: true,
        why: 'Baseline of how active you are day to day.',
      },
    ],
  },

  // ---- 3. Body basics -------------------------------------------------------
  {
    id: 'body',
    title: 'Body basics',
    subtitle: 'A quick clinical snapshot. Estimates are fine.',
    questions: [
      { key: 'height_cm', label: 'Height', type: 'number', unit: 'cm', min: 100, max: 250, required: true },
      { key: 'weight_kg', label: 'Weight', type: 'number', unit: 'kg', min: 30, max: 300, required: true },
      {
        key: 'resting_hr',
        label: 'Resting heart rate',
        help: 'From a smartwatch, if you have one.',
        type: 'number',
        unit: 'bpm',
        min: 30,
        max: 150,
        allowUnknown: true,
        sensitive: true,
        why: 'Optional — a useful heart-health signal if you know it.',
      },
      { key: 'bp_known', label: 'Do you know your blood pressure?', type: 'single', options: ['Yes', 'No'], sensitive: true, why: 'Only asked so we can skip it if you don’t know it.' },
      { key: 'systolic_bp', label: 'Systolic (top number)', type: 'number', unit: 'mmHg', min: 70, max: 220, sensitive: true, why: 'Blood pressure is a core cardiovascular marker.', showIf: (a) => a.bp_known === 'Yes' },
      { key: 'diastolic_bp', label: 'Diastolic (bottom number)', type: 'number', unit: 'mmHg', min: 40, max: 140, sensitive: true, why: 'Blood pressure is a core cardiovascular marker.', showIf: (a) => a.bp_known === 'Yes' },
      {
        key: 'conditions',
        label: 'Any diagnosed conditions?',
        help: 'Select all that apply.',
        type: 'multi',
        options: ['None', 'High blood pressure', 'Type 2 diabetes', 'High cholesterol', 'Other'],
        sensitive: true,
        why: 'Optional — helps separate managed conditions from new risk.',
      },
      { key: 'medications', label: 'Regular medications', help: 'Optional — a short note is fine.', type: 'text', placeholder: 'e.g. blood pressure medication', sensitive: true, why: 'Optional context for your results.' },
    ],
  },

  // ---- 4. Family history & genetics ----------------------------------------
  {
    id: 'family',
    title: 'Family & inherited health',
    subtitle: 'Family history is how we estimate genetic risk without a lab test.',
    questions: [
      { key: 'family_known', label: 'Do you know your biological family’s medical history?', type: 'single', options: ['Yes, mostly', 'Somewhat', 'No — adopted or unknown'], sensitive: true, why: '“Unknown” is a valid answer — it tells us to weight this differently.' },
      {
        key: 'family_conditions',
        label: 'Has a parent or sibling been diagnosed with…',
        help: 'Select all that apply.',
        type: 'multi',
        options: ['Type 2 diabetes', 'Heart disease', 'High blood pressure', 'Stroke', 'High cholesterol', 'Breast or ovarian cancer', 'Colorectal cancer', 'Alzheimer’s / dementia', 'None', 'Unsure'],
        sensitive: true,
        why: 'First-degree family history is the strongest self-reportable genetic signal.',
        showIf: (a) => a.family_known !== 'No — adopted or unknown',
      },
      { key: 'family_early_onset', label: 'Did a close relative develop heart disease early?', help: 'Father/brother before 55, or mother/sister before 65.', type: 'single', options: ['Yes', 'No', 'Unsure'], sensitive: true, why: 'Early onset signals stronger inherited risk (a real clinical criterion).', showIf: (a) => a.family_known !== 'No — adopted or unknown' },
      { key: 'known_hereditary', label: 'Any known inherited condition in the family?', help: 'Select all that apply.', type: 'multi', options: ['Familial high cholesterol', 'Sickle cell', 'BRCA gene', 'Cystic fibrosis', 'Other', 'None', 'Unsure'], sensitive: true, why: 'Captures named single-gene risks.' },
      { key: 'genetic_test_done', label: 'Have you ever done a DNA test?', help: '23andMe, AncestryDNA, or a clinical test.', type: 'single', options: ['Yes', 'No'], sensitive: true, why: 'Captures the few respondents with real genetic data.' },
      { key: 'genetic_test_flags', label: 'Did it flag any health risks?', type: 'text', placeholder: 'Optional — e.g. raised cholesterol risk', sensitive: true, why: 'Optional detail from your test.', showIf: (a) => a.genetic_test_done === 'Yes' },
    ],
  },

  // ---- 5. Lifestyle ---------------------------------------------------------
  {
    id: 'lifestyle',
    title: 'Everyday lifestyle',
    subtitle: 'The habits that move the needle most.',
    questions: [
      { key: 'sleep_hours', label: 'Average sleep per night', type: 'number', unit: 'hrs', min: 3, max: 12, step: 0.5, sensitive: true, why: 'Sleep drives recovery and long-term risk.' },
      { key: 'sleep_quality', label: 'How rested do you usually feel?', type: 'scale', scale: { min: 1, max: 5, minLabel: 'Exhausted', maxLabel: 'Fully rested' }, sensitive: true, why: 'Quality matters as much as hours.' },
      { key: 'diet_veg', label: 'Servings of fruit & veg per day', type: 'single', options: ['0–1', '2–3', '4–5', '6+'], sensitive: true, why: 'Feeds your diet score.' },
      { key: 'diet_fastfood', label: 'Fast food or takeout per week', type: 'single', options: ['0', '1–2', '3–4', '5+'], sensitive: true, why: 'Feeds your diet score.' },
      { key: 'diet_sugary', label: 'Sugary drinks per day', type: 'single', options: ['0', '1', '2', '3+'], sensitive: true, why: 'Feeds your diet score.' },
      { key: 'alcohol', label: 'Alcohol consumption', type: 'single', options: ['None', 'Occasional', 'Weekly', 'Daily'], sensitive: true, why: 'Optional — a known cardiometabolic factor.' },
      { key: 'smoking', label: 'Do you smoke or vape?', type: 'single', options: ['Never', 'Former', 'Current'], sensitive: true, why: 'Optional — one of the biggest single risk factors.' },
      { key: 'stress_level', label: 'Typical stress level', type: 'scale', scale: { min: 0, max: 10, minLabel: 'Calm', maxLabel: 'Overwhelmed' }, sensitive: true, why: 'Chronic stress affects many outcomes.' },
      { key: 'sedentary_hours', label: 'Hours per day sitting', type: 'number', unit: 'hrs', min: 0, max: 16, sensitive: true, why: 'Sedentary time is an independent risk factor.' },
    ],
  },

  // ---- 6. Movement ----------------------------------------------------------
  {
    id: 'movement',
    title: 'Movement',
    subtitle: 'Rough estimates are perfectly fine.',
    questions: [
      { key: 'daily_steps', label: 'Typical daily steps', type: 'single', options: ['Under 3k', '3–5k', '5–8k', '8–12k', '12k+', 'Don’t know'], sensitive: true, why: 'A simple proxy for overall activity.' },
      { key: 'active_minutes', label: 'Active minutes per day', type: 'single', options: ['Under 15', '15–30', '30–60', '60+', 'Don’t know'], sensitive: true, why: 'Time spent genuinely moving.' },
      { key: 'workouts_per_week', label: 'Structured workouts per week', type: 'single', options: ['0', '1', '2', '3', '4', '5', '6+'], sensitive: true, why: 'Intentional exercise volume.' },
      { key: 'exercise_days_per_week', label: 'Days per week you exercise at all', type: 'single', options: ['0', '1', '2', '3', '4', '5', '6', '7'], sensitive: true, why: 'How often you move with intent.' },
      { key: 'exercise_types', label: 'What kind of activity?', help: 'Select all that apply.', type: 'multi', options: ['Walking', 'Running', 'Strength', 'Cycling', 'Yoga / Pilates', 'Sports', 'None'], sensitive: true, why: 'The mix shapes recommendations.' },
      { key: 'mobility_limits', label: 'Any mobility limitations?', type: 'text', placeholder: 'Optional — e.g. knee injury', sensitive: true, why: 'So advice stays realistic for you.' },
    ],
  },

  // ---- 7. Your goal ---------------------------------------------------------
  {
    id: 'goal',
    title: 'Your goal',
    subtitle: 'So your summary points somewhere useful.',
    questions: [
      { key: 'primary_focus', label: 'What do you most want to improve?', type: 'single', options: ['Weight Management', 'Cardiovascular Health', 'Diabetes Prevention', 'Sleep Improvement', 'Fitness Improvement', 'Stress Management', 'General Wellness', 'Blood Pressure Control', 'Recovery Monitoring', 'Lifestyle Coaching'], sensitive: true, why: 'Focuses your recommendations.' },
      { key: 'motivation', label: 'In a sentence, why now?', type: 'text', placeholder: 'Optional', sensitive: true, why: 'Optional — a little qualitative colour.' },
    ],
  },
];

// ---- Derived / computed values -------------------------------------------
export function computeSummary(a) {
  const out = {};

  // BMI
  const h = Number(a.height_cm);
  const w = Number(a.weight_kg);
  if (h > 0 && w > 0) {
    const m = h / 100;
    out.bmi = Number((w / (m * m)).toFixed(1));
  }

  // Diet score 0–10 (veg +, fast food −, sugary −)
  const vegMap = { '0–1': 0, '2–3': 2, '4–5': 3.5, '6+': 5 };
  const ffMap = { '0': 0, '1–2': -1, '3–4': -2, '5+': -3.5 };
  const sugMap = { '0': 0, '1': -0.5, '2': -1, '3+': -2 };
  if (a.diet_veg || a.diet_fastfood || a.diet_sugary) {
    const raw = (vegMap[a.diet_veg] ?? 0) + (ffMap[a.diet_fastfood] ?? 0) + (sugMap[a.diet_sugary] ?? 0);
    out.dietScore = Math.max(0, Math.min(10, Math.round((raw + 5.5) * 10) / 10));
  }

  // Steps band -> midpoint
  const stepMap = { 'Under 3k': 2000, '3–5k': 4000, '5–8k': 6500, '8–12k': 10000, '12k+': 14000 };
  if (a.daily_steps && stepMap[a.daily_steps] != null) out.steps = stepMap[a.daily_steps];

  return out;
}

// Illustrative 0–100 wellness snapshot for the closing screen (demo only).
export function computeWellnessSnapshot(a, summary) {
  let score = 70;
  const factors = [];
  const bump = (delta, label) => { score += delta; if (label) factors.push({ delta, label }); };

  if (summary.bmi) {
    if (summary.bmi >= 18.5 && summary.bmi < 25) bump(6, 'Healthy BMI range');
    else if (summary.bmi >= 30) bump(-8, 'Elevated BMI');
    else if (summary.bmi >= 25) bump(-3, 'Slightly raised BMI');
  }
  const stepMap = { 'Under 3k': -6, '3–5k': -2, '5–8k': 2, '8–12k': 6, '12k+': 8 };
  if (a.daily_steps in stepMap) bump(stepMap[a.daily_steps], a.daily_steps === 'Under 3k' ? 'Low daily activity' : 'Good daily movement');
  if (a.sleep_hours) { const s = Number(a.sleep_hours); if (s >= 7 && s <= 9) bump(5, 'Solid sleep'); else if (s < 6) bump(-6, 'Short sleep'); }
  if (a.smoking === 'Current') bump(-12, 'Current smoker');
  if (a.smoking === 'Former') bump(-3);
  if (summary.dietScore != null) { if (summary.dietScore >= 7) bump(5, 'Strong diet'); else if (summary.dietScore <= 3) bump(-5, 'Diet could improve'); }
  if (a.stress_level != null && a.stress_level !== '') { const st = Number(a.stress_level); if (st >= 8) bump(-5, 'High stress'); else if (st <= 3) bump(3, 'Low stress'); }
  const famCount = Array.isArray(a.family_conditions) ? a.family_conditions.filter((c) => c !== 'None' && c !== 'Unsure').length : 0;
  if (famCount >= 2) bump(-4, 'Family history of chronic conditions');

  score = Math.max(5, Math.min(100, Math.round(score)));
  factors.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  return { score, factors: factors.slice(0, 4) };
}
