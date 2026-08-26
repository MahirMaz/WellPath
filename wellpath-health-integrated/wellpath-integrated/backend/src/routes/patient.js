import express from 'express';
import { pool } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

router.use(authenticate);

async function ownsPatientRecord(req, patientId) {
  if (req.user.role !== 'patient') return false;
  const [rows] = await pool.query(
    'SELECT patient_id FROM patient_profiles WHERE patient_id = ? AND user_id = ? LIMIT 1',
    [patientId, req.user.userId]
  );
  return rows.length > 0;
}

async function requireOwnPatient(req, res, next) {
  try {
    if (!(await ownsPatientRecord(req, req.params.id))) {
      return res.status(403).json({ error: 'You can only manage your own patient settings.' });
    }
    next();
  } catch (error) {
    next(error);
  }
}

const EDITABLE_METRIC_GOALS = Object.freeze({
  steps: { column: 'step_goal', minimum: 500, maximum: 100000, precision: 0 },
  sleep: { column: 'sleep_goal_hours', minimum: 1, maximum: 16, precision: 1 },
  exercise: { column: 'exercise_goal_minutes', minimum: 1, maximum: 600, precision: 0 },
  activeMinutes: { column: 'active_minute_goal', minimum: 1, maximum: 720, precision: 0 },
  activeCalories: { column: 'active_calorie_goal', minimum: 25, maximum: 10000, precision: 0 },
  sedentary: { column: 'sedentary_limit_hours', minimum: 1, maximum: 24, precision: 1 },
});

let supportTablesPromise;
function ensurePatientSupportTables() {
  if (!supportTablesPromise) {
    supportTablesPromise = Promise.all([
      pool.query(`CREATE TABLE IF NOT EXISTS patient_app_preferences (
        patient_id INT NOT NULL PRIMARY KEY,
        ai_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        ui_preferences JSON NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_patient_app_preferences_patient FOREIGN KEY (patient_id) REFERENCES patient_profiles(patient_id) ON DELETE CASCADE
      )`),
      pool.query(`CREATE TABLE IF NOT EXISTS patient_health_connections (
        patient_id INT NOT NULL,
        provider VARCHAR(40) NOT NULL,
        connection_status VARCHAR(30) NOT NULL DEFAULT 'not_connected',
        permissions JSON NULL,
        last_sync DATETIME NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (patient_id, provider),
        CONSTRAINT fk_patient_health_connections_patient FOREIGN KEY (patient_id) REFERENCES patient_profiles(patient_id) ON DELETE CASCADE
      )`),
      pool.query(`CREATE TABLE IF NOT EXISTS patient_food_log (
        food_log_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        patient_id INT NOT NULL,
        food_name VARCHAR(160) NOT NULL,
        kcal DECIMAL(10,2) NOT NULL DEFAULT 0,
        protein_g DECIMAL(10,2) NOT NULL DEFAULT 0,
        carbs_g DECIMAL(10,2) NOT NULL DEFAULT 0,
        sugar_g DECIMAL(10,2) NOT NULL DEFAULT 0,
        fibre_g DECIMAL(10,2) NOT NULL DEFAULT 0,
        fat_g DECIMAL(10,2) NOT NULL DEFAULT 0,
        satfat_g DECIMAL(10,2) NOT NULL DEFAULT 0,
        sodium_mg DECIMAL(10,2) NOT NULL DEFAULT 0,
        ai_estimated TINYINT(1) NOT NULL DEFAULT 0,
        logged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_patient_food_date (patient_id, logged_at),
        CONSTRAINT fk_patient_food_log_patient FOREIGN KEY (patient_id) REFERENCES patient_profiles(patient_id) ON DELETE CASCADE
      )`),
    ]).catch((error) => {
      supportTablesPromise = null;
      throw error;
    });
  }
  return supportTablesPromise;
}

router.get('/:id/dashboard', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        f.steps,
        f.sleep_hours,
        f.sleep_bedtime,
        f.sleep_wake_time,
        f.sleep_interruptions,
        f.sleep_consistency,
        f.resting_heart_rate,
        f.exercise_minutes,
        f.calories_burned,
        f.active_calories,
        f.active_minutes,
        f.bmi,
        f.systolic_bp,
        f.diastolic_bp,
        f.record_date,
        f.workout_count,
        f.workout_intensity,
        f.diet_score,
        f.stress_level,
        f.sedentary_hours,
        f.longest_inactive_minutes,
        pref.step_goal,
        pref.sleep_goal_hours,
        pref.exercise_goal_minutes,
        pref.active_minute_goal,
        pref.sedentary_limit_hours,
        pref.active_calorie_goal,
        pref.resting_hr_baseline_low,
        pref.resting_hr_baseline_high,
        pref.bp_systolic_target_max,
        pref.bp_diastolic_target_max,
        p.date_of_birth,
        p.birthday,
        p.age,
        p.gender,
        p.height_inches,
        p.weight_lbs
      FROM patient_daily_health_fact f
      JOIN patient_profiles pp ON pp.patient_id = f.patient_id
      JOIN user_pii p ON p.user_id = pp.user_id
      LEFT JOIN patient_metric_preferences pref ON pref.patient_id = f.patient_id
      WHERE f.patient_id = ?
      ORDER BY f.record_date DESC
      LIMIT 1
    `, [req.params.id]);

    res.json(rows[0] || {});
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/metric-goals', requireOwnPatient, asyncRoute(async (req, res) => {
  const metricId = String(req.body?.metricId || '');
  const config = EDITABLE_METRIC_GOALS[metricId];
  const requestedValue = Number(req.body?.value);

  if (!config) {
    return res.status(400).json({ error: 'That metric does not support a patient-adjustable goal.' });
  }
  if (!Number.isFinite(requestedValue) || requestedValue < config.minimum || requestedValue > config.maximum) {
    return res.status(400).json({
      error: `Enter a goal between ${config.minimum} and ${config.maximum}.`,
    });
  }

  const value = config.precision === 0
    ? Math.round(requestedValue)
    : Number(requestedValue.toFixed(config.precision));

  await pool.query(`
    INSERT INTO patient_metric_preferences (patient_id, ${config.column})
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE ${config.column} = VALUES(${config.column})
  `, [req.params.id, value]);

  res.json({ metricId, value });
}));

const historyDays = (req, fallback = 365) => {
  const n = parseInt(req.query.days, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, 1), 730);
};

router.get('/:id/trends', async (req, res) => {
  try {
    const limit = historyDays(req);
    const [rows] = await pool.query(`
      SELECT
        record_date as day,
        record_date as recordDate,
        steps,
        sleep_hours as sleep,
        sleep_bedtime as bedtime,
        sleep_wake_time as wakeTime,
        sleep_interruptions as sleepInterruptions,
        sleep_consistency as sleepConsistency,
        resting_heart_rate as hr,
        exercise_minutes as exercise,
        active_minutes as activeMinutes,
        calories_burned as caloriesBurned,
        active_calories as activeCalories,
        sedentary_hours as sedentaryHours,
        longest_inactive_minutes as longestInactiveMinutes,
        workout_count as workoutCount,
        workout_intensity as workoutIntensity,
        stress_level as stress,
        systolic_bp as systolicBp,
        diastolic_bp as diastolicBp
      FROM patient_daily_health_fact
      WHERE patient_id = ?
      ORDER BY record_date DESC
      LIMIT ${limit}
    `, [req.params.id]);

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const formatted = rows.map(row => ({
      ...row,
      day: days[new Date(row.day).getDay()]
    })).reverse();

    res.json(formatted);
  } catch (error) {
    console.error('Trends error:', error);
    res.status(500).json({ error: error.message });
  }
});

let moodTableReady = null;
function ensureMoodTable() {
  if (!moodTableReady) {
    moodTableReady = pool.query(`
      CREATE TABLE IF NOT EXISTS patient_mood_log (
        patient_id INT NOT NULL,
        record_date DATE NOT NULL,
        mood TINYINT NOT NULL,
        note VARCHAR(200) NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (patient_id, record_date)
      )
    `).catch((error) => {
      moodTableReady = null;
      throw error;
    });
  }
  return moodTableReady;
}

router.get('/:id/mood', async (req, res) => {
  try {
    await ensureMoodTable();
    const limit = historyDays(req);
    const [rows] = await pool.query(`
      SELECT record_date AS date, mood, note
      FROM patient_mood_log
      WHERE patient_id = ?
      ORDER BY record_date DESC
      LIMIT ${limit}
    `, [req.params.id]);
    res.json(rows.reverse());
  } catch (error) {
    console.error('Mood log error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/mood', async (req, res) => {
  try {
    const { mood, date, note } = req.body;
    const moodValue = Number(mood);
    if (!Number.isInteger(moodValue) || moodValue < 1 || moodValue > 5) {
      return res.status(400).json({ error: 'Mood must be an integer from 1 to 5' });
    }
    const recordDate = date || new Date().toISOString().slice(0, 10);

    await ensureMoodTable();
    await pool.query(`
      INSERT INTO patient_mood_log (patient_id, record_date, mood, note)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE mood = VALUES(mood), note = VALUES(note)
    `, [req.params.id, recordDate, moodValue, note || null]);

    res.status(201).json({ date: recordDate, mood: moodValue, note: note || null });
  } catch (error) {
    console.error('Save mood error:', error);
    res.status(500).json({ error: error.message });
  }
});

let periodTableReady = null;
function ensurePeriodTable() {
  if (!periodTableReady) {
    periodTableReady = pool.query(`
      CREATE TABLE IF NOT EXISTS patient_period_log (
        patient_id INT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NULL,
        notes VARCHAR(200) NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (patient_id, start_date)
      )
    `).catch((error) => {
      periodTableReady = null;
      throw error;
    });
  }
  return periodTableReady;
}

const isDateString = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));

router.get('/:id/periods', async (req, res) => {
  try {
    await ensurePeriodTable();
    const [rows] = await pool.query(`
      SELECT start_date AS startDate, end_date AS endDate
      FROM patient_period_log
      WHERE patient_id = ?
      ORDER BY start_date DESC
      LIMIT 24
    `, [req.params.id]);
    res.json(rows.reverse());
  } catch (error) {
    console.error('Period log error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/periods', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    if (!isDateString(startDate)) {
      return res.status(400).json({ error: 'startDate must be YYYY-MM-DD' });
    }
    if (endDate && !isDateString(endDate)) {
      return res.status(400).json({ error: 'endDate must be YYYY-MM-DD' });
    }
    await ensurePeriodTable();
    await pool.query(`
      INSERT INTO patient_period_log (patient_id, start_date, end_date)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE end_date = VALUES(end_date)
    `, [req.params.id, startDate, endDate || null]);
    res.status(201).json({ startDate, endDate: endDate || null });
  } catch (error) {
    console.error('Save period error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id/periods/:date', async (req, res) => {
  try {
    if (!isDateString(req.params.date)) {
      return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    }
    await ensurePeriodTable();
    await pool.query(
      'DELETE FROM patient_period_log WHERE patient_id = ? AND start_date = ?',
      [req.params.id, req.params.date]
    );
    res.json({ removed: req.params.date });
  } catch (error) {
    console.error('Delete period error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/goals', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        goal_id as id,
        goal_text as title,
        goal_status as status
      FROM goals
      WHERE patient_id = ?
      ORDER BY goal_id
    `, [req.params.id]);

    const formatted = rows.map(row => ({
      ...row,
      status: row.status === 'completed' ? 'Complete' : 
              row.status === 'in_progress' ? 'In progress' : 'Planned'
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Goals error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/goals', async (req, res) => {
  try {
    const { title, status } = req.body;
    const patientId = req.params.id;

    if (!title) {
      return res.status(400).json({ error: 'Goal title required' });
    }

    const goalStatus = status === 'Complete' ? 'completed' :
                      status === 'In progress' ? 'in_progress' : 'planned';

    const [result] = await pool.query(`
      INSERT INTO goals (patient_id, goal_text, goal_status, target_date)
      VALUES (?, ?, ?, ?)
    `, [patientId, title, goalStatus, new Date(Date.now() + 7 * 86400000)]);

    res.status(201).json({
      id: result.insertId,
      title,
      status: status || 'Planned'
    });
  } catch (error) {
    console.error('Add goal error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.patch('/goals/:id', async (req, res) => {
  try {
    const { status, title } = req.body;
    const goalId = req.params.id;

    let query = 'UPDATE goals SET ';
    const params = [];

    if (status) {
      const goalStatus = status === 'Complete' ? 'completed' :
                        status === 'In progress' ? 'in_progress' : 'planned';
      query += 'goal_status = ? ';
      params.push(goalStatus);
    }
    if (title) {
      if (status) query += ', ';
      query += 'goal_text = ? ';
      params.push(title);
    }
    query += 'WHERE goal_id = ?';
    params.push(goalId);

    await pool.query(query, params);
    res.json({ success: true });
  } catch (error) {
    console.error('Update goal error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/care-team', async (req, res) => {
  try {
    const patientId = req.params.id;

    const [rows] = await pool.query(`
      SELECT
        pp.primary_focus,
        clin.full_name AS clinician_name,
        trn.full_name  AS trainer_name
      FROM patient_profiles pp
      LEFT JOIN care_assignments ca ON ca.patient_id = pp.patient_id AND ca.end_date IS NULL
      LEFT JOIN user_pii clin ON clin.user_id = ca.clinician_user_id
      LEFT JOIN user_pii trn  ON trn.user_id  = ca.trainer_user_id
      WHERE pp.patient_id = ?
      LIMIT 1
    `, [patientId]);

    const [noteRows] = await pool.query(`
      SELECT note_text, created_at
      FROM trainer_notes
      WHERE patient_id = ?
      ORDER BY note_id DESC
      LIMIT 1
    `, [patientId]);

    const row = rows[0] || {};
    res.json({
      primaryFocus: row.primary_focus || null,
      trainer: row.trainer_name ? { name: row.trainer_name } : null,
      clinician: row.clinician_name ? { name: row.clinician_name } : null,
      trainerNote: noteRows[0]
        ? { text: noteRows[0].note_text, date: noteRows[0].created_at }
        : null,
    });
  } catch (error) {
    console.error('Care team error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/preferences', requireOwnPatient, asyncRoute(async (req, res) => {
  await ensurePatientSupportTables();
  const [rows] = await pool.query(
    'SELECT ai_enabled, ui_preferences FROM patient_app_preferences WHERE patient_id = ? LIMIT 1',
    [req.params.id]
  );
  const row = rows[0];
  const uiPreferences = row?.ui_preferences
    ? (typeof row.ui_preferences === 'string' ? JSON.parse(row.ui_preferences) : row.ui_preferences)
    : null;
  res.json({ ai_enabled: row ? Boolean(row.ai_enabled) : true, ui_preferences: uiPreferences });
}));

router.patch('/:id/preferences', requireOwnPatient, asyncRoute(async (req, res) => {
  await ensurePatientSupportTables();
  const { aiEnabled, uiPreferences } = req.body || {};
  if (typeof aiEnabled !== 'boolean' && !uiPreferences) {
    return res.status(400).json({ error: 'No supported preference was provided.' });
  }
  await pool.query(`
    INSERT INTO patient_app_preferences (patient_id, ai_enabled, ui_preferences)
    VALUES (?, COALESCE(?, TRUE), ?)
    ON DUPLICATE KEY UPDATE
      ai_enabled = IF(? IS NULL, ai_enabled, VALUES(ai_enabled)),
      ui_preferences = COALESCE(VALUES(ui_preferences), ui_preferences)
  `, [
    req.params.id,
    typeof aiEnabled === 'boolean' ? aiEnabled : null,
    uiPreferences ? JSON.stringify(uiPreferences) : null,
    typeof aiEnabled === 'boolean' ? aiEnabled : null,
  ]);
  const [rows] = await pool.query(
    'SELECT ai_enabled, ui_preferences FROM patient_app_preferences WHERE patient_id = ? LIMIT 1',
    [req.params.id]
  );
  const row = rows[0];
  res.json({
    ai_enabled: Boolean(row.ai_enabled),
    ui_preferences: typeof row.ui_preferences === 'string' ? JSON.parse(row.ui_preferences) : row.ui_preferences,
  });
}));

router.get('/:id/connections', requireOwnPatient, asyncRoute(async (req, res) => {
  await ensurePatientSupportTables();
  const [rows] = await pool.query(`
    SELECT provider, connection_status AS status, permissions, last_sync
    FROM patient_health_connections WHERE patient_id = ? ORDER BY provider
  `, [req.params.id]);
  const existing = new Map(rows.map((row) => [row.provider, {
    ...row,
    permissions: row.permissions
      ? (typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions)
      : [],
  }]));
  res.json(['apple_health', 'health_connect'].map((provider) => existing.get(provider) || {
    provider, status: 'not_connected', permissions: [], last_sync: null,
  }));
}));

router.patch('/:id/connections/:provider', requireOwnPatient, asyncRoute(async (req, res) => {
  await ensurePatientSupportTables();
  const provider = String(req.params.provider);
  if (!['apple_health', 'health_connect'].includes(provider)) {
    return res.status(400).json({ error: 'Unsupported health data provider.' });
  }
  const status = req.body.status === 'connected' ? 'connected' : 'not_connected';
  const permissions = Array.isArray(req.body.permissions) ? req.body.permissions : [];
  const lastSync = req.body.last_sync || null;
  await pool.query(`
    INSERT INTO patient_health_connections (patient_id, provider, connection_status, permissions, last_sync)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE connection_status = VALUES(connection_status), permissions = VALUES(permissions), last_sync = VALUES(last_sync)
  `, [req.params.id, provider, status, JSON.stringify(permissions), lastSync]);
  res.json({ provider, status, permissions, last_sync: lastSync });
}));

router.get('/:id/nutrition-logs', requireOwnPatient, asyncRoute(async (req, res) => {
  await ensurePatientSupportTables();
  const days = Math.min(Math.max(Number.parseInt(req.query.days, 10) || 45, 1), 365);
  const [rows] = await pool.query(`
    SELECT food_log_id AS id, DATE(logged_at) AS recordDate, food_name AS name,
      kcal, protein_g AS protein, carbs_g AS carbs, sugar_g AS sugar,
      fibre_g AS fibre, fat_g AS fat, satfat_g AS satfat, sodium_mg AS sodium,
      ai_estimated, logged_at AS createdAt
    FROM patient_food_log
    WHERE patient_id = ? AND logged_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    ORDER BY logged_at ASC, food_log_id ASC
  `, [req.params.id, days]);
  res.json(rows.map((row) => ({
    id: row.id,
    name: row.name,
    recordDate: new Date(row.recordDate).toISOString().slice(0, 10),
    source: row.ai_estimated ? 'ai_estimate' : 'manual',
    ...Object.fromEntries(['kcal', 'protein', 'carbs', 'sugar', 'fibre', 'fat', 'satfat', 'sodium'].map((key) => [key, Number(row[key]) || 0])),
  })));
}));

router.post('/:id/nutrition-logs', requireOwnPatient, asyncRoute(async (req, res) => {
  await ensurePatientSupportTables();
  const entry = req.body || {};
  const recordDate = /^\d{4}-\d{2}-\d{2}$/.test(String(entry.recordDate || '')) ? entry.recordDate : new Date().toISOString().slice(0, 10);
  const name = String(entry.name || '').trim().slice(0, 180);
  if (!name) return res.status(400).json({ error: 'Food name is required.' });
  const number = (key) => Math.max(0, Number(entry[key]) || 0);
  const [result] = await pool.query(`
    INSERT INTO patient_food_log
      (patient_id, logged_at, food_name, kcal, protein_g, carbs_g, sugar_g, fibre_g, fat_g, satfat_g, sodium_mg, ai_estimated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [req.params.id, recordDate, name, number('kcal'), number('protein'), number('carbs'), number('sugar'), number('fibre'), number('fat'), number('satfat'), number('sodium'), entry.source === 'ai_estimate' ? 1 : 0]);
  res.status(201).json({ id: result.insertId, recordDate, name, ...Object.fromEntries(['kcal', 'protein', 'carbs', 'sugar', 'fibre', 'fat', 'satfat', 'sodium'].map((key) => [key, number(key)])), source: entry.source === 'ai_estimate' ? 'ai_estimate' : 'manual' });
}));

router.delete('/:id/nutrition-logs/:logId', requireOwnPatient, asyncRoute(async (req, res) => {
  await ensurePatientSupportTables();
  const [result] = await pool.query('DELETE FROM patient_food_log WHERE food_log_id = ? AND patient_id = ?', [req.params.logId, req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Food log entry not found.' });
  res.json({ success: true });
}));

router.get('/:id/profile', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        pp.patient_id,
        pp.consent_status,
        pp.primary_focus,
        p.full_name,
        p.date_of_birth,
        p.birthday,
        p.age,
        p.height_inches,
        p.weight_lbs,
        p.gender,
        p.email
      FROM patient_profiles pp
      JOIN user_pii p ON p.user_id = pp.user_id
      WHERE pp.patient_id = ?
    `, [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
