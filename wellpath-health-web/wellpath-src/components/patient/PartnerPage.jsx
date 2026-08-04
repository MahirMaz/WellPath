import React, { useState } from 'react';
import { HeartHandshake, ClipboardList, MessageCircle, ShieldCheck, Plus, CheckCircle2, Trash2 } from 'lucide-react';

export function PartnerPage({ patientData, healthLog, goals, setGoals, onAddGoal, onToggleGoal }) {
  const [newGoal, setNewGoal] = useState('');
  const [goalMessage, setGoalMessage] = useState('');
  const completedWorkouts = healthLog.filter((day) => day.exercise >= 45).length;
  const recoveryReady = patientData.sleep >= 7 && patientData.heartRate <= 74;

  const addGoal = (e) => {
    e.preventDefault();
    const title = newGoal.trim();
    if (!title) return;
    onAddGoal(title);
    setNewGoal('');
    setGoalMessage('Goal added!');
    setTimeout(() => setGoalMessage(''), 3000);
  };

  const deleteGoal = (id) => {
    setGoals(goals.filter((goal) => goal.id !== id));
  };

  return (
    <div className="mobile-flow">
      <section className="partner-hero">
        <div>
          <span>Gym Partner</span>
          <h2>Share support, not pressure.</h2>
          <p>Useful check-ins for a trainer or gym partner while the patient stays in control.</p>
        </div>
        <HeartHandshake size={28} />
      </section>

      <div className="partner-grid">
        <article className="partner-mini-card">
          <strong>{completedWorkouts}/{healthLog.length}</strong>
          <span>active days</span>
        </article>
        <article className="partner-mini-card">
          <strong>{patientData.sleep} hrs</strong>
          <span>sleep last night</span>
        </article>
      </div>

      <section className="support-card partner-card">
        <h3><ClipboardList size={18} /> Today&apos;s partner plan</h3>
        <div className="workout-list">
          <div><strong>{recoveryReady ? 'Strength circuit' : 'Recovery walk'}</strong><span>{recoveryReady ? '30 min' : '20 min'}</span></div>
          <div><strong>Mobility reset</strong><span>8 min</span></div>
          <div><strong>Check-in question</strong><span>Energy level</span></div>
        </div>
      </section>

      <section className="support-card partner-card">
        <h3><MessageCircle size={18} /> Encouragement prompts</h3>
        {['Nice work keeping the week steady.', 'Want to do a short walk together?', 'Let\'s keep recovery easy today.'].map((message) => (
          <button className="message-template" key={message} type="button">{message}</button>
        ))}
      </section>

      <section className="support-card partner-card">
        <h3><ShieldCheck size={18} /> Sharing controls</h3>
        <SourceRow label="Share steps and workouts" status="On" />
        <SourceRow label="Share sleep summary" status="Optional" />
        <SourceRow label="Share clinician data" status="Off" />
        <p>The partner view focuses on motivation and consistency, not diagnosis.</p>
      </section>

      <section className="support-card partner-card">
        <h3>Goals</h3>
        <form className="goal-form" onSubmit={addGoal}>
          <input value={newGoal} onChange={(e) => setNewGoal(e.target.value)} placeholder="Add a new goal..." />
          <button className="secondary-btn"><Plus size={16} /> Add</button>
        </form>
        {goalMessage && <p className="form-feedback" role="status">{goalMessage}</p>}
        <div className="goal-list">
          {goals.map((goal) => (
            <div key={goal.id} className={goal.status === 'Complete' ? 'complete-goal' : ''}>
              <button onClick={() => onToggleGoal(goal.id, goal.status)}><CheckCircle2 size={18} /></button>
              <span>{goal.title}</span>
              <em>{goal.status}</em>
              <button onClick={() => deleteGoal(goal.id)}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SourceRow({ label, status }) {
  return (
    <div className="source-row">
      <span>{label}</span>
      <em>{status}</em>
    </div>
  );
}
