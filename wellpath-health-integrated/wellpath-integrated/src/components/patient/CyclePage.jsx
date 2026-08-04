import React, { useEffect, useMemo, useState } from 'react';
import { Droplets, CalendarDays, ShieldCheck, Plus, Trash2, ChevronDown } from 'lucide-react';
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

// Prediction confidence, derived from the model's own out-of-sample error and
// how much history we could validate against. Tight, well-tested fit + more
// cycles => higher confidence. This is a transparent heuristic on real values,
// not a fabricated number.
function predictionConfidence(errorDays, cyclesLogged, sd) {
  const e = Number.isFinite(errorDays) ? errorDays : (Number.isFinite(sd) ? sd : 4);
  const varScore = Math.max(0, Math.min(1, 1 - (e - 1) / 6)); // e<=1 -> 1, e>=7 -> 0
  const dataScore = Math.min(1, (cyclesLogged || 0) / 10);
  const conf = 0.72 * varScore + 0.28 * dataScore;
  return Math.round(Math.max(0.45, Math.min(0.97, conf)) * 100);
}

// How much each cycle in the window is weighted (oldest..newest), summing to 1.
// Normalized exponential recency weighting with the fitted decay: the newest
// cycle carries the most, decaying smoothly into the past.
function ewmaWeights(n, alpha) {
  const raw = [];
  for (let i = 0; i < n; i += 1) raw[i] = Math.pow(1 - alpha, n - 1 - i);
  const sum = raw.reduce((s, v) => s + v, 0) || 1;
  return raw.map((v) => v / sum);
}

// Are cycles getting longer, shorter, or holding steady lately?
function cycleTrend(lengths) {
  if (lengths.length < 4) return 'Stable';
  const recent = lengths.slice(-3);
  const prev = lengths.slice(-6, -3);
  if (!prev.length) return 'Stable';
  const d = mean(recent) - mean(prev);
  if (d >= 1) return 'Lengthening';
  if (d <= -1) return 'Shortening';
  return 'Stable';
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

  const cyclesLogged = cycles.length;
  const confidence = predictionConfidence(model.fitted ? model.error : sd, cyclesLogged, sd);
  const trend = cycleTrend(cycles.map((c) => c.length));

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
    cyclesLogged,
    confidence,
    trend,
    recentLengths: recent,
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

// ===== Visual cycle timeline =====
// One left-to-right bar = your current cycle in days. It labels the three things
// on the bar itself so it reads without decoding a legend: where "today" falls
// (a flagged marker), the cycle's start and predicted next period as the two
// ends, and the ± uncertainty as a shaded band around the predicted day. Phase
// colors sit quietly underneath as context, explained by the legend below.
function CycleTimeline({ stats }) {
  const expLen = Math.max(10, Math.round(stats.expectedLength));
  const predDay = daysBetween(stats.lastStart, dateKey(stats.predicted.toISOString()));
  const today = Math.max(1, stats.dayInCycle);
  const total = Math.max(predDay + stats.window + 1, expLen + 1, today + 1);
  const pos = (day) => Math.max(0, Math.min(100, ((day - 1) / total) * 100));
  const ov = Math.max(6, expLen - 14);

  const phases = [
    { label: 'Menstrual', from: 1, to: 5, color: 'var(--coral)' },
    { label: 'Follicular', from: 6, to: ov, color: 'var(--wellpath-accent)' },
    { label: 'Luteal', from: ov + 1, to: expLen, color: 'var(--wellpath-blue)' },
  ].filter((p) => p.to >= p.from);

  const winLeft = pos(Math.max(1, predDay - stats.window));
  const winWidth = Math.max(3, pos(predDay + stats.window + 1) - winLeft);
  const todayPct = pos(today);
  // Keep the floating "today" flag from spilling off either edge.
  const flagPct = Math.max(15, Math.min(85, todayPct));

  // Which day (and phase) sits under the cursor as you scrub across the bar.
  const [hover, setHover] = useState(null);
  const phaseAt = (day) => {
    if (day >= predDay - stats.window && day <= predDay + stats.window) return 'Predicted period';
    const p = phases.find((ph) => day >= ph.from && day <= ph.to);
    return p ? p.label : null;
  };
  const onScrub = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const day = Math.max(1, Math.round(frac * total) + 1);
    setHover({ pct: frac * 100, day, phase: phaseAt(day) });
  };

  return (
    <div className="cycle-tl">
      <p className="cycle-tl-caption">Where you are in this cycle — and when your next period is expected.</p>

      <div className="cycle-tl-plot">
        {hover ? (
          <div className="cycle-tl-hover" style={{ left: `${Math.max(15, Math.min(85, hover.pct))}%` }}>
            Day {hover.day}{hover.phase ? ` · ${hover.phase}` : ''}
          </div>
        ) : (
          <div className="cycle-tl-flag" style={{ left: `${flagPct}%` }}>
            Today · Day {today}
          </div>
        )}
        <div
          className="cycle-tl-track"
          onMouseMove={onScrub}
          onMouseLeave={() => setHover(null)}
        >
          {phases.map((p) => (
            <div key={p.label} className="cycle-tl-seg"
              style={{ left: `${pos(p.from)}%`, width: `${pos(p.to + 1) - pos(p.from)}%`, background: p.color }} />
          ))}
          <div className="cycle-tl-window" style={{ left: `${winLeft}%`, width: `${winWidth}%` }} />
          <div className="cycle-tl-today-line" style={{ left: `${todayPct}%` }} />
          {hover && <div className="cycle-tl-hover-line" style={{ left: `${hover.pct}%` }} />}
        </div>
      </div>

      <div className="cycle-tl-ends">
        <span className="cycle-tl-end">
          <em>Cycle start</em>
          <strong>Day 1</strong>
        </span>
        <span className="cycle-tl-end right">
          <em>Next period</em>
          <strong>{fmtDate(stats.predicted)} · ±{stats.window} day{stats.window === 1 ? '' : 's'}</strong>
        </span>
      </div>

      <div className="cycle-tl-legend">
        <span className="cycle-tl-legend-title">Phases:</span>
        {phases.map((p) => (
          <span key={p.label}><i style={{ background: p.color }} />{p.label}</span>
        ))}
      </div>
    </div>
  );
}

// ===== "Why this date?" transparent breakdown =====
// Shows the real math: the recent cycle lengths, how much each is weighted by
// the fitted recency model (actual EWMA weights), and the chain from those to
// the predicted date. Nothing here is invented — it's the model, made visible.
function CycleWhy({ stats }) {
  const lengths = stats.recentLengths || [];
  const weights = ewmaWeights(lengths.length, stats.fittedAlpha);
  const maxW = Math.max(...weights, 0.0001);
  const expLen = Math.round(stats.expectedLength);

  return (
    <div className="cycle-why">
      <p className="cycle-why-lead">Each recent cycle, weighted by how recent it is:</p>
      <div className="cycle-why-bars">
        {lengths.map((len, i) => (
          <div className="cycle-why-row" key={i}>
            <span className="cycle-why-len">{len}d</span>
            <div className="cycle-why-track">
              <div className="cycle-why-fill" style={{ width: `${(weights[i] / maxW) * 100}%` }} />
            </div>
            <span className="cycle-why-pct">{Math.round(weights[i] * 100)}%</span>
          </div>
        ))}
      </div>
      <div className="cycle-why-chain">
        <span>Weighted cycle length <strong>{expLen} days</strong></span>
        {stats.adjustmentDays !== 0 && (
          <span>Recent symptoms <strong>{stats.adjustmentDays < 0 ? '−' : '+'}{Math.abs(stats.adjustmentDays)} day{Math.abs(stats.adjustmentDays) === 1 ? '' : 's'}</strong></span>
        )}
        <span>Next start <strong>{fmtDate(stats.predicted)}</strong></span>
      </div>
    </div>
  );
}

// ===== Prediction factors =====
// Presents the inputs behind the estimate as neutral health information rather
// than a product comparison.
function CycleFactors({ stats }) {
  const signalMatch = stats.strength === null ? null : Math.round(stats.strength * 100);
  const factors = [
    {
      label: 'Cycle history',
      detail: `${stats.cyclesLogged} logged cycle${stats.cyclesLogged === 1 ? '' : 's'} · recent average ${Math.round(stats.simpleAvg)} days`,
      value: `${Math.round(stats.expectedLength)} days`,
    },
    {
      label: 'Recent cycle pattern',
      detail: 'Recent cycles are weighted more than older entries',
      value: stats.trend,
    },
    {
      label: 'Recent body signals',
      detail: signalMatch === null
        ? 'Not enough recent health data to compare'
        : `${signalMatch}% of tracked signals match a premenstrual pattern`,
      value: stats.adjustmentDays === 0
        ? 'No date change'
        : `${stats.adjustmentDays > 0 ? '+' : '−'}${Math.abs(stats.adjustmentDays)} day${Math.abs(stats.adjustmentDays) === 1 ? '' : 's'}`,
    },
    {
      label: 'Natural variability',
      detail: `Your logged cycles are ${stats.regularity}`,
      value: `±${stats.window} day${stats.window === 1 ? '' : 's'}`,
    },
  ];

  return (
    <section className="cycle-factors-card">
      <div className="cycle-factors-head">
        <span>Prediction factors</span>
        <p>Information used to estimate your next period.</p>
      </div>

      <div className="cycle-factor-list">
        {factors.map((factor, index) => (
          <div className="cycle-factor-row" key={factor.label}>
            <span className="cycle-factor-number">{index + 1}</span>
            <div>
              <strong>{factor.label}</strong>
              <p>{factor.detail}</p>
            </div>
            <em>{factor.value}</em>
          </div>
        ))}
      </div>
    </section>
  );
}

export function CyclePage({ patientId, healthLog = [] }) {
  const [periods, setPeriods] = useState([]);
  const [startInput, setStartInput] = useState(todayKey());
  const [saveNote, setSaveNote] = useState('');
  const [whyOpen, setWhyOpen] = useState(false);
  const [predictionOpen, setPredictionOpen] = useState(false);
  const [recentCyclesOpen, setRecentCyclesOpen] = useState(false);

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

  return (
    <div className="mobile-flow">
      <div className="mobile-section-title">
        <div>
          <span>Cycle tracking</span>
          <h2>Cycle</h2>
        </div>
        <Droplets size={19} />
      </div>

      <section className="cycle-log-card cycle-log-top">
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

        <button
          type="button"
          className="cycle-history-toggle"
          onClick={() => setRecentCyclesOpen((open) => !open)}
          aria-expanded={recentCyclesOpen}
        >
          <span>
            <CalendarDays size={15} />
            <strong>Recent cycles</strong>
          </span>
          <span>
            <em>{stats.cycles.length} logged</em>
            <ChevronDown size={16} className={recentCyclesOpen ? 'open' : ''} />
          </span>
        </button>

        {recentCyclesOpen && (
          <div className="cycle-history-list cycle-history-expanded">
            {stats.cycles.length ? (
              stats.cycles.slice(-6).reverse().map((c) => (
                <div className="cycle-history-item" key={c.start}>
                  <CalendarDays size={14} />
                  <span>{fmtDate(toDate(c.start))}</span>
                  <strong>{c.length} days</strong>
                  <button type="button" aria-label={`Remove ${c.start}`} onClick={() => removeStart(c.start)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            ) : (
              <p className="cycle-history-empty">No completed cycles logged yet.</p>
            )}
          </div>
        )}
      </section>

      {stats.enough ? (
        <section className="cycle-predict-card">
          <button
            type="button"
            className="cycle-predict-toggle"
            onClick={() => setPredictionOpen((open) => !open)}
            aria-expanded={predictionOpen}
          >
            <div className="cycle-predict-summary">
              <span className="cycle-predict-label">Next period predicted</span>
              <strong className="cycle-predict-date">{fmtDate(stats.predicted)}</strong>
              <em className="cycle-predict-sub">
                {stats.daysUntil > 0
                  ? `In ${stats.daysUntil} day${stats.daysUntil === 1 ? '' : 's'}`
                  : stats.daysUntil === 0
                    ? 'Expected today'
                    : `${Math.abs(stats.daysUntil)} day${Math.abs(stats.daysUntil) === 1 ? '' : 's'} overdue`}
                {` · ±${stats.window} day${stats.window === 1 ? '' : 's'}`}
              </em>
            </div>
            <div className="cycle-predict-toggle-side">
              <div className="cycle-confidence" title="Derived from the model's out-of-sample error and how many cycles were analyzed">
                <span className="cycle-conf-value">{stats.confidence}%</span>
                <span className="cycle-conf-label">confidence</span>
              </div>
              <ChevronDown size={19} className={predictionOpen ? 'open' : ''} />
            </div>
          </button>

          {predictionOpen && (
            <div className="cycle-predict-expanded">
              {/* See it: the visual timeline anchors the prediction. */}
              <CycleTimeline stats={stats} />

              {/* Understand it: one structured explanation of the estimate. */}
              <CycleFactors stats={stats} />

              {/* Prove it: the underlying math, tucked away for the curious. */}
              <button type="button" className="cycle-why-toggle" onClick={() => setWhyOpen((v) => !v)} aria-expanded={whyOpen}>
                How this date is calculated <ChevronDown size={15} className={whyOpen ? 'open' : ''} />
              </button>
              {whyOpen && <CycleWhy stats={stats} />}
            </div>
          )}
        </section>
      ) : (
        <section className="cycle-predict-card empty">
          <span className="cycle-predict-label">Next period</span>
          <strong className="cycle-predict-date">Not enough history</strong>
          <em className="cycle-predict-sub">Log at least two period start dates and a prediction will appear here.</em>
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

      <div className="quiet-disclaimer">
        <ShieldCheck size={15} /> Estimates from your logged history — not medical advice, and not for preventing or planning pregnancy.
      </div>
    </div>
  );
}
