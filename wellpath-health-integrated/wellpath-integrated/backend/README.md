Backend database layer added for WellPath Health.

Required environment variables:
DB_HOST
DB_USER
DB_PASSWORD
DB_NAME

Frontend should call:
GET /api/patient/{patient_id}/dashboard

The API reads from patient_daily_health_fact instead of hardcoded dashboard values.
