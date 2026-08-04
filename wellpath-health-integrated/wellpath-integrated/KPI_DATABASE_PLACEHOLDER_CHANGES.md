# KPI Database Placeholder Changes

This file records the database-backed placeholder fix for the patient dashboard KPI cards.

## What Changed

- Added `patient_metric_preferences` to store per-patient KPI targets and personal ranges:
  - step goal
  - sleep-duration goal
  - exercise-minute goal
  - active-minute goal
  - sedentary-hour limit
  - active-calorie goal
  - resting heart-rate baseline range
  - blood-pressure target range for prototype status labels

- Added these fields to `patient_daily_health_fact`:
  - `active_calories`
  - `sleep_bedtime`
  - `sleep_wake_time`
  - `sleep_interruptions`
  - `longest_inactive_minutes`
  - `workout_intensity`

- Updated the patient dashboard API to return the new fields from MySQL.

- Updated the React patient dashboard mapping so KPI cards use backend values instead of hardcoded goals.

- Updated the seed process so running `npm run seed` preserves these KPI fields.

## Why The Placeholder Values Make Sense

- Step, sleep, exercise, active-minute, sedentary, and active-calorie targets are stored per patient because those values should not all use the same default.
- Active calories are estimated from active minutes, exercise minutes, and workout count, so they rise on more active days.
- Sleep interruptions increase on lower-sleep or higher-stress days.
- Longest inactive period increases when sedentary time is higher and active minutes are lower.
- Workout intensity is based on exercise minutes and active minutes:
  - `Vigorous` for higher exercise and active-minute days
  - `Moderate` for normal workout days
  - `Light` for lower workout days
  - `None` when no exercise is logged
- Resting heart rate and blood pressure use range/status logic instead of fake goal-completion percentages.
- Sedentary time uses limit logic because lower sedentary time is better.
- Calories use active calories for goal progress; total calories are kept as context.

## Files Updated

- `backend/src/seed/kpiPlaceholderSchema.js`
- `backend/scripts/applyKpiPlaceholderMigration.js`
- `backend/src/seed/data/patients.js`
- `backend/src/seed/data/healthData.js`
- `backend/src/seed/seedDatabase.js`
- `backend/src/routes/patient.js`
- `src/components/PatientView.jsx`
- `src/utils/patientKpis.js`

## How To Reapply

From the project root:

```bash
cd C:\Users\Mahir\Desktop\WellPath\wellpath-health-integrated\wellpath-integrated
node backend/scripts/applyKpiPlaceholderMigration.js
```

If you fully reseed later:

```bash
cd C:\Users\Mahir\Desktop\WellPath\wellpath-health-integrated\wellpath-integrated\backend
npm run seed
```
