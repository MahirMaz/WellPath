import React, { useState, useMemo } from 'react';
import { Sparkles, Plus, X, Info, Loader2 } from 'lucide-react';

// Evidence-based daily reference points (US Dietary Guidelines / FDA) — the
// nutrients that matter most for cardiometabolic risk.
const REF = {
  kcal:   { limit: 2000, unit: 'kcal', kind: 'info' },
  sodium: { limit: 2300, unit: 'mg',  kind: 'limit' },
  satfat: { limit: 22,   unit: 'g',   kind: 'limit' },
  sugar:  { limit: 50,   unit: 'g',   kind: 'limit' },
  fibre:  { limit: 28,   unit: 'g',   kind: 'goal' },
};
const NAMES = { kcal: 'Calories', sodium: 'Sodium', satfat: 'Saturated fat', sugar: 'Sugar', fibre: 'Fibre' };
const BLANK_MANUAL = { name: '', kcal: '', sodium: '', satfat: '', sugar: '', fibre: '' };

export function NutritionLogger() {
  const [mode, setMode] = useState('ai');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [manual, setManual] = useState(BLANK_MANUAL);
  const [logged, setLogged] = useState([]);

  const add = (item) => setLogged((l) => [...l, item]);
  const remove = (i) => setLogged((l) => l.filter((_, idx) => idx !== i));

  const estimate = async () => {
    const food = query.trim();
    if (!food || loading) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/ai/nutrition-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('authToken')}` },
        body: JSON.stringify({ food }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not estimate that food.'); return; }
      add({ name: data.name || food, kcal: data.kcal, protein: data.protein, carbs: data.carbs, sugar: data.sugar, fibre: data.fibre, fat: data.fat, satfat: data.satfat, sodium: data.sodium, ai: true });
      setQuery('');
    } catch {
      setError('Could not reach the estimator. Check your connection or enter values manually.');
    } finally {
      setLoading(false);
    }
  };

  const addManual = () => {
    const n = (k) => Number(manual[k]) || 0;
    if (!manual.name.trim() && !n('kcal') && !n('sodium')) return;
    add({ name: manual.name.trim() || 'Manual entry', kcal: n('kcal'), protein: 0, carbs: 0, sugar: n('sugar'), fibre: n('fibre'), fat: 0, satfat: n('satfat'), sodium: n('sodium'), ai: false });
    setManual(BLANK_MANUAL);
  };

  const totals = useMemo(() => {
    const t = { kcal: 0, protein: 0, carbs: 0, sugar: 0, fibre: 0, fat: 0, satfat: 0, sodium: 0 };
    for (const f of logged) for (const k of Object.keys(t)) t[k] += Number(f[k]) || 0;
    return t;
  }, [logged]);

  const stat = (nk) => {
    const ref = REF[nk]; const v = totals[nk];
    if (ref.kind === 'goal') return v >= ref.limit ? 'ok' : 'under';
    if (ref.kind === 'limit') return v > ref.limit ? 'over' : 'ok';
    return 'info';
  };

  const mnum = (k, label, unit) => (
    <label className="nl-mfield"><span>{label} <em>({unit})</em></span>
      <input type="number" min="0" value={manual[k]} onChange={(e) => setManual((m) => ({ ...m, [k]: e.target.value }))} /></label>
  );

  return (
    <section className="nt-logger">
      <h3>Food logger</h3>
      <p className="nt-note-plain">Estimate any food with AI, or enter the key nutrients yourself. Totals are checked against dietary guidelines.</p>

      <div className="nl-modes">
        <button type="button" className={mode === 'ai' ? 'on' : ''} onClick={() => setMode('ai')}><Sparkles size={13} /> AI estimate</button>
        <button type="button" className={mode === 'manual' ? 'on' : ''} onClick={() => setMode('manual')}>Manual entry</button>
      </div>

      {mode === 'ai' ? (
        <div className="nl-ai">
          <div className="nl-ai-row">
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && estimate()}
              placeholder="e.g. 2 slices of pepperoni pizza and a coke" />
            <button type="button" className="nl-est" onClick={estimate} disabled={loading || !query.trim()}>
              {loading ? <Loader2 size={15} className="nl-spin" /> : <Sparkles size={15} />} Estimate
            </button>
          </div>
          {error && <p className="nl-error">{error}</p>}
          <p className="nl-tiny">AI estimates are approximate — switch to Manual for exact label values.</p>
        </div>
      ) : (
        <div className="nl-manual">
          <label className="nl-mfield nl-mfield-wide"><span>Food name</span>
            <input type="text" value={manual.name} onChange={(e) => setManual((m) => ({ ...m, name: e.target.value }))} placeholder="e.g. Homemade curry" /></label>
          <div className="nl-mgrid">
            {mnum('kcal', 'Calories', 'kcal')}
            {mnum('sodium', 'Sodium', 'mg')}
            {mnum('satfat', 'Saturated fat', 'g')}
            {mnum('sugar', 'Sugar', 'g')}
            {mnum('fibre', 'Fibre', 'g')}
          </div>
          <button type="button" className="nl-est" onClick={addManual}><Plus size={15} /> Add to log</button>
        </div>
      )}

      {logged.length > 0 ? (
        <ul className="nl-logged">
          {logged.map((f, i) => (
            <li key={i}>
              <span>{f.ai && <Sparkles size={11} className="nl-ai-tag" />}{f.name} <em>{Math.round(f.kcal)} kcal</em></span>
              <button type="button" onClick={() => remove(i)} aria-label="Remove"><X size={13} /></button>
            </li>
          ))}
        </ul>
      ) : <p className="nl-hint">Nothing logged yet.</p>}

      {logged.length > 0 && (
        <>
          <div className="nl-totals">
            {['kcal', 'sodium', 'satfat', 'sugar', 'fibre'].map((nk) => (
              <div key={nk} className={`nl-tot ${stat(nk)}`}>
                <span className="nl-tot-val">{Math.round(totals[nk])}<small>{REF[nk].unit}</small></span>
                <span className="nl-tot-lab">{NAMES[nk]}</span>
                <span className="nl-tot-ref">
                  {REF[nk].kind === 'goal' ? (stat(nk) === 'ok' ? 'goal met' : `goal ${REF[nk].limit}`)
                    : REF[nk].kind === 'limit' ? (stat(nk) === 'over' ? `over ${REF[nk].limit}` : `within ${REF[nk].limit}`)
                    : `of ~${REF[nk].limit}`}
                </span>
              </div>
            ))}
          </div>
          <p className="nl-macros">Also today: protein {Math.round(totals.protein)} g · carbs {Math.round(totals.carbs)} g · total fat {Math.round(totals.fat)} g</p>
          <p className="nl-disclaimer"><Info size={13} /> General nutrition guidance vs dietary guidelines — not a diagnosis or medical advice.</p>
        </>
      )}
    </section>
  );
}

export default NutritionLogger;
