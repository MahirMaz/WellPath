import React, { useMemo, useState } from 'react';
import { EyeOff, MessageSquare, Minus, ShieldCheck, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { buildRecentComparisons, formatTrendValue } from '../../utils/trendPatterns.js';

export function AiInsightsPage({ metrics, aiEnabled, setAiEnabled, aiAnswer, onAskAi, healthLog = [], onGenerateAiInsight }) {
  const priority = metrics.find((metric) => metric.id === 'sleep') || metrics[0];
  const recovery = metrics.find((metric) => metric.id === 'recovery') || metrics[0];
  const [patternInsight, setPatternInsight] = useState(null);
  const [patternLoading, setPatternLoading] = useState(false);
  const [preferenceStatus, setPreferenceStatus] = useState('');
  const comparisons = useMemo(() => buildRecentComparisons(healthLog), [healthLog]);
  const shown = comparisons.slice(0, 4);
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
          userQuestion: 'Which recent lifestyle pattern is most useful to notice, and what is one small next step?',
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
      setPatternInsight('The explanation is unavailable right now. Your recent comparisons are still shown below.');
    } finally {
      setPatternLoading(false);
    }
  };

  return (
    <div className="mobile-flow">
      <div className="mobile-section-title ai-page-heading">
        <div><span>Optional explanations</span><h2>AI Insights</h2></div>
        <button type="button" className={aiEnabled ? 'toggle-pill on' : 'toggle-pill'} onClick={() => toggleAi(!aiEnabled)} aria-pressed={aiEnabled}>
          {aiEnabled ? <Sparkles size={15} /> : <EyeOff size={15} />}
          {aiEnabled ? 'AI on' : 'AI off'}
        </button>
      </div>

      {preferenceStatus && <p className="form-feedback" role="status">{preferenceStatus}</p>}

      <div className="ai-safety-notice">
        <ShieldCheck size={17} />
        <p>AI Insights explain lifestyle patterns only. They may be incomplete or incorrect and are not a diagnosis, treatment plan, or substitute for a healthcare professional.</p>
      </div>

      {priority && <section className="ai-brief-card">
        <h3>Quick questions</h3>
        <p>Choose a question for a short, plain-language look at your recent habits.</p>
        <AiPromptChips metric={priority} aiEnabled={aiEnabled} onAskAi={onAskAi} />
      </section>}

      <section className="ai-brief-card">
        <h3>Pattern snapshot</h3>
        <p>Your latest seven days compared with the seven days before them. This describes history; it does not predict what happens next.</p>
        {shown.length ? (
          <div className="forecast-grid">
            {shown.map((item) => {
              const Icon = item.direction === 'flat' ? Minus : item.direction === 'up' ? TrendingUp : TrendingDown;
              return (
                <div className={`forecast-card tone-${item.tone}`} key={item.key}>
                  <span className="forecast-label">{item.label}</span>
                  <strong>
                    {formatTrendValue(item.previousAverage, item.digits)} <Icon size={13} /> {formatTrendValue(item.recentAverage, item.digits)}{item.unit ? ` ${item.unit}` : ''}
                  </strong>
                  <small>{item.direction === 'flat' ? 'about the same' : `${item.direction} from the prior week`}</small>
                </div>
              );
            })}
          </div>
        ) : <p>Keep using WellPath to unlock a two-week pattern comparison.</p>}

        {patternInsight ? <div className="forecast-ai-text"><Sparkles size={14} /><p>{patternInsight}</p></div>
          : patternLoading ? <div className="forecast-ai-text"><Sparkles size={14} /><p className="ai-loading-text">Reading your recent pattern...</p></div>
            : null}
        {aiEnabled && !patternLoading && comparisons.length > 0 && (
          <button type="button" className="mood-ai-btn" onClick={explainPatterns}>{patternInsight ? 'Refresh explanation' : 'Explain these patterns'}</button>
        )}
      </section>

      {recovery && <section className="ai-brief-card">
        <h3>Recovery questions</h3>
        <AiPromptChips metric={recovery} aiEnabled={aiEnabled} onAskAi={onAskAi} />
      </section>}

      {aiEnabled && aiAnswer ? (
        <section className={`ai-answer-panel featured ${isLoading ? 'loading' : ''}`}>
          <div className="ai-answer-header"><span>{aiAnswer.metric}</span><h3>{aiAnswer.prompt}</h3></div>
          <div className="ai-answer-content"><p>{aiAnswer.text}</p></div>
          <div className="ai-disclaimer"><ShieldCheck size={16} /> {aiAnswer.disclaimer || 'Lifestyle guidance only. Not a medical diagnosis or medical advice.'}</div>
        </section>
      ) : (
        <section className="ai-empty-state">
          <MessageSquare size={20} />
          <strong>{aiEnabled ? 'Ask about your recent habits' : 'AI Insights are off'}</strong>
          <p>{aiEnabled ? 'Choose a question above for a lifestyle-focused explanation.' : 'All non-AI summaries keep working. Turn AI on only when you want generated explanations.'}</p>
          {!aiEnabled && <button type="button" className="secondary-btn" onClick={() => toggleAi(true)}>Turn on AI Insights</button>}
        </section>
      )}
    </div>
  );
}

function AiPromptChips({ metric, aiEnabled, onAskAi }) {
  return (
    <div className="ai-prompt-row">
      {metric.prompts.map((prompt) => (
        <button key={prompt.id} className="ai-prompt-chip" disabled={!aiEnabled} onClick={() => onAskAi(metric, prompt)} type="button">
          <Sparkles size={13} /> {prompt.label}
        </button>
      ))}
    </div>
  );
}
