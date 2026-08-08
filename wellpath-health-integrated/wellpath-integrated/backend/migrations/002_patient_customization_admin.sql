-- WellPath patient personalization, nutrition history, and admin support.
-- Apply after the original database schema. The application also creates the
-- patient support tables lazily so local development remains straightforward.

CREATE TABLE IF NOT EXISTS patient_app_preferences (
  patient_id INT NOT NULL PRIMARY KEY,
  ai_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ui_preferences JSON NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_patient_app_preferences_patient
    FOREIGN KEY (patient_id) REFERENCES patient_profiles(patient_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS patient_health_connections (
  patient_id INT NOT NULL,
  provider VARCHAR(40) NOT NULL,
  connection_status VARCHAR(30) NOT NULL DEFAULT 'not_connected',
  permissions JSON NULL,
  last_sync DATETIME NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (patient_id, provider),
  CONSTRAINT fk_patient_health_connections_patient
    FOREIGN KEY (patient_id) REFERENCES patient_profiles(patient_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS patient_food_log (
  food_log_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  record_date DATE NOT NULL,
  food_name VARCHAR(180) NOT NULL,
  calories DECIMAL(8,2) NOT NULL DEFAULT 0,
  protein_g DECIMAL(8,2) NOT NULL DEFAULT 0,
  carbs_g DECIMAL(8,2) NOT NULL DEFAULT 0,
  sugar_g DECIMAL(8,2) NOT NULL DEFAULT 0,
  fibre_g DECIMAL(8,2) NOT NULL DEFAULT 0,
  fat_g DECIMAL(8,2) NOT NULL DEFAULT 0,
  saturated_fat_g DECIMAL(8,2) NOT NULL DEFAULT 0,
  sodium_mg DECIMAL(8,2) NOT NULL DEFAULT 0,
  source VARCHAR(30) NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_patient_food_date (patient_id, record_date),
  CONSTRAINT fk_patient_food_log_patient
    FOREIGN KEY (patient_id) REFERENCES patient_profiles(patient_id) ON DELETE CASCADE
);

INSERT INTO patient_app_preferences (patient_id, ai_enabled)
SELECT patient_id, TRUE FROM patient_profiles
ON DUPLICATE KEY UPDATE patient_id = VALUES(patient_id);
