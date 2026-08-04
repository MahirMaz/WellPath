import express from 'express';
import crypto from 'crypto';
import { pool } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  generateHealthInsights,
  generateTargetedDashboardInsight,
  generateClinicianSummary,
  generateTrainerNote,
  isCompleteInsightText,
  estimateFoodNutrition,
  extractMemoryFacts,
} from '../services/aiService.js';

const router = express.Router();

// Create the insight cache table once per process (no migration framework here).
let cacheTableReady = null;
function ensureInsightCacheTable() {
  if (!cacheTableReady) {
    cacheTableReady = pool.query(`
      CREATE TABLE IF NOT EXISTS ai_insight_cache (
        patient_id INT NOT NULL,
        insight_type VARCHAR(20) NOT NULL,
        target_id VARCHAR(50) NOT NULL,
        data_hash CHAR(64) NOT NULL,
        insight_text TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (patient_id, insight_type, target_id)
      )
    `).catch((error) => {
      // Reset so a later request can retry table creation.
      cacheTableReady = null;
      throw error;
    });
  }
  return cacheTableReady;
}

// Hash of everything that affects the generated text. When any underlying value
// changes (including record_date rolling to a new day), the hash changes and the
// cached insight is regenerated. Otherwise we serve the cached copy for free.
// Bump INSIGHT_CACHE_VERSION whenever the prompt or model changes so old cached
// insights are invalidated and regenerated in the new style.
const INSIGHT_CACHE_VERSION = 'v7-cycle-adjust-guard';
function buildInsightDataHash(payload) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({ v: INSIGHT_CACHE_VERSION, ...payload }))
    .digest('hex');
}

async function getCachedInsight(patientId, insightType, targetId, dataHash) {
  try {
    await ensureInsightCacheTable();
    const [rows] = await pool.query(
      `SELECT insight_text FROM ai_insight_cache
       WHERE patient_id = ? AND insight_type = ? AND target_id = ? AND data_hash = ?`,
      [patientId, insightType, targetId, dataHash]
    );
    return rows.length ? rows[0].insight_text : null;
  } catch (error) {
    // Cache is an optimization; never let it break insight generation.
    console.error('AI insight cache read failed:', error);
    return null;
  }
}

async function storeCachedInsight(patientId, insightType, targetId, dataHash, insightText) {
  try {
    await ensureInsightCacheTable();
    await pool.query(
      `INSERT INTO ai_insight_cache (patient_id, insight_type, target_id, data_hash, insight_text)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE data_hash = VALUES(data_hash), insight_text = VALUES(insight_text)`,
      [patientId, insightType, targetId, dataHash, insightText]
    );
  } catch (error) {
    console.error('AI insight cache write failed:', error);
  }
}

// POST /api/ai/insights
router.post('/insights', authenticate, async (req, res) => {
  try {
    const { patientId, metricId, promptId, insightType, targetId, targetTitle, targetContext } = req.body;
    
    if (!patientId) {
      return res.status(400).json({ error: 'Patient ID required' });
    }

    // Get patient profile
    const [patientRows] = await pool.query(`
      SELECT 
        pp.patient_id,
        pp.primary_focus,
        p.full_name,
        p.date_of_birth
      FROM patient_profiles pp
      JOIN user_pii p ON p.user_id = pp.user_id
      WHERE pp.patient_id = ?
    `, [patientId]);

    if (patientRows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const patient = patientRows[0];

    // Get latest health metrics
    const [healthRows] = await pool.query(`
      SELECT 
        f.steps,
        f.sleep_hours,
        f.sleep_bedtime,
        f.sleep_wake_time,
        f.sleep_interruptions,
        f.resting_heart_rate,
        f.exercise_minutes,
        f.active_minutes,
        f.calories_burned,
        f.active_calories,
        f.sedentary_hours,
        f.longest_inactive_minutes,
        f.workout_count,
        f.workout_intensity,
        f.systolic_bp,
        f.diastolic_bp,
        f.bmi,
        f.diet_score,
        f.stress_level,
        f.record_date,
        pref.step_goal,
        pref.sleep_goal_hours,
        pref.exercise_goal_minutes,
        pref.active_minute_goal,
        pref.sedentary_limit_hours,
        pref.active_calorie_goal,
        pref.resting_hr_baseline_low,
        pref.resting_hr_baseline_high,
        pref.bp_systolic_target_max,
        pref.bp_diastolic_target_max
      FROM patient_daily_health_fact f
      LEFT JOIN patient_metric_preferences pref ON pref.patient_id = f.patient_id
      WHERE f.patient_id = ?
      ORDER BY f.record_date DESC
      LIMIT 1
    `, [patientId]);

    // Get 7-day trends
    const [trendRows] = await pool.query(`
      SELECT 
        steps,
        sleep_hours,
        resting_heart_rate,
        exercise_minutes,
        active_minutes,
        calories_burned,
        active_calories,
        sedentary_hours,
        systolic_bp,
        diastolic_bp,
        record_date
      FROM patient_daily_health_fact
      WHERE patient_id = ?
      ORDER BY record_date DESC
      LIMIT 7
    `, [patientId]);

    // Format data for AI
    const patientData = {
      name: patient.full_name,
      ageRange: patient.date_of_birth ? calculateAgeRange(patient.date_of_birth) : 'Adult',
      primaryFocus: patient.primary_focus || 'Overall wellness',
    };

    const metrics = healthRows.map(row => ({
      steps: row.steps,
      sleep: row.sleep_hours,
      hr: row.resting_heart_rate,
      exercise: row.exercise_minutes,
      activeMinutes: row.active_minutes,
      caloriesBurned: row.calories_burned,
      activeCalories: row.active_calories,
      sedentaryHours: row.sedentary_hours,
      systolicBp: row.systolic_bp,
      diastolicBp: row.diastolic_bp,
      bmi: row.bmi,
      diet: row.diet_score,
      stress: row.stress_level,
    }));

    const trends = trendRows.map(row => ({
      steps: row.steps,
      sleep: row.sleep_hours,
      hr: row.resting_heart_rate,
      exercise: row.exercise_minutes,
      activeMinutes: row.active_minutes,
      caloriesBurned: row.calories_burned,
      activeCalories: row.active_calories,
      sedentaryHours: row.sedentary_hours,
      systolicBp: row.systolic_bp,
      diastolicBp: row.diastolic_bp,
      date: row.record_date,
    })).reverse();

    if (insightType && targetId) {
      const latestMetrics = healthRows[0] || {};
      const dataHash = buildInsightDataHash({
        patientData,
        latestMetrics,
        trends,
        insightType,
        targetId,
        targetContext,
      });

      // Serve a cached insight when the underlying data is unchanged (0 tokens).
      const cached = await getCachedInsight(patientId, insightType, targetId, dataHash);
      if (cached) {
        return res.json({
          answer: cached,
          cached: true,
          disclaimer: 'Lifestyle guidance only. Not a medical diagnosis.',
        });
      }

      const answer = await generateTargetedDashboardInsight({
        patientData,
        latestMetrics,
        trends,
        insightType,
        targetId,
        targetTitle,
        targetContext,
      });

      // Only cache real insights, never the "having trouble" fallback text.
      if (isCompleteInsightText(answer)) {
        await storeCachedInsight(patientId, insightType, targetId, dataHash, answer);
      }

      return res.json({
        answer,
        cached: false,
        disclaimer: 'Lifestyle guidance only. Not a medical diagnosis.',
      });
    }

    // Generate AI insights
    const insights = await generateHealthInsights(patientData, metrics, trends);

    // Check if we should respond with specific metric insight
    let answer = insights;
    
    if (metricId) {
        answer = insights;
    }

    res.json({
      answer: answer,
      disclaimer: 'Lifestyle guidance only. Not a medical diagnosis.',
    });

  } catch (error) {
    console.error('AI Insights error:', error);
    res.status(500).json({ 
      error: 'Failed to generate insights',
      answer: 'I\'m having trouble generating insights right now. Please try again later.',
      disclaimer: 'Lifestyle guidance only. Not a medical diagnosis.',
    });
  }
});

// ===== Clinician visit-prep summary =====

// Average a numeric field across rows, ignoring null/NaN. Returns null if empty.
function avgField(rows, key) {
  const values = rows
    .map((row) => Number(row[key]))
    .filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// Deterministic trend: compare the older half of the window with the recent half
// and report direction + magnitude. `rows` are ordered oldest -> newest.
function computeTrend(rows, key, digits = 0) {
  const series = rows
    .map((row) => Number(row[key]))
    .filter((value) => Number.isFinite(value));
  if (series.length < 4) return null;
  const mid = Math.floor(series.length / 2);
  const older = series.slice(0, mid);
  const recent = series.slice(mid);
  const olderAvg = older.reduce((s, v) => s + v, 0) / older.length;
  const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
  const delta = recentAvg - olderAvg;
  const round = (n) => Number(n.toFixed(digits));
  // A change under ~3% of the older average is treated as flat, so we don't
  // narrate noise as a trend.
  const threshold = Math.abs(olderAvg) * 0.03;
  const direction = Math.abs(delta) < threshold ? 'flat' : delta > 0 ? 'up' : 'down';
  return {
    latest: round(series[series.length - 1]),
    recentAvg: round(recentAvg),
    priorAvg: round(olderAvg),
    delta: round(delta),
    direction,
    days: series.length,
  };
}

// Build the deterministic analysis the model will narrate. All numbers here are
// computed from the DB, never by the LLM.
function buildClinicianComputed(latest, trends) {
  const clamp1 = (n) => (Number.isFinite(Number(n)) ? Number(Number(n).toFixed(1)) : null);
  const bpSysMax = Number(latest.bp_systolic_target_max);
  const bpDiaMax = Number(latest.bp_diastolic_target_max);
  const hrLow = Number(latest.resting_hr_baseline_low);
  const hrHigh = Number(latest.resting_hr_baseline_high);
  const sys = Number(latest.systolic_bp);
  const dia = Number(latest.diastolic_bp);
  const hr = Number(latest.resting_heart_rate);

  const flags = [];
  if (Number.isFinite(sys) && Number.isFinite(dia) && Number.isFinite(bpSysMax) && Number.isFinite(bpDiaMax)) {
    if (sys > bpSysMax || dia > bpDiaMax) {
      flags.push(`Latest blood pressure ${sys}/${dia} is above target ${bpSysMax}/${bpDiaMax}.`);
    }
  }
  if (Number.isFinite(hr) && Number.isFinite(hrHigh) && hr > hrHigh) {
    flags.push(`Resting heart rate ${hr} bpm is above the usual ${hrLow}-${hrHigh} bpm range.`);
  }

  const goalPct = (value, goal) => {
    const v = Number(value);
    const g = Number(goal);
    if (!Number.isFinite(v) || !Number.isFinite(g) || g <= 0) return null;
    return Math.round((v / g) * 100);
  };

  return {
    windowDays: trends.length,
    latest: {
      steps: Number(latest.steps) || null,
      sleepHours: clamp1(latest.sleep_hours),
      restingHeartRate: Number(latest.resting_heart_rate) || null,
      exerciseMinutes: Number(latest.exercise_minutes) || null,
      activeMinutes: Number(latest.active_minutes) || null,
      sedentaryHours: clamp1(latest.sedentary_hours),
      bloodPressure:
        Number.isFinite(sys) && Number.isFinite(dia) ? `${sys}/${dia}` : null,
      bmi: clamp1(latest.bmi),
    },
    goalAttainment: {
      stepsPctOfGoal: goalPct(latest.steps, latest.step_goal),
      sleepPctOfGoal: goalPct(latest.sleep_hours, latest.sleep_goal_hours),
      exercisePctOfGoal: goalPct(latest.exercise_minutes, latest.exercise_goal_minutes),
    },
    trends: {
      steps: computeTrend(trends, 'steps'),
      sleepHours: computeTrend(trends, 'sleep_hours', 1),
      restingHeartRate: computeTrend(trends, 'resting_heart_rate'),
      exerciseMinutes: computeTrend(trends, 'exercise_minutes'),
      sedentaryHours: computeTrend(trends, 'sedentary_hours', 1),
      systolicBp: computeTrend(trends, 'systolic_bp'),
      diastolicBp: computeTrend(trends, 'diastolic_bp'),
    },
    averages: {
      steps: Math.round(avgField(trends, 'steps') ?? 0) || null,
      sleepHours: clamp1(avgField(trends, 'sleep_hours')),
      restingHeartRate: Math.round(avgField(trends, 'resting_heart_rate') ?? 0) || null,
    },
    clinicalFlags: flags,
  };
}

// POST /api/ai/clinician-summary  { patientId }
// Clinician-facing visit-prep briefing. Restricted to clinician/dba roles.
router.post('/clinician-summary', authenticate, authorize('clinician', 'dba'), async (req, res) => {
  try {
    const { patientId } = req.body;
    if (!patientId) {
      return res.status(400).json({ error: 'Patient ID required' });
    }

    const [patientRows] = await pool.query(`
      SELECT pp.patient_id, pp.primary_focus, p.full_name, p.date_of_birth, p.gender
      FROM patient_profiles pp
      JOIN user_pii p ON p.user_id = pp.user_id
      WHERE pp.patient_id = ?
    `, [patientId]);

    if (patientRows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    const patient = patientRows[0];

    const [healthRows] = await pool.query(`
      SELECT f.*,
        pref.step_goal, pref.sleep_goal_hours, pref.exercise_goal_minutes,
        pref.active_minute_goal, pref.sedentary_limit_hours,
        pref.resting_hr_baseline_low, pref.resting_hr_baseline_high,
        pref.bp_systolic_target_max, pref.bp_diastolic_target_max
      FROM patient_daily_health_fact f
      LEFT JOIN patient_metric_preferences pref ON pref.patient_id = f.patient_id
      WHERE f.patient_id = ?
      ORDER BY f.record_date DESC
      LIMIT 1
    `, [patientId]);

    if (healthRows.length === 0) {
      return res.status(404).json({ error: 'No health data for this patient yet.' });
    }
    const latest = healthRows[0];

    const [trendRows] = await pool.query(`
      SELECT steps, sleep_hours, resting_heart_rate, exercise_minutes, active_minutes,
             sedentary_hours, systolic_bp, diastolic_bp, record_date
      FROM patient_daily_health_fact
      WHERE patient_id = ?
      ORDER BY record_date DESC
      LIMIT 30
    `, [patientId]);
    const trends = trendRows.slice().reverse(); // oldest -> newest

    const [alertRows] = await pool.query(`
      SELECT alert_type, alert_level, alert_message, alert_date
      FROM alerts
      WHERE patient_id = ? AND resolved_status = 0
      ORDER BY alert_date DESC
      LIMIT 5
    `, [patientId]);

    const computed = buildClinicianComputed(latest, trends);
    const patientData = {
      name: patient.full_name,
      ageRange: patient.date_of_birth ? calculateAgeRange(patient.date_of_birth) : 'Adult',
      gender: patient.gender || null,
      primaryFocus: patient.primary_focus || 'Overall wellness',
    };

    const dataHash = buildInsightDataHash({ patientData, computed, alerts: alertRows });
    const cached = await getCachedInsight(patientId, 'clinician', 'summary', dataHash);
    if (cached) {
      try {
        return res.json({
          summary: JSON.parse(cached),
          cached: true,
          generatedFor: patient.full_name,
          disclaimer: 'AI-generated decision support. Not a diagnosis. Verify against the record.',
        });
      } catch {
        // Corrupt cache row — fall through and regenerate.
      }
    }

    const summary = await generateClinicianSummary({
      patientData,
      computed,
      alerts: alertRows,
    });

    await storeCachedInsight(patientId, 'clinician', 'summary', dataHash, JSON.stringify(summary));

    res.json({
      summary,
      cached: false,
      generatedFor: patient.full_name,
      disclaimer: 'AI-generated decision support. Not a diagnosis. Verify against the record.',
    });
  } catch (error) {
    console.error('Clinician summary error:', error);
    res.status(500).json({ error: 'Could not generate the visit summary right now. Please try again.' });
  }
});

// POST /api/ai/trainer-note-draft  { patientId }
// Drafts an encouragement note for a trainer to review, edit, and save. The
// activity highlights are computed here; the model only phrases them warmly.
router.post('/trainer-note-draft', authenticate, authorize('trainer'), async (req, res) => {
  try {
    const { patientId } = req.body;
    if (!patientId) {
      return res.status(400).json({ error: 'Patient ID required' });
    }

    // Trainer may only draft notes for their own assigned patients.
    const [access] = await pool.query(`
      SELECT pp.primary_focus, p.full_name
      FROM care_assignments ca
      JOIN patient_profiles pp ON pp.patient_id = ca.patient_id
      JOIN user_pii p ON p.user_id = pp.user_id
      WHERE ca.patient_id = ? AND ca.trainer_user_id = ? AND ca.end_date IS NULL
      LIMIT 1
    `, [patientId, req.user.userId]);

    if (access.length === 0) {
      return res.status(403).json({ error: 'No access to this patient' });
    }

    const [trendRows] = await pool.query(`
      SELECT steps, sleep_hours, exercise_minutes, active_minutes, sedentary_hours,
             workout_count, record_date,
             (SELECT step_goal FROM patient_metric_preferences WHERE patient_id = ?) AS step_goal,
             (SELECT exercise_goal_minutes FROM patient_metric_preferences WHERE patient_id = ?) AS exercise_goal_minutes
      FROM patient_daily_health_fact
      WHERE patient_id = ?
      ORDER BY record_date DESC
      LIMIT 14
    `, [patientId, patientId, patientId]);

    if (trendRows.length === 0) {
      return res.status(404).json({ error: 'No activity data for this patient yet.' });
    }

    const trends = trendRows.slice().reverse(); // oldest -> newest
    const latest = trendRows[0];
    const stepGoal = Number(latest.step_goal);
    const exGoal = Number(latest.exercise_goal_minutes);
    const goalPct = (value, goal) =>
      Number.isFinite(Number(value)) && Number.isFinite(goal) && goal > 0
        ? Math.round((Number(value) / goal) * 100)
        : null;

    const computed = {
      windowDays: trends.length,
      activeDays: trends.filter((d) => Number(d.exercise_minutes) >= 30).length,
      latest: {
        steps: Number(latest.steps) || null,
        exerciseMinutes: Number(latest.exercise_minutes) || null,
        activeMinutes: Number(latest.active_minutes) || null,
      },
      goalAttainment: {
        stepsPctOfGoal: goalPct(latest.steps, stepGoal),
        exercisePctOfGoal: goalPct(latest.exercise_minutes, exGoal),
      },
      trends: {
        steps: computeTrend(trends, 'steps'),
        exerciseMinutes: computeTrend(trends, 'exercise_minutes'),
        activeMinutes: computeTrend(trends, 'active_minutes'),
        sedentaryHours: computeTrend(trends, 'sedentary_hours', 1),
      },
    };

    const draft = await generateTrainerNote({
      patientData: { name: access[0].full_name, primaryFocus: access[0].primary_focus || 'Overall wellness' },
      computed,
    });

    res.json({ draft });
  } catch (error) {
    console.error('Trainer note draft error:', error);
    res.status(500).json({ error: 'Could not draft a note right now. Please try again.' });
  }
});

// POST /api/ai/nutrition-estimate  { food: "2 slices pepperoni pizza" }
router.post('/nutrition-estimate', authenticate, async (req, res) => {
  try {
    const { food } = req.body;
    if (!food || !String(food).trim()) {
      return res.status(400).json({ error: 'Food description required' });
    }
    const nutrition = await estimateFoodNutrition(String(food).trim().slice(0, 200));
    res.json({ ...nutrition, disclaimer: 'AI estimate — approximate, not a nutrition label.' });
  } catch (error) {
    console.error('Nutrition estimate error:', error);
    res.status(500).json({ error: 'Could not estimate this food. Try rephrasing, or enter values manually.' });
  }
});

// Extract durable personal facts from something the user typed, so future
// insights can be tailored to them. Returns { facts: [] } (never throws to client).
router.post('/remember', authenticate, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !String(message).trim()) return res.json({ facts: [] });
    const facts = await extractMemoryFacts(String(message).slice(0, 400));
    res.json({ facts });
  } catch (error) {
    console.error('Memory extraction error:', error);
    res.json({ facts: [] });
  }
});

function calculateAgeRange(dob) {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  if (age < 18) return 'Under 18';
  if (age < 30) return '18-29';
  if (age < 45) return '30-44';
  if (age < 60) return '45-59';
  return '60+';
}

export default router;
