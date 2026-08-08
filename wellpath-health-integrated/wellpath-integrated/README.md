# WellPath Health

## Project Overview

WellPath is a role-based lifestyle analytics application built with React, Vite, Express, and MySQL. It helps people understand patterns in activity, sleep, recovery, nutrition, and exercise. It provides lifestyle support and trend monitoring only; it does not diagnose conditions, prescribe treatment, or replace professional medical care.

The product has four separate workspaces:

- Patient: a phone-first daily health app with customizable read-only metric cards, breakdowns, mood and food logs, goals, lifestyle signals, optional AI explanations, light/dark mode, and reduced-motion support.
- Trainer: a phone-style support app for assigned patients, workout planning, recovery context, completed-session logging, patient feedback, and encouragement notes.
- Clinician: a web/tablet trend-review dashboard with patient profiles, historical comparisons, non-diagnostic signals, secure notes, follow-up plans, reports, and audit activity.
- Admin: a desktop operations dashboard for accounts, role boundaries, consent metadata, connection status, and audit events. It intentionally excludes individual readings, private notes, mood entries, and AI conversations.

## Run The Integrated App

Requirements: Node.js, npm, and MySQL.

1. Import `wellpath_health_dump.sql` into a MySQL database named `wellpath_health`.
2. In `backend`, install dependencies, copy `.env.example` to `.env`, and enter your local MySQL credentials and JWT secret.
3. Seed the sample accounts, then apply `backend/migrations/002_patient_customization_admin.sql`.
4. Start the API.

   ```bash
   cd backend
   npm install
   npm run seed
   npm run dev
   ```

5. In another terminal, start the frontend.

   ```bash
   npm install
   npm run dev
   ```

6. Open the Local URL printed by Vite, normally `http://127.0.0.1:5173/`.

The API uses port `3000` by default. Set `WELLPATH_API_PORT` before starting Vite if the API runs on another port.

## Demo Accounts

All seeded accounts use `password123`.

- Patient: `alex@example.com`
- Trainer: `jordan@example.com`
- Clinician: `rivera@example.com`
- Admin: `admin@wellpath.example`

## Features

- Authenticated, separated role experiences with server-side permission checks.
- Patient card visibility, order, spacing, start-screen, section, animation, theme, and AI preferences.
- Historical trend comparisons without forecasting or diagnostic language.
- Optional AI explanations with a real opt-out enforced by the API.
- Dated nutrition history and food-to-lifestyle association checks that require matched data and explicitly avoid claiming causation.
- Trainer plans, session records, feedback history, recovery-aware coaching prompts, and saved encouragement notes.
- Clinician signals, assignment/status actions, secure notes, care plans, report export, and audit history.
- Privacy-limited admin account, access, connection, and audit dashboards.
- Responsive light and dark interfaces for phone, tablet, and desktop.
- Apple Health and Health Connect bridge points for installed iOS/Android builds.

## Desktop Web Wrapper

`../../wellpath-health-web` contains the synchronized Vinext desktop wrapper. It can connect to the same API or use its browser fallback data for a standalone UI presentation.

```bash
cd ../../wellpath-health-web
npm install
npm run dev
```

## Next Goals

- Complete native HealthKit and Health Connect permission and sync testing on physical phones.
- Replace simulated readings with approved device or institutional test data.
- Add stronger explainable trend analysis while keeping non-diagnostic wording.
- Add notification delivery and user-controlled reminder schedules.
- Add organization-level admin policies, pagination, and production monitoring.
- Expand automated API authorization, browser, and accessibility coverage in CI.

## Professor Demo Notes

- Show that each account opens only its own role workspace.
- Customize the patient Today screen, refresh it, and show that the preference persists.
- Turn AI Insights off and show that prompts disappear and the backend rejects AI requests.
- Open Nutrition and explain that matched-day associations are not claims of causation.
- Use the trainer phone view to review recovery, adjust a plan, log a session, and save encouragement.
- Use the clinician tablet view to change trend ranges, review a signal, save a secure note, and export a summary.
- Use the admin dashboard to explain operational visibility and the deliberate privacy boundary.
- Emphasize that WellPath supports lifestyle understanding and conversations, not medical diagnosis.

## Verification

```bash
npm run build
```

The desktop wrapper additionally supports:

```bash
npm test
npm audit --omit=dev
```
