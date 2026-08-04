const bedtimes = ['22:50:00', '23:15:00', '22:45:00', '23:05:00', '23:30:00', '22:40:00', '23:00:00'];
const wakeTimes = ['05:55:00', '06:10:00', '05:50:00', '06:05:00', '06:35:00', '05:45:00', '06:15:00'];

export const deriveKpiPlaceholderFields = (metric, dayIndex = 0, patientId = 1) => {
  const activeMinutes = Number(metric.active_minutes ?? metric.active ?? 0);
  const exerciseMinutes = Number(metric.exercise_minutes ?? metric.exercise ?? 0);
  const sleepHours = Number(metric.sleep_hours ?? metric.sleep ?? 0);
  const sedentaryHours = Number(metric.sedentary_hours ?? metric.sedentary ?? 0);
  const workoutCount = Number(metric.workout_count ?? metric.workout ?? 0);
  const stressLevel = Number(metric.stress_level ?? metric.stress ?? 5);
  const offset = (patientId + dayIndex) % bedtimes.length;

  const activeCalories = Math.max(
    180,
    Math.round(activeMinutes * 7.5 + exerciseMinutes * 4.5 + workoutCount * 28)
  );
  const sleepInterruptions = Math.max(
    0,
    Math.min(4, (sleepHours < 6 ? 2 : sleepHours < 6.6 ? 1 : 0) + (stressLevel >= 6 ? 1 : 0))
  );
  const sleepConsistency = clamp(
    round(100 - Math.abs(sleepHours - 7.5) * 12 - sleepInterruptions * 8 - Math.abs(offset - 3) * 2, 1),
    35,
    100
  );
  const longestInactiveMinutes = Math.max(
    60,
    Math.min(240, Math.round(sedentaryHours * 22 + Math.max(0, 50 - activeMinutes) * 1.5))
  );
  const workoutIntensity =
    exerciseMinutes >= 55 && activeMinutes >= 55 ? 'Vigorous' :
    exerciseMinutes >= 35 ? 'Moderate' :
    exerciseMinutes > 0 ? 'Light' :
    'None';

  return {
    active_calories: activeCalories,
    sleep_bedtime: bedtimes[offset],
    sleep_wake_time: wakeTimes[offset],
    sleep_interruptions: sleepInterruptions,
    sleep_consistency: sleepConsistency,
    longest_inactive_minutes: longestInactiveMinutes,
    workout_intensity: workoutIntensity,
  };
};

// Small deterministic PRNG so re-seeding always produces the same data.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (value, digits = 0) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// A full year of history so the app can show real long-term progress, support
// month-over-month/seasonal views, and give the cycle predictor and correlation
// features enough data to be meaningful.
const HEALTH_HISTORY_DAYS = 365;

export const generateDailyHealthData = () => {
  const data = [];

  // `HEALTH_HISTORY_DAYS` consecutive days ending today (UTC), so the newest
  // record is always "today" and the data reads as current/ongoing.
  const now = new Date();
  const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const days = [];
  for (let i = HEALTH_HISTORY_DAYS - 1; i >= 0; i -= 1) {
    const d = new Date(endDate);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  // Each patient is a distinct "person" for the showcase — every profile has ONE
  // clear headline problem that the dashboard, AI advice, and Risk Signal react to.
  // These are the CURRENT (today) baselines:
  //   Alex   (1) - severe sleep deprivation (~4.8 h) + shaky recovery
  //   Maria  (2) - overweight/obese, sedentary, poor diet (metabolic / diabetes risk)
  //   James  (3) - high blood pressure (~146/95), otherwise moderate
  //   Sophie (4) - very sedentary (~2,900 steps, 11.5 h sitting)
  //   Daniel (5) - chronic high stress (9/10) + poor diet
  const patientBaselines = {
    1: { steps: 8500, sleep: 4.8, hr: 76, exercise: 45, bp_sys: 118, bp_dia: 76, bmi: 23.5, calories: 2450, active: 50, workout: 3, diet: 7, stress: 6, sedentary: 6.5 },   // Alex  - sleep deprivation
    2: { steps: 3800, sleep: 6.8, hr: 78, exercise: 12, bp_sys: 128, bp_dia: 82, bmi: 31.5, calories: 1900, active: 15, workout: 1, diet: 3, stress: 6, sedentary: 11.0 },  // Maria - overweight / metabolic
    3: { steps: 7000, sleep: 6.9, hr: 74, exercise: 30, bp_sys: 146, bp_dia: 95, bmi: 26.5, calories: 2200, active: 34, workout: 2, diet: 5, stress: 5, sedentary: 7.5 },   // James - hypertension
    4: { steps: 2900, sleep: 7.0, hr: 74, exercise: 8,  bp_sys: 120, bp_dia: 78, bmi: 25.0, calories: 1950, active: 12, workout: 1, diet: 6, stress: 5, sedentary: 11.5 },  // Sophie- sedentary / low activity
    5: { steps: 6000, sleep: 6.2, hr: 80, exercise: 25, bp_sys: 126, bp_dia: 82, bmi: 26.0, calories: 2100, active: 30, workout: 2, diet: 3, stress: 9, sedentary: 8.0 },   // Daniel- chronic high stress + poor diet
    6: { steps: 3500, sleep: 5.6, hr: 84, exercise: 8, bp_sys: 150, bp_dia: 96, bmi: 33.0, calories: 1850, active: 12, workout: 0, diet: 3, stress: 6, sedentary: 11.0 },  // Robert- older, high-RISK: obese, high BP, poor sleep, sedentary
  };

  // Year-long progress: net change from one year ago -> today (now - yearAgo),
  // per metric. Positive means the value is higher now than a year ago. This makes
  // the "progress over the year" view show a real story per patient:
  //   Maria improving a lot, James's activity declining, others steady/slight gains.
  const yearProgress = {
    1: { steps: 300, sleep: -1.4, hr: 5, exercise: 2, active: 2, sedentary: 0.8, stress: 1.5, bmi: 0.2, bp_sys: 2, bp_dia: 1, calories: 40 },        // Alex - sleep slid, stress crept up
    2: { steps: 900, sleep: 0.6, hr: -4, exercise: 5, active: 6, sedentary: -1.2, stress: -1.0, bmi: -1.4, bp_sys: -5, bp_dia: -3, calories: 120 }, // Maria - improving (slowly losing weight)
    3: { steps: -400, sleep: -0.2, hr: 2, exercise: -6, active: -6, sedentary: 0.8, stress: 0.6, bmi: 0.6, bp_sys: 8, bp_dia: 5, calories: -80 },   // James - blood pressure rising
    4: { steps: -1500, sleep: 0.0, hr: 3, exercise: -18, active: -18, sedentary: 2.2, stress: 0.8, bmi: 1.0, bp_sys: 2, bp_dia: 1, calories: -150 },// Sophie - activity fell off a cliff
    5: { steps: -300, sleep: -0.6, hr: 4, exercise: -4, active: -4, sedentary: 0.6, stress: 2.5, bmi: 0.5, bp_sys: 3, bp_dia: 2, calories: -40 },   // Daniel - stress climbing
    6: { steps: -400, sleep: -0.4, hr: 3, exercise: -3, active: -3, sedentary: 0.8, stress: 0.6, bmi: 0.8, bp_sys: 7, bp_dia: 4, calories: -50 },  // Robert - drifting worse (weight & BP rising)
  };

  const lastIndex = days.length - 1;

  let id = 1;
  Object.keys(patientBaselines).forEach((key) => {
    const patientId = Number(key);
    const b = patientBaselines[patientId];
    const prog = yearProgress[patientId] || {};
    const rnd = mulberry32(patientId * 9973 + 12345);
    // Roughly-normal noise centered on 0, about [-1.5, 1.5]. Each metric draws
    // its own noise so metrics vary independently (realistic correlations).
    const noise = () => rnd() + rnd() + rnd() - 1.5;

    // Value of a metric on a given day, trended from a year ago to today.
    // p=0 is the oldest day, p=1 is today. delta is (now - yearAgo).
    const trend = (metric, p) => b[metric] - (prog[metric] || 0) * (1 - p);

    days.forEach((date, index) => {
      const p = lastIndex ? index / lastIndex : 1;
      // Gentle seasonal wave (peaks ~late June, dips ~late December) for realism.
      const dObj = new Date(`${date}T00:00:00Z`);
      const doy = Math.floor((dObj - Date.UTC(dObj.getUTCFullYear(), 0, 0)) / 86400000);
      const seasonal = Math.cos(((doy - 172) / 365) * 2 * Math.PI); // ~+1 summer, ~-1 winter

      // Trended baselines for this day.
      const bExercise = trend('exercise', p);
      const bActive = trend('active', p);
      const bSedentary = trend('sedentary', p);
      const bSleep = trend('sleep', p);
      const bSteps = trend('steps', p);
      const bHr = trend('hr', p);

      // Independent daily drivers (each draws its own noise), with a small seasonal
      // lift to movement in warmer months.
      const exercise = Math.max(0, Math.round(bExercise * (1 + 0.07 * seasonal) + noise() * 10));
      const activeMinutes = Math.max(0, Math.round(bActive * (1 + 0.08 * seasonal) + noise() * 10));
      const sedentary = clamp(round(bSedentary * (1 - 0.05 * seasonal) + noise() * 1.1, 1), 1, 14);

      // Realistic, detectable relationships the "Connections" feature can find:
      // - more exercise -> a bit more sleep
      // - more sitting  -> fewer steps that day
      // - resting HR is lower with more sleep and higher with more sitting
      const sleep = clamp(round(bSleep + 0.03 * (exercise - bExercise) + noise() * 0.5, 1), 3.5, 9.5);
      const steps = Math.max(0, Math.round(bSteps * (1 + 0.05 * seasonal) - 420 * (sedentary - bSedentary) + noise() * 800));
      const hr = Math.round(bHr - 1.3 * (sleep - bSleep) + 0.9 * (sedentary - bSedentary) + noise() * 1.5);

      const dailyMetric = {
        daily_health_id: id++,
        patient_id: patientId,
        record_date: date,
        steps,
        sleep_hours: sleep,
        resting_heart_rate: hr,
        exercise_minutes: exercise,
        systolic_bp: Math.round(trend('bp_sys', p) + noise() * 3),
        diastolic_bp: Math.round(trend('bp_dia', p) + noise() * 2),
        bmi: round(trend('bmi', p) + noise() * 0.05, 1),
        calories_burned: Math.round(trend('calories', p) + noise() * 110),
        active_minutes: activeMinutes,
        workout_count: Math.max(0, Math.round(b.workout + noise() * 0.8)),
        diet_score: clamp(Math.round(b.diet + noise() * 1.2), 1, 10),
        stress_level: clamp(Math.round(trend('stress', p) + noise() * 1.3), 1, 10),
        sedentary_hours: sedentary,
        data_source: index % 2 === 0 ? 'wearable' : 'manual',
        created_at: new Date(),
      };

      data.push({
        ...dailyMetric,
        ...deriveKpiPlaceholderFields(dailyMetric, index, patientId),
      });
    });
  });
  return data;
};

// Daily mood (1-5) derived from that day's physiology plus noise, so the mood
// analysis has genuine signal. Mood responds to how each day deviates from the
// patient's OWN baseline (a uniformly unhealthy patient still has better and
// worse days), anchored around a personal base level set by overall health.
export const generateMoodData = (dailyHealthData) => {
  const byPatient = new Map();
  for (const day of dailyHealthData) {
    if (!byPatient.has(day.patient_id)) byPatient.set(day.patient_id, []);
    byPatient.get(day.patient_id).push(day);
  }

  const moods = [];
  for (const [patientId, days] of byPatient) {
    const avg = (key) => days.reduce((s, d) => s + Number(d[key]), 0) / days.length;
    const avgSleep = avg('sleep_hours');
    const avgActive = avg('active_minutes');
    const avgStress = avg('stress_level');
    const avgSed = avg('sedentary_hours');
    // Personal anchor: healthier overall habits -> higher typical mood.
    const base = Math.max(1.8, Math.min(4.2,
      3 + (avgSleep - 6.8) * 0.35 - (avgStress - 5) * 0.15 - (avgSed - 7) * 0.06
    ));

    for (const day of days) {
      const rnd = mulberry32(patientId * 7919 + Number(String(day.record_date).slice(-2)) * 131);
      const noise = () => rnd() + rnd() - 1;
      const raw =
        base +
        (Number(day.sleep_hours) - avgSleep) * 1.1 +
        (Number(day.active_minutes) - avgActive) * 0.025 -
        (Number(day.stress_level) - avgStress) * 0.3 -
        (Number(day.sedentary_hours) - avgSed) * 0.22 +
        noise() * 0.35;
      moods.push({
        patient_id: patientId,
        record_date: day.record_date,
        mood: Math.max(1, Math.min(5, Math.round(raw))),
      });
    }
  }
  return moods;
};

// Period history for patients who track cycles. Anchored to the current date so
// the data always reads like a real, ongoing cycle: each patient is placed at a
// plausible point in her current cycle (`dayInCycle`), then history walks backwards
// using her typical cycle length plus small natural variation. This keeps stats and
// predictions accurate over time — the next-period estimate always lands a realistic
// few days/weeks out instead of drifting overdue as calendar time passes.
// Keyed by patient_id -> { avgCycle, variability, periodDays, dayInCycle }.
const CYCLE_PROFILES = {
  2: { avgCycle: 29, variability: 4, periodDays: 5, dayInCycle: 20 }, // Maria - a bit irregular, ~9 days out
  4: { avgCycle: 28, variability: 1, periodDays: 4, dayInCycle: 16 }, // Sophie - very regular, ~12 days out
};

export const generatePeriodData = () => {
  const rows = [];
  // Today at UTC midnight, matching the UTC date math used below.
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  for (const [key, profile] of Object.entries(CYCLE_PROFILES)) {
    const patientId = Number(key);
    const rnd = mulberry32(patientId * 4241 + 77);
    // Most recent period started (dayInCycle - 1) days ago, so she's currently
    // that many days into her cycle as of today.
    const cursor = new Date(today);
    cursor.setUTCDate(cursor.getUTCDate() - (profile.dayInCycle - 1));

    for (let i = 0; i < 6; i += 1) {
      const start = new Date(cursor);
      const end = new Date(cursor);
      end.setUTCDate(end.getUTCDate() + (profile.periodDays - 1));
      rows.push({
        patient_id: patientId,
        start_date: start.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
      });
      // Step back one cycle (length varies naturally around the average).
      const jitter = Math.round((rnd() * 2 - 1) * profile.variability);
      cursor.setUTCDate(cursor.getUTCDate() - (profile.avgCycle + jitter));
    }
  }
  return rows;
};

export const generateKpiValues = () => {
  const data = [];
  let id = 1;
  const patients = [1, 2, 3, 4, 5, 6];
  const kpiTypes = [1, 2, 3, 4];
  const dates = ['2026-06-24', '2026-06-30'];
  
  patients.forEach(patientId => {
    dates.forEach(date => {
      kpiTypes.forEach(kpiTypeId => {
        let value = 0;
        let text = 'Moderate';
        const base = 65 + (patientId * 3) % 20;
        const variation = (patientId * 7 + kpiTypeId * 5 + Date.parse(date) / 86400000) % 30;
        
        switch(kpiTypeId) {
          case 1: // Health Score
            value = Math.min(100, base + variation - 10);
            text = value > 75 ? 'Good' : value > 55 ? 'Moderate' : 'Needs attention';
            break;
          case 2: // Risk Score
            value = Math.min(100, 30 + (100 - base) * 0.7 + (variation - 15) * 0.5);
            text = value > 70 ? 'High' : value > 40 ? 'Moderate' : 'Low';
            break;
          case 3: // Activity Consistency
            value = Math.min(100, 60 + (patientId * 5) % 25 + (variation - 15) * 0.6);
            text = value > 75 ? 'Consistent' : value > 50 ? 'Moderate' : 'Needs improvement';
            break;
          case 4: // Recovery Score
            value = Math.min(100, 50 + (patientId * 4) % 30 + (variation - 10) * 0.7);
            text = value > 70 ? 'Good' : value > 45 ? 'Moderate' : 'Needs attention';
            break;
        }
        
        data.push({
          kpi_value_id: id++,
          patient_id: patientId,
          kpi_type_id: kpiTypeId,
          calculation_date: date,
          numeric_value: Math.round(value),
          text_value: text
        });
      });
    });
  });
  return data;
};
