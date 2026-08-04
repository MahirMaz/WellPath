import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../src/config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const exportDir = path.join(projectRoot, 'powerbi_exports');

const csvEscape = (value) => {
  if (value === null || value === undefined) return '';
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const writeCsv = (filename, rows) => {
  if (!rows.length) {
    fs.writeFileSync(path.join(exportDir, filename), '');
    return;
  }

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
  ];

  fs.writeFileSync(path.join(exportDir, filename), `${lines.join('\n')}\n`);
};

const queries = {
  'patients.csv': `
    SELECT
      pp.patient_id,
      p.user_id,
      p.full_name,
      p.email,
      p.gender,
      p.date_of_birth,
      p.birthday,
      p.age,
      p.height_inches,
      p.weight_lbs,
      pp.primary_focus,
      pp.consent_status
    FROM patient_profiles pp
    JOIN user_pii p ON p.user_id = pp.user_id
    ORDER BY pp.patient_id
  `,
  'daily_health.csv': `
    SELECT
      daily_health_id,
      patient_id,
      record_date,
      steps,
      sleep_hours,
      sleep_bedtime,
      sleep_wake_time,
      sleep_interruptions,
      sleep_consistency,
      resting_heart_rate,
      exercise_minutes,
      active_minutes,
      calories_burned,
      active_calories,
      sedentary_hours,
      longest_inactive_minutes,
      workout_count,
      workout_intensity,
      systolic_bp,
      diastolic_bp,
      bmi,
      diet_score,
      stress_level,
      data_source
    FROM patient_daily_health_fact
    ORDER BY patient_id, record_date
  `,
  'metric_preferences.csv': `
    SELECT
      patient_id,
      step_goal,
      sleep_goal_hours,
      exercise_goal_minutes,
      active_minute_goal,
      sedentary_limit_hours,
      active_calorie_goal,
      resting_hr_baseline_low,
      resting_hr_baseline_high,
      bp_systolic_target_max,
      bp_diastolic_target_max
    FROM patient_metric_preferences
    ORDER BY patient_id
  `,
  'goals.csv': `
    SELECT
      goal_id,
      patient_id,
      goal_text,
      goal_status,
      target_date
    FROM goals
    ORDER BY patient_id, goal_id
  `,
  'care_assignments.csv': `
    SELECT
      ca.assignment_id,
      ca.patient_id,
      patient.full_name AS patient_name,
      ca.clinician_user_id,
      clinician.full_name AS clinician_name,
      ca.trainer_user_id,
      trainer.full_name AS trainer_name,
      ca.start_date,
      ca.end_date
    FROM care_assignments ca
    JOIN patient_profiles pp ON pp.patient_id = ca.patient_id
    JOIN user_pii patient ON patient.user_id = pp.user_id
    LEFT JOIN user_pii clinician ON clinician.user_id = ca.clinician_user_id
    LEFT JOIN user_pii trainer ON trainer.user_id = ca.trainer_user_id
    ORDER BY ca.patient_id
  `,
  'kpi_values.csv': `
    SELECT
      kv.kpi_value_id,
      kv.patient_id,
      kt.kpi_name,
      kt.role_view,
      kt.unit,
      kv.calculation_date,
      kv.numeric_value,
      kv.text_value
    FROM patient_kpi_values kv
    JOIN kpi_types kt ON kt.kpi_type_id = kv.kpi_type_id
    ORDER BY kv.patient_id, kt.kpi_name, kv.calculation_date
  `,
  'latest_patient_summary.csv': `
    WITH latest AS (
      SELECT
        f.*,
        ROW_NUMBER() OVER (PARTITION BY f.patient_id ORDER BY f.record_date DESC, f.daily_health_id DESC) AS rn
      FROM patient_daily_health_fact f
    )
    SELECT
      pp.patient_id,
      p.full_name,
      p.age,
      p.height_inches,
      p.weight_lbs,
      l.record_date,
      l.steps,
      pref.step_goal,
      l.sleep_hours,
      l.sleep_consistency,
      pref.sleep_goal_hours,
      l.resting_heart_rate,
      pref.resting_hr_baseline_low,
      pref.resting_hr_baseline_high,
      l.exercise_minutes,
      pref.exercise_goal_minutes,
      l.active_minutes,
      pref.active_minute_goal,
      l.active_calories,
      pref.active_calorie_goal,
      l.sedentary_hours,
      pref.sedentary_limit_hours,
      l.systolic_bp,
      l.diastolic_bp,
      pref.bp_systolic_target_max,
      pref.bp_diastolic_target_max,
      l.bmi,
      l.stress_level,
      l.diet_score
    FROM latest l
    JOIN patient_profiles pp ON pp.patient_id = l.patient_id
    JOIN user_pii p ON p.user_id = pp.user_id
    LEFT JOIN patient_metric_preferences pref ON pref.patient_id = l.patient_id
    WHERE l.rn = 1
    ORDER BY pp.patient_id
  `,
};

const run = async () => {
  fs.mkdirSync(exportDir, { recursive: true });

  for (const [filename, query] of Object.entries(queries)) {
    const [rows] = await pool.query(query);
    writeCsv(filename, rows);
    console.log(`Exported ${filename} (${rows.length} rows)`);
  }

  await pool.end();
};

run().catch(async (error) => {
  console.error('Power BI export failed:', error);
  await pool.end();
  process.exitCode = 1;
});
