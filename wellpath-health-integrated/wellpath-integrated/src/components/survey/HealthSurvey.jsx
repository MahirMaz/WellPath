import React, { useMemo, useState, useEffect } from 'react';
import { X, ArrowLeft, ArrowRight, Check, HeartPulse, ShieldCheck, Sparkles, RotateCcw } from 'lucide-react';
import { SURVEY_META, SURVEY_STEPS, computeSummary, computeWellnessSnapshot } from './surveyConfig';
import './survey.css';

const EXCLUSIVE = ['None']; // multi-select options that clear the others when picked

function isAnswered(v) {
  if (v === undefined || v === null || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

export default function HealthSurvey({ onExit }) {
  const [phase, setPhase] = useState('welcome'); // welcome | form | review | done
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState({});

  const steps = SURVEY_STEPS;
  const step = steps[stepIndex];

  const visibleQuestions = useMemo(
    () => (step ? step.questions.filter((q) => !q.showIf || q.showIf(answers)) : []),
    [step, answers]
  );

  const requiredMissing = visibleQuestions.filter((q) => q.required && !isAnswered(answers[q.key]));
  const canProceed = requiredMissing.length === 0;
  const consentDeclined = answers.consent_data_use === 'No, thanks';

  useEffect(() => {
    const el = document.querySelector('.hs-body');
    if (el) el.scrollTop = 0;
  }, [phase, stepIndex]);

  const setAnswer = (key, value) => setAnswers((prev) => ({ ...prev, [key]: value }));

  const toggleMulti = (key, option) => {
    setAnswers((prev) => {
      const arr = Array.isArray(prev[key]) ? prev[key] : [];
      const has = arr.includes(option);
      let next;
      if (has) next = arr.filter((o) => o !== option);
      else if (EXCLUSIVE.includes(option)) next = [option];
      else next = [...arr.filter((o) => !EXCLUSIVE.includes(o)), option];
      return { ...prev, [key]: next };
    });
  };

  const goNext = () => {
    if (stepIndex < steps.length - 1) setStepIndex((i) => i + 1);
    else setPhase('review');
  };
  const goBack = () => {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
    else setPhase('welcome');
  };

  const progress = phase === 'form' ? Math.round(((stepIndex) / steps.length) * 100)
    : phase === 'review' ? 96 : phase === 'done' ? 100 : 0;

  const summary = useMemo(() => computeSummary(answers), [answers]);
  const snapshot = useMemo(() => computeWellnessSnapshot(answers, summary), [answers, summary]);

  return (
    <div className="hs-overlay" role="dialog" aria-modal="true" aria-label="WellPath health survey">
      <div className="hs-shell">
        {/* Header */}
        <header className="hs-header">
          <span className="hs-brand"><HeartPulse size={18} /> WellPath Survey</span>
          <button className="hs-icon-btn" onClick={onExit} aria-label="Close survey"><X size={18} /></button>
        </header>
        <div className="hs-progress"><span className="hs-progress-bar" style={{ width: `${progress}%` }} /></div>

        {/* Body */}
        <div className="hs-body">
          {phase === 'welcome' && <Welcome onStart={() => { setPhase('form'); setStepIndex(0); }} />}

          {phase === 'form' && step && (
            <section className="hs-step">
              <div className="hs-step-head">
                <span className="hs-step-count">Step {stepIndex + 1} of {steps.length}</span>
                <h2>{step.title}</h2>
                {step.subtitle && <p>{step.subtitle}</p>}
              </div>

              {visibleQuestions.map((q) => (
                <Question
                  key={q.key}
                  q={q}
                  value={answers[q.key]}
                  onSet={(v) => setAnswer(q.key, v)}
                  onToggle={(opt) => toggleMulti(q.key, opt)}
                />
              ))}

              {step.id === 'consent' && consentDeclined && (
                <p className="hs-decline-note">No problem — you can close this preview any time.</p>
              )}
            </section>
          )}

          {phase === 'review' && (
            <Review
              steps={steps}
              answers={answers}
              onEdit={(i) => { setStepIndex(i); setPhase('form'); }}
            />
          )}

          {phase === 'done' && <Done summary={summary} snapshot={snapshot} answers={answers} onRestart={() => { setAnswers({}); setStepIndex(0); setPhase('welcome'); }} onExit={onExit} />}
        </div>

        {/* Footer */}
        {phase === 'form' && (
          <footer className="hs-footer">
            <button className="hs-btn ghost" onClick={goBack}><ArrowLeft size={16} /> Back</button>
            {step.id === 'consent' && consentDeclined ? (
              <button className="hs-btn primary" onClick={onExit}>Close preview</button>
            ) : (
              <button className="hs-btn primary" onClick={goNext} disabled={!canProceed}>
                {stepIndex === steps.length - 1 ? 'Review' : 'Continue'} <ArrowRight size={16} />
              </button>
            )}
          </footer>
        )}
        {phase === 'review' && (
          <footer className="hs-footer">
            <button className="hs-btn ghost" onClick={() => { setStepIndex(steps.length - 1); setPhase('form'); }}><ArrowLeft size={16} /> Back</button>
            <button className="hs-btn primary" onClick={() => setPhase('done')}><Check size={16} /> Finish</button>
          </footer>
        )}
      </div>
    </div>
  );
}

function Welcome({ onStart }) {
  return (
    <section className="hs-welcome">
      <span className="hs-welcome-ring"><HeartPulse size={30} /></span>
      <h1>{SURVEY_META.title}</h1>
      <p className="hs-welcome-sub">{SURVEY_META.subtitle}</p>
      <ul className="hs-welcome-points">
        <li><Sparkles size={15} /> {SURVEY_META.estMinutes} · {SURVEY_STEPS.length} short sections</li>
        <li><Check size={15} /> {SURVEY_META.requiredNote}</li>
        <li><ShieldCheck size={15} /> Sensitive questions are optional and explained.</li>
      </ul>
      <button className="hs-btn primary hs-btn-wide" onClick={onStart}>Start survey <ArrowRight size={16} /></button>
    </section>
  );
}

function Question({ q, value, onSet, onToggle }) {
  return (
    <div className="hs-q">
      <div className="hs-q-top">
        <label className="hs-q-label">{q.label}</label>
        {q.sensitive && <span className="hs-optional">Optional</span>}
      </div>
      {q.help && <p className="hs-q-help">{q.help}</p>}

      {q.type === 'single' && (
        <div className="hs-chips">
          {q.options.map((opt) => (
            <button key={opt} type="button" className={`hs-chip${value === opt ? ' selected' : ''}`} onClick={() => onSet(value === opt ? undefined : opt)}>{opt}</button>
          ))}
        </div>
      )}

      {q.type === 'multi' && (
        <div className="hs-chips">
          {q.options.map((opt) => {
            const on = Array.isArray(value) && value.includes(opt);
            return <button key={opt} type="button" className={`hs-chip${on ? ' selected' : ''}`} onClick={() => onToggle(opt)}>{on && <Check size={13} />} {opt}</button>;
          })}
        </div>
      )}

      {q.type === 'scale' && (
        <div className="hs-scale">
          <div className="hs-scale-row">
            {Array.from({ length: q.scale.max - q.scale.min + 1 }, (_, i) => q.scale.min + i).map((n) => (
              <button key={n} type="button" className={`hs-scale-btn${value === n ? ' selected' : ''}`} onClick={() => onSet(value === n ? undefined : n)}>{n}</button>
            ))}
          </div>
          <div className="hs-scale-labels"><span>{q.scale.minLabel}</span><span>{q.scale.maxLabel}</span></div>
        </div>
      )}

      {q.type === 'number' && (
        <div className="hs-number-wrap">
          <div className={`hs-number${value === 'unknown' ? ' disabled' : ''}`}>
            <input
              type="number"
              inputMode="decimal"
              min={q.min}
              max={q.max}
              step={q.step || 1}
              value={value === 'unknown' || value === undefined ? '' : value}
              placeholder={q.placeholder || ''}
              disabled={value === 'unknown'}
              onChange={(e) => onSet(e.target.value === '' ? undefined : Number(e.target.value))}
            />
            {q.unit && <span className="hs-unit">{q.unit}</span>}
          </div>
          {q.allowUnknown && (
            <button type="button" className={`hs-chip small${value === 'unknown' ? ' selected' : ''}`} onClick={() => onSet(value === 'unknown' ? undefined : 'unknown')}>Don’t know</button>
          )}
        </div>
      )}

      {q.type === 'text' && (
        <textarea className="hs-textarea" rows={2} maxLength={q.maxLength || 300} placeholder={q.placeholder || ''} value={value || ''} onChange={(e) => onSet(e.target.value || undefined)} />
      )}

      {q.sensitive && q.why && <p className="hs-why">{q.why}</p>}
    </div>
  );
}

function formatAnswer(v) {
  if (v === 'unknown') return 'Don’t know';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

function Review({ steps, answers, onEdit }) {
  return (
    <section className="hs-review">
      <div className="hs-step-head">
        <h2>Review your answers</h2>
        <p>Tap “Edit” on any section to change something.</p>
      </div>
      {steps.map((s, i) => {
        const visible = s.questions.filter((q) => !q.showIf || q.showIf(answers));
        const answered = visible.filter((q) => isAnswered(answers[q.key]));
        if (answered.length === 0) return null;
        return (
          <div key={s.id} className="hs-review-block">
            <div className="hs-review-head">
              <h3>{s.title}</h3>
              <button className="hs-link" onClick={() => onEdit(i)}>Edit</button>
            </div>
            {answered.map((q) => (
              <div key={q.key} className="hs-review-item">
                <span className="hs-review-q">{q.label}</span>
                <span className="hs-review-a">{formatAnswer(answers[q.key])}</span>
              </div>
            ))}
          </div>
        );
      })}
    </section>
  );
}

function Done({ summary, snapshot, answers, onRestart, onExit }) {
  const metrics = [];
  if (summary.bmi) metrics.push({ label: 'BMI', value: summary.bmi });
  if (summary.dietScore != null) metrics.push({ label: 'Diet score', value: `${summary.dietScore}/10` });
  if (summary.steps) metrics.push({ label: 'Est. daily steps', value: summary.steps.toLocaleString() });
  if (answers.primary_focus) metrics.push({ label: 'Focus', value: answers.primary_focus });

  return (
    <section className="hs-done">
      <span className="hs-welcome-ring"><Check size={30} /></span>
      <h1>All done — thank you!</h1>
      <p className="hs-welcome-sub">Here’s your illustrative snapshot. In the full app this saves to the WellPath dataset for analysis.</p>

      <div className="hs-score-card">
        <div className="hs-score-ring" style={{ '--score': `${snapshot.score}%` }}>
          <strong>{snapshot.score}</strong><small>/ 100</small>
        </div>
        <div className="hs-score-factors">
          <p className="hs-score-title">Wellness snapshot <span>(demo)</span></p>
          {snapshot.factors.length === 0 && <span className="hs-factor muted">Answer more questions for a fuller picture.</span>}
          {snapshot.factors.map((f, i) => (
            <span key={i} className={`hs-factor ${f.delta >= 0 ? 'pos' : 'neg'}`}>{f.delta >= 0 ? '▲' : '▼'} {f.label}</span>
          ))}
        </div>
      </div>

      {metrics.length > 0 && (
        <div className="hs-metric-grid">
          {metrics.map((m) => (
            <div key={m.label} className="hs-metric"><span className="hs-metric-val">{m.value}</span><span className="hs-metric-label">{m.label}</span></div>
          ))}
        </div>
      )}

      <div className="hs-done-actions">
        <button className="hs-btn ghost" onClick={onRestart}><RotateCcw size={16} /> Start over</button>
        <button className="hs-btn primary" onClick={onExit}>Close</button>
      </div>
    </section>
  );
}
