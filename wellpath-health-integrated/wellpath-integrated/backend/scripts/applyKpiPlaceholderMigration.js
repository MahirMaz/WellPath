import { pool } from '../src/config/db.js';
import { patientMetricPreferences } from '../src/seed/data/patients.js';
import { userPii } from '../src/seed/data/users.js';
import { deriveKpiPlaceholderFields } from '../src/seed/data/healthData.js';
import { ensureKpiPlaceholderSchema } from '../src/seed/kpiPlaceholderSchema.js';

const upsertPreferences = async (connection) => {
  for (const preferences of patientMetricPreferences) {
    await connection.query(`
      INSERT INTO patient_metric_preferences
      (patient_id, step_goal, sleep_goal_hours, exercise_goal_minutes, active_minute_goal,
       sedentary_limit_hours, active_calorie_goal, resting_hr_baseline_low,
       resting_hr_baseline_high, bp_systolic_target_max, bp_diastolic_target_max)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        step_goal = VALUES(step_goal),
        sleep_goal_hours = VALUES(sleep_goal_hours),
        exercise_goal_minutes = VALUES(exercise_goal_minutes),
        active_minute_goal = VALUES(active_minute_goal),
        sedentary_limit_hours = VALUES(sedentary_limit_hours),
        active_calorie_goal = VALUES(active_calorie_goal),
        resting_hr_baseline_low = VALUES(resting_hr_baseline_low),
        resting_hr_baseline_high = VALUES(resting_hr_baseline_high),
        bp_systolic_target_max = VALUES(bp_systolic_target_max),
        bp_diastolic_target_max = VALUES(bp_diastolic_target_max)
    `, [
      preferences.patient_id,
      preferences.step_goal,
      preferences.sleep_goal_hours,
      preferences.exercise_goal_minutes,
      preferences.active_minute_goal,
      preferences.sedentary_limit_hours,
      preferences.active_calorie_goal,
      preferences.resting_hr_baseline_low,
      preferences.resting_hr_baseline_high,
      preferences.bp_systolic_target_max,
      preferences.bp_diastolic_target_max,
    ]);
  }
};

const backfillProfileFields = async (connection) => {
  for (const pii of userPii) {
    await connection.query(`
      UPDATE user_pii
      SET
        birthday = COALESCE(birthday, ?),
        age = COALESCE(age, ?),
        height_inches = COALESCE(height_inches, ?),
        weight_lbs = COALESCE(weight_lbs, ?)
      WHERE user_id = ?
    `, [
      pii.birthday,
      pii.age,
      pii.height_inches,
      pii.weight_lbs,
      pii.user_id,
    ]);
  }
};

const backfillDailyHealth = async (connection) => {
  const [rows] = await connection.query(`
    SELECT
      daily_health_id,
      patient_id,
      sleep_hours,
      exercise_minutes,
      calories_burned,
      active_minutes,
      workout_count,
      stress_level,
      sedentary_hours
    FROM patient_daily_health_fact
    ORDER BY patient_id, record_date, daily_health_id
  `);

  const patientDayIndex = new Map();
  for (const row of rows) {
    const dayIndex = patientDayIndex.get(row.patient_id) ?? 0;
    patientDayIndex.set(row.patient_id, dayIndex + 1);
    const placeholders = deriveKpiPlaceholderFields(row, dayIndex, row.patient_id);

    await connection.query(`
      UPDATE patient_daily_health_fact
      SET
        active_calories = COALESCE(active_calories, ?),
        sleep_bedtime = COALESCE(sleep_bedtime, ?),
        sleep_wake_time = COALESCE(sleep_wake_time, ?),
        sleep_interruptions = COALESCE(sleep_interruptions, ?),
        sleep_consistency = COALESCE(sleep_consistency, ?),
        longest_inactive_minutes = COALESCE(longest_inactive_minutes, ?),
        workout_intensity = COALESCE(workout_intensity, ?)
      WHERE daily_health_id = ?
    `, [
      placeholders.active_calories,
      placeholders.sleep_bedtime,
      placeholders.sleep_wake_time,
      placeholders.sleep_interruptions,
      placeholders.sleep_consistency,
      placeholders.longest_inactive_minutes,
      placeholders.workout_intensity,
      row.daily_health_id,
    ]);
  }
};

const run = async () => {
  const connection = await pool.getConnection();
  try {
    await ensureKpiPlaceholderSchema(connection);
    await upsertPreferences(connection);
    await backfillProfileFields(connection);
    await backfillDailyHealth(connection);
    console.log('KPI placeholder migration complete.');
  } finally {
    connection.release();
    await pool.end();
  }
};

run().catch((error) => {
  console.error('KPI placeholder migration failed:', error);
  process.exitCode = 1;
});
