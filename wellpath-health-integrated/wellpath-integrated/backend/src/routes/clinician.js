import express from 'express';
import { pool } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// All routes require clinician role
router.use(authenticate);
router.use(authorize('clinician', 'dba'));

// GET /api/clinician/patients
router.get('/patients', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        pp.patient_id,
        p.full_name,
        pp.primary_focus,
        pp.consent_status,
        ca.clinician_user_id,
        p.birthday,
        p.age,
        p.height_inches,
        p.weight_lbs,
        u_clinician.full_name as clinician_name,
        u_trainer.full_name as trainer_name
      FROM patient_profiles pp
      JOIN user_pii p ON p.user_id = pp.user_id
      LEFT JOIN care_assignments ca ON ca.patient_id = pp.patient_id AND ca.end_date IS NULL
      LEFT JOIN user_pii u_clinician ON u_clinician.user_id = ca.clinician_user_id
      LEFT JOIN user_pii u_trainer ON u_trainer.user_id = ca.trainer_user_id
      ORDER BY pp.patient_id
    `);

    // Add KPI data
    const patients = await Promise.all(rows.map(async (patient) => {
      const [kpis] = await pool.query(`
        SELECT 
          k.kpi_name,
          kv.numeric_value,
          kv.text_value
        FROM patient_kpi_values kv
        JOIN kpi_types k ON k.kpi_type_id = kv.kpi_type_id
        WHERE kv.patient_id = ?
        AND kv.calculation_date = (
          SELECT MAX(calculation_date) 
          FROM patient_kpi_values 
          WHERE patient_id = ?
        )
      `, [patient.patient_id, patient.patient_id]);

      const healthScore = kpis.find(k => k.kpi_name === 'Health Score')?.numeric_value || 0;
      const riskScore = kpis.find(k => k.kpi_name === 'Risk Score')?.numeric_value || 0;

      return {
        ...patient,
        healthScore,
        riskScore,
        riskLevel: riskScore >= 70 ? 'High' : riskScore >= 40 ? 'Medium' : 'Low'
      };
    }));

    res.json(patients);
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/clinician/patients/:id
router.get('/patients/:id', async (req, res) => {
  try {
    const patientId = req.params.id;

    // Get patient profile
    const [profile] = await pool.query(`
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
        p.email,
        ca.clinician_user_id,
        ca.trainer_user_id
      FROM patient_profiles pp
      JOIN user_pii p ON p.user_id = pp.user_id
      LEFT JOIN care_assignments ca ON ca.patient_id = pp.patient_id AND ca.end_date IS NULL
      WHERE pp.patient_id = ?
    `, [patientId]);

    if (profile.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Get latest health metrics
    const [health] = await pool.query(`
      SELECT *
      FROM patient_daily_health_fact
      WHERE patient_id = ?
      ORDER BY record_date DESC
      LIMIT 1
    `, [patientId]);

    // Get KPIs
    const [kpis] = await pool.query(`
      SELECT 
        k.kpi_name,
        kv.numeric_value,
        kv.text_value,
        kv.calculation_date
      FROM patient_kpi_values kv
      JOIN kpi_types k ON k.kpi_type_id = kv.kpi_type_id
      WHERE kv.patient_id = ?
      AND kv.calculation_date = (
        SELECT MAX(calculation_date) 
        FROM patient_kpi_values 
        WHERE patient_id = ?
      )
    `, [patientId, patientId]);

    // Get alerts
    const [alerts] = await pool.query(`
      SELECT
        alert_id,
        alert_type,
        alert_level,
        alert_message,
        alert_date,
        resolved_status
      FROM alerts
      WHERE patient_id = ?
      AND resolved_status = 0
      ORDER BY alert_date DESC
    `, [patientId]);

    // Last 14 days (oldest -> newest) for trend sparklines in the Overview tab.
    const [trendRows] = await pool.query(`
      SELECT record_date, steps, sleep_hours, resting_heart_rate,
             exercise_minutes, systolic_bp, diastolic_bp
      FROM patient_daily_health_fact
      WHERE patient_id = ?
      ORDER BY record_date DESC
      LIMIT 14
    `, [patientId]);

    res.json({
      profile: profile[0],
      health: health[0] || {},
      kpis,
      alerts,
      trends: trendRows.reverse()
    });
  } catch (error) {
    console.error('Get patient details error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/clinician/alerts/:alertId/resolve — mark an alert handled.
router.patch('/alerts/:alertId/resolve', async (req, res) => {
  try {
    const [result] = await pool.query(
      'UPDATE alerts SET resolved_status = 1 WHERE alert_id = ?',
      [req.params.alertId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.json({ success: true, alertId: Number(req.params.alertId) });
  } catch (error) {
    console.error('Resolve alert error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/clinician/signals
router.get('/signals', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        a.*,
        p.full_name,
        pp.primary_focus
      FROM alerts a
      JOIN patient_profiles pp ON pp.patient_id = a.patient_id
      JOIN user_pii p ON p.user_id = pp.user_id
      WHERE a.resolved_status = 0
      ORDER BY a.alert_date DESC
      LIMIT 20
    `);

    res.json(rows);
  } catch (error) {
    console.error('Get signals error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
