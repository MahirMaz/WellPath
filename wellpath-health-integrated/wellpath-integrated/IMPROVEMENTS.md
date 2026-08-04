# WellPath — prioritized improvement punch-list

From an end-to-end UX + data review. Tags: **[UX]** / **[Data]** · effort **S** (mins–1h) / **M** (a few hours) / **L** (a day+).
Ordered so the top items give the most improvement for the least effort.

> **✅ Done so far:** #1 (clinician dead tabs removed → 3 working tabs), #2 (inline save feedback),
> #3 (Nutrition→Risk cross-link), #6 (Risk Signal & Nutrition auto-fill from the patient's real data),
> #7 (app now runs the **pooled** models + a new **Kidney** signal). Remaining: #4, #5, #8–#12.

---

## Tier 1 — Quick wins (do first)

1. **Remove or disable the dead clinician tabs** — [UX] S
   `ClinicianView.jsx` shows Overview / Patients / Trends / Signals / Plans / Reports, but only the default
   view renders — the other tabs set state and do nothing. Either give them minimal real content or hide them.
   *Dead buttons read worse than fewer buttons.*

2. **Replace `alert()` popups with inline feedback** — [UX] S
   `TrainerView.jsx` uses `alert('Note saved!')`. Swap for a small inline "Saved ✓" message.

3. **Cross-link Nutrition ↔ Risk Signal** — [UX] S
   The Nutrition tab says "feeds your Risk Signals" — add a button that jumps there.

4. **Handle expired sessions** — [UX] S–M
   The 24h token expires silently and calls fail quietly. Catch 401 → show "Session expired, please log in again."

5. **De-crowd the bottom nav for female patients** — [UX] S
   Today/Breakdown/Mood/Nutrition/Cycle/More = 6 items. Consider moving Cycle (or Mood) into "More".

---

## Tier 2 — Medium

6. **Auto-fill Risk Signal & Nutrition from the patient's real data** — [UX+Data] M ⭐
   Right now users re-type age/height/weight the app already knows. Populate the shared profile
   (`profileContext.jsx`) from the logged-in patient's dashboard data. *Biggest single UX win.*

7. **Put the best models in the app** — [Data] M ⭐
   The app runs a simpler single-cycle model set. Regenerate `multiModel.json` from the stronger
   **pooled** models, add the solid **kidney** signal, and keep LDL/triglycerides flagged low-confidence.

8. **Add basic trends/charts to trainer & clinician views** — [UX] M
   These are the "review" roles but show only static lists. Even a sparkline of steps/sleep/BP over time
   would make them feel real.

---

## Tier 3 — Bigger lifts (real product moves)

9. **Serve the real research pipeline via the backend** — [Data/architecture] L ⭐
   Expose the calibrated, audited `condition-models` pipeline behind an API endpoint so the app runs the
   *actual* rigorous models — one source of truth instead of two parallel model tracks. *Fixes the biggest
   structural disconnect between the polished app and the serious analysis.*

10. **Persist the survey** — [Data] M–L
    Add a `survey_responses` table + a save endpoint so answers are actually stored. This is the project's
    stated premise (collect data on 100+ people) and it currently isn't wired.

11. **Close the full loop** — [UX+Data] L
    Patient data → real models → a per-patient risk signal shown to *both* the patient and the clinician
    (so the clinician's "Risk" labels come from the trained models, not seed data).

12. **External validation / longitudinal pivot** — [Data/research] L
    The models are cross-sectional (association). Following the Add Health cohort over time is the only way
    to raise the accuracy ceiling and make genuine "predicts future risk" claims. Biggest scientific upgrade.

---

## If you only do three
**#1 (kill dead tabs)** + **#6 (auto-fill from patient data)** + **#7 (best models in the app)** —
together they make the app look finished *and* make it genuinely powered by your real analysis, for a
fraction of the effort of the Tier-3 items.
