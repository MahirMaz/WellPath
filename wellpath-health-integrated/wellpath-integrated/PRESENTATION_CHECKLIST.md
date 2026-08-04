# WellPath — Presentation Day Checklist

## The night before (at home, on WiFi)
- [ ] Pull latest / make sure all your code changes are saved.
- [ ] Fresh demo data: open a terminal in `backend/` and run `npm run seed`.
- [ ] **Pre-warm the AI cache**: run the app and click through *every* demo
      patient's insights while online. These get cached in the DB, so they'll
      still display even if the venue WiFi drops. (Live nutrition estimates
      still need internet.)
- [ ] Make sure MySQL is set to start automatically (Services → MySQL → Automatic),
      or know how to start it manually.
- [ ] Charge the laptop. Pack the charger.

## Pack
- [ ] Laptop + charger
- [ ] **HDMI / USB-C-to-HDMI adapter** for the projector
- [ ] Phone (for hotspot backup — venue WiFi is unreliable)

## At the venue
- [ ] Plug in power + projector, mirror/extend display.
- [ ] Connect to internet (venue WiFi *or* phone hotspot) so the live AI works.
- [ ] Double-click **`start-wellpath.bat`**. Wait for the browser to open at
      http://localhost:5173.
- [ ] Do one silent dry-run login (e.g. Alex) before the audience is watching.

## Demo logins (password: `password123`)
Alex (sleep) · Maria (weight) · James (BP) · Sophie (sedentary) · Daniel (stress)
Plus Jordan (trainer) and Dr. Rivera (clinician).

## If something breaks
- **Backend window shows `EADDRINUSE`** → a server is already running on that
  port. Run `stop-wellpath.bat`, then `start-wellpath.bat` again.
- **Page loads but no data / errors** → MySQL isn't running. Start the MySQL
  service, then restart the backend window.
- **AI insights spin forever** → no internet. Fall back to a patient you
  pre-warmed last night (cached insights still render).

## Making changes at the venue
Servers auto-reload: save a file and the frontend hot-updates, the backend
restarts itself. No need to re-run the launcher. Only re-run `npm run seed`
if you changed the database schema or seed data.
