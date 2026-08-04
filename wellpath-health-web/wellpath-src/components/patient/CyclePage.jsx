import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, Droplets, CalendarDays, ShieldCheck, Plus, Trash2 } from 'lucide-react';
import { api } from '../../api';

const DAY_MS = 86400000;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const mean = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);
const dateKey = (value) => String(value).slice(0, 10);
const toDate = (value) => new Date(`${dateKey(value)}T00:00:00`);
const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);
const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / DAY_MS);
const fmtDate = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const todayKey = () => new Date().toISOString().slice(0, 10);

// ===== Prediction from cycle history + live signals =====
// This is deliberately more than "last start + 28 days". It (1) weights recent
// cycles more than older ones (EWMA), so it tracks how the cycle is trending
// now, and (2) nudges the date earlier/later based on whether the body is
// already showing premenstrual physiological signs. The AI then explains it.

// How strongly recent physiology matches the premenstrual pattern (0 = no signs,
// 1 = all tracked signals point that way). null when there's nothing to read.
function premenstrualStrength(signals) {
  if (!signals || !signals.length) return null;
  const matching = signals.filter((s) => s.matches).length;
  return matching / signals.length;
}

const ewmaOf = (arr, alpha) => {
  let e = arr[0];
  for (let i = 1; i < arr.length; i += 1) e = alpha * arr[i] + (1 - alpha) * e;
  return e;
};

// Learn how strongly to weight recent cycles FROM this person's own history:
// sweep candidate recency weights and keep the one that best predicted their
// past cycles using only earlier data (walk-forward). Returns that weight plus
// the model's typical out-of-sample error, which becomes the confidence window.
// Falls back to a neutral default when there isn't enough history to validate.
function fitCycleModel(lengths) {
  if (lengths.length < 4) return { alpha: 0.5, error: null, fitted: false };
  let best = { alpha: 0.5, error: Infinity };
  for (let a = 0.1; a <= 0.9001; a += 0.05) {
    let sum = 0; let count = 0;
    for (let i = 2; i < lengths.length; i += 1) {
      sum += Math.abs(ewmaOf(lengths.slice(0, i), a) - lengths[i]);
      count += 1;
    }
    const error = count ? sum / count : Infinity;
    if (error < best.error - 1e-9) best = { alpha: Math.round(a * 100) / 100, error };
  }
  return { alpha: best.alpha, error: Math.round(best.error * 10) / 10, fitted: true };
}

function computeCycleStats(periods, signals) {
  const starts = periods.map((p) => dateKey(p.startDate)).sort();
  if (starts.length < 2) return { enough: false, cycles: [], starts };

  const cycles = [];
  for (let i = 1; i < starts.length; i += 1) {
    const length = daysBetween(starts[i - 1], starts[i]);
    // Discard implausible gaps so one mistyped date can't wreck the estimate.
    if (length >= 15 && length <= 60) cycles.push({ length, start: starts[i] });
  }
  if (!cycles.length) return { enough: false, cycles: [], starts };

  const recent = cycles.slice(-6).map((c) => c.length);
  const simpleAvg = mean(recent);

  // Recency weight LEARNED from this person's history (not a fixed constant).
  const model = fitCycleModel(cycles.map((c) => c.length));
  const expectedLength = ewmaOf(recent, model.alpha);

  const sd = Math.sqrt(mean(recent.map((v) => (v - simpleAvg) ** 2)) || 0);
  // Confidence window = the model's own out-of-sample error when we could fit
  // it, else raw cycle variability.
  const errorDays = model.fitted ? model.error : sd;
  const window = Math.max(1, Math.round(errorDays));
  const lastStart = starts[starts.length - 1];

  // Calendar baseline, then a bounded physiological nudge.
  const baseline = addDays(toDate(lastStart), Math.round(expectedLength));
  const baselineDaysUntil = daysBetween(todayKey(), dateKey(baseline.toISOString()));
  const strength = premenstrualStrength(signals);

  // The nudge is capped by how reliable the fitted model is: clockwork history
  // (small error) -> signals barely move the date; erratic history -> a little
  // more say. Direction is a physiological prior; magnitude is data-driven.
  const signalCap = Math.max(1, Math.min(3, Math.round(errorDays)));
  let adjustmentDays = 0;
  if (strength !== null && baselineDaysUntil <= 7 && baselineDaysUntil >= -4) {
    adjustmentDays = Math.max(-signalCap, Math.min(signalCap, -Math.round((strength - 0.5) * 2 * signalCap)));
  }

  const predicted = addDays(baseline, adjustmentDays);
  const daysUntil = daysBetween(todayKey(), dateKey(predicted.toISOString()));
  const dayInCycle = daysBetween(lastStart, todayKey()) + 1;
  const regularity =
    sd <= 2 ? 'very regular' : sd <= 4 ? 'fairly regular' : sd <= 7 ? 'somewhat variable' : 'irregular';

  const ovulationDay = Math.round(expectedLength) - 14;
  let phase = 'Luteal phase';
  if (dayInCycle <= 5) phase = 'Period';
  else if (dayInCycle < ovulationDay - 1) phase = 'Follicular phase';
  else if (dayInCycle <= ovulationDay + 1) phase = 'Around ovulation (estimated)';

  return {
    enough: true,
    cycles,
    starts,
    simpleAvg,
    expectedLength,
    sd,
    lastStart,
    baseline,
    baselineDaysUntil,
    adjustmentDays,
    strength,
    predicted,
    window,
    daysUntil,
    dayInCycle,
    regularity,
    phase,
    fittedAlpha: model.alpha,
    modelError: model.fitted ? model.error : null,
    modelFitted: model.fitted,
  };
}

// ===== KPI corroboration =====
// Compares the last 3 days against the 30-day baseline. Resting HR rising and
// sleep dropping are the shifts that commonly precede a period, so we flag
// whether the recent pattern matches that direction.
const SIGNAL_FACTORS = [
  { key: 'hr', label: 'Resting heart rate', unit: 'bpm', premenstrual: 'up', digits: 0 },
  { key: 'sleep', label: 'Sleep', unit: 'hrs', premenstrual: 'down', digits: 1 },
  { key: 'sedentaryHours', label: 'Sitting time', unit: 'hrs', premenstrual: 'up', digits: 1 },
];

function computeSignals(healthLog) {
  if (healthLog.length < 7) return [];
  return SIGNAL_FACTORS.map((factor) => {
    const values = healthLog.map((d) => num(d[factor.key])).filter((v) => v !== null);
    if (values.length < 7) return null;
    const baseline = mean(values);
    const recent = mean(values.slice(-3));
    const delta = recent - baseline;
    const rising = delta > 0;
    const matches = (factor.premenstrual === 'up' && rising) || (factor.premenstrual === 'down' && !rising);
    return {
      label: factor.label,
      unit: factor.unit,
      recent: recent.toFixed(factor.digits),
      delta: `${delta > 0 ? '+' : ''}${delta.toFixed(factor.digits)}`,
      matches: Math.abs(delta) >= (factor.digits === 0 ? 1 : 0.2) && matches,
    };
  }).filter(Boolean);
}

export function CyclePage({ patientId, healthLog = [], aiEnabled, onGenerateAiInsight }) {
  const [periods, setPeriods] = useState([]);
  const [startInput, setStartInput] = useState(todayKey());
  const [saveNote, setSaveNote] = useState('');
  const [aiText, setAiText] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.getPeriods(patientId)
      .then((rows) => { if (!cancelled) setPeriods(rows); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [patientId]);

  const signals = useMemo(() => computeSignals(healthLog), [healthLog]);
  const stats = useMemo(() => computeCycleStats(periods, signals), [periods, signals]);

  const refresh = async () => {
    const rows = await api.getPeriods(patientId).catch(() => null);
    if (rows) setPeriods(rows);
  };

  const logStart = async () => {
    setSaveNote('');
    try {
      await api.logPeriod(patientId, startInput);
      await refresh();
      setSaveNote('Logged.');
    } catch (error) {
      setSaveNote('Could not save — check the date and try again.');
    }
  };

  const removeStart = async (date) => {
    try {
      await api.deletePeriod(patientId, dateKey(date));
      await refresh();
    } catch (error) {
      setSaveNote('Could not remove that entry.');
    }
  };

  const askAi = async () => {
    if (!aiEnabled || !onGenerateAiInsight || aiLoading) return;
    setAiLoading(true);
    setAiText(null);
    try {
      const text = await onGenerateAiInsight({
        insightType: 'cycle',
        targetId: 'cycle',
        targetTitle: 'Cycle outlook',
        targetContext: {
          method: 'recency weight fitted to this person\'s own cycle history (walk-forward), then nudged by current premenstrual physiological signals; nudge size scales with the fitted model error',
          fittedRecencyWeight: stats.enough ? stats.fittedAlpha : null,
          modelAccuracyDays: stats.enough ? stats.modelError : null,
          predictedStart: stats.enough ? dateKey(stats.predicted.toISOString()) : null,
          calendarEstimate: stats.enough ? dateKey(stats.baseline.toISOString()) : null,
          signalAdjustmentDays: stats.enough ? stats.adjustmentDays : null,
          daysUntilPredicted: stats.enough ? stats.daysUntil : null,
          expectedCycleLength: stats.enough ? Math.round(stats.expectedLength) : null,
          typicalCycleLength: stats.enough ? Math.round(stats.simpleAvg) : null,
          variabilityDays: stats.enough ? Math.round(stats.sd * 10) / 10 : null,
          regularity: stats.enough ? stats.regularity : 'not enough history',
          currentPhase: stats.enough ? stats.phase : null,
          dayInCycle: stats.enough ? stats.dayInCycle : null,
          cyclesLogged: stats.cycles.length,
          physiologicalSignals: signals.map((s) => ({
            factor: s.label,
            recent: `${s.recent} ${s.unit}`,
            changeVsBaseline: `${s.delta} ${s.unit}`,
            matchesPremenstrualPattern: s.matches,
          })),
        },
      });
      setAiText(text);
    } catch (error) {
      setAiText("I'm having trouble analyzing your cycle right now. Please try again later.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="mobile-flow">
      <div className="mobile-section-title">
        <div>
          <span>Cycle tracking</span>
          <h2>Cycle</h2>
        </div>
        <Droplets size={19} />
      </div>

      {stats.enough ? (
        <section className="cycle-predict-card">
          <span className="cycle-predict-label">Next period expected</span>
          <strong className="cycle-predict-date">{fmtDate(stats.predicted)}</strong>
          <em className="cycle-predict-sub">
            {stats.daysUntil > 0
              ? `in about ${stats.daysUntil} day${stats.daysUntil === 1 ? '' : 's'}`
              : stats.daysUntil === 0
                ? 'expected today'
                : `${Math.abs(stats.daysUntil)} day${Math.abs(stats.daysUntil) === 1 ? '' : 's'} late`}
            {` · give or take ${stats.window} day${stats.window === 1 ? '' : 's'}`}
          </em>
          {stats.adjustmentDays !== 0 && (
            <span className="cycle-adjust-note">
              <Sparkles size={12} /> Shifted {Math.abs(stats.adjustmentDays)} day{Math.abs(stats.adjustmentDays) === 1 ? '' : 's'}{' '}
              {stats.adjustmentDays < 0 ? 'earlier' : 'later'} than the {fmtDate(stats.baseline)} calendar estimate, based on your recent signals.
            </span>
          )}
          <div className="cycle-stat-row">
            <div><span>Cycle length</span><strong>~{Math.round(stats.expectedLength)} days</strong></div>
            <div><span>Regularity</span><strong>{stats.regularity}</strong></div>
            <div><span>Today</span><strong>Day {stats.dayInCycle}</strong></div>
            <div><span>Phase</span><strong>{stats.phase}</strong></div>
          </div>
          {stats.modelFitted && (
            <span className="cycle-model-note">
              Recency weighting tuned to your history · typically accurate to ±{stats.modelError} day{stats.modelError === 1 ? '' : 's'}.
            </span>
          )}
        </section>
      ) : (
        <section className="cycle-predict-card empty">
          <span className="cycle-predict-label">Next period</span>
          <strong className="cycle-predict-date">Not enough history</strong>
          <em className="cycle-predict-sub">Log at least two period start dates and a prediction will appear here.</em>
        </section>
      )}

      <section className="cycle-log-card">
        <strong>Log a period start</strong>
        <div className="cycle-log-row">
          <input
            type="date"
            value={startInput}
            max={todayKey()}
            onChange={(e) => setStartInput(e.target.value)}
          />
          <button type="button" className="cycle-log-btn" onClick={logStart}>
            <Plus size={15} /> Add
          </button>
        </div>
        {saveNote && <small className="cycle-note">{saveNote}</small>}
      </section>

      {stats.cycles.length > 0 && (
        <section className="cycle-history-card">
          <div className="cycle-history-head">
            <strong>Recent cycles</strong>
            <em>{stats.cycles.length} logged</em>
          </div>
          <div className="cycle-history-list">
            {stats.cycles.slice(-6).reverse().map((c) => (
              <div className="cycle-history-item" key={c.start}>
                <CalendarDays size={14} />
                <span>{fmtDate(toDate(c.start))}</span>
                <strong>{c.length} days</strong>
                <button type="button" aria-label={`Remove ${c.start}`} onClick={() => removeStart(c.start)}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mobile-section-title">
        <div>
          <span>What your body is showing</span>
          <h2>Signals</h2>
        </div>
      </div>

      <section className="cycle-signals">
        {signals.length ? (
          signals.map((s) => (
            <div className={s.matches ? 'cycle-signal matching' : 'cycle-signal'} key={s.label}>
              <div>
                <span>{s.label}</span>
                <strong>{s.recent} {s.unit}</strong>
              </div>
              <em>{s.delta} vs your 30-day average</em>
            </div>
          ))
        ) : (
          <div className="connection-item"><p>Not enough recent health data to compare signals yet.</p></div>
        )}
      </section>

      <section className="score-ai-insight mood-ai-card">
        <span className="score-ai-icon"><Sparkles size={22} /></span>
        <div>
          <strong>AI cycle analysis</strong>
          {aiText ? (
            <p>{aiText}</p>
          ) : aiLoading ? (
            <p className="ai-loading-text">Reading your cycle history and recent signals...</p>
          ) : (
            <p>{aiEnabled ? 'Ask the AI to interpret your prediction and what your recent metrics suggest.' : 'AI is off in Settings.'}</p>
          )}
          {aiEnabled && !aiLoading && (
            <button type="button" className="mood-ai-btn" onClick={askAi}>
              {aiText ? 'Analyze again' : 'Analyze my cycle'}
            </button>
          )}
        </div>
      </section>

      <div className="quiet-disclaimer">
        <ShieldCheck size={15} /> Estimates from your logged history — not medical advice, and not for preventing or planning pregnancy.
      </div>
    </div>
  );
}
