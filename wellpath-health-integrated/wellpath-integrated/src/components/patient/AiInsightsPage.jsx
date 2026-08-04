import React from 'react';
import { Sparkles, MessageSquare } from 'lucide-react';

export function AiInsightsPage({ metrics, aiEnabled, setAiEnabled, aiAnswer, onAskAi }) {
  const priority = metrics.find((metric) => metric.id === 'sleep') || metrics[0];
  const recovery = metrics.find((metric) => metric.id === 'recovery') || metrics[0];

  // Check if AI is thinking (loading state)
  const isLoading = aiAnswer?.text?.includes('Analyzing your health data');

  return (
    <div className="mobile-flow">
      <section className="ai-brief-card">
        <h3>Quick Insights</h3>
        <p>Click a prompt below to get AI-powered recommendations based on your health data.</p>
        <AiPromptChips metric={priority} aiEnabled={aiEnabled} onAskAi={onAskAi} />
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
          {aiAnswer.disclaimer && (
            <div className="ai-disclaimer">
              <span>⚠️</span> {aiAnswer.disclaimer}
            </div>
          )}
        </section>
      ) : (
        <section className="ai-empty-state">
          <MessageSquare size={20} />
          <strong>Ask the AI about your health data</strong>
          <p>Choose a prompt above to get personalized lifestyle recommendations based on your health metrics.</p>
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
