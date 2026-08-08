import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Info, Loader2, Plus, Sparkles, TrendingUp, X } from 'lucide-react';
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

export function NutritionLogger({ patientId, healthLog = [] }) {
  const [mode, setMode] = useState('ai');
  const [recordDate, setRecordDate] = useState(todayKey);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [manual, setManual] = useState(BLANK_MANUAL);
  const [logged, setLogged] = useState(() => loadLocalEntries(patientId));

  useEffect(() => {
    let cancelled = false;
    api.getNutritionLogs(patientId, 45)
      .then((entries) => {
        if (!cancelled && Array.isArray(entries)) setLogged(entries);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [patientId]);

  useEffect(() => {
    saveLocalEntries(patientId, logged);
  }, [logged, patientId]);

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
