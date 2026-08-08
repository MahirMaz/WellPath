import React, { useMemo, useState } from 'react';
import { Sparkles, MessageSquare, TrendingUp, TrendingDown, Minus, ShieldCheck, EyeOff } from 'lucide-react';

// Metrics we project forward. dir 'high' = rising is good, 'low' = falling is good.
const FORECAST_METRICS = [
  { key: 'sleep', label: 'Sleep', unit: 'hrs', dir: 'high', digits: 1 },
  { key: 'steps', label: 'Steps', unit: '', dir: 'high', digits: 0 },
  { key: 'activeMinutes', label: 'Active minutes', unit: 'min', dir: 'high', digits: 0 },
  { key: 'sedentaryHours', label: 'Sitting time', unit: 'hrs', dir: 'low', digits: 1 },
  { key: 'hr', label: 'Resting HR', unit: 'bpm', dir: 'low', digits: 0 },
  { key: 'systolicBp', label: 'Systolic BP', unit: 'mmHg', dir: 'low', digits: 0 },
];

// Least-squares trend over the 30-day history, projected 7 days ahead.
function buildProjections(healthLog) {
  const projections = [];
  for (const metric of FORECAST_METRICS) {
    const values = healthLog
      .map((d) => Number(d[metric.key]))
      .filter((v) => Number.isFinite(v));
    if (values.length < 10) continue;

    const n = values.length;
    const meanX = (n - 1) / 2;
    const meanY = values.reduce((s, v) => s + v, 0) / n;
    let num = 0; let den = 0;
    values.forEach((y, x) => { num += (x - meanX) * (y - meanY); den += (x - meanX) ** 2; });
    const slope = den ? num / den : 0;

    const last7 = values.slice(-7);
    const currentAvg = last7.reduce((s, v) => s + v, 0) / last7.length;
    // Projected average across the next 7 days on the fitted line.
    const projectedAvg = meanY + slope * (n + 3 - meanX);
    const change = projectedAvg - currentAvg;
    const relChange = currentAvg ? Math.abs(change / currentAvg) : 0;
    const direction = relChange < 0.015 ? 'flat' : change > 0 ? 'up' : 'down';
    const tone = direction === 'flat' ? 'neutral'
      : (metric.dir === 'high') === (change > 0) ? 'good' : 'bad';

    projections.push({
      ...metric,
      currentAvg,
      projectedAvg,
      change,
      direction,
      tone,
      notable: relChange >= 0.015,
    });
  }
  // Most-changing first so the interesting ones lead.
  return projections.sort((a, b) => Math.abs(b.change / (b.currentAvg || 1)) - Math.abs(a.change / (a.currentAvg || 1)));
}
const fmtVal = (v, digits) => (digits ? Number(v).toFixed(digits) : Math.round(v).toLocaleString());

export function AiInsightsPage({ metrics, aiEnabled, setAiEnabled, aiAnswer, onAskAi, healthLog = [], onGenerateAiInsight }) {
  const priority = metrics.find((metric) => metric.id === 'sleep') || metrics[0];
  const recovery = metrics.find((metric) => metric.id === 'recovery') || metrics[0];
  const [forecast, setForecast] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [preferenceStatus, setPreferenceStatus] = useState('');

  const projections = useMemo(() => buildProjections(healthLog), [healthLog]);
  const shown = projections.slice(0, 4);

  const isLoading = aiAnswer?.status === 'loading';

  const toggleAi = async (enabled) => {
    setPreferenceStatus('Saving preference...');
    try {
      await setAiEnabled(enabled);
      setPreferenceStatus(`AI Insights turned ${enabled ? 'on' : 'off'}.`);
    } catch (error) {
      setPreferenceStatus(error.message || 'The AI preference could not be saved.');
    }
  };

  const generateForecast = async () => {
    if (!aiEnabled || !onGenerateAiInsight || forecastLoading) return;
    setForecastLoading(true);
    setForecast(null);
    try {
      const text = await onGenerateAiInsight({
        insightType: 'prediction',
        targetId: 'forecast',
        targetTitle: 'Next-week forecast',
        targetContext: {
          horizonDays: 7,
          projections: projections.map((p) => ({
            metric: p.label,
            currentWeeklyAvg: Number(fmtVal(p.currentAvg, p.digits).replace(/,/g, '')),
            projectedWeeklyAvg: Number(fmtVal(p.projectedAvg, p.digits).replace(/,/g, '')),
            direction: p.direction,
            assessment: p.tone,
          })),
        },
      });
      setForecast(text);
    } catch (error) {
      setForecast("I'm having trouble generating a forecast right now. Please try again later.");
    } finally {
      setForecastLoading(false);
    }
  };

  return (
    <div className="mobile-flow">
      <div className="mobile-section-title ai-page-heading">
        <div>
          <span>Optional explanations</span>
          <h2>AI Insights</h2>
        </div>
        <button
          type="button"
          className={aiEnabled ? 'toggle-pill on' : 'toggle-pill'}
          onClick={() => toggleAi(!aiEnabled)}
          aria-pressed={aiEnabled}
        >
          {aiEnabled ? <Sparkles size={15} /> : <EyeOff size={15} />}
          {aiEnabled ? 'AI on' : 'AI off'}
        </button>
      </div>

      {preferenceStatus && <p className="form-feedback" role="status">{preferenceStatus}</p>}

      <div className="ai-safety-notice">
        <ShieldCheck size={17} />
        <p>AI Insights explain lifestyle patterns only. They may be incomplete or incorrect and are not a diagnosis, treatment plan, or substitute for a healthcare professional.</p>
      </div>

      <section className="ai-brief-card">
        <h3>Quick Insights</h3>
        <p>Choose a prompt for a plain-language explanation of your recent data.</p>
        <AiPromptChips metric={priority} aiEnabled={aiEnabled} onAskAi={onAskAi} />
      </section>

      <section className="ai-brief-card">
        <h3>Predictive analysis</h3>
        <p>A simple next-week estimate based on recent patterns. It cannot predict health outcomes.</p>
        {shown.length ? (
          <div className="forecast-grid">
            {shown.map((p) => {
              const Icon = p.direction === 'flat' ? Minus : p.direction === 'up' ? TrendingUp : TrendingDown;
              return (
                <div className={`forecast-card tone-${p.tone}`} key={p.key}>
                  <span className="forecast-label">{p.label}</span>
                  <strong>
                    {fmtVal(p.currentAvg, p.digits)} <Icon size={13} /> {fmtVal(p.projectedAvg, p.digits)}{p.unit ? ` ${p.unit}` : ''}
                  </strong>
                  <small>{p.direction === 'flat' ? 'holding steady' : 'next-week estimate'}</small>
                </div>
              );
            })}
          </div>
        ) : (
          <p>Not enough history yet to project trends.</p>
        )}

        {forecast ? (
          <div className="forecast-ai-text"><Sparkles size={14} /><p>{forecast}</p></div>
        ) : forecastLoading ? (
          <div className="forecast-ai-text"><Sparkles size={14} /><p className="ai-loading-text">Projecting your patterns forward...</p></div>
        ) : null}
        {aiEnabled && !forecastLoading && projections.length > 0 && (
          <button type="button" className="mood-ai-btn" onClick={generateForecast}>
            {forecast ? 'Regenerate forecast' : 'Generate AI forecast'}
          </button>
        )}
      </section>

      <section className="ai-brief-card">
        <h3>More Questions</h3>
        <AiPromptChips metric={recovery} aiEnabled={aiEnabled} onAskAi={onAskAi} />
      </section>

      {aiEnabled && aiAnswer ? (
        <section className={`ai-answer-panel featured ${isLoading ? 'loading' : ''}`}>
          <div className="ai-answer-header">
            <span>{aiAnswer.metric}</span>
            <h3>{aiAnswer.prompt}</h3>
          </div>
          <div className="ai-answer-content">
            <p>{aiAnswer.text}</p>
          </div>
          <div className="ai-disclaimer">
            <ShieldCheck size={16} /> {aiAnswer.disclaimer || 'Lifestyle guidance only. Not a medical diagnosis or medical advice.'}
          </div>
        </section>
      ) : (
        <section className="ai-empty-state">
          <MessageSquare size={20} />
          <strong>{aiEnabled ? 'Ask about your health data' : 'AI Insights are off'}</strong>
          <p>{aiEnabled ? 'Choose a prompt above to get a lifestyle-focused explanation.' : 'Your health summary still works without AI. Turn it on only when you want generated explanations.'}</p>
          {!aiEnabled && <button type="button" className="secondary-btn" onClick={() => toggleAi(true)}>Turn on AI Insights</button>}
        </section>
      )}
    </div>
  );
}

// ===== Sub-components for AiInsightsPage =====
function AiPromptChips({ metric, aiEnabled, onAskAi, compact = false }) {
  return (
    <div className={compact ? 'ai-prompt-row compact' : 'ai-prompt-row'}>
      {metric.prompts.map((prompt) => (
        <button
          key={prompt.id}
          className="ai-prompt-chip"
          disabled={!aiEnabled}
          onClick={() => onAskAi(metric, prompt)}
          type="button"
        >
          <Sparkles size={13} />
          {prompt.label}
        </button>
      ))}
    </div>
  );
}
