import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Check, Link2, Sparkles, Target, ChevronDown, TrendingUp, TrendingDown, Minus, SlidersHorizontal } from 'lucide-react';
import { calculateRecoveryScore } from '../../utils/patientKpis.js';
import { useBubbleReveal } from '../../utils/useBubbleReveal.js';
import { PersonalizedHint } from './AiInsightBox.jsx';
import { getMemory } from './aiMemory.js';
import { buildRecentComparisons, formatTrendValue } from '../../utils/trendPatterns.js';

const METRIC_COLORS = {
  steps: '#35d48d', sleep: '#8b7cf6', heartRate: '#ff5f7a', exercise: '#f59e0b',
  activeMinutes: '#38bdf8', recovery: '#14b8a6', activeCalories: '#f97316', sedentary: '#d6c62f', bloodPressure: '#a855f7',
};

const GOAL_EDITOR_CONFIG = Object.freeze({
  steps: { minimum: 500, maximum: 100000, step: 100, suffix: 'steps' },
  sleep: { minimum: 1, maximum: 16, step: 0.1, suffix: 'hrs' },
  exercise: { minimum: 1, maximum: 600, step: 5, suffix: 'min' },
  activeMinutes: { minimum: 1, maximum: 720, step: 5, suffix: 'min' },
  activeCalories: { minimum: 25, maximum: 10000, step: 25, suffix: 'cal' },
  sedentary: { minimum: 1, maximum: 24, step: 0.1, suffix: 'hrs' },
});

const WEEKLY_GOAL_METRICS = new Set(['steps', 'exercise', 'activeMinutes', 'activeCalories']);
function goalCadence(cfg) {
  return WEEKLY_GOAL_METRICS.has(cfg?.id)
    ? { factor: 7, word: 'weekly' }
    : { factor: 1, word: 'daily' };
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const mean = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);
const withUnit = (value, unit) => (unit ? `${value} ${unit}` : `${value}`);

function metricConfigs(pd = {}) {
  return [
    { id: 'steps', key: 'steps', label: 'Steps', unit: '', dir: 'high', goal: num(pd.stepGoal), fmt: (v) => Math.round(v).toLocaleString() },
    { id: 'sleep', key: 'sleep', label: 'Sleep', unit: 'hrs', dir: 'high', goal: num(pd.sleepGoal), fmt: (v) => Number(v).toFixed(1) },
    { id: 'recovery', key: 'recoveryScore', label: 'Recovery', unit: '/100', dir: 'high', goal: 70, fmt: (v) => Math.round(v) },
    { id: 'heartRate', key: 'hr', label: 'Resting HR', unit: 'bpm', dir: 'range', range: [num(pd.restingHrBaselineLow), num(pd.restingHrBaselineHigh)], fmt: (v) => Math.round(v) },
    { id: 'exercise', key: 'exercise', label: 'Exercise', unit: 'min', dir: 'high', goal: num(pd.exerciseGoal), fmt: (v) => Math.round(v) },
    { id: 'activeMinutes', key: 'activeMinutes', label: 'Active Min', unit: 'min', dir: 'high', goal: num(pd.activeMinuteGoal), fmt: (v) => Math.round(v) },
    { id: 'activeCalories', key: 'activeCalories', label: 'Active Cal', unit: 'cal', dir: 'high', goal: num(pd.activeCalorieGoal), fmt: (v) => Math.round(v) },
    { id: 'sedentary', key: 'sedentaryHours', label: 'Sedentary', unit: 'hrs', dir: 'low', goal: num(pd.sedentaryLimit), fmt: (v) => Number(v).toFixed(1) },
    { id: 'bloodPressure', key: 'systolicBp', label: 'Blood Pressure', unit: 'mmHg', dir: 'low', goal: num(pd.bpSystolicTargetMax), fmt: (v) => Math.round(v) },
  ];
}

function heartRateScore(value, patientData) {
  const hr = num(value);
  if (hr == null) return null;
  const low = num(patientData.restingHrBaselineLow);
  const high = num(patientData.restingHrBaselineHigh);
  if (low != null && high != null) {
    const distance = hr < low ? low - hr : hr > high ? hr - high : 0;
    return distance === 0 ? 100 : Math.max(20, 100 - distance * 12);
  }
  return Math.max(0, Math.min(100, 100 - Math.max(0, hr - 74) * 4));
}

function seriesOf(healthLog, cfg, patientData) {
  if (cfg.id === 'recovery') {
    return healthLog
      .map((d) => ({
        value: calculateRecoveryScore({
          sleepHours: d.sleep,
          sleepConsistency: d.sleepConsistency,
          restingHeartRateScore: heartRateScore(d.hr, patientData),
          exerciseMinutes: d.exercise,
          activeMinutes: d.activeMinutes,
          age: patientData.age,
        }).score,
        date: d.recordDate || d.day,
      }))
      .filter((p) => p.value !== null);
  }

  return healthLog
    .map((d) => ({ value: num(d[cfg.key]), date: d.recordDate || d.day }))
    .filter((p) => p.value !== null);
}

function meetsGoal(value, cfg) {
  if (cfg.dir === 'high') return Number.isFinite(cfg.goal) && value >= cfg.goal;
  if (cfg.dir === 'low') return Number.isFinite(cfg.goal) && value <= cfg.goal;
  if (cfg.dir === 'range') {
    const [lo, hi] = cfg.range || [];
    return Number.isFinite(lo) && Number.isFinite(hi) && value >= lo && value <= hi;
  }
  return false;
}

function computeStats(series, cfg) {
  const values = series.map((p) => p.value);
  if (!values.length) return null;
  const last7 = values.slice(-7);
  const prev7 = values.slice(-14, -7);
  const wowNow = mean(last7);
  const wowPrev = mean(prev7);
  let max = series[0];
  let min = series[0];
  for (const p of series) {
    if (p.value > max.value) max = p;
    if (p.value < min.value) min = p;
  }
  let streak = 0;
  for (let i = series.length - 1; i >= 0; i -= 1) {
    if (meetsGoal(series[i].value, cfg)) streak += 1;
    else break;
  }
  return {
    avg: mean(values),
    max,
    min,
    hits: series.filter((p) => meetsGoal(p.value, cfg)).length,
    total: series.length,
    streak,
    wow: wowNow != null && wowPrev != null ? wowNow - wowPrev : null,
  };
}

function pearson(a, b) {
  const pairs = a.map((v, i) => [v, b[i]]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (pairs.length < 5) return 0;
  const ma = mean(pairs.map((p) => p[0]));
  const mb = mean(pairs.map((p) => p[1]));
  let n = 0; let da = 0; let db = 0;
  for (const [x, y] of pairs) { const dx = x - ma; const dy = y - mb; n += dx * dy; da += dx * dx; db += dy * dy; }
  const den = Math.sqrt(da * db);
  return den ? n / den : 0;
}

const CONNECTION_PAIRS = [
  { a: 'sleep', b: 'hr', neg: 'On nights you sleep more, your resting heart rate tends to be lower.', pos: 'On nights you sleep more, your resting heart rate tends to be higher.' },
  { a: 'exercise', b: 'sleep', pos: 'Days with more exercise tend to come with more sleep.', neg: 'Days with more exercise tend to come with less sleep.' },
  { a: 'sedentaryHours', b: 'steps', neg: 'The more you sit, the fewer steps you take that day.', pos: 'More sitting goes with more steps that day.' },
  { a: 'sedentaryHours', b: 'hr', pos: 'The more you sit, the higher your resting heart rate tends to be.', neg: 'More sitting goes with a lower resting heart rate.' },
  { a: 'steps', b: 'hr', neg: 'On more active days, your resting heart rate tends to be lower.', pos: 'On more active days, your resting heart rate tends to be higher.' },
];

function buildConnections(healthLog) {
  const results = [];
  for (const pair of CONNECTION_PAIRS) {
    const r = pearson(healthLog.map((d) => num(d[pair.a])), healthLog.map((d) => num(d[pair.b])));
    const abs = Math.abs(r);
    if (abs < 0.35) continue;
    const strength = abs >= 0.6 ? 'strong' : abs >= 0.45 ? 'clear' : 'mild';
    results.push({ text: r < 0 ? pair.neg : pair.pos, r, strength });
  }
  return results.sort((x, y) => Math.abs(y.r) - Math.abs(x.r)).slice(0, 3);
}

function fmtDate(d) {
  if (!d) return '';
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? String(d) : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function wowTone(wow, cfg) {
  if (wow == null || cfg.dir === 'range' || Math.abs(wow) < 1e-9) return null;
  const improving = cfg.dir === 'high' ? wow > 0 : wow < 0;
  return improving ? 'good' : 'bad';
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

const NICE_STEP = { steps: 100, activeCalories: 25, sleep: 0.1, sedentary: 0.1 };
function roundNice(value, id) {
  const step = NICE_STEP[id] || 1;
  return Math.round(value / step) * step;
}

function goalSuggestion(series, stats, cfg) {
  const coachable = cfg.dir === 'high' || cfg.id === 'sedentary';
  if (!coachable || !stats || series.length < 7) return null;

  const values = series.map((p) => p.value);
  const raw = cfg.dir === 'low' ? percentile(values, 0.25) : percentile(values, 0.75);
  const numericValue = roundNice(raw, cfg.id); // daily pace (what we store)
  const cad = goalCadence(cfg);
  const shown = withUnit(cfg.fmt(numericValue * cad.factor), cfg.unit).trim();
  const hitRate = stats.total ? stats.hits / stats.total : 0;
  const hasGoal = Number.isFinite(cfg.goal);
  const noun = `${cad.word} ${cfg.dir === 'low' ? 'limit' : 'target'}`;

  let text;
  if (!hasGoal) {
    text = `No ${noun} set yet. Based on your last 30 days, about ${shown} would be a realistic ${noun}.`;
  } else if (hitRate < 0.2) {
    text = cfg.dir === 'low'
      ? `You're over your limit ${stats.hits} of ${stats.total} days. A more realistic ${noun} is about ${shown}.`
      : `You're meeting this goal on only ${stats.hits} of ${stats.total} days. A more reachable ${noun} is about ${shown}.`;
  } else if (hitRate > 0.85) {
    text = cfg.dir === 'low'
      ? `You're under your limit ${stats.hits} of ${stats.total} days — you could tighten it to about ${shown}.`
      : `You're hitting this goal ${stats.hits} of ${stats.total} days. For a new challenge, aim for about ${shown}.`;
  } else {
    text = `Based on your last 30 days, a realistic ${noun} is about ${shown}.`;
  }
  return { text, value: shown, numericValue, noun };
}

const RANGE_OPTIONS = [
  { days: 30, short: '30D', label: 'Last 30 days' },
  { days: 90, short: '90D', label: 'Last 90 days' },
  { days: 365, short: '1Y', label: 'Last year' },
];
const MIN_ZOOM_DAYS = 7;

function clampWindow(start, end, total, minLen = MIN_ZOOM_DAYS) {
  if (total <= 0) return { start: 0, end: 0 };
  const len = Math.max(minLen, Math.min(total, Math.round(end - start + 1)));
  const s = Math.max(0, Math.min(Math.round(start), total - len));
  return { start: s, end: s + len - 1 };
}

export function HealthSummary({ patientId = null, healthLog = [], patientData = {}, initialMetricId = null, aiEnabled = true, onGenerateAiInsight, onAdjustGoal }) {
  const personalized = patientId ? getMemory(patientId).length > 0 : false;
  const configs = metricConfigs(patientData);
  const validInitial = configs.some((c) => c.id === initialMetricId) ? initialMetricId : 'steps';
  const [selectedId, setSelectedId] = useState(validInitial);
  const menu = useBubbleReveal();
  const menuRef = useRef(null);

  const total = healthLog.length;
  const [view, setView] = useState(() => clampWindow(total - 30, total - 1, total));
  useEffect(() => {
    setView(clampWindow(total - 30, total - 1, total));
  }, [healthLog]);

  const setPreset = (days) => setView(clampWindow(total - days, total - 1, total));
  const spanDays = view.end - view.start + 1;
  const atLatest = view.end >= total - 1;
  const activePreset = atLatest
    ? (RANGE_OPTIONS.find((o) => Math.min(o.days, total) === spanDays)?.days ?? null)
    : null;

  const visibleLog = useMemo(() => healthLog.slice(view.start, view.end + 1), [healthLog, view]);

  const comparisons = useMemo(() => buildRecentComparisons(healthLog.slice(-45)), [healthLog]);
  const shownComparisons = comparisons.slice(0, 4);
  const [patternInsight, setPatternInsight] = useState(null);
  const [patternLoading, setPatternLoading] = useState(false);
  const [goalEditorMetric, setGoalEditorMetric] = useState(null);
  const [goalDraft, setGoalDraft] = useState('');
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalUpdate, setGoalUpdate] = useState(null);

  useEffect(() => {
    setGoalEditorMetric(null);
    setGoalUpdate(null);
  }, [selectedId]);

  const explainPatterns = async () => {
    if (!aiEnabled || !onGenerateAiInsight || patternLoading) return;
    setPatternLoading(true);
    setPatternInsight(null);
    try {
      const text = await onGenerateAiInsight({
        insightType: 'trend',
        targetId: 'recent-comparison',
        targetTitle: 'Recent direction',
        targetContext: {
          comparisons: comparisons.map((item) => ({
            metric: item.label,
            recentSevenDayAverage: Number(formatTrendValue(item.recentAverage, item.digits).replace(/,/g, '')),
            previousSevenDayAverage: Number(formatTrendValue(item.previousAverage, item.digits).replace(/,/g, '')),
            direction: item.direction,
          })),
        },
      });
      setPatternInsight(text);
    } catch {
      setPatternInsight('The explanation is unavailable right now. The comparison cards still show your recent history.');
    } finally {
      setPatternLoading(false);
    }
  };

  useEffect(() => {
    if (!menu.open) return undefined;
    const onDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) menu.close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menu.open]);

  const cfg = configs.find((c) => c.id === selectedId) || configs[0];
  const series = seriesOf(visibleLog, cfg, patientData);
  const stats = computeStats(series, cfg);
  const suggestion = goalSuggestion(series, stats, cfg);
  const connections = buildConnections(healthLog);
  const color = METRIC_COLORS[cfg.id];
  const latest = series.length ? series[series.length - 1].value : null;
  const editorConfig = GOAL_EDITOR_CONFIG[cfg.id];
  const goalEditorOpen = goalEditorMetric === cfg.id;
  const cad = goalCadence(cfg);
  const cadWordCap = cad.word.charAt(0).toUpperCase() + cad.word.slice(1);

  const openGoalEditor = () => {
    const baseDaily = Number.isFinite(cfg.goal) ? cfg.goal : suggestion?.numericValue;
    setGoalDraft(Number.isFinite(baseDaily) ? String(baseDaily * cad.factor) : '');
    setGoalUpdate(null);
    setGoalEditorMetric(cfg.id);
  };

  const saveAdjustedGoal = async (displayValue, source) => {
    const requestedDisplay = Number(String(displayValue).replace(/,/g, ''));
    const minDisplay = (editorConfig?.minimum ?? 0) * cad.factor;
    const maxDisplay = (editorConfig?.maximum ?? 0) * cad.factor;
    if (!editorConfig || !Number.isFinite(requestedDisplay)
      || requestedDisplay < minDisplay || requestedDisplay > maxDisplay) {
      setGoalUpdate({
        tone: 'error',
        text: `Enter a value between ${minDisplay.toLocaleString()} and ${maxDisplay.toLocaleString()}.`,
      });
      return;
    }

    const requestedValue = requestedDisplay / cad.factor; // stored per-day
    setGoalSaving(true);
    setGoalUpdate(null);
    try {
      const saved = await onAdjustGoal(cfg.id, requestedValue);
      const savedLabel = `${cfg.fmt(saved.value * cad.factor)} ${editorConfig.suffix}`.trim();
      setGoalDraft(String(saved.value * cad.factor));
      setGoalEditorMetric(null);
      setGoalUpdate({
        tone: 'success',
        text: source === 'suggested'
          ? `${cadWordCap} ${cfg.label} goal set to the suggested ${savedLabel}.`
          : `${cadWordCap} ${cfg.label} goal updated to ${savedLabel}.`,
      });
    } catch (error) {
      setGoalUpdate({ tone: 'error', text: error.message || 'The goal could not be updated.' });
    } finally {
      setGoalSaving(false);
    }
  };

  const submitManualGoal = (event) => {
    event.preventDefault();
    saveAdjustedGoal(goalDraft, 'manual');
  };

  const firstDay = visibleLog[0];
  const lastDay = visibleLog[visibleLog.length - 1];
  const presetLabel = RANGE_OPTIONS.find((o) => o.days === activePreset)?.label;
  const rangeCaption = presetLabel
    || (firstDay && lastDay
      ? `${fmtDate(firstDay.recordDate || firstDay.day)} – ${fmtDate(lastDay.recordDate || lastDay.day)}`
      : `${spanDays} days`);

  const goalLabel = cfg.dir === 'range'
    ? (cfg.range && Number.isFinite(cfg.range[0]) ? `target ${cfg.range[0]}-${cfg.range[1]} ${cfg.unit}` : 'no target set')
    : Number.isFinite(cfg.goal) ? `${cad.word} ${cfg.dir === 'low' ? 'limit' : 'goal'} ${withUnit(cfg.fmt(cfg.goal * cad.factor), cfg.unit)}` : 'no goal set';

  return (
    <div className="mobile-flow">
      <div className="mobile-section-title">
        <div>
          <span>{rangeCaption}</span>
          <h2>Breakdown</h2>
        </div>
      </div>

      <div className="breakdown-controls">
        <div className="breakdown-select" ref={menuRef}>
          <button
            type="button"
            className={menu.open ? 'breakdown-select-trigger open' : 'breakdown-select-trigger'}
            style={{ '--tab-color': color }}
            onClick={menu.toggle}
            aria-haspopup="listbox"
            aria-expanded={menu.open}
          >
            <span className="breakdown-select-dot" />
            <span className="breakdown-select-label">{cfg.label}</span>
            <ChevronDown size={16} className="breakdown-select-chevron" />
          </button>
          {menu.mounted && (
            <ul className={`breakdown-select-menu bubble-anim${menu.closing ? ' closing' : ''}`} role="listbox">
              {configs.map((c) => (
                <li key={c.id} role="option" aria-selected={c.id === selectedId}>
                  <button
                    type="button"
                    className={c.id === selectedId ? 'breakdown-select-option selected' : 'breakdown-select-option'}
                    style={{ '--tab-color': METRIC_COLORS[c.id] }}
                    onClick={() => { setSelectedId(c.id); menu.close(); }}
                  >
                    <span className="breakdown-select-dot" />
                    {c.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="breakdown-range" role="group" aria-label="Time range">
          {RANGE_OPTIONS.map((opt, i) => {
            const available = total > (i === 0 ? 1 : RANGE_OPTIONS[i - 1].days);
            return (
              <button
                key={opt.days}
                type="button"
                className={activePreset === opt.days ? 'active' : ''}
                onClick={() => setPreset(opt.days)}
                disabled={!available}
                title={available ? opt.label : 'Not enough history yet'}
                aria-pressed={activePreset === opt.days}
              >
                {opt.short}
              </button>
            );
          })}
        </div>
      </div>

      <section className="metric-detail-panel" style={{ '--metric-color': color }}>
        <div className="metric-detail-header">
          <div>
            <span>{goalLabel}</span>
            <h3>{cfg.label}</h3>
          </div>
          <strong>{latest != null ? cfg.fmt(latest) : '--'} <small>{cfg.unit}</small></strong>
        </div>

        <TrendChart
          series={series}
          color={color}
          goal={cfg.dir === 'range' ? undefined : cfg.goal}
          unit={cfg.unit}
          fmt={cfg.fmt}
          view={view}
          setView={setView}
          total={total}
        />
        <p className="trend-hint">Scroll or pinch to zoom · drag to pan · double-click for last 7 days</p>

        {stats ? (
          <div className="breakdown-stats">
            <Stat label={`${spanDays}-day average`} value={withUnit(cfg.fmt(stats.avg), cfg.unit)} />
            <Stat label="Highest" value={withUnit(cfg.fmt(stats.max.value), cfg.unit)} sub={fmtDate(stats.max.date)} />
            <Stat label="Lowest" value={withUnit(cfg.fmt(stats.min.value), cfg.unit)} sub={fmtDate(stats.min.date)} />
            <Stat label={cfg.dir === 'low' ? 'Under limit' : cfg.dir === 'range' ? 'In range' : 'Goal met'} value={`${stats.hits} of ${stats.total} days`} />
            <Stat label="Current streak" value={`${stats.streak} ${stats.streak === 1 ? 'day' : 'days'}`} />
            <Stat
              label="vs last week"
              value={stats.wow == null ? 'n/a' : `${stats.wow > 0 ? '+' : ''}${cfg.fmt(stats.wow)} ${cfg.unit}`.trim()}
              tone={wowTone(stats.wow, cfg)}
            />
          </div>
        ) : (
          <p className="breakdown-empty">Not enough history for this metric yet.</p>
        )}

        {suggestion && (
          <div className="breakdown-suggestion">
            <Target size={16} />
            <div className="breakdown-suggestion-content">
              <strong>Suggested {suggestion.noun}: {suggestion.value}</strong>
              <p>{suggestion.text}</p>
              {editorConfig && onAdjustGoal && (
                <div className="goal-adjustment">
                  {!goalEditorOpen ? (
                    <button className="goal-adjust-trigger" type="button" onClick={openGoalEditor}>
                      <SlidersHorizontal size={14} /> Adjust {cad.word} {cfg.label} goal
                    </button>
                  ) : (
                    <div className="goal-adjust-panel">
                      <button
                        className="goal-use-suggestion"
                        type="button"
                        disabled={goalSaving}
                        onClick={() => saveAdjustedGoal(suggestion.numericValue * cad.factor, 'suggested')}
                      >
                        <Check size={14} /> Use suggested {suggestion.value}
                      </button>
                      <form className="goal-manual-form" onSubmit={submitManualGoal}>
                        <label htmlFor={`manual-goal-${cfg.id}`}>Or enter your own {suggestion.noun}</label>
                        <div className="goal-manual-row">
                          <span className="goal-input-wrap">
                            <input
                              id={`manual-goal-${cfg.id}`}
                              type="number"
                              min={editorConfig.minimum * cad.factor}
                              max={editorConfig.maximum * cad.factor}
                              step={editorConfig.step * cad.factor}
                              value={goalDraft}
                              onChange={(event) => setGoalDraft(event.target.value)}
                              disabled={goalSaving}
                              aria-label={`${cfg.label} ${suggestion.noun}`}
                            />
                            <span>{editorConfig.suffix}</span>
                          </span>
                          <button type="submit" disabled={goalSaving || !goalDraft}>Save</button>
                        </div>
                      </form>
                      <button className="goal-adjust-cancel" type="button" disabled={goalSaving} onClick={() => setGoalEditorMetric(null)}>Cancel</button>
                    </div>
                  )}
                  {goalUpdate && <p className={`goal-adjust-message ${goalUpdate.tone}`} role="status">{goalUpdate.text}</p>}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="mobile-section-title">
        <div>
          <span>Patterns across your metrics</span>
          <h2>Connections</h2>
        </div>
        <Link2 size={18} />
      </div>

      <section className="breakdown-connections">
        {connections.length ? (
          connections.map((c, i) => (
            <div className="connection-item" key={i}>
              <Sparkles size={15} />
              <p>{c.text}</p>
              <em className={`connection-strength ${c.strength}`}>{c.strength} link</em>
            </div>
          ))
        ) : (
          <div className="connection-item">
            <p>No clear pattern between your metrics yet — keep logging daily and check back.</p>
          </div>
        )}
      </section>

      <div className="mobile-section-title">
        <div>
          <span>Consistent patterns in your last 30 days</span>
          <h2>Recent trends</h2>
        </div>
        <TrendingUp size={18} />
      </div>

      <section className="ai-brief-card">
        <p>Which habits are consistently rising, falling, or holding steady.</p>
        {shownComparisons.length ? (
          <div className="forecast-grid">
            {shownComparisons.map((item) => {
              const Icon = item.direction === 'flat' ? Minus : item.direction === 'up' ? TrendingUp : TrendingDown;
              const word = item.direction === 'flat' ? 'about the same' : item.direction === 'up' ? 'up from prior week' : 'down from prior week';
              return (
                <div className={`forecast-card tone-${item.tone}`} key={item.key}>
                  <span className="forecast-label">{item.label}</span>
                  <strong>{formatTrendValue(item.recentAverage, item.digits)}{item.unit ? ` ${item.unit}` : ''}</strong>
                  <small><Icon size={12} /> {word}</small>
                </div>
              );
            })}
          </div>
        ) : (
          <p>Not enough history yet to spot trends.</p>
        )}

        {patternInsight ? (
          <div className="forecast-ai-text"><Sparkles size={14} /><p>{patternInsight}</p></div>
        ) : patternLoading ? (
          <div className="forecast-ai-text"><Sparkles size={14} /><p className="ai-loading-text">Reading your recent trends...</p></div>
        ) : null}
        {patternInsight && personalized && <PersonalizedHint />}
        {aiEnabled && onGenerateAiInsight && !patternLoading && shownComparisons.length > 0 && (
          <button type="button" className="mood-ai-btn" onClick={explainPatterns}>
            {patternInsight ? 'Refresh' : 'Explain my trends'}
          </button>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, sub, tone }) {
  return (
    <div className="breakdown-stat">
      <span>{label}</span>
      <strong className={tone ? `tone-${tone}` : ''}>{value}</strong>
      {sub ? <small>{sub}</small> : null}
    </div>
  );
}

function movingAverage(series, window) {
  const half = Math.floor(window / 2);
  return series.map((p, i) => {
    let sum = 0; let n = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(series.length - 1, i + half); j += 1) {
      const v = series[j].value;
      if (Number.isFinite(v)) { sum += v; n += 1; }
    }
    return { ...p, value: n ? sum / n : null };
  });
}

function TrendChart({ series, color, goal, unit, fmt, view, setView, total }) {
  const [hover, setHover] = useState(null);
  const plotRef = useRef(null);
  const pointers = useRef(new Map()); // active pointerId -> {x,y}
  const gesture = useRef(null);        // { type: 'pan' | 'pinch', ... }
  const zoomable = Boolean(setView && total);

  useEffect(() => {
    const el = plotRef.current;
    if (!el || !zoomable) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / (rect.width || 1)));
      const len = view.end - view.start + 1;
      const newLen = Math.round(Math.max(MIN_ZOOM_DAYS, Math.min(total, len * (e.deltaY > 0 ? 1.2 : 1 / 1.2))));
      const centerIdx = view.start + frac * (len - 1);
      const start = centerIdx - frac * (newLen - 1);
      setView(clampWindow(start, start + newLen - 1, total));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [view, total, zoomable, setView]);

  if (series.length < 2) return <div className="breakdown-chart-empty">Not enough history yet</div>;
  const dense = series.length > 60;

  const values = series.map((p) => p.value).filter(Number.isFinite);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (Number.isFinite(goal)) { lo = Math.min(lo, goal); hi = Math.max(hi, goal); }
  const range = (hi - lo) || 1;

  const xPct = (i) => (i / (series.length - 1)) * 100;
  const yPct = (v) => 5 + (1 - (v - lo) / range) * 90; // inset to keep points off the edges
  const toPoints = (arr) => arr
    .map((p, i) => (Number.isFinite(p.value) ? `${xPct(i)},${yPct(p.value)}` : null))
    .filter(Boolean)
    .join(' ');

  const rawPoints = toPoints(series);
  const smoothPoints = dense ? toPoints(movingAverage(series, 7)) : null;
  const goalY = Number.isFinite(goal) ? yPct(goal) : null;

  const yTicks = [hi, (hi + lo) / 2, lo];
  const last = series.length - 1;
  const xTicks = [0, Math.round(last / 3), Math.round((2 * last) / 3), last]
    .filter((v, i, a) => a.indexOf(v) === i)
    .map((i) => series[i].date);

  const width = () => plotRef.current?.getBoundingClientRect().width || 1;
  const hoverAt = (clientX) => {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect) return;
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / (rect.width || 1)));
    setHover(Math.round(frac * (series.length - 1)));
  };
  const panBy = (fromView, dxRatio) => {
    const len = fromView.end - fromView.start + 1;
    const start = fromView.start - Math.round(dxRatio * (len - 1));
    setView(clampWindow(start, start + len - 1, total));
  };

  const twoPointerDist = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const twoPointerMidX = () => {
    const [a, b] = [...pointers.current.values()];
    return (a.x + b.x) / 2;
  };
  const fracOf = (clientX) => {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect) return 0.5;
    return Math.min(1, Math.max(0, (clientX - rect.left) / (rect.width || 1)));
  };
  const zoomTo = (baseView, factor, frac) => {
    const len = baseView.end - baseView.start + 1;
    const newLen = Math.round(Math.max(MIN_ZOOM_DAYS, Math.min(total, len * factor)));
    const centerIdx = baseView.start + frac * (len - 1);
    const start = centerIdx - frac * (newLen - 1);
    setView(clampWindow(start, start + newLen - 1, total));
  };
  const startPan = () => {
    const [p] = [...pointers.current.values()];
    gesture.current = { type: 'pan', x: p.x, view, moved: false };
  };
  const startPinch = () => {
    gesture.current = { type: 'pinch', dist: twoPointerDist(), view, frac: fracOf(twoPointerMidX()) };
    setHover(null);
  };

  const onPointerDown = (e) => {
    if (!zoomable) return;
    plotRef.current?.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2) startPinch();
    else startPan();
  };
  const onPointerMove = (e) => {
    if (pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    const g = gesture.current;
    if (g?.type === 'pinch' && pointers.current.size >= 2) {
      zoomTo(g.view, g.dist / (twoPointerDist() || 1), g.frac);
      return;
    }
    if (g?.type === 'pan') {
      const dx = e.clientX - g.x;
      if (Math.abs(dx) > 2) { g.moved = true; setHover(null); }
      if (g.moved) panBy(g.view, dx / width());
      return;
    }
    if (e.pointerType !== 'touch') hoverAt(e.clientX);
  };
  const onPointerUp = (e) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    plotRef.current?.releasePointerCapture?.(e.pointerId);
    if (pointers.current.size === 1) {
      startPan(); // dropped from a pinch back to single-finger pan
    } else if (pointers.current.size === 0) {
      gesture.current = null;
      if (g?.type === 'pan' && !g.moved) hoverAt(e.clientX);
    }
  };
  const onPointerLeave = (e) => {
    if (e.pointerType !== 'touch' && !gesture.current) setHover(null);
  };

  return (
    <div className="trend-chart">
      <div className="trend-y-axis">
        {yTicks.map((t, i) => <span key={i}>{fmt(t)}</span>)}
      </div>
      <div
        className="trend-plot"
        ref={plotRef}
        style={zoomable ? { touchAction: 'pan-y', cursor: 'crosshair' } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        onDoubleClick={zoomable ? () => setView(clampWindow(total - 7, total - 1, total)) : undefined}
      >
        <svg className="trend-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {goalY != null && <line x1="0" x2="100" y1={goalY} y2={goalY} className="trend-goal-line" />}
          {smoothPoints && (
            <polyline points={rawPoints} fill="none" stroke={color} strokeWidth="1" opacity="0.25" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          )}
          <polyline points={smoothPoints || rawPoints} fill="none" stroke={color} strokeWidth={smoothPoints ? '2.5' : '2'} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        {/* Individual dots only when the window is sparse enough to read them. */}
        {!dense && series.map((p, i) => (
          Number.isFinite(p.value) ? (
            <span
              key={i}
              className={hover === i ? 'trend-dot active' : 'trend-dot'}
              style={{ left: `${xPct(i)}%`, top: `${yPct(p.value)}%`, '--dot-color': color, pointerEvents: 'none' }}
            />
          ) : null
        ))}
        {dense && hover != null && series[hover] && Number.isFinite(series[hover].value) && (
          <span
            className="trend-dot active"
            style={{ left: `${xPct(hover)}%`, top: `${yPct(series[hover].value)}%`, '--dot-color': color, pointerEvents: 'none' }}
          />
        )}
        {hover != null && series[hover] && Number.isFinite(series[hover].value) && (
          <div
            className="trend-tooltip bubble-anim"
            style={{
              left: `${xPct(hover)}%`,
              top: `${yPct(series[hover].value)}%`,
              transform: `translate(${xPct(hover) < 20 ? '-8%' : xPct(hover) > 80 ? '-92%' : '-50%'}, calc(-100% - 10px))`,
            }}
          >
            <strong>{fmt(series[hover].value)}{unit ? ` ${unit}` : ''}</strong>
            <span>{fmtDate(series[hover].date)}</span>
          </div>
        )}
      </div>
      <div className="trend-x-axis">
        {xTicks.map((d, i) => <span key={i}>{fmtDate(d)}</span>)}
      </div>
    </div>
  );
}
