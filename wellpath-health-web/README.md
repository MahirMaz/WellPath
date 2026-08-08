# WellPath Health Web

A separate, desktop-first web showcase for the existing WellPath Health app.
The original app project is not modified.

## What is included

- Patient, trainer, clinician, and privacy-limited admin role-based experiences
- Patient card visibility, order, spacing, section, start-screen, motion, and AI preferences
- Dated nutrition history with careful food-to-lifestyle pattern comparisons
- Desktop patient navigation with responsive mobile behavior
- Authenticated bridge to the existing WellPath backend
- Live Groq-powered health insights and food nutrition estimates
- Browser-based showcase data fallback when the backend is unavailable
- Interactive goals, mood, cycle, nutrition, risk, trainer notes, and clinician views
- Light and dark themes

## Local development

The existing WellPath API can run at `http://localhost:3000/api`. The web
project automatically connects to it through a same-origin server route.

```bash
npm install
npm run dev
```

To use another backend, set:

```text
WELLPATH_API_URL=https://your-api.example.com/api
```

For hosted AI fallback, configure `GROQ_API_KEY` as a server-side secret. It is
never included in browser JavaScript.

## Demo accounts

All showcase accounts use `password123`.

- Patient: `alex@example.com`
- Trainer: `jordan@example.com`
- Clinician: `rivera@example.com`
- Admin: `admin@wellpath.example`

## Production

```bash
npm run build
```

WellPath provides lifestyle trend support only and does not diagnose medical
conditions or replace professional medical advice.
