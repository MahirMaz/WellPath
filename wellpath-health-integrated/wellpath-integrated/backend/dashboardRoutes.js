import express from 'express';
import { pool } from './db.js';

const router = express.Router();

router.get('/patient/:id/dashboard', async (req,res)=>{
  try {
    const [rows] = await pool.query(`
      SELECT
        steps,
        sleep_hours,
        resting_heart_rate,
        exercise_minutes,
        calories_burned,
        active_minutes,
        bmi,
        systolic_bp,
        diastolic_bp
      FROM patient_daily_health_fact
      WHERE patient_id = ?
      ORDER BY record_date DESC
      LIMIT 1
    `,[req.params.id]);

    res.json(rows[0] || {});
  } catch(e){
    res.status(500).json({error:e.message});
  }
});

export default router;
