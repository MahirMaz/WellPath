import express from 'express';
import { pool } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);
router.use(authorize('trainer'));

router.get('/patients', async (req, res) => {
  try {
    const trainerId = req.user.userId;

    const [rows] = await pool.query(`
      SELECT 
        pp.patient_id,
        p.full_name,
        pp.primary_focus,
        ca.trainer_user_id
      FROM care_assignments ca
      JOIN patient_profiles pp ON pp.patient_id = ca.patient_id
      JOIN user_pii p ON p.user_id = pp.user_id
      WHERE ca.trainer_user_id = ?
      AND ca.end_date IS NULL
    `, [trainerId]);

    const patients = await Promise.all(rows.map(async (patient) => {
      const [metrics] = await pool.query(`
        SELECT 
          steps,
          sleep_hours,
          resting_heart_rate,
          exercise_minutes,
          record_date
        FROM patient_daily_health_fact
        WHERE patient_id = ?
        ORDER BY record_date DESC
        LIMIT 1
      `, [patient.patient_id]);

      const [kpis] = await pool.query(`
        SELECT
          k.kpi_name,
          kv.numeric_value
        FROM patient_kpi_values kv
        JOIN kpi_types k ON k.kpi_type_id = kv.kpi_type_id
        WHERE kv.patient_id = ?
        AND k.kpi_name IN ('Activity Consistency', 'Recovery Score')
        AND kv.calculation_date = (
          SELECT MAX(calculation_date)
          FROM patient_kpi_values
          WHERE patient_id = ?
        )
      `, [patient.patient_id, patient.patient_id]);

      const [trend] = await pool.query(`
        SELECT record_date, steps, sleep_hours, exercise_minutes, active_minutes, resting_heart_rate
        FROM patient_daily_health_fact
        WHERE patient_id = ?
        ORDER BY record_date DESC
        LIMIT 7
      `, [patient.patient_id]);

      return {
        ...patient,
        metrics: metrics[0] || {},
        trend: trend.reverse(),
        kpis: kpis.reduce((acc, k) => ({ ...acc, [k.kpi_name]: k.numeric_value }), {})
      };
    }));

    res.json(patients);
  } catch (error) {
    console.error('Get trainer patients error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/notes/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const trainerId = req.user.userId;

    const [access] = await pool.query(`
      SELECT 1 FROM care_assignments 
      WHERE patient_id = ? 
      AND trainer_user_id = ? 
      AND end_date IS NULL
    `, [patientId, trainerId]);

    if (access.length === 0) {
      return res.status(403).json({ error: 'No access to this patient' });
    }

    const [rows] = await pool.query(`
      SELECT note_text
      FROM trainer_notes
      WHERE patient_id = ?
      ORDER BY note_id DESC
      LIMIT 1
    `, [patientId]);

    res.json({ note: rows[0]?.note_text || '' });
  } catch (error) {
    console.error('Get trainer note error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.patch('/notes/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { note } = req.body;
    const trainerId = req.user.userId;

    if (!note) {
      return res.status(400).json({ error: 'Note content required' });
    }

    const [access] = await pool.query(`
      SELECT 1 FROM care_assignments 
      WHERE patient_id = ? 
      AND trainer_user_id = ? 
      AND end_date IS NULL
    `, [patientId, trainerId]);

    if (access.length === 0) {
      return res.status(403).json({ error: 'No access to this patient' });
    }

    const [existing] = await pool.query(
      'SELECT note_id FROM trainer_notes WHERE patient_id = ? ORDER BY note_id DESC LIMIT 1',
      [patientId]
    );

    if (existing.length > 0) {
      await pool.query(
        'UPDATE trainer_notes SET note_text = ? WHERE note_id = ?',
        [note, existing[0].note_id]
      );
    } else {
      await pool.query(
        'INSERT INTO trainer_notes (patient_id, trainer_user_id, note_text) VALUES (?, ?, ?)',
        [patientId, trainerId, note]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update trainer note error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;