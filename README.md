# WellPath Health

A role-based lifestyle analytics platform that helps people understand patterns in their
activity, sleep, recovery, nutrition, and exercise — and gives the trainers, clinicians, and
administrators around them the right view of that data, and nothing more.

WellPath provides lifestyle support and trend monitoring only. It does **not** diagnose
conditions, prescribe treatment, or replace professional medical care, and its language and
data boundaries are designed around that principle.

<p align="center">
  <img src="poster_assets/patient-dashboard.png" alt="Patient dashboard" width="30%" />
  <img src="poster_assets/ai-card-insight.png" alt="AI metric explanation" width="30%" />
  <img src="poster_assets/clinician-dashboard.png" alt="Clinician trend dashboard" width="30%" />
</p>

## Why it's built this way

The core idea is **one dataset, four audiences, strict separation**. A patient's raw readings,
private notes, mood entries, and AI conversations are visible to the patient — and deliberately
invisible to an administrator, who sees only accounts, consent metadata, and audit events. Those
boundaries are enforced on the server, not just hidden in the UI.

| Workspace | Device target | Sees | Never sees |
|-----------|---------------|------|------------|
| **Patient** | Phone-first daily app | Own metrics, breakdowns, mood/food logs, goals, optional AI explanations | Other patients' data |
| **Trainer** | Phone-style support app | Assigned patients, workout plans, recovery context, session logs, encouragement notes | Clinical notes, diagnoses |
| **Clinician** | Web / tablet review dashboard | Patient profiles, historical trends, non-diagnostic signals, secure notes, care plans, reports | — |
| **Admin** | Desktop operations console | Accounts, roles, consent metadata, connection status, audit events | Individual readings, private notes, mood entries, AI conversations |

## Highlights

- **Authenticated, role-separated experiences** with JWT auth and server-side permission checks on every route.
- **Patient personalization** — card visibility, order, spacing, start screen, section, animation, theme, and AI preferences, all persisted per user.
- **Optional AI explanations** with a real opt-out that is enforced by the API, not just toggled in the client.
- **Historical trend comparisons** written to avoid forecasting or diagnostic language, and nutrition association checks that require matched data and explicitly avoid claiming causation.
- **Accessibility built in** — responsive light/dark interfaces for phone, tablet, and desktop, plus reduced-motion support.
- **Health platform bridge points** for Apple HealthKit and Android Health Connect in installed builds.

## Tech stack

**Frontend:** React 18, Vite, Lucide icons · **Backend:** Node.js, Express, JWT, bcrypt ·
**Database:** MySQL · **Desktop wrapper:** synchronized web build in `wellpath-health-web/`.

## Repository layout

```
wellpath-health-integrated/wellpath-integrated/   The integrated app (frontend + Express/MySQL backend)
wellpath-condition-models/                        Companion ML work: multi-condition risk modeling & explainability
wellpath-data-research/                            Population-health data research, analysis notebooks, and charts
poster_assets/                                     Screenshots
```

## Running the app

Requirements: Node.js, npm, and MySQL.

```bash
cd wellpath-health-integrated/wellpath-integrated

# 1. Import wellpath_health_dump.sql into a MySQL database named `wellpath_health`
# 2. Configure the API
cd backend
cp .env.example .env          # add your MySQL credentials and a JWT secret
npm install
npm run seed                  # seeds sample accounts and health data
npm run dev                   # API on http://localhost:3000

# 3. In a second terminal, start the frontend
cd ..
npm install
npm run dev                   # Vite dev server, usually http://127.0.0.1:5173
```

### Demo accounts

All seeded accounts use the password `password123`.

| Role | Email |
|------|-------|
| Patient | `alex@example.com` |
| Trainer | `jordan@example.com` |
| Clinician | `rivera@example.com` |
| Admin | `admin@wellpath.example` |

## Roadmap

- Native HealthKit / Health Connect permission and sync testing on physical devices.
- Replace simulated readings with approved device or institutional test data.
- Stronger explainable trend analysis that keeps non-diagnostic wording.
- User-controlled reminders and notification delivery.
- Organization-level admin policies, pagination, and production monitoring.
- Expanded automated API authorization, browser, and accessibility coverage in CI.
