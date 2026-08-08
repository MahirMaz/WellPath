import React, { useMemo } from 'react';
import {
  CalendarCheck2, CheckCircle2, ChevronRight, ClipboardList, Dumbbell,
  MessageSquare, Moon, Plus, ShieldCheck, Target, TrendingUp,
} from 'lucide-react';

function initials(name = '') {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function agendaFromPlan(plan) {
  const duration = Math.max(20, Number(plan?.duration_minutes) || 45);
  const exercises = Array.isArray(plan?.exercises) && plan.exercises.length
    ? plan.exercises.slice(0, 3)
    : ['Movement preparation', 'Main work', 'Cool-down'];
  const preparationEnd = 5;
  const coolDownStart = Math.max(preparationEnd + 5, duration - 5);
  const mainDuration = Math.max(5, coolDownStart - preparationEnd);
  const mainStep = Math.max(5, Math.round(mainDuration / Math.max(exercises.length - 1, 1)));

  return [
    { range: '0-5 min', title: 'Check in and screen', detail: 'Energy, sleep, soreness, comfort' },
    ...exercises.map((exercise, index) => {
      if (index === exercises.length - 1) {
        return { range: `${coolDownStart}-${duration} min`, title: exercise, detail: 'Finish at a manageable pace' };
      }
      const start = preparationEnd + index * mainStep;
      const end = Math.min(coolDownStart, start + mainStep);
      return { range: `${start}-${end} min`, title: exercise, detail: index === 0 ? 'Prepare movement and technique' : 'Follow the current training plan' };
    }),
  ].slice(0, 4);
}

export default function TrainerHome({
  patient, plan, trends, feedback, averageSleep, consistency, recoveryScore,
  activeDays, weeklyExercise, weeklyTarget, exerciseProgress, selectedDayIndex,
  onSelectDay, onOpenSection, onOpenMetric,
}) {
  const recentTrends = trends.slice(-7);
  const maxExercise = Math.max(...recentTrends.map((day) => Number(day.exercise) || 0), 1);
  const latestFeedback = feedback[0];
  const selectedDay = recentTrends[selectedDayIndex] || recentTrends.at(-1);
  const needsCheckIn = (averageSleep && Number(averageSleep) < 6.5)
    || (Number.isFinite(recoveryScore) && recoveryScore < 65);
  const agenda = useMemo(() => agendaFromPlan(plan), [plan]);

  const pulse = [
    { id: 'consistency', label: 'Consistency', value: `${Number.isFinite(consistency) ? consistency : 0}%`, icon: TrendingUp },
    { id: 'sleep', label: 'Avg sleep', value: averageSleep ? `${averageSleep}h` : 'N/A', icon: Moon },
    { id: 'active-days', label: 'Active days', value: `${activeDays}/${recentTrends.length || 7}`, icon: CalendarCheck2 },
  ];

  return (
    <div className="coach-home-flow">
      <section className="coach-client-summary" aria-label="Selected client summary">
        <div className="coach-client-identity"><span>{initials(patient?.full_name)}</span><div><h1>{patient?.full_name}</h1><p><Target size={14} /> {patient?.primary_focus}</p></div></div>
        <div className="coach-pulse" aria-label="Recent client indicators">
          {pulse.map(({ id, label, value, icon: Icon }) => (
            <button key={id} type="button" onClick={() => onOpenMetric(id)} aria-label={`Open ${label} details`}>
              <Icon size={14} /><strong>{value}</strong><span>{label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="coach-priority" aria-labelledby="coach-priority-title">
        <div className="coach-priority-heading">
          <div><span>Next session priority</span><h2 id="coach-priority-title">{needsCheckIn ? 'Keep the load flexible' : 'Plan looks appropriate to continue'}</h2></div>
          <button type="button" className={`coach-priority-status ${needsCheckIn ? 'check' : 'ready'}`} onClick={() => onOpenSection('feedback')}>
            {needsCheckIn ? 'Check in first' : 'Ready'} <ChevronRight size={15} />
          </button>
        </div>
        <p>{needsCheckIn
          ? 'Recent sleep or recovery is below the usual support range. Ask how the client feels before progressing the session.'
          : 'Recent activity and recovery look steady. Confirm comfort and confidence before progressing the plan.'}</p>
        <div className="coach-checklist">
          <span><CheckCircle2 size={16} /> Confirm today&apos;s energy</span>
          <span><CheckCircle2 size={16} /> Review last-session feedback</span>
          <span><CheckCircle2 size={16} /> Keep effort near {plan?.effort_target || 6}/10</span>
        </div>
        <div className="coach-boundary"><ShieldCheck size={16} /><span>WellPath supports coaching decisions. It does not clear a client for exercise.</span></div>
      </section>

      <section className="coach-actions" aria-label="Trainer quick actions">
        <button type="button" onClick={() => onOpenSection('plan')}><ClipboardList size={20} /><span>Adjust plan</span><ChevronRight size={16} /></button>
        <button type="button" onClick={() => onOpenSection('sessions')}><Plus size={20} /><span>Log session</span><ChevronRight size={16} /></button>
        <button type="button" onClick={() => onOpenSection('feedback')}><MessageSquare size={20} /><span>Write note</span><ChevronRight size={16} /></button>
      </section>

      <section className="trainer-panel coach-activity-panel">
        <div className="coach-panel-title"><div><span>Weekly activity</span><h2>{weeklyExercise} of {weeklyTarget} minutes</h2></div><strong>{exerciseProgress}%</strong></div>
        <div className="progress" role="progressbar" aria-label="Weekly workout goal progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={exerciseProgress}><span style={{ width: `${exerciseProgress}%` }} /></div>
        <div className="coach-chart-current"><span>{selectedDay?.day || 'Day'}</span><strong>{Number(selectedDay?.exercise) || 0} min</strong></div>
        <div className="coach-bars" aria-label="Select a day to review exercise minutes">
          {recentTrends.map((day, index) => (
            <button key={`${day.recordDate}-${index}`} type="button" className={selectedDayIndex === index ? 'selected' : ''} onClick={() => onSelectDay(index)} aria-pressed={selectedDayIndex === index} aria-label={`${day.day}: ${day.exercise} exercise minutes`}>
              <span><i style={{ height: `${Math.max(12, ((Number(day.exercise) || 0) / maxExercise) * 100)}%` }} /></span><small>{day.day}</small>
            </button>
          ))}
        </div>
        <button className="coach-inline-link" type="button" onClick={() => onOpenSection('plan')}>Review weekly plan <ChevronRight size={15} /></button>
      </section>

      <button className="trainer-panel coach-feedback-card" type="button" onClick={() => onOpenSection('feedback')}>
        <div className="coach-panel-title"><div><span>Latest client feedback</span><h2>{latestFeedback ? 'From the last session' : 'No feedback yet'}</h2></div><ChevronRight size={18} /></div>
        {latestFeedback ? <div className="coach-feedback-scores">
          <FeedbackMeter label="Energy" value={latestFeedback.energy} />
          <FeedbackMeter label="Confidence" value={latestFeedback.confidence} positive />
          <FeedbackMeter label="Difficulty" value={latestFeedback.difficulty} />
        </div> : <p className="empty-state">Ask the client to share a quick post-session check-in.</p>}
      </button>

      <section className="trainer-panel coach-agenda">
        <div className="coach-panel-title"><div><span>Today&apos;s session agenda</span><h2>{plan?.session_type || 'Current plan'} - {plan?.duration_minutes || 45} min</h2></div><Dumbbell size={20} /></div>
        <div className="coach-agenda-list">
          {agenda.map((item, index) => <button type="button" key={`${item.range}-${item.title}`} onClick={() => onOpenSection('plan')}>
            <i aria-hidden="true">{index + 1}</i><span>{item.range}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div><ChevronRight size={15} />
          </button>)}
        </div>
      </section>
    </div>
  );
}

function FeedbackMeter({ label, value, positive = false }) {
  const numericValue = Math.max(0, Math.min(5, Number(value) || 0));
  return <div><span>{label}</span><strong>{numericValue}/5</strong><i><em className={positive ? 'positive' : ''} style={{ width: `${numericValue * 20}%` }} /></i></div>;
}
