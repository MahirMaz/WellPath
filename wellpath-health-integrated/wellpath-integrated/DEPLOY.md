# Deploying WellPath

WellPath has three parts, so a live deploy means hosting three things and pointing
them at each other:

1. **Database** — MySQL (managed host)
2. **Backend** — the Express API (`backend/`)
3. **Frontend** — the React/Vite app (this folder), which is also an installable PWA

Recommended free-tier stack: **Aiven** (or Railway) for MySQL, **Render** for the API,
**Vercel** for the frontend. Any equivalent host works — only the environment variables matter.

> This repo is a monorepo. The app lives at
> `wellpath-health-integrated/wellpath-integrated`. When a host asks for a **Root Directory**,
> use that path (and `.../backend` for the API).

---

## 1. Database (MySQL)

1. Create a managed MySQL database. Note the **host, port, user, password, database name**.
   Managed MySQL almost always requires SSL.
2. Load the schema and data. From a machine with the MySQL client and this repo:

   ```bash
   # from repo root
   mysql -h <host> -P <port> -u <user> -p <dbname> < wellpath_health_dump.sql
   mysql -h <host> -P <port> -u <user> -p <dbname> \
     < wellpath-health-integrated/wellpath-integrated/backend/migrations/002_patient_customization_admin.sql
   ```

3. Seed the sample accounts and health data by running the seed script against the remote DB:

   ```bash
   cd wellpath-health-integrated/wellpath-integrated/backend
   # put the remote DB creds in .env, with DB_SSL=true
   npm install
   npm run seed
   ```

---

## 2. Backend API (Render)

Create a new **Web Service** from the GitHub repo.

- **Root Directory:** `wellpath-health-integrated/wellpath-integrated/backend`
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Health Check Path:** `/api/health`

Environment variables:

| Key | Value |
|-----|-------|
| `DB_HOST` | your MySQL host |
| `DB_PORT` | your MySQL port |
| `DB_USER` | your MySQL user |
| `DB_PASSWORD` | your MySQL password |
| `DB_NAME` | your database name |
| `DB_SSL` | `true` |
| `JWT_SECRET` | a long random string |
| `GROQ_API_KEY` | your Groq key (free at console.groq.com) |
| `CORS_ORIGINS` | your frontend URL (fill in after step 3) |

After it deploys you get a URL like `https://wellpath-api.onrender.com`.
Check `https://<that-url>/api/health` returns `{"status":"ok"}`.

> Note: Render's free tier sleeps after inactivity, so the first request after idle
> takes ~30-50s to wake. Fine for a demo.

---

## 3. Frontend (Vercel)

Import the repo as a new project.

- **Root Directory:** `wellpath-health-integrated/wellpath-integrated`
- **Framework Preset:** Vite
- **Build Command:** `npm run build` (default)
- **Output Directory:** `dist` (default)

Environment variable:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://<your-backend-url>/api` |

Deploy. You get a URL like `https://wellpath.vercel.app`.

---

## 4. Connect them

1. Set the backend's `CORS_ORIGINS` to the Vercel URL (e.g. `https://wellpath.vercel.app`)
   and redeploy the backend.
2. Open the frontend URL and log in with a demo account
   (`alex@example.com` / `password123`).
3. On phone or desktop Chrome, use the browser's **Install** option to add it as a
   standalone app.

Done — that URL is your live, shareable demo.
