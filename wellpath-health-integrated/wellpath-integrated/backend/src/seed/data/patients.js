export const patientProfiles = [
  { patient_id: 1, user_id: 1, consent_status: 1, primary_focus: 'Sleep Improvement' },
  { patient_id: 2, user_id: 2, consent_status: 1, primary_focus: 'Weight Management' },
  { patient_id: 3, user_id: 3, consent_status: 1, primary_focus: 'Blood Pressure Control' },
  { patient_id: 4, user_id: 4, consent_status: 1, primary_focus: 'Fitness Improvement' },
  { patient_id: 5, user_id: 5, consent_status: 1, primary_focus: 'Stress Management' },
  { patient_id: 6, user_id: 8, consent_status: 1, primary_focus: 'Diabetes Prevention' },
];

export const careAssignments = [
  { assignment_id: 1, patient_id: 1, clinician_user_id: 7, trainer_user_id: 6, start_date: '2026-01-15', end_date: null },
  { assignment_id: 2, patient_id: 2, clinician_user_id: 7, trainer_user_id: 6, start_date: '2026-02-01', end_date: null },
  { assignment_id: 3, patient_id: 3, clinician_user_id: 7, trainer_user_id: 6, start_date: '2026-03-10', end_date: null },
  { assignment_id: 4, patient_id: 4, clinician_user_id: 7, trainer_user_id: 6, start_date: '2026-04-05', end_date: null },
  { assignment_id: 5, patient_id: 5, clinician_user_id: 7, trainer_user_id: 6, start_date: '2026-05-01', end_date: null },
  { assignment_id: 6, patient_id: 6, clinician_user_id: 7, trainer_user_id: 6, start_date: '2026-02-20', end_date: null },
];

export const patientMetricPreferences = [
  {
    patient_id: 1,
    step_goal: 10000,
    sleep_goal_hours: 8.0,
    exercise_goal_minutes: 60,
    active_minute_goal: 60,
    sedentary_limit_hours: 8.0,
    active_calorie_goal: 800,
    resting_hr_baseline_low: 60,
    resting_hr_baseline_high: 72,
    bp_systolic_target_max: 120,
    bp_diastolic_target_max: 80,
  },
  {
    patient_id: 2,
    step_goal: 9000,
    sleep_goal_hours: 8.0,
    exercise_goal_minutes: 45,
    active_minute_goal: 55,
    sedentary_limit_hours: 8.0,
    active_calorie_goal: 700,
    resting_hr_baseline_low: 66,
    resting_hr_baseline_high: 73,
    bp_systolic_target_max: 120,
    bp_diastolic_target_max: 80,
  },
  {
    patient_id: 3,
    step_goal: 8500,
    sleep_goal_hours: 7.5,
    exercise_goal_minutes: 50,
    active_minute_goal: 60,
    sedentary_limit_hours: 7.5,
    active_calorie_goal: 760,
    resting_hr_baseline_low: 70,
    resting_hr_baseline_high: 78,
    bp_systolic_target_max: 125,
    bp_diastolic_target_max: 82,
  },
  {
    patient_id: 4,
    step_goal: 10000,
    sleep_goal_hours: 7.5,
    exercise_goal_minutes: 70,
    active_minute_goal: 65,
    sedentary_limit_hours: 8.0,
    active_calorie_goal: 850,
    resting_hr_baseline_low: 64,
    resting_hr_baseline_high: 72,
    bp_systolic_target_max: 120,
    bp_diastolic_target_max: 80,
  },
  {
    patient_id: 5,
    step_goal: 9000,
    sleep_goal_hours: 8.0,
    exercise_goal_minutes: 50,
    active_minute_goal: 55,
    sedentary_limit_hours: 7.5,
    active_calorie_goal: 720,
    resting_hr_baseline_low: 67,
    resting_hr_baseline_high: 75,
    bp_systolic_target_max: 122,
    bp_diastolic_target_max: 80,
  },
  {
    patient_id: 6,
    step_goal: 7000,
    sleep_goal_hours: 8.0,
    exercise_goal_minutes: 40,
    active_minute_goal: 45,
    sedentary_limit_hours: 8.0,
    active_calorie_goal: 600,
    resting_hr_baseline_low: 68,
    resting_hr_baseline_high: 76,
    bp_systolic_target_max: 130,
    bp_diastolic_target_max: 85,
  },
];

export const kpiTypes = [
  { kpi_type_id: 1, kpi_name: 'Health Score', role_view: 'patient', unit: 'score' },
  { kpi_type_id: 2, kpi_name: 'Risk Score', role_view: 'clinician', unit: 'score' },
  { kpi_type_id: 3, kpi_name: 'Activity Consistency', role_view: 'trainer', unit: '%' },
  { kpi_type_id: 4, kpi_name: 'Recovery Score', role_view: 'patient', unit: 'score' },
];

export const goalsData = [
  { text: 'Walk 10,000 steps at least 5 days this week', status: 'in_progress' },
  { text: 'Sleep 7 hours for the next 3 nights', status: 'in_progress' },
  { text: 'Complete three 45-minute workouts', status: 'planned' },
  { text: 'Review history signals every Friday', status: 'planned' },
];

export const recommendationsData = [
  'Try a 10-minute walk after meals.',
  'Keep bedtime within the same 30-minute window.',
  'Add one light stretching session after workouts.',
  'Drink water before afternoon activity.',
];
