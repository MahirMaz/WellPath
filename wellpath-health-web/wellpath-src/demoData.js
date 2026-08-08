const DAY_MS = 86_400_000;

export const demoProfiles = [
  {
    patientId: 1,
    userId: 1,
    name: 'Alex Johnson',
    email: 'alex@example.com',
    birthday: '2002-04-12',
    age: 24,
    gender: 'Male',
    heightInches: 70,
    weightLbs: 164,
    focus: 'Improve sleep and recovery',
    clinician: 'Dr. Rivera',
    trainer: 'Jordan Lee',
    baseline: { steps: 8500, sleep: 5.3, hr: 74, exercise: 48, activeMinutes: 52, sedentaryHours: 6.3, systolicBp: 119, diastolicBp: 76, bmi: 23.5, stress: 6 },
  },
  {
    patientId: 2,
    userId: 2,
    name: 'Maria Garcia',
    email: 'maria@example.com',
    birthday: '1998-08-25',
    age: 27,
    gender: 'Female',
    heightInches: 64,
    weightLbs: 184,
    focus: 'Build sustainable daily movement',
    clinician: 'Dr. Rivera',
    trainer: 'Jordan Lee',
    baseline: { steps: 4300, sleep: 6.8, hr: 78, exercise: 18, activeMinutes: 24, sedentaryHours: 10.1, systolicBp: 128, diastolicBp: 82, bmi: 31.5, stress: 6 },
  },
  {
    patientId: 3,
    userId: 3,
    name: 'James Kim',
    email: 'james@example.com',
    birthday: '1995-11-03',
    age: 30,
    gender: 'Male',
    heightInches: 69,
    weightLbs: 180,
    focus: 'Monitor cardiovascular patterns',
    clinician: 'Dr. Rivera',
    trainer: 'Jordan Lee',
    baseline: { steps: 7000, sleep: 6.9, hr: 75, exercise: 31, activeMinutes: 36, sedentaryHours: 7.4, systolicBp: 145, diastolicBp: 94, bmi: 26.6, stress: 5 },
  },
  {
    patientId: 4,
    userId: 4,
    name: 'Sophie Patel',
    email: 'sophie@example.com',
    birthday: '2000-06-18',
    age: 26,
    gender: 'Female',
    heightInches: 65,
    weightLbs: 150,
    focus: 'Reduce sedentary time',
    clinician: 'Dr. Rivera',
    trainer: 'Jordan Lee',
    baseline: { steps: 3100, sleep: 7.1, hr: 73, exercise: 12, activeMinutes: 18, sedentaryHours: 11.2, systolicBp: 120, diastolicBp: 78, bmi: 25, stress: 5 },
  },
  {
    patientId: 5,
    userId: 5,
    name: 'Daniel Lee',
    email: 'daniel@example.com',
    birthday: '1997-09-30',
    age: 28,
    gender: 'Male',
    heightInches: 70,
    weightLbs: 181,
    focus: 'Manage stress and nutrition',
    clinician: 'Dr. Rivera',
    trainer: 'Jordan Lee',
    baseline: { steps: 6100, sleep: 6.2, hr: 80, exercise: 26, activeMinutes: 31, sedentaryHours: 8, systolicBp: 126, diastolicBp: 82, bmi: 26, stress: 9 },
  },
  {
    patientId: 6,
    userId: 8,
    name: 'Robert Hayes',
    email: 'robert@example.com',
    birthday: '1964-03-10',
    age: 62,
    gender: 'Male',
    heightInches: 69,
    weightLbs: 224,
    focus: 'Improve activity and sleep consistency',
    clinician: 'Dr. Rivera',
    trainer: 'Jordan Lee',
    baseline: { steps: 3500, sleep: 5.7, hr: 84, exercise: 10, activeMinutes: 15, sedentaryHours: 10.8, systolicBp: 149, diastolicBp: 95, bmi: 33, stress: 6 },
  },
];

export const demoAccounts = [
  ...demoProfiles.map((profile) => ({
    id: profile.userId,
    name: profile.name,
    email: profile.email,
    role: 'patient',
    patientId: profile.patientId,
  })),
  { id: 6, name: 'Jordan Lee', email: 'jordan@example.com', role: 'trainer', patientId: null },
  { id: 7, name: 'Dr. Rivera', email: 'rivera@example.com', role: 'clinician', patientId: null },
  { id: 9, name: 'Morgan Chen', email: 'admin@wellpath.example', role: 'dba', patientId: null },
];

export function getDemoProfile(patientId) {
  return demoProfiles.find((profile) => profile.patientId === Number(patientId)) || demoProfiles[0];
}

function wobble(dayIndex, seed, amplitude) {
  return (
    Math.sin((dayIndex + seed * 3) / 5.2) * amplitude +
    Math.cos((dayIndex + seed) / 12.7) * amplitude * 0.45
  );
}

export function buildDemoTrends(patientId, count = 365) {
  const profile = getDemoProfile(patientId);
  const base = profile.baseline;
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today.getTime() - (count - index - 1) * DAY_MS);
    const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });
    const progress = index / Math.max(1, count - 1);
    const activityLift = profile.patientId === 2 ? progress * 650 : profile.patientId === 4 ? -progress * 500 : progress * 180;
    const steps = Math.max(1200, Math.round(base.steps + activityLift + wobble(index, profile.patientId, 620)));
    const sleep = Math.max(3.8, Math.min(9, Number((base.sleep + wobble(index, profile.patientId + 2, 0.35)).toFixed(1))));
    const exercise = Math.max(0, Math.round(base.exercise + wobble(index, profile.patientId + 4, 8)));
    const activeMinutes = Math.max(0, Math.round(base.activeMinutes + wobble(index, profile.patientId + 6, 9)));
    const sedentaryHours = Math.max(2, Number((base.sedentaryHours - activityLift / 2500 + wobble(index, profile.patientId + 5, 0.45)).toFixed(1)));
    const hr = Math.round(base.hr - (sleep - base.sleep) * 1.5 + wobble(index, profile.patientId + 1, 1.4));
    const activeCalories = Math.max(180, Math.round(activeMinutes * 7.4 + exercise * 4.1));

    return {
      day: dayLabel,
      recordDate: date.toISOString().slice(0, 10),
      steps,
      sleep,
      bedtime: '23:05:00',
      wakeTime: '06:15:00',
      sleepInterruptions: sleep < 6 ? 2 : 1,
      sleepConsistency: Math.max(48, Math.min(96, Math.round(88 - Math.abs(sleep - 7.5) * 10))),
      hr,
      exercise,
      activeMinutes,
      caloriesBurned: 1900 + activeCalories,
      activeCalories,
      sedentaryHours,
      longestInactiveMinutes: Math.round(sedentaryHours * 20),
      workoutCount: exercise > 35 ? 1 : 0,
      workoutIntensity: exercise > 45 ? 'Vigorous' : exercise > 20 ? 'Moderate' : 'Light',
      stress: Math.max(1, Math.min(10, Math.round(base.stress + wobble(index, profile.patientId + 8, 1)))),
      systolicBp: Math.round(base.systolicBp + wobble(index, profile.patientId + 9, 3)),
      diastolicBp: Math.round(base.diastolicBp + wobble(index, profile.patientId + 10, 2)),
    };
  });
}

export function buildDemoDashboard(patientId) {
  const profile = getDemoProfile(patientId);
  const latest = buildDemoTrends(profile.patientId, 7).at(-1);
  return {
    steps: latest.steps,
    sleep_hours: latest.sleep,
    sleep_bedtime: latest.bedtime,
    sleep_wake_time: latest.wakeTime,
    sleep_interruptions: latest.sleepInterruptions,
    sleep_consistency: latest.sleepConsistency,
    resting_heart_rate: latest.hr,
    exercise_minutes: latest.exercise,
    active_minutes: latest.activeMinutes,
    calories_burned: latest.caloriesBurned,
    active_calories: latest.activeCalories,
    sedentary_hours: latest.sedentaryHours,
    longest_inactive_minutes: latest.longestInactiveMinutes,
    workout_count: latest.workoutCount,
    workout_intensity: latest.workoutIntensity,
    systolic_bp: latest.systolicBp,
    diastolic_bp: latest.diastolicBp,
    bmi: profile.baseline.bmi,
    diet_score: profile.patientId === 5 ? 3 : 7,
    stress_level: latest.stress,
    step_goal: 10000,
    sleep_goal_hours: 8,
    exercise_goal_minutes: 60,
    active_minute_goal: 60,
    sedentary_limit_hours: 8,
    active_calorie_goal: 800,
    resting_hr_baseline_low: 60,
    resting_hr_baseline_high: 72,
    bp_systolic_target_max: 130,
    bp_diastolic_target_max: 85,
    birthday: profile.birthday,
    date_of_birth: profile.birthday,
    age: profile.age,
    gender: profile.gender,
    height_inches: profile.heightInches,
    weight_lbs: profile.weightLbs,
  };
}

export function buildDemoClinicianPatients() {
  return demoProfiles.map((profile) => {
    const elevated =
      profile.baseline.systolicBp >= 140 ||
      profile.baseline.bmi >= 32 ||
      profile.baseline.sedentaryHours >= 10.5;
    const riskScore = elevated ? 72 : profile.baseline.sedentaryHours >= 9 ? 48 : 28;
    return {
      patient_id: profile.patientId,
      full_name: profile.name,
      primary_focus: profile.focus,
      consent_status: 1,
      birthday: profile.birthday,
      age: profile.age,
      height_inches: profile.heightInches,
      weight_lbs: profile.weightLbs,
      clinician_name: profile.clinician,
      trainer_name: profile.trainer,
      healthScore: elevated ? 62 : 84,
      riskScore,
      riskLevel: riskScore >= 70 ? 'High' : riskScore >= 40 ? 'Medium' : 'Low',
    };
  });
}

export function buildDemoPatientDetails(patientId) {
  const profile = getDemoProfile(patientId);
  const dashboard = buildDemoDashboard(patientId);
  const highBloodPressure = dashboard.systolic_bp >= 140 || dashboard.diastolic_bp >= 90;
  return {
    profile: {
      patient_id: profile.patientId,
      full_name: profile.name,
      email: profile.email,
      gender: profile.gender,
      primary_focus: profile.focus,
      consent_status: 1,
    },
    health: dashboard,
    kpis: [
      { kpi_name: 'Health Score', numeric_value: highBloodPressure ? 64 : 84, text_value: highBloodPressure ? 'Review' : 'On track' },
      { kpi_name: 'Activity Consistency', numeric_value: Math.min(96, Math.round(dashboard.steps / 100)), text_value: 'Weekly' },
      { kpi_name: 'Recovery Score', numeric_value: Math.round((dashboard.sleep_hours / 8) * 100), text_value: 'Current' },
    ],
    alerts: highBloodPressure
      ? [{ alert_id: `bp-${profile.patientId}`, alert_type: 'Blood pressure pattern', alert_level: 'high', alert_message: 'Repeated readings are above the review threshold.' }]
      : [],
  };
}

export function buildDemoTrainerPatients() {
  return demoProfiles.slice(0, 5).map((profile) => {
    const dashboard = buildDemoDashboard(profile.patientId);
    return {
      patient_id: profile.patientId,
      full_name: profile.name,
      primary_focus: profile.focus,
      metrics: {
        steps: dashboard.steps,
        sleep_hours: dashboard.sleep_hours,
        resting_heart_rate: dashboard.resting_heart_rate,
        exercise_minutes: dashboard.exercise_minutes,
      },
      kpis: {
        'Activity Consistency': Math.min(96, Math.round(dashboard.steps / 100)),
        'Recovery Score': Math.round((dashboard.sleep_hours / 8) * 100),
      },
    };
  });
}

export const initialDemoGoals = {
  1: [
    { id: 101, title: 'Protect a consistent wind-down routine', status: 'In progress' },
    { id: 102, title: 'Reach the movement goal five days this week', status: 'Planned' },
  ],
  2: [
    { id: 201, title: 'Take a 10-minute walk after lunch', status: 'In progress' },
    { id: 202, title: 'Log three balanced lunches', status: 'Planned' },
  ],
};
