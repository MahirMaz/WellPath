import React from 'react';
import { Utensils, Gauge, ArrowRight } from 'lucide-react';
import { useHealthProfile } from '../shared/profileContext.jsx';
import { NutritionLogger } from './NutritionLogger.jsx';
import { AiInsightBox } from '../patient/AiInsightBox.jsx';
import './nutrition.css';

export function NutritionTab({ patientId, aiEnabled = true, onGenerateAiInsight, onGoToRisk }) {
  const { profile: v, set } = useHealthProfile();

  const num = (k, label, help) => (
    <label className="nt-field">
      <span>{label}</span>
      <input type="number" min="0" max="21" value={v[k]} onChange={(e) => set(k, e.target.value === '' ? '' : Number(e.target.value))} />
      {help && <em>{help}</em>}
    </label>
  );

  return (
    <div className="nt-wrap">
      <header className="nt-head">
        <span className="nt-head-icon"><Utensils size={20} /></span>
        <div><h2>Nutrition</h2><p>Log what you eat, estimate the nutrients, and check them against dietary guidelines.</p></div>
      </header>

      {/* ---- food logger: AI estimate or manual entry -> nutrient totals -> guideline checks ---- */}
      <NutritionLogger />

      {/* ---- habits that feed the Risk Signal ---- */}
      <section className="nt-inputs">
        <h3>Your eating habits</h3>
        <p className="nt-note"><Gauge size={13} /> These feed directly into your <strong>Risk Signals</strong> — change them and the risk bands update.</p>
        <div className="nt-grid">
          {num('fast_food', 'Fast-food / restaurant meals', 'in the last 7 days')}
          {num('meals_not_home', 'Meals not home-cooked', 'in the last 7 days')}
        </div>
        {onGoToRisk && (
          <button type="button" className="nt-link" onClick={onGoToRisk}>View Risk Signals <ArrowRight size={14} /></button>
        )}
      </section>

      {aiEnabled && onGenerateAiInsight && (
        <AiInsightBox
          title="Ask about your nutrition"
          aiEnabled={aiEnabled}
          patientId={patientId}
          presets={[
            { label: 'Is my diet balanced?', question: 'Based on my eating habits, does my diet look balanced, and what could I improve?' },
            { label: 'Eat a bit healthier', question: 'What is one realistic change to eat a little healthier this week?' },
            { label: 'Cut back on fast food', question: 'I eat fast food fairly often; how could I cut back without it feeling like a big change?' },
          ]}
          onAsk={(question) => onGenerateAiInsight({
            insightType: 'nutrition',
            targetId: 'nutrition',
            targetTitle: 'Nutrition',
            targetContext: {
              userQuestion: question,
              fastFoodPerWeek: v.fast_food,
              mealsNotHomePerWeek: v.meals_not_home,
            },
          })}
        />
      )}
    </div>
  );
}

export default NutritionTab;
