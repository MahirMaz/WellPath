import React, { useEffect, useState } from 'react';
import {
  BarChart3, CheckCircle2, ClipboardList, HeartHandshake, MessageCircle, Plus, ShieldCheck, Trash2,
} from 'lucide-react';

const defaultSharing = {
  activity: false,
  sleep: false,
  clinician: false,
};

function readSharingPreferences() {
  try {
    const saved = localStorage.getItem('wellpath-partner-sharing');
    return saved ? { ...defaultSharing, ...JSON.parse(saved) } : defaultSharing;
  } catch {
    return defaultSharing;
  }
}
export function PartnerPage({ patientData, healthLog, goals, onAddGoal, onToggleGoal, onDeleteGoal, onSubmitFeedback }) {
  const [newGoal, setNewGoal] = useState('');
  const [goalMessage, setGoalMessage] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [sharing, setSharing] = useState(readSharingPreferences);
  const [shareMessage, setShareMessage] = useState('');
  const [feedback, setFeedback] = useState({ energy: 3, confidence: 3, difficulty: 3, comment: '' });
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const completedWorkouts = healthLog.filter((day) => day.exercise >= 45).length;
  const recoveryReady = patientData.sleep >= 7 && patientData.heartRate <= 74;
  const maxExercise = Math.max(...healthLog.map((day) => Number(day.exercise) || 0), 1);

  useEffect(() => {
    localStorage.setItem('wellpath-partner-sharing', JSON.stringify(sharing));
  }, [sharing]);

  const addGoal = async (event) => {
    event.preventDefault();
    const title = newGoal.trim();
    if (!title) {
      setGoalMessage('Add a short goal before saving.');
      return;
    }

    try {
      await onAddGoal(title);
      setNewGoal('');
      setGoalMessage('Goal added.');
    } catch (error) {
      setGoalMessage(error.message);
    }
  };

  const toggleGoal = async (goal) => {
    try {
      const status = await onToggleGoal(goal.id, goal.status);
      setGoalMessage(status === 'Complete' ? 'Goal marked complete.' : 'Goal returned to in progress.');
    } catch (error) {
      setGoalMessage(error.message);
    }
  };

  const deleteGoal = async (goalId) => {
    try {
      await onDeleteGoal(goalId);
      setPendingDelete(null);
      setGoalMessage('Goal deleted.');
    } catch (error) {
      setGoalMessage(error.message);
    }
  };

  const shareEncouragement = async (message) => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'WellPath encouragement', text: message });
        setShareMessage('Message shared.');
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(message);
        setShareMessage('Message copied.');
      } else {
        setShareMessage('Sharing is not available in this browser.');
      }
    } catch (error) {
      if (error.name !== 'AbortError') setShareMessage('The message could not be shared.');
    }
  };

  const toggleSharing = (key) => {
    setSharing((current) => ({ ...current, [key]: !current[key] }));
  };

  const submitFeedback = async (event) => {
    event.preventDefault();
    if (!feedback.comment.trim()) {
      setFeedbackMessage('Add a short note about how the session felt.');
      return;
    }
    setFeedbackSaving(true);
    setFeedbackMessage('');
    try {
      await onSubmitFeedback({
        ...feedback,
        session_date: new Date().toISOString().slice(0, 10),
        comment: feedback.comment.trim(),
      });
      setFeedback({ energy: 3, confidence: 3, difficulty: 3, comment: '' });
      setFeedbackMessage('Check-in shared with your trainer.');
    } catch (error) {
      setFeedbackMessage(error.message || 'Your check-in could not be saved.');
    } finally {
      setFeedbackSaving(false);
    }
  };

  return (
    <div className="mobile-flow">
      <section className="partner-hero">
        <div>
          <span>Gym Partner</span>
          <h2>Share support, not pressure.</h2>
          <p>Useful check-ins for a trainer or gym partner while you stay in control.</p>
        </div>
        <HeartHandshake size={28} />
      </section>

      <div className="partner-grid">
        <article className="partner-mini-card"><strong>{completedWorkouts}/{healthLog.length}</strong><span>active days</span></article>
        <article className="partner-mini-card"><strong>{patientData.sleep} hrs</strong><span>sleep last night</span></article>
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
        <h3><BarChart3 size={18} /> Weekly exercise</h3>
        <div className="bars compact-bars" role="img" aria-label="Seven-day exercise minutes chart">
          {healthLog.map((day) => (
            <div className="bar-wrap" key={day.day}>
              <span className="bar" style={{ height: `${Math.max(12, (day.exercise / maxExercise) * 100)}%` }} title={`${day.exercise} minutes`} />
              <small>{day.day}</small>
            </div>
          ))}
        </div>
        <p>{completedWorkouts} days reached 45 minutes. A shorter day still counts as useful movement.</p>
      </section>

      <section className="support-card partner-card">
        <h3><MessageCircle size={18} /> Encouragement prompts</h3>
        {['Nice work keeping the week steady.', 'Want to do a short walk together?', 'Let\'s keep recovery easy today.'].map((message) => (
          <button className="message-template" key={message} type="button" onClick={() => shareEncouragement(message)}>
            {message}
          </button>
        ))}
        {shareMessage && <p className="form-feedback" role="status">{shareMessage}</p>}
      </section>

      <section className="support-card partner-card patient-feedback-card">
        <h3><HeartHandshake size={18} /> Post-session check-in</h3>
        <p>Share how the workout felt. Your trainer sees this check-in; it is not a clinical assessment.</p>
        <form onSubmit={submitFeedback}>
          <FeedbackRange label="Energy" value={feedback.energy} onChange={(value) => setFeedback((current) => ({ ...current, energy: value }))} />
          <FeedbackRange label="Confidence" value={feedback.confidence} onChange={(value) => setFeedback((current) => ({ ...current, confidence: value }))} />
          <FeedbackRange label="Difficulty" value={feedback.difficulty} onChange={(value) => setFeedback((current) => ({ ...current, difficulty: value }))} />
          <label className="feedback-comment"><span>How did it feel?</span><textarea value={feedback.comment} onChange={(event) => setFeedback((current) => ({ ...current, comment: event.target.value }))} rows="3" maxLength="500" placeholder="Example: The pace felt manageable." /></label>
          <button className="secondary-btn" type="submit" disabled={feedbackSaving}>{feedbackSaving ? 'Saving...' : 'Share check-in'}</button>
        </form>
        {feedbackMessage && <p className="form-feedback" role="status">{feedbackMessage}</p>}
      </section>

      <section className="support-card partner-card">
        <h3><ShieldCheck size={18} /> Sharing controls</h3>
        <SharingToggle label="Share steps and workouts" checked={sharing.activity} onChange={() => toggleSharing('activity')} />
        <SharingToggle label="Share sleep summary" checked={sharing.sleep} onChange={() => toggleSharing('sleep')} />
        <SharingToggle label="Share clinician information" checked={sharing.clinician} onChange={() => toggleSharing('clinician')} />
        <p>Sharing starts off. Your choices are saved on this device and can be changed here at any time.</p>
      </section>

      <section className="support-card partner-card">
        <h3>Goals</h3>
        <form className="goal-form" onSubmit={addGoal}>
          <label className="sr-only" htmlFor="new-patient-goal">New goal</label>
          <input id="new-patient-goal" value={newGoal} onChange={(event) => setNewGoal(event.target.value)} placeholder="Add a manageable goal" />
          <button className="secondary-btn" type="submit"><Plus size={16} /> Add</button>
        </form>
        {goalMessage && <p className="form-feedback" role="status">{goalMessage}</p>}
        <div className="goal-list">
          {goals.map((goal) => (
            <div key={goal.id} className={goal.status === 'Complete' ? 'complete-goal' : ''}>
              <button type="button" onClick={() => toggleGoal(goal)} aria-label={`${goal.status === 'Complete' ? 'Reopen' : 'Complete'} ${goal.title}`}>
                <CheckCircle2 size={18} />
              </button>
              <span>{goal.title}</span>
              <em>{goal.status}</em>
              {pendingDelete === goal.id ? (
                <span className="inline-confirm">
                  <button type="button" onClick={() => deleteGoal(goal.id)}>Delete</button>
                  <button type="button" onClick={() => setPendingDelete(null)}>Keep</button>
                </span>
              ) : (
                <button type="button" onClick={() => setPendingDelete(goal.id)} aria-label={`Delete ${goal.title}`}><Trash2 size={16} /></button>
              )}
            </div>
          ))}
          {!goals.length && <p className="empty-state">No goals yet. Add one small next step when you are ready.</p>}
        </div>
      </section>
    </div>
  );
}

function SharingToggle({ label, checked, onChange }) {
  return (
    <label className="setting-row sharing-toggle">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={onChange} />
    </label>
  );
}

function FeedbackRange({ label, value, onChange }) {
  return (
    <label className="patient-feedback-range">
      <span>{label}<strong>{value}/5</strong></span>
      <input type="range" min="1" max="5" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}
