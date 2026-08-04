# WellPath Health Healthcare UI

## Project Overview

This is a complete working React + Vite healthcare lifestyle analytics project for CST3116 Project I. The app is named WellPath Health. It is an Integrated Health & Lifestyle Data Platform that combines simulated clinical, wearable, and lifestyle data into one patient profile. It includes a lightweight Node backend, a JSON data file, saved records, a working intake form, KPI logic, generated review signals, and role-based workflows for patients, trainers, and clinicians. It focuses on trend monitoring, habit summaries, patient goals, history, and lifestyle recommendations. It does not diagnose medical conditions or replace clinical advice.

The app includes three role-based experiences:

- Patient mobile view for daily steps, sleep, heart rate, exercise progress, history, recommendations, and goals.
- Trainer or gym partner support view for activity consistency, workout progress, workout focus, recovery, weekly exercise, and encouragement notes.
- Clinician web/tablet trend review dashboard for patient overview cards, trends, review signals, recommendations, long-term progress, and a patient list.
- Role-based login keeps patient, trainer, and clinician experiences separate instead of exposing every role tab to every user.

The data model is represented in the app with simulated records for `users`, `patient_profile`, `clinical_metrics`, `wearable_metrics`, `lifestyle_metrics`, `patient_kpi`, `clinician_kpi`, `trainer_kpi`, and `alerts`.

## How To Run The Project

1. Install dependencies:

   ```bash
   npm install
   ```

2. Build the frontend:

   ```bash
   npm run build
   ```

3. Start the complete app with the Node backend:

   ```bash
   npm start
   ```

4. Open:

   ```text
   http://127.0.0.1:5173/
   ```

For frontend-only development, you can also run:

   ```bash
   npm run dev
   ```

The complete app saves data in `data/app-data.json`. The Vite-only development server falls back to browser storage.

## How To Use It Like A Phone App

This project is also a Progressive Web App, so it can be installed on a phone home screen.

### Same Wi-Fi Phone Test

1. On the computer running the project, start the complete app:

   ```bash
   npm run build
   npm start
   ```

2. Find the computer's local IP address:

   ```bash
   ipconfig
   ```

3. On your phone, open:

   ```text
   http://YOUR-COMPUTER-IP:5173/
   ```

4. Install it:

   - Android Chrome: tap the browser menu, then **Install app** or **Add to Home screen**.
   - iPhone Safari: tap Share, then **Add to Home Screen**.

After installation, the app opens from the phone home screen with its own icon and app-like layout.

## Features

- Sign-in flow with saved session state.
- Role picker on login for Patient, Trainer, or Clinician demo access.
- Separate signed-in navigation for each role, with a Switch Role action instead of cross-role tabs.
- Light and dark mode toggle saved across sessions.
- Installable phone app experience using PWA manifest and service worker.
- Node backend API at `/api/state`.
- JSON data storage in `data/app-data.json`.
- Patient intake form that validates required fields and creates a new simulated patient record.
- Intake fields map to personal info, clinical metrics, wearable data, lifestyle inputs, consent, KPI tables, and generated review signals.
- Rule-based KPI engine for health score, trend flag score, activity consistency, recovery score, and engagement level.
- Patient dashboard with steps, sleep, heart rate, exercise progress, weekly trend chart, and compact next-step cards.
- Apple Health-inspired summary page with read-only synced metrics, readiness score, ring visual, weekly averages, and connected data sources.
- Trends page with charts that update when new health data is saved.
- Plan page that combines lifestyle recommendations and editable goals in one simpler patient section.
- History page with lifestyle signals and review actions instead of a separate Alerts tab.
- Trainer support view with consistency, workout progress, workout focus, recovery, exercise trend, and saved encouragement notes.
- Clinician trend review dashboard with patient metrics, review signals, recommendation summary, long-term chart, searchable patient list, patient profile, recent signals, goals, and exportable report.
- Editable patient goals with add, complete, and delete actions inside the Plan section.
- Patient health metrics are read-only to represent synced device data instead of manual editing.
- Server-backed persistence for health logs, goals, recommendations, alert reviews, trainer notes, active role, and active patient screen.
- Responsive layout for mobile, tablet, and desktop.
- Clear disclaimer that the app gives lifestyle trend support, not medical diagnosis.

## Next Goals

- Replace the JSON data file with a production database.
- Connect the intake form to Yeven's full ERD/schema implementation.
- Add secure user accounts and permissions.
- Connect wearable or simulated device data.
- Add stronger trend analysis and chart filtering.
- Improve rule-based recommendations with clearer explainability.
- Add provider notes and care-team collaboration.
- Add formal testing for more browsers and devices.

## What To Mention During The Professor Demo

- The project is a complete working local product built with React, Vite, and a Node backend.
- It saves user actions in `data/app-data.json`, so records persist outside the browser session.
- The patient intake form is the data entry point: it maps personal, clinical, wearable, lifestyle, and consent fields into simulated database tables.
- Submitting the intake form calculates KPIs and generates lifestyle review signals immediately.
- Each role is separated at login, so patients do not access the clinician dashboard and trainers do not access the patient app.
- Light/dark mode and simplified mobile navigation make the patient app easier to use.
- The main daily experience is designed for the patient on a phone.
- The trainer view is a smaller support view for motivation and consistency.
- The clinician trend review dashboard is optimized for web/tablet analytics.
- The charts show trends in lifestyle habits such as steps, sleep, heart rate, and exercise.
- Goals, recommendations, history review, trainer notes, workout focus, patient search, report export, and patient profile selection are interactive.
- Patient metrics are presented as synced read-only data to feel closer to a real health app.
- The app intentionally avoids medical diagnosis and only provides trend monitoring and lifestyle recommendations.
