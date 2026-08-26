import bcrypt from 'bcrypt';
import { pool } from '../config/db.js';
import { roles } from './data/roles.js';
import { users, userPii } from './data/users.js';
import { 
  patientProfiles, 
  careAssignments, 
  patientMetricPreferences,
  kpiTypes,
  goalsData,
  recommendationsData 
} from './data/patients.js';
import { generateDailyHealthData, generateKpiValues, generateMoodData, generatePeriodData } from './data/healthData.js';
import { ensureKpiPlaceholderSchema } from './kpiPlaceholderSchema.js';

const seedDatabase = async () => {
  const connection = await pool.getConnection();
  
  try {
    console.log('🌱 Starting database seed...');
    console.log('🗑️  Clearing existing data...');
    
    await ensureKpiPlaceholderSchema(connection);

    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    
    await connection.query('TRUNCATE TABLE trainer_notes');
    await connection.query('TRUNCATE TABLE goals');
    await connection.query('TRUNCATE TABLE recommendations');
    await connection.query('TRUNCATE TABLE alerts');
    await connection.query('TRUNCATE TABLE patient_kpi_values');
    await connection.query('TRUNCATE TABLE kpi_types');
    await connection.query('TRUNCATE TABLE patient_daily_health_fact');
    await connection.query('TRUNCATE TABLE patient_metric_preferences');
    await connection.query('TRUNCATE TABLE patient_intake_assessment');
    await connection.query('TRUNCATE TABLE care_assignments');
    await connection.query('TRUNCATE TABLE patient_profiles');
    await connection.query('TRUNCATE TABLE user_pii');
    await connection.query('TRUNCATE TABLE users');
    await connection.query('TRUNCATE TABLE roles');
    await connection.query('TRUNCATE TABLE access_audit_log');
    
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    console.log('📝 Inserting roles...');
    for (const role of roles) {
      await connection.query(
        'INSERT INTO roles (role_id, role_name) VALUES (?, ?)',
        [role.role_id, role.role_name]
      );
    }
    
    console.log('👤 Inserting users...');
    for (const user of users) {
      await connection.query(
        'INSERT INTO users (user_id, role_id, account_status, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
        [user.user_id, user.role_id, user.account_status, hashedPassword, new Date()]
      );
    }
    
    console.log('🔒 Inserting user PII...');
    for (const pii of userPii) {
      await connection.query(
        `INSERT INTO user_pii
         (user_id, full_name, date_of_birth, birthday, age, height_inches, weight_lbs, gender, email, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pii.user_id,
          pii.full_name,
          pii.date_of_birth,
          pii.birthday,
          pii.age,
          pii.height_inches,
          pii.weight_lbs,
          pii.gender,
          pii.email,
          new Date(),
        ]
      );
    }
    
    console.log('🏥 Inserting patient profiles...');
    for (const profile of patientProfiles) {
      await connection.query(
        'INSERT INTO patient_profiles (patient_id, user_id, consent_status, primary_focus) VALUES (?, ?, ?, ?)',
        [profile.patient_id, profile.user_id, profile.consent_status, profile.primary_focus]
      );
    }
    
    console.log('👨‍⚕️ Inserting care assignments...');
    for (const assignment of careAssignments) {
      await connection.query(
        'INSERT INTO care_assignments (assignment_id, patient_id, clinician_user_id, trainer_user_id, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)',
        [assignment.assignment_id, assignment.patient_id, assignment.clinician_user_id, assignment.trainer_user_id, assignment.start_date, assignment.end_date]
      );
    }

    console.log('Inserting patient KPI targets and baselines...');
    for (const preferences of patientMetricPreferences) {
      await connection.query(`
        INSERT INTO patient_metric_preferences
        (patient_id, step_goal, sleep_goal_hours, exercise_goal_minutes, active_minute_goal,
         sedentary_limit_hours, active_calorie_goal, resting_hr_baseline_low,
         resting_hr_baseline_high, bp_systolic_target_max, bp_diastolic_target_max)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    
    console.log('📊 Inserting daily health data...');
    const dailyData = generateDailyHealthData();
    for (const data of dailyData) {
      await connection.query(`
        INSERT INTO patient_daily_health_fact 
        (daily_health_id, patient_id, record_date, steps, sleep_hours, resting_heart_rate, 
         sleep_bedtime, sleep_wake_time, sleep_interruptions, sleep_consistency, exercise_minutes, systolic_bp,
         diastolic_bp, bmi, calories_burned, active_calories, active_minutes, workout_count,
         workout_intensity, diet_score, stress_level, sedentary_hours, longest_inactive_minutes,
         data_source, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        data.daily_health_id, data.patient_id, data.record_date, 
        data.steps, data.sleep_hours, data.resting_heart_rate,
        data.sleep_bedtime, data.sleep_wake_time, data.sleep_interruptions,
        data.sleep_consistency,
        data.exercise_minutes, data.systolic_bp, data.diastolic_bp,
        data.bmi, data.calories_burned, data.active_calories, data.active_minutes,
        data.workout_count, data.workout_intensity, data.diet_score, data.stress_level,
        data.sedentary_hours, data.longest_inactive_minutes, data.data_source, data.created_at
      ]);
    }
    
    const periodData = generatePeriodData();

    console.log('🙂 Inserting mood log...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS patient_mood_log (
        patient_id INT NOT NULL,
        record_date DATE NOT NULL,
        mood TINYINT NOT NULL,
        note VARCHAR(200) NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (patient_id, record_date)
      )
    `);
    await connection.query('TRUNCATE TABLE patient_mood_log');
    for (const mood of generateMoodData(dailyData, periodData)) {
      await connection.query(
        'INSERT INTO patient_mood_log (patient_id, record_date, mood, note) VALUES (?, ?, ?, ?)',
        [mood.patient_id, mood.record_date, mood.mood, mood.note || null]
      );
    }

    console.log('🩸 Inserting cycle history...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS patient_period_log (
        patient_id INT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NULL,
        notes VARCHAR(200) NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (patient_id, start_date)
      )
    `);
    await connection.query('TRUNCATE TABLE patient_period_log');
    for (const p of periodData) {
      await connection.query(
        'INSERT INTO patient_period_log (patient_id, start_date, end_date) VALUES (?, ?, ?)',
        [p.patient_id, p.start_date, p.end_date]
      );
    }

    console.log('📈 Inserting KPI types...');
    for (const kpi of kpiTypes) {
      await connection.query(
        'INSERT INTO kpi_types (kpi_type_id, kpi_name, role_view, unit) VALUES (?, ?, ?, ?)',
        [kpi.kpi_type_id, kpi.kpi_name, kpi.role_view, kpi.unit]
      );
    }
    
    console.log('📊 Inserting KPI values...');
    const kpiValues = generateKpiValues();
    for (const kpi of kpiValues) {
      await connection.query(
        'INSERT INTO patient_kpi_values (kpi_value_id, patient_id, kpi_type_id, calculation_date, numeric_value, text_value) VALUES (?, ?, ?, ?, ?, ?)',
        [kpi.kpi_value_id, kpi.patient_id, kpi.kpi_type_id, kpi.calculation_date, kpi.numeric_value, kpi.text_value]
      );
    }
    
    console.log('🎯 Inserting goals...');
    let goalId = 1;
    for (let patientId = 1; patientId <= 6; patientId++) {
      for (const goal of goalsData) {
        await connection.query(
          'INSERT INTO goals (goal_id, patient_id, goal_text, goal_status, target_date) VALUES (?, ?, ?, ?, ?)',
          [goalId++, patientId, goal.text, goal.status, new Date(Date.now() + 7 * 86400000)]
        );
      }
    }
    
    console.log('💡 Inserting recommendations...');
    let recId = 1;
    for (let patientId = 1; patientId <= 6; patientId++) {
      const statuses = ['not_started', 'in_progress', 'completed', 'not_started'];
      for (let i = 0; i < recommendationsData.length; i++) {
        await connection.query(
          'INSERT INTO recommendations (recommendation_id, patient_id, created_by_user_id, recommendation_text, status) VALUES (?, ?, ?, ?, ?)',
          [recId++, patientId, 7, recommendationsData[i], statuses[i % statuses.length]]
        );
      }
    }
    
    console.log('📝 Inserting trainer notes...');
    let noteId = 1;
    const trainerNotes = [
      'Your training is solid — the real win this week is sleep. Protect a consistent bedtime and the recovery numbers will follow.', // Alex - sleep
      'Small, steady steps: a 10-minute walk after each meal and swapping one fast-food meal will move the needle most right now.',     // Maria - weight
      'Keep the activity gentle and regular, and log your blood pressure — let\'s review the readings together and loop in your clinician.', // James - BP
      'Let\'s beat the sitting: a 3-minute movement break every hour and a short daily walk. Consistency beats intensity here.',        // Sophie - sedentary
      'Recovery is the priority — a wind-down routine, steadier sleep, and one stress-reset habit a day will help everything else.',    // Daniel - stress
      'Several markers are trending the wrong way — let\'s get you in for bloodwork and a BP check, and start with gentle daily walks.',  // Robert - at-risk
    ];
    
    for (let patientId = 1; patientId <= 6; patientId++) {
      await connection.query(
        'INSERT INTO trainer_notes (note_id, patient_id, trainer_user_id, note_text) VALUES (?, ?, ?, ?)',
        [noteId++, patientId, 6, trainerNotes[patientId - 1]]
      );
    }
    
    console.log('✅ Database seed complete!');
    console.log('\n📋 Sample users created:');
    console.log('   🔑 All passwords: "password123"');
    console.log('   👤 Patient: alex@example.com');
    console.log('   👤 Patient: maria@example.com');
    console.log('   👤 Patient: james@example.com');
    console.log('   👤 Patient: sophie@example.com');
    console.log('   👤 Patient: daniel@example.com');
    console.log('   👤 Patient: robert@example.com  (at-risk profile)');
    console.log('   🏋️  Trainer: jordan@example.com');
    console.log('   🏥 Clinician: rivera@example.com');
    
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
};

seedDatabase().catch(console.error);
