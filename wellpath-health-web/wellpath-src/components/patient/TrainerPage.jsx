import React, { useEffect, useState } from 'react';
import {
  Dumbbell, Target, Plus, CheckCircle2, Trash2, ShieldCheck,
  MessageCircle, Activity, HeartPulse, Flame, Footprints, Moon, Timer, Scale,
} from 'lucide-react';
import { api } from '../../api';
import { usePatientList } from './usePatientLocal.js';
import { QuestionsCard } from './QuestionsCard.jsx';

// The patient-facing Trainer tab (converted from the old Care Team page).
// It leads with the patient's goals, then the basic health numbers a personal
// trainer actually watches, plus places to log workouts and body weight, and a
// notepad of questions to bring to a session. All self-tracked entries are kept
// locally per patient (no backend table needed for the demo).
const mean = (arr) => (arr.length ? arr.reduce((s, v) => s + (Number(v) || 0), 0) / arr.length : null);
const fmtNum = (v, d = 0) =>
  (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString(undefined, { maximumFractionDigits: d }));
const shortDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function TrainerPage({ patientId, patientData = {}, healthLog = [], goals = [], setGoals, onAddGoal, onToggleGoal }) {
  const [careTeam, setCareTeam] = useState(null);
  const [newGoal, setNewGoal] = useState('');
  const [goalMessage, setGoalMessage] = useState('');

  // Self-tracked logs (persisted locally per patient).
  const [exercises, exerciseLog] = usePatientList(patientId, 'exercises');
  const [weights, weightLog] = usePatientList(patientId, 'weightlog');

  const [exName, setExName] = useState('');
  const [exMin, setExMin] = useState('');
  const [exIntensity, setExIntensity] = useState('Moderate');
  const [weightInput, setWeightInput] = useState('');

  useEffect(() => {
    if (!patientId) return;
    api.getCareTeam(patientId).then(setCareTeam).catch(() => {});
  }, [patientId]);

  const addExercise = (e) => {
    e.preventDefault();
    const name = exName.trim();
    const minutes = Number(exMin);
    if (!name || !minutes || minutes <= 0) return;
    exerciseLog.add({ name, minutes, intensity: exIntensity, date: new Date().toISOString() });
    setExName('');
    setExMin('');
    setExIntensity('Moderate');
  };

  const removeExercise = (id) => exerciseLog.remove(id);

  const addWeight = (e) => {
    e.preventDefault();
    const lbs = Number(weightInput);
    if (!lbs || lbs <= 0) return;
    weightLog.add({ weightLbs: lbs, date: new Date().toISOString() });
    setWeightInput('');
  };

  const addGoal = (e) => {
    e.preventDefault();
    const title = newGoal.trim();
    if (!title) return;
    onAddGoal(title);
    setNewGoal('');
    setGoalMessage('Goal added!');
    setTimeout(() => setGoalMessage(''), 3000);
  };

  const deleteGoal = (id) => setGoals(goals.filter((goal) => goal.id !== id));

  const activeGoals = goals.filter((g) => g.status !== 'Complete').length;
  const trainer = careTeam?.trainer;
  const note = careTeam?.trainerNote;
  const noteDate = note?.date
    ? new Date(note.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;

  const avg = (key) => mean(healthLog.map((d) => d[key]).filter((v) => v != null));
  const loggedThisWeek = exercises.filter((x) => (Date.now() - new Date(x.date)) / 86400000 <= 7);
  const loggedMinutes = loggedThisWeek.reduce((s, x) => s + (Number(x.minutes) || 0), 0);

  const stats = [
    {
      icon: Scale, label: 'Weight',
      value: patientData.weightLbs ? `${fmtNum(patientData.weightLbs)} lb` : '—',
      sub: patientData.bmi ? `BMI ${fmtNum(patientData.bmi, 1)}` : null,
    },
    {
      icon: HeartPulse, label: 'Resting HR',
      value: patientData.heartRate ? `${fmtNum(patientData.heartRate)} bpm` : '—',
      sub: (patientData.restingHrBaselineLow && patientData.restingHrBaselineHigh)
        ? `Baseline ${patientData.restingHrBaselineLow}–${patientData.restingHrBaselineHigh}` : null,
    },
    {
      icon: Footprints, label: 'Steps',
      value: fmtNum(patientData.steps),
      sub: patientData.stepGoal ? `Goal ${fmtNum(patientData.stepGoal)}`
        : (avg('steps') != null ? `7-day avg ${fmtNum(avg('steps'))}` : null),
    },
    {
      icon: Dumbbell, label: 'Exercise',
      value: `${fmtNum(patientData.exercise)} min`,
      sub: patientData.exerciseGoal ? `Goal ${fmtNum(patientData.exerciseGoal)} min`
        : (avg('exercise') != null ? `7-day avg ${fmtNum(avg('exercise'))} min` : null),
    },
    {
      icon: Activity, label: 'Active minutes',
      value: `${fmtNum(patientData.activeMinutes)} min`,
      sub: patientData.activeMinuteGoal ? `Goal ${fmtNum(patientData.activeMinuteGoal)} min`
        : (avg('activeMinutes') != null ? `7-day avg ${fmtNum(avg('activeMinutes'))} min` : null),
    },
    {
      icon: Flame, label: 'Calories burned',
      value: fmtNum(patientData.caloriesBurned),
      sub: 'kcal today',
    },
    {
      icon: Timer, label: 'Sedentary',
      value: `${fmtNum(patientData.sedentaryHours, 1)} hrs`,
      sub: patientData.sedentaryLimit ? `Limit ${fmtNum(patientData.sedentaryLimit)} hrs` : null,
    },
    {
      icon: Moon, label: 'Sleep',
      value: `${fmtNum(patientData.sleep, 1)} hrs`,
      sub: avg('sleep') != null ? `7-day avg ${fmtNum(avg('sleep'), 1)} hrs` : null,
    },
  ];

  return (
    <div className="mobile-flow">
      <div className="mobile-section-title">
        <div>
          <span>Training</span>
          <h2>Trainer</h2>
        </div>
        <Dumbbell size={19} />
      </div>

      {/* Goals — front and center */}
      <section className="support-card">
        <div className="careteam-goals-head">
          <h3><Target size={18} /> Goals</h3>
          {goals.length > 0 && <span className="careteam-goal-count">{activeGoals} active</span>}
        </div>
        <form className="goal-form" onSubmit={addGoal}>
          <input value={newGoal} onChange={(e) => setNewGoal(e.target.value)} placeholder="Add a training goal..." />
          <button className="secondary-btn" type="submit"><Plus size={16} /> Add</button>
        </form>
        {goalMessage && <p className="form-feedback" role="status">{goalMessage}</p>}
        <div className="goal-list">
          {goals.length === 0 && (
            <p className="careteam-muted">No goals yet — add one to train toward.</p>
          )}
          {goals.map((goal) => (
            <div key={goal.id} className={goal.status === 'Complete' ? 'complete-goal' : ''}>
              <button onClick={() => onToggleGoal(goal.id, goal.status)} aria-label="Toggle goal complete">
                <CheckCircle2 size={18} />
              </button>
              <span>{goal.title}</span>
              <em>{goal.status}</em>
              <button onClick={() => deleteGoal(goal.id)} aria-label="Remove goal"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      </section>

      {/* Health snapshot — the basics a trainer watches */}
      <section className="support-card">
        <h3><Activity size={18} /> Health snapshot</h3>
        <p className="trainer-sub">Today&apos;s values, with recent context where it helps.</p>
        <div className="trainer-stats">
          {stats.map((s) => (
            <div className="trainer-stat" key={s.label}>
              <span className="trainer-stat-icon"><s.icon size={16} /></span>
              <span className="trainer-stat-label">{s.label}</span>
              <strong className="trainer-stat-value">{s.value}</strong>
              {s.sub && <em className="trainer-stat-sub">{s.sub}</em>}
            </div>
          ))}
        </div>
      </section>

      {/* Log exercise */}
      <section className="support-card">
        <div className="careteam-goals-head">
          <h3><Dumbbell size={18} /> Log exercise</h3>
          {loggedThisWeek.length > 0 && (
            <span className="careteam-goal-count">{loggedThisWeek.length} this week · {loggedMinutes} min</span>
          )}
        </div>
        <form className="exercise-form" onSubmit={addExercise}>
          <input
            className="ex-name"
            value={exName}
            onChange={(e) => setExName(e.target.value)}
            placeholder="Exercise (e.g. Upper-body strength)"
          />
          <div className="exercise-form-row">
            <input
              className="ex-min"
              type="number"
              min="1"
              value={exMin}
              onChange={(e) => setExMin(e.target.value)}
              placeholder="Min"
            />
            <select value={exIntensity} onChange={(e) => setExIntensity(e.target.value)}>
              <option>Light</option>
              <option>Moderate</option>
              <option>Intense</option>
            </select>
            <button className="secondary-btn" type="submit"><Plus size={16} /> Log</button>
          </div>
        </form>
        <div className="exercise-list">
          {exercises.length === 0 && (
            <p className="careteam-muted">No workouts logged yet. Add your first session above.</p>
          )}
          {exercises.map((x) => (
            <div className="exercise-item" key={x.id}>
              <span className={`ex-intensity ex-${x.intensity.toLowerCase()}`}>{x.intensity}</span>
              <div className="ex-main">
                <strong>{x.name}</strong>
                <em>{new Date(x.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</em>
              </div>
              <span className="ex-min-val">{x.minutes} min</span>
              <button onClick={() => removeExercise(x.id)} aria-label="Remove exercise"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </section>

      {/* Weight log — a simple body-metric the patient tracks themselves */}
      <section className="support-card">
        <div className="careteam-goals-head">
          <h3><Scale size={18} /> Weight log</h3>
          {weights.length > 0 && <span className="careteam-goal-count">Latest {fmtNum(weights[0].weightLbs)} lb</span>}
        </div>
        <form className="exercise-form" onSubmit={addWeight}>
          <div className="exercise-form-row weight-row">
            <input
              type="number"
              min="1"
              step="0.1"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              placeholder="Weight (lb)"
            />
            <button className="secondary-btn" type="submit"><Plus size={16} /> Log</button>
          </div>
        </form>
        <div className="exercise-list">
          {weights.length === 0 && (
            <p className="careteam-muted">No weigh-ins logged yet. Add one to start a trend.</p>
          )}
          {weights.map((w, i) => {
            const prev = weights[i + 1];
            const delta = prev ? Number(w.weightLbs) - Number(prev.weightLbs) : null;
            return (
              <div className="exercise-item" key={w.id}>
                <span className="ex-min-val">{fmtNum(w.weightLbs, 1)} lb</span>
                <div className="ex-main">
                  <em>{shortDate(w.date)}</em>
                </div>
                {delta != null && (
                  <span className={`weight-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`}>
                    {delta > 0 ? '+' : ''}{delta.toFixed(1)} lb
                  </span>
                )}
                <button onClick={() => weightLog.remove(w.id)} aria-label="Remove weigh-in"><Trash2 size={14} /></button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Questions to bring to a session — patient-authored, not app advice */}
      <QuestionsCard
        patientId={patientId}
        name="questions.trainer"
        title="Questions for your trainer"
        placeholder="e.g. Is my squat form okay?"
      />

      {/* A note from the trainer — the real cross-role loop, kept at the bottom */}
      {note && (
        <section className="support-card careteam-note-card">
          <h3><MessageCircle size={18} /> A note from your trainer</h3>
          <blockquote className="careteam-note">{note.text}</blockquote>
          <div className="careteam-note-foot">
            <span>{trainer?.name || 'Your trainer'}</span>
            {noteDate && <em>{noteDate}</em>}
          </div>
        </section>
      )}

      <div className="quiet-disclaimer">
        <ShieldCheck size={15} /> Lifestyle tracking to support your training — not medical advice.
      </div>
    </div>
  );
}
