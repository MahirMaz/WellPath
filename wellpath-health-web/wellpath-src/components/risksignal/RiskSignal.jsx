import React, { useMemo, useState } from 'react';
import { Gauge, ShieldAlert, ArrowUp, ArrowDown, RotateCcw, Info, Utensils, Pencil, Check } from 'lucide-react';
import { modelSet, computeCondition } from './riskModel.js';
import { useHealthProfile } from '../shared/profileContext.jsx';
import './risksignal.css';

const BANDS = {
  lower:   { label: 'Lower-than-typical', cls: 'lower' },
  typical: { label: 'Typical',            cls: 'typical' },
  higher:  { label: 'Higher-than-typical', cls: 'higher' },
};
const CONF = {
  moderate: { label: 'moderate confidence', cls: 'ok' },
  limited:  { label: 'limited confidence', cls: 'mid' },
  low:      { label: 'low confidence — needs a lab test', cls: 'low' },
};

function ConditionCard({ cond, inputs }) {
  const { band, drivers, confidence, prob } = useMemo(() => computeCondition(cond, inputs), [cond, inputs]);
  const b = BANDS[band]; const cf = CONF[confidence];
  const markerPct = Math.max(3, Math.min(97, prob * 100));
  return (
    <div className={`rs-card ${b.cls}`}>
      <div className="rs-card-head">
        <div>
          <span className="rs-card-cond">{cond.label}</span>
          <span className={`rs-conf ${cf.cls}`}>{cf.label}</span>
        </div>
        <strong className="rs-card-band">{b.label}</strong>
      </div>
      <div className="rs-meter">
        <span className="seg lower" /><span className="seg typical" /><span className="seg higher" />
        <span className="rs-marker" style={{ left: `${markerPct}%` }} />
      </div>
      <div className="rs-meter-labels"><span>Lower</span><span>Typical</span><span>Higher</span></div>
      <p className="rs-card-outcome">pattern for <strong>{cond.outcome}</strong></p>
      {confidence === 'low' ? (
        <p className="rs-card-lowconf"><Info size={13} /> Your everyday inputs don't reliably indicate this — only a blood test can. {cond.facts[0]}</p>
      ) : (
        drivers.length > 0 && (
          <div className="rs-card-drivers">
            {drivers.slice(0, 3).map((d) => (
              <span key={d.key} className={`rs-chip ${d.value >= 0 ? 'up' : 'down'}`}>
                {d.value >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />} {d.label}
              </span>
            ))}
          </div>
        )
      )}
      <p className="rs-card-fact">{cond.facts[confidence === 'low' ? 1 : 0]}</p>
    </div>
  );
}

export function RiskSignal() {
  const { profile: v, set, reset } = useHealthProfile();
  const [locked, setLocked] = useState(true);
  const bmi = useMemo(() => {
    const m = Number(v.heightCm) / 100;
    return m > 0 ? Number(v.weightKg) / (m * m) : NaN;
  }, [v.heightCm, v.weightKg]);
  const inputs = useMemo(() => ({ ...v, bmi }), [v, bmi]);

  const num = (k, label, unit, step = 1) => (
    <label className="rs-field"><span>{label}{unit ? <em> ({unit})</em> : null}</span>
      <input type="number" step={step} value={v[k]} onChange={(e) => set(k, e.target.value === '' ? '' : Number(e.target.value))} /></label>
  );
  const seg = (k, label, options) => (
    <label className="rs-field"><span>{label}</span>
      <div className="rs-seg">{options.map(([val, lbl]) => (
        <button key={String(val)} type="button" className={v[k] === val ? 'on' : ''} onClick={() => set(k, val)}>{lbl}</button>
      ))}</div></label>
  );

  return (
    <div className="rs-wrap">
      <header className="rs-head">
        <span className="rs-head-icon"><Gauge size={20} /></span>
        <div><h2>Risk Signals</h2><p>Research demo — your inputs vs patterns in real data, across several conditions.</p></div>
      </header>

      <div className="rs-disclaimer">
        <ShieldAlert size={16} />
        <span><strong>Not a diagnosis or medical advice.</strong> These compare your inputs to patterns in a research dataset (NHANES). They cannot tell you whether you have any condition — only a clinician and lab tests can. Use them to decide whether to ask about screening.</span>
      </div>

      <section className="rs-panel">
        {Object.entries(modelSet.conditions).map(([key, cond]) => (
          <ConditionCard key={key} cond={cond} inputs={inputs} />
        ))}
      </section>

      <div className="rs-nutri-note">
        <Utensils size={14} />
        <span>Your <strong>fast-food ({v.fast_food}/wk)</strong> and <strong>meals-out ({v.meals_not_home}/wk)</strong> are factored into these bands — edit them in the <strong>Nutrition</strong> tab.</span>
      </div>

      <section className="rs-inputs">
        <div className="rs-inputs-head">
          <h3>Profile stats</h3>
          {locked ? (
            <button type="button" className="rs-reset" onClick={() => setLocked(false)}><Pencil size={13} /> Edit</button>
          ) : (
            <div className="rs-edit-actions">
              <button type="button" className="rs-reset" onClick={reset}><RotateCcw size={13} /> Reset</button>
              <button type="button" className="rs-submit" onClick={() => setLocked(true)}><Check size={14} /> Submit</button>
            </div>
          )}
        </div>

        {locked ? (
          <div className="rs-stats-view">
            {[
              ['Age', `${v.age} yrs`],
              ['Sex at birth', v.sex_female ? 'Female' : 'Male'],
              ['Height', `${v.heightCm} cm`],
              ['Weight', `${v.weightKg} kg`],
              ['BMI', Number.isFinite(bmi) ? bmi.toFixed(1) : '—'],
              ['Resting heart rate', `${v.resting_hr} bpm`],
              ['Sleep', `${v.sleep_hours} hrs`],
              ['Smoking', ['Never', 'Former', 'Current'][v.smoker_ord] || '—'],
              ['Family history of diabetes', v.fh_diabetes ? 'Yes' : 'No'],
              ['Vigorous activity', v.vigorous_activity ? 'Yes' : 'No'],
              ['Moderate activity', v.moderate_activity ? 'Yes' : 'No'],
            ].map(([label, val]) => (
              <div className="rs-stat" key={label}><span>{label}</span><strong>{val}</strong></div>
            ))}
          </div>
        ) : (
          <>
            <div className="rs-grid">
              {num('age', 'Age', 'years')}
              {seg('sex_female', 'Sex at birth', [[1, 'Female'], [0, 'Male']])}
              {num('heightCm', 'Height', 'cm')}
              {num('weightKg', 'Weight', 'kg')}
              {num('resting_hr', 'Resting heart rate', 'bpm')}
              {num('sleep_hours', 'Sleep', 'hrs', 0.5)}
              {seg('smoker_ord', 'Smoking', [[0, 'Never'], [1, 'Former'], [2, 'Current']])}
              {seg('fh_diabetes', 'Family history of diabetes', [[1, 'Yes'], [0, 'No']])}
              {seg('vigorous_activity', 'Vigorous activity', [[1, 'Yes'], [0, 'No']])}
              {seg('moderate_activity', 'Moderate activity', [[1, 'Yes'], [0, 'No']])}
            </div>
            <p className="rs-bmi">Computed BMI: <strong>{Number.isFinite(bmi) ? bmi.toFixed(1) : '—'}</strong> · edit anything, then Submit to lock your profile.</p>
          </>
        )}
      </section>

      <p className="rs-footer">
        Models: logistic regression per condition on {modelSet.source} Cross-validated AUC —
        {Object.values(modelSet.conditions).map((c) => ` ${c.label} ${c.cv_auc}`).join(' ·')}. Research prototype — not clinically validated.
      </p>
    </div>
  );
}

export default RiskSignal;
