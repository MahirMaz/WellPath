# WellPath

Live demo: [well-path-seven.vercel.app](https://well-path-seven.vercel.app). On the login screen you
can click any of the demo accounts to get straight in without typing anything. It's on a free hosting
tier, so if nobody has opened it in a while the first load takes about 30 seconds while the server
wakes up.

WellPath is a health tracking app. The idea I wanted to try was showing the same health data in
completely different ways depending on who is looking at it. A patient, their trainer, their clinician
and an admin all use the app, but each one only sees the part that makes sense for their role. It is
meant for tracking lifestyle trends, not for anything medical, so it does not diagnose or give
treatment advice.

<p align="center">
  <img src="poster_assets/patient-dashboard.png" alt="Patient dashboard" width="30%" />
  <img src="poster_assets/ai-card-insight.png" alt="AI metric explanation" width="30%" />
  <img src="poster_assets/clinician-dashboard.png" alt="Clinician dashboard" width="30%" />
</p>

Each of the four account types gets its own version of the app. Patients see a phone style view of
their daily numbers (activity, sleep, recovery, nutrition) along with mood and food logs, goals, and
optional AI explanations of what a number means. Trainers get a support view for the patients assigned
to them, with workout plans, recovery info and notes. Clinicians get a wider dashboard for reviewing a
patient's trends over time, with secure notes and reports. Admins only see accounts, roles and audit
logs; they cannot open anyone's actual readings, notes or AI conversations.

The part I cared about most was making those boundaries real. All the permission checks run on the
server, so an admin cannot pull a patient's private data even by hitting the API directly.

The stack is React and Vite on the front end, an Express API on the back, and MySQL for storage. Login
uses JWT with passwords hashed by bcrypt. The AI explanations go through Groq, but the model never does
any of the math. Every number, trend and flag is worked out from the database first, and the model
just turns that into a sentence, so it cannot invent a statistic.

## Running it locally

You need Node, npm and MySQL.

```bash
cd wellpath-health-integrated/wellpath-integrated

# import wellpath_health_dump.sql into a MySQL database called wellpath_health first

cd backend
cp .env.example .env      # fill in your MySQL login and a JWT secret
npm install
npm run seed              # loads sample accounts and health data
npm run dev               # API runs on port 3000

# then in another terminal:
cd ..
npm install
npm run dev               # Vite dev server, usually on 127.0.0.1:5173
```

## Demo accounts

Every account uses the password `password123`, though on the live site you can just click one to sign
in. The patients are Alex, Maria, James, Sophie, Daniel and Robert, and each is a different health
profile (Alex is not sleeping enough, Maria is working on her weight, James has rising blood pressure,
and so on). Jordan is a trainer, Rivera is a clinician, and admin@wellpath.example is the admin. A good
way to see the point of the app is to sign in as a patient, then as Rivera to see that same person from
the clinician side, then as the admin to see how little an operations account is allowed to see.

## What's in the repo

The app itself is in `wellpath-health-integrated/wellpath-integrated`. Two other folders hold the
research side of the project: `wellpath-condition-models` is the machine learning work on health risk
prediction, and `wellpath-data-research` is the data analysis notebooks and charts. Screenshots are in
`poster_assets`. There is also a full write-up in [docs/WellPath-Report.pdf](docs/WellPath-Report.pdf)
if you want the background, design decisions and research findings; it was a team project for a college
course.

## Still to do

- Real HealthKit and Health Connect syncing on a phone instead of the simulated readings
- Reminders and notifications
- Better admin controls and pagination for larger datasets
- Automated tests
