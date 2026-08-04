const dailyHealthColumns = [
  ['active_calories', 'INT NULL AFTER calories_burned'],
  ['sleep_bedtime', 'TIME NULL AFTER sleep_hours'],
  ['sleep_wake_time', 'TIME NULL AFTER sleep_bedtime'],
  ['sleep_interruptions', 'INT NULL AFTER sleep_wake_time'],
  ['sleep_consistency', 'DECIMAL(5,2) NULL AFTER sleep_interruptions'],
  ['longest_inactive_minutes', 'INT NULL AFTER sedentary_hours'],
  ['workout_intensity', 'VARCHAR(20) NULL AFTER workout_count'],
];

const userPiiColumns = [
  ['birthday', 'DATE NULL AFTER date_of_birth'],
  ['age', 'INT NULL AFTER birthday'],
  ['height_inches', 'DECIMAL(4,1) NULL AFTER age'],
  ['weight_lbs', 'DECIMAL(5,1) NULL AFTER height_inches'],
];

async function ensureColumns(connection, tableName, columns) {
  const [existingRows] = await connection.query(`SHOW COLUMNS FROM ${tableName}`);
  const existingColumns = new Set(existingRows.map((column) => column.Field));

  for (const [columnName, definition] of columns) {
    if (!existingColumns.has(columnName)) {
      await connection.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    }
  }
}

export async function ensureKpiPlaceholderSchema(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS patient_metric_preferences (
      patient_id INT PRIMARY KEY,
      step_goal INT NULL,
      sleep_goal_hours DECIMAL(3,1) NULL,
      exercise_goal_minutes INT NULL,
      active_minute_goal INT NULL,
      sedentary_limit_hours DECIMAL(3,1) NULL,
      active_calorie_goal INT NULL,
      resting_hr_baseline_low INT NULL,
      resting_hr_baseline_high INT NULL,
      bp_systolic_target_max INT NULL,
      bp_diastolic_target_max INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_patient_metric_preferences_patient
        FOREIGN KEY (patient_id) REFERENCES patient_profiles(patient_id)
        ON DELETE CASCADE
    )
  `);

  await ensureColumns(connection, 'patient_daily_health_fact', dailyHealthColumns);
  await ensureColumns(connection, 'user_pii', userPiiColumns);
}
