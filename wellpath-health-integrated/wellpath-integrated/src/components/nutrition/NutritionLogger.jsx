import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Info, Loader2, Plus, Sparkles, TrendingUp, X } from 'lucide-react';
import { api } from '../../api';
import { buildDailyNutritionTotals, buildFoodHealthAssociations } from '../../utils/foodPatterns.js';

const REF = {
  kcal: { limit: 2000, unit: 'kcal', kind: 'info' },
  sodium: { limit: 2300, unit: 'mg', kind: 'limit' },
  satfat: { limit: 22, unit: 'g', kind: 'limit' },
  sugar: { limit: 50, unit: 'g', kind: 'limit' },
  fibre: { limit: 28, unit: 'g', kind: 'goal' },
};
const NAMES = { kcal: 'Calories', sodium: 'Sodium', satfat: 'Saturated fat', sugar: 'Sugar', fibre: 'Fibre' };
const NUTRIENT_KEYS = ['kcal', 'protein', 'carbs', 'sugar', 'fibre', 'fat', 'satfat', 'sodium'];
const BLANK_MANUAL = Object.fromEntries(['name', ...NUTRIENT_KEYS].map((key) => [key, '']));
const todayKey = () => new Date().toISOString().slice(0, 10);
const storageKey = (patientId) => `wellpath:nutrition-log:v2:${patientId || 'patient'}`;

function loadLocalEntries(patientId) {
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey(patientId)) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveLocalEntries(patientId, entries) {
  try {
    window.localStorage.setItem(storageKey(patientId), JSON.stringify(entries));
  } catch {
    // The log still works for this session if storage is unavailable.
  }
}

// Compact, token-friendly summary of the real meal log so the AI can read what
// the user actually ate and draw grounded conclusions (never invent foods).
function buildMealLogSummary(logged, dailyTotals, associations) {
  const days = dailyTotals.length;
  const avg = (key) => (days
    ? Math.round(dailyTotals.reduce((sum, day) => sum + (Number(day[key]) || 0), 0) / days)
    : 0);
  const counts = new Map();
  logged.forEach((entry) => {
    const name = String(entry.name || '').trim().toLowerCase();
    if (name) counts.set(name, (counts.get(name) || 0) + 1);
  });
  const topFoods = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));
  const recentDays = dailyTotals.slice(-10).map((day) => ({
    date: day.date,
    meals: day.meals,
    kcal: Math.round(day.kcal),
    protein: Math.round(day.protein),
    sugar: Math.round(day.sugar),
    fibre: Math.round(day.fibre),
    satfat: Math.round(day.satfat),
    sodium: Math.round(day.sodium),
  }));
  return {
    daysLogged: days,
    mealsLogged: logged.length,
    dailyAverages: {
      kcal: avg('kcal'), protein: avg('protein'), carbs: avg('carbs'), sugar: avg('sugar'),
      fibre: avg('fibre'), fat: avg('fat'), satfat: avg('satfat'), sodium: avg('sodium'),
    },
    topFoods,
    recentDays,
    associations: (associations || []).map((item) => ({
      title: item.title, nutrient: item.nutrientLabel, metric: item.metricLabel, direction: item.direction,
    })),
  };
}

// ---- date helpers (local-time, no timezone drift on YYYY-MM-DD keys) ----
const pad2 = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
const startOfWeek = (d) => addDays(d, -d.getDay());

function groupEntriesByDate(logged) {
  const map = new Map();
  logged.forEach((entry) => {
    const key = (entry.recordDate || entry.record_date || '').slice(0, 10);
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(entry);
  });
  return map;
}

// Browsable meal history: switch between Month / Week / Day, page through time,
// and see exactly what was eaten. The AI read of the whole log sits underneath.
function MealHistory({ logged, aiEnabled, onGenerateAiInsight, mealInsight, mealInsightLoading, onReadMealLog }) {
  const [view, setView] = useState('month');
  const [anchor, setAnchor] = useState(() => {
    const dates = logged.map((e) => (e.recordDate || '').slice(0, 10)).filter(Boolean).sort();
    return dates.length ? new Date(`${dates[dates.length - 1]}T00:00:00`) : new Date();
  });
  const byDate = useMemo(() => groupEntriesByDate(logged), [logged]);
  const today = new Date();

  // Meals load asynchronously after mount, so jump to the most recent logged
  // month the first time data arrives (then leave the user's browsing alone).
  const jumpedRef = useRef(false);
  useEffect(() => {
    if (jumpedRef.current) return;
    const dates = logged.map((e) => (e.recordDate || '').slice(0, 10)).filter(Boolean).sort();
    if (dates.length) {
      setAnchor(new Date(`${dates[dates.length - 1]}T00:00:00`));
      jumpedRef.current = true;
    }
  }, [logged]);

  const shift = (dir) => {
    if (view === 'month') setAnchor((d) => addMonths(d, dir));
    else if (view === 'week') setAnchor((d) => addDays(d, dir * 7));
    else setAnchor((d) => addDays(d, dir));
  };

  const label = view === 'month'
    ? anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : view === 'week'
      ? (() => { const s = startOfWeek(anchor); const e = addDays(s, 6);
          return `${s.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`; })()
      : anchor.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

  const foodList = (meals) => (
    <ul className="mh-food-list">
      {meals.map((m) => (
        <li key={m.id}>
          <span>{m.source === 'ai_estimate' && <Sparkles size={11} className="nl-ai-tag" />}{m.name}</span>
          <em>{Math.round(m.kcal)} kcal</em>
        </li>
      ))}
    </ul>
  );

  return (
    <section className="meal-history-box" aria-label="Meal history">
      <div className="mh-head">
        <div><h3>Meal history</h3><p className="nt-note-plain">Look back at what you ate, by month, week, or day.</p></div>
        <div className="mh-views" role="group" aria-label="History view">
          {['month', 'week', 'day'].map((v) => (
            <button key={v} type="button" className={view === v ? 'on' : ''} onClick={() => setView(v)}>
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="mh-nav">
        <button type="button" onClick={() => shift(-1)} aria-label="Previous"><ChevronLeft size={17} /></button>
        <strong>{label}</strong>
        <button type="button" onClick={() => shift(1)} aria-label="Next"><ChevronRight size={17} /></button>
      </div>

      {view === 'month' && (() => {
        const y = anchor.getFullYear(); const mo = anchor.getMonth();
        const offset = new Date(y, mo, 1).getDay();
        const days = new Date(y, mo + 1, 0).getDate();
        const cells = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
        return (
          <div className="mh-cal">
            <div className="mh-cal-head">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => <span key={i}>{w}</span>)}</div>
            <div className="mh-cal-grid">
              {cells.map((d, idx) => {
                if (d === null) return <span className="mh-cal-empty" key={`e${idx}`} />;
                const key = ymd(new Date(y, mo, d));
                const meals = byDate.get(key) || [];
                return (
                  <button
                    key={key}
                    type="button"
                    className={`mh-cal-cell${meals.length ? ' has' : ''}${key === ymd(today) ? ' today' : ''}`}
                    onClick={() => { setAnchor(new Date(y, mo, d)); setView('day'); }}
                    aria-label={`${key}, ${meals.length} meals logged`}
                  >
                    <span className="mh-cal-num">{d}</span>
                    {meals.length > 0 && <span className="mh-cal-dot">{meals.length}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {view === 'week' && (() => {
        const start = startOfWeek(anchor);
        return (
          <div className="mh-week">
            {Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((d) => {
              const key = ymd(d); const meals = byDate.get(key) || [];
              return (
                <div className={`mh-week-day${meals.length ? '' : ' empty'}`} key={key}>
                  <button type="button" className="mh-week-daybtn" onClick={() => { setAnchor(d); setView('day'); }}>
                    <strong>{d.toLocaleDateString(undefined, { weekday: 'short' })} {d.getDate()}</strong>
                    <em>{meals.length ? `${meals.length} meal${meals.length > 1 ? 's' : ''}` : 'nothing logged'}</em>
                  </button>
                  {meals.length > 0 && (
                    <ul className="mh-food-mini">
                      {meals.slice(0, 4).map((m) => <li key={m.id}>{m.name}</li>)}
                      {meals.length > 4 && <li className="mh-more">+{meals.length - 4} more</li>}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {view === 'day' && (() => {
        const meals = byDate.get(ymd(anchor)) || [];
        const kcal = meals.reduce((s, m) => s + (Number(m.kcal) || 0), 0);
        return meals.length
          ? <div className="mh-day"><p className="mh-day-sum">{meals.length} meal{meals.length > 1 ? 's' : ''} · {Math.round(kcal)} kcal</p>{foodList(meals)}</div>
          : <p className="nl-hint">Nothing logged on this day.</p>;
      })()}

      {aiEnabled && onGenerateAiInsight && logged.length > 0 && (
        <div className="mh-ai">
          <div className="nutrition-pattern-heading"><Sparkles size={17} /><div><strong>What your meals show</strong><span>AI reads your whole meal log</span></div></div>
          {mealInsight
            ? <p className="nmi-text">{mealInsight}</p>
            : mealInsightLoading
              ? <p className="nmi-text ai-loading-text">Reading your meal log…</p>
              : <p className="nl-hint">Get a plain-language read of what you’ve actually been eating, and one realistic change that fits it.</p>}
          <button type="button" className="mood-ai-btn" onClick={onReadMealLog} disabled={mealInsightLoading}>
            {mealInsight ? 'Refresh' : 'Read my meal log'}
          </button>
        </div>
      )}
    </section>
  );
}

export function NutritionLogger({ patientId, healthLog = [], aiEnabled = true, onGenerateAiInsight }) {
  const [mealInsight, setMealInsight] = useState(null);
  const [mealInsightLoading, setMealInsightLoading] = useState(false);
  const [mode, setMode] = useState('ai');
  const [recordDate, setRecordDate] = useState(todayKey);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [manual, setManual] = useState(BLANK_MANUAL);
  // The database is the source of truth. Start empty and load from the server;
  // the local cache is only a fallback for when the server can't be reached.
  const [logged, setLogged] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    api.getNutritionLogs(patientId, 365)
      .then((entries) => {
        if (cancelled) return;
        setLogged(Array.isArray(entries) ? entries : []);
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLogged(loadLocalEntries(patientId)); // offline fallback only
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [patientId]);

  // Mirror the loaded server data into the local cache (never clobber it with
  // the empty pre-load state).
  useEffect(() => {
    if (loaded) saveLocalEntries(patientId, logged);
  }, [loaded, logged, patientId]);

  const add = async (item) => {
    const optimistic = {
      ...item,
      id: item.id || `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      recordDate,
    };
    setLogged((entries) => [...entries, optimistic]);
    try {
      const saved = await api.addNutritionLog(patientId, optimistic);
      setLogged((entries) => entries.map((entry) => entry.id === optimistic.id ? saved : entry));
    } catch {
      setError('Saved on this device. It will need the API connection to sync with another device.');
    }
  };

  const remove = async (entry) => {
    setLogged((entries) => entries.filter((item) => item.id !== entry.id));
    if (!String(entry.id).startsWith('local-')) {
      api.deleteNutritionLog(patientId, entry.id).catch(() => setError('Removed on this device, but server sync is unavailable.'));
    }
  };

  const estimate = async () => {
    const food = query.trim();
    if (!food || loading) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.estimateNutrition(food);
      await add({
        name: data.name || food,
        ...Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, Number(data[key]) || 0])),
        source: 'ai_estimate',
      });
      setQuery('');
    } catch {
      setError('The estimator is unavailable. You can still enter the label values manually.');
    } finally {
      setLoading(false);
    }
  };

  const addManual = async () => {
    const numeric = Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, Number(manual[key]) || 0]));
    if (!manual.name.trim() && !numeric.kcal && !numeric.sodium) return;
    await add({ name: manual.name.trim() || 'Manual entry', ...numeric, source: 'manual' });
    setManual(BLANK_MANUAL);
  };

  const dailyTotals = useMemo(() => buildDailyNutritionTotals(logged), [logged]);
  const selectedTotals = dailyTotals.find((day) => day.date === recordDate)
    || { kcal: 0, protein: 0, carbs: 0, sugar: 0, fibre: 0, fat: 0, satfat: 0, sodium: 0, meals: 0 };
  const selectedEntries = logged.filter((entry) => (entry.recordDate || entry.record_date || '').slice(0, 10) === recordDate);
  const patterns = useMemo(() => buildFoodHealthAssociations(logged, healthLog), [logged, healthLog]);

  const readMealLog = async () => {
    if (!onGenerateAiInsight || mealInsightLoading) return;
    setMealInsightLoading(true);
    setMealInsight(null);
    try {
      const text = await onGenerateAiInsight({
        insightType: 'nutrition',
        targetId: 'meal-log',
        targetTitle: 'Meal log',
        targetContext: {
          userQuestion: 'Read my recent meal log and give the single most useful conclusion about my eating pattern, plus one realistic change.',
          mealLog: buildMealLogSummary(logged, dailyTotals, patterns.associations),
        },
      });
      setMealInsight(text);
    } catch {
      setMealInsight('Could not read your meal log right now. Please try again.');
    } finally {
      setMealInsightLoading(false);
    }
  };

  const stat = (key) => {
    const ref = REF[key];
    const value = selectedTotals[key];
    if (ref.kind === 'goal') return value >= ref.limit ? 'ok' : 'under';
    if (ref.kind === 'limit') return value > ref.limit ? 'over' : 'ok';
    return 'info';
  };

  const numberField = (key, label, unit) => (
    <label className="nl-mfield"><span>{label} <em>({unit})</em></span>
      <input type="number" min="0" value={manual[key]} onChange={(event) => setManual((current) => ({ ...current, [key]: event.target.value }))} />
    </label>
  );

  return (
    <section className="nt-logger">
      <div className="nl-title-row">
        <div><h3>Food log</h3><p className="nt-note-plain">Keep a dated meal history and compare it with your own lifestyle patterns.</p></div>
        <label className="nl-date"><CalendarDays size={15} /><input aria-label="Food log date" type="date" value={recordDate} max={todayKey()} onChange={(event) => setRecordDate(event.target.value)} /></label>
      </div>

      <div className="nl-modes">
        <button type="button" className={mode === 'ai' ? 'on' : ''} onClick={() => setMode('ai')}><Sparkles size={13} /> AI estimate</button>
        <button type="button" className={mode === 'manual' ? 'on' : ''} onClick={() => setMode('manual')}>Manual entry</button>
      </div>

      {mode === 'ai' ? (
        <div className="nl-ai">
          <div className="nl-ai-row">
            <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && estimate()} placeholder="e.g. turkey sandwich and an apple" />
            <button type="button" className="nl-est" onClick={estimate} disabled={loading || !query.trim()}>
              {loading ? <Loader2 size={15} className="nl-spin" /> : <Sparkles size={15} />} Estimate
            </button>
          </div>
          <p className="nl-tiny">AI estimates are approximate. Use Manual for nutrition-label values.</p>
        </div>
      ) : (
        <div className="nl-manual">
          <label className="nl-mfield nl-mfield-wide"><span>Food name</span><input type="text" value={manual.name} onChange={(event) => setManual((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Homemade curry" /></label>
          <div className="nl-mgrid">
            {numberField('kcal', 'Calories', 'kcal')}
            {numberField('protein', 'Protein', 'g')}
            {numberField('carbs', 'Carbs', 'g')}
            {numberField('sodium', 'Sodium', 'mg')}
            {numberField('satfat', 'Saturated fat', 'g')}
            {numberField('sugar', 'Sugar', 'g')}
            {numberField('fibre', 'Fibre', 'g')}
          </div>
          <button type="button" className="nl-est" onClick={addManual}><Plus size={15} /> Add to log</button>
        </div>
      )}

      {error && <p className="nl-error" role="status">{error}</p>}

      {selectedEntries.length ? (
        <ul className="nl-logged">
          {selectedEntries.map((entry) => (
            <li key={entry.id}>
              <span>{entry.source === 'ai_estimate' && <Sparkles size={11} className="nl-ai-tag" />}{entry.name} <em>{Math.round(entry.kcal)} kcal</em></span>
              <button type="button" onClick={() => remove(entry)} aria-label={`Remove ${entry.name}`}><X size={13} /></button>
            </li>
          ))}
        </ul>
      ) : <p className="nl-hint">Nothing logged for this date.</p>}

      {selectedEntries.length > 0 && <>
        <div className="nl-totals">
          {Object.keys(REF).map((key) => (
            <div key={key} className={`nl-tot ${stat(key)}`}>
              <span className="nl-tot-val">{Math.round(selectedTotals[key])}<small>{REF[key].unit}</small></span>
              <span className="nl-tot-lab">{NAMES[key]}</span>
              <span className="nl-tot-ref">{REF[key].kind === 'goal' ? `goal ${REF[key].limit}` : REF[key].kind === 'limit' ? `guide ${REF[key].limit}` : `reference ~${REF[key].limit}`}</span>
            </div>
          ))}
        </div>
        <p className="nl-macros">Protein {Math.round(selectedTotals.protein)} g | Carbs {Math.round(selectedTotals.carbs)} g | Total fat {Math.round(selectedTotals.fat)} g</p>
      </>}

      <MealHistory
        logged={logged}
        aiEnabled={aiEnabled}
        onGenerateAiInsight={onGenerateAiInsight}
        mealInsight={mealInsight}
        mealInsightLoading={mealInsightLoading}
        onReadMealLog={readMealLog}
      />

      <section className="nutrition-patterns" aria-label="Food and health patterns">
        <div className="nutrition-pattern-heading"><TrendingUp size={17} /><div><strong>Food and lifestyle patterns</strong><span>{patterns.pairedDays} matched days</span></div></div>
        {patterns.associations.length ? patterns.associations.map((item) => (
          <article className={`nutrition-pattern-card tone-${item.tone}`} key={item.id}>
            <strong>{item.title}</strong>
            <p>On {item.nutrientLabel} days at or above {item.threshold}{item.nutrientUnit}, your {item.metricLabel} was typically {item.direction} than on other logged days.</p>
            <small>Compared across {item.higherDays + item.lowerDays} days in your log.</small>
          </article>
        )) : <p className="nl-hint">
          {patterns.pairedDays < 7
            ? 'Log meals on at least seven days that also have health data to reveal careful pattern comparisons.'
            : 'There is enough matched data, but no consistent food and lifestyle association stands out yet.'}
        </p>}
        <p className="nl-disclaimer"><Info size={13} /> These are personal associations, not proof that a food caused a health change. Lifestyle support only, not medical advice.</p>
      </section>
    </section>
  );
}

export default NutritionLogger;
