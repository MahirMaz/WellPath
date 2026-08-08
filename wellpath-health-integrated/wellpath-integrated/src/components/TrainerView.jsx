import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, BarChart3, CalendarCheck2, CheckCircle2, ClipboardList, Dumbbell,
  ChevronRight, Gauge, Info, LayoutDashboard, ListChecks, LogOut, MessageSquare, Moon, Plus,
  RefreshCw, Save, ShieldCheck, Sparkles, Sun, Target, Timer, TrendingUp, UserCheck, Users, X,
} from 'lucide-react';
import { api } from '../api';

const trainerSections = [
  { id: 'overview', label: 'Today', icon: LayoutDashboard },
  { id: 'plan', label: 'Plan', icon: ClipboardList },
  { id: 'sessions', label: 'Sessions', icon: Dumbbell },
  { id: 'feedback', label: 'Feedback', icon: MessageSquare },
];

const noteTemplates = [
  'Nice work keeping your week consistent.',
  'Let us keep the next session manageable and repeatable.',
  'Recovery counts too. A lighter day still supports the plan.',
];

function todayText() {
  return new Date().toISOString().slice(0, 10);
}

function emptySession(plan) {
  return {
    session_date: todayText(),
    duration_minutes: plan?.duration_minutes || 45,
    session_type: plan?.session_type || 'Full body',
    effort: plan?.effort_target || 6,
    completion: 'Completed',
    notes: '',
  };
}

function starterPlan(patient) {
  return {
    weekly_target: 180,
    focus: patient?.primary_focus || 'Build a steady weekly routine',
    session_type: 'Full body',
    duration_minutes: 45,
    effort_target: 6,
    exercises: ['Warm-up walk', 'Strength circuit', 'Mobility cool-down'],
  };
}

async function optionalFeature(request, fallback) {
  try {
    return await request;
  } catch (error) {
    if (error.status === 404) return fallback;
    throw error;
  }
}

function TrainerView({ user, onLogout, theme, setTheme }) {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [trends, setTrends] = useState([]);
  const [goals, setGoals] = useState([]);
  const [plan, setPlan] = useState(null);
  const [planForm, setPlanForm] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [note, setNote] = useState('');
  const [activeSection, setActiveSection] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [patientLoading, setPatientLoading] = useState(false);
  const [saving, setSaving] = useState('');
  const [draftingNote, setDraftingNote] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [sessionForm, setSessionForm] = useState(emptySession());
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const metricDetailRef = useRef(null);

  useEffect(() => { fetchPatients(); }, []);

  useEffect(() => {
    if (selectedMetric && metricDetailRef.current) {
      metricDetailRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedMetric]);

  const fetchPatients = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getTrainerPatients();
      setPatients(data);
      if (data.length) await loadPatient(data[0]);
    } catch (loadError) {
      setError(loadError.message || 'Your patient list could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  const loadPatient = async (patient) => {
    setSelectedPatient(patient);
    setPatientLoading(true);
    setStatusMessage('');
    setSelectedMetric(null);
    try {
      const fallbackPlan = starterPlan(patient);
      const [noteData, trendData, planData, sessionData, feedbackData, goalData] = await Promise.all([
        api.getTrainerNote(patient.patient_id),
        api.getTrends(patient.patient_id),
        optionalFeature(api.getTrainerPlan(patient.patient_id), fallbackPlan),
        optionalFeature(api.getTrainerSessions(patient.patient_id), []),
        optionalFeature(api.getPatientFeedback(patient.patient_id), []),
        api.getGoals(patient.patient_id),
      ]);
      setNote(noteData.note || '');
      setTrends(Array.isArray(trendData) ? trendData : []);
      setPlan(planData || fallbackPlan);
      setPlanForm(planData || fallbackPlan);
      setSessions(Array.isArray(sessionData) ? sessionData : []);
      setFeedback(Array.isArray(feedbackData) ? feedbackData : []);
      setGoals(Array.isArray(goalData) ? goalData : []);
      setSessionForm(emptySession(planData || fallbackPlan));
      setSelectedDayIndex(Math.min(6, Math.max(0, (Array.isArray(trendData) ? trendData.length : 1) - 1)));
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'This patient could not be loaded.');
    } finally {
      setPatientLoading(false);
    }
  };

  const savePlan = async (event) => {
    event.preventDefault();
    if (!selectedPatient || !planForm) return;
    setSaving('plan');
    setStatusMessage('');
    try {
      const saved = await api.updateTrainerPlan(selectedPatient.patient_id, planForm);
      setPlan(saved);
      setPlanForm(saved);
      setSessionForm((current) => ({ ...current, duration_minutes: saved.duration_minutes, session_type: saved.session_type, effort: saved.effort_target }));
      setStatusMessage('Training plan saved.');
    } catch (saveError) {
      setStatusMessage(saveError.message || 'The training plan could not be saved.');
    } finally {
      setSaving('');
    }
  };

  const addPlanActivity = () => {
    setPlanForm((current) => ({ ...current, exercises: [...current.exercises, 'New activity'] }));
  };

  const updatePlanActivity = (index, value) => {
    setPlanForm((current) => ({ ...current, exercises: current.exercises.map((item, itemIndex) => itemIndex === index ? value : item) }));
  };

  const removePlanActivity = (index) => {
    setPlanForm((current) => ({ ...current, exercises: current.exercises.filter((_, itemIndex) => itemIndex !== index) }));
  };

  const logSession = async (event) => {
    event.preventDefault();
    if (!selectedPatient) return;
    setSaving('session');
    setStatusMessage('');
    try {
      const saved = await api.addTrainerSession(selectedPatient.patient_id, sessionForm);
      setSessions((items) => [saved, ...items]);
      setSessionForm(emptySession(plan));
      setStatusMessage('Session logged.');
    } catch (saveError) {
      setStatusMessage(saveError.message || 'The session could not be logged.');
    } finally {
      setSaving('');
    }
  };

  const saveNote = async () => {
    if (!selectedPatient || !note.trim()) return;
    setSaving('note');
    setStatusMessage('');
    try {
      await api.updateTrainerNote(selectedPatient.patient_id, note.trim());
      setStatusMessage('Encouragement note saved.');
    } catch (saveError) {
      setStatusMessage(saveError.message || 'The note could not be saved.');
    } finally {
      setSaving('');
    }
  };

  const draftNoteWithAi = async () => {
    if (!selectedPatient) return;
    setDraftingNote(true);
    setStatusMessage('');
    try {
      const response = await api.draftTrainerNote(selectedPatient.patient_id);
      setNote(response.draft || '');
      setStatusMessage('AI draft ready. Review and edit it before saving.');
    } catch (draftError) {
      setStatusMessage(draftError.message || 'The AI note draft could not be created.');
    } finally {
      setDraftingNote(false);
    }
  };

  const recentTrends = trends.slice(-7);
  const weeklyExercise = recentTrends.reduce((sum, day) => sum + (Number(day.exercise) || 0), 0);
  const weeklyTarget = Number(plan?.weekly_target) || 180;
  const exerciseProgress = Math.min(100, Math.round((weeklyExercise / weeklyTarget) * 100));
  const maxExercise = Math.max(...recentTrends.map((day) => Number(day.exercise) || 0), 1);
  const activeDays = recentTrends.filter((day) => Number(day.exercise) >= 30).length;
  const averageSleep = useMemo(() => {
    const values = recentTrends.map((day) => Number(day.sleep)).filter(Number.isFinite);
    return values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1) : null;
  }, [trends]);
  const recoveryScore = Number(selectedPatient?.kpis?.['Recovery Score']);
  const consistency = Number(selectedPatient?.kpis?.['Activity Consistency']);
  const lighterSession = (averageSleep && Number(averageSleep) < 6.5) || (Number.isFinite(recoveryScore) && recoveryScore < 65);
  const completedSessions = sessions.filter((session) => session.completion === 'Completed').length;
  const latestFeedback = feedback[0];
  const selectedTrendDay = recentTrends[selectedDayIndex] || recentTrends[recentTrends.length - 1];
  const metricDetails = [
    {
      id: 'consistency', icon: TrendingUp, label: 'Consistency',
      value: `${Number.isFinite(consistency) ? consistency : 0}%`, detail: 'recent activity pattern',
      title: 'Activity consistency', context: `${activeDays} active days in the last ${recentTrends.length || 7} days`,
      explanation: 'Consistency shows how regularly movement is happening. It is more useful for coaching than chasing one unusually active day.',
      prompt: 'Ask which days felt easiest to repeat and build the next week around that routine.',
      actionLabel: 'Review weekly plan', actionSection: 'plan',
      data: recentTrends.map((day) => Number(day.exercise) || 0), labels: recentTrends.map((day) => day.day),
    },
    {
      id: 'recovery', icon: Moon, label: 'Recovery',
      value: Number.isFinite(recoveryScore) ? recoveryScore : 'N/A', detail: 'lifestyle estimate',
      title: 'Recovery snapshot', context: averageSleep ? `${averageSleep} hours average sleep` : 'Sleep data is not available',
      explanation: 'This combines shared sleep and activity patterns into a simple lifestyle estimate. It is not a readiness clearance.',
      prompt: 'Check energy, soreness, comfort, and confidence before deciding whether to progress the session.',
      actionLabel: 'Review feedback', actionSection: 'feedback',
      data: recentTrends.map((day) => Number(day.sleep) || 0), labels: recentTrends.map((day) => day.day),
    },
    {
      id: 'active-days', icon: CalendarCheck2, label: 'Active days',
      value: `${activeDays}/${recentTrends.length || 7}`, detail: '30+ exercise minutes',
      title: 'Active days', context: `${weeklyExercise} total exercise minutes this week`,
      explanation: 'An active day is a day with at least 30 shared exercise minutes. Shorter movement still counts toward the weekly total.',
      prompt: 'Recognize returning after a rest day and keep the next session manageable.',
      actionLabel: 'Log a session', actionSection: 'sessions',
      data: recentTrends.map((day) => Number(day.exercise) || 0), labels: recentTrends.map((day) => day.day),
    },
    {
      id: 'sleep', icon: Timer, label: 'Average sleep',
      value: averageSleep ? `${averageSleep}h` : 'N/A', detail: 'last seven nights',
      title: 'Sleep and recovery', context: lighterSession ? 'A check-in may be useful today' : 'Recent sleep looks steady',
      explanation: 'The patient shares a simple sleep duration trend. Quality, schedule, and how they feel still need a conversation.',
      prompt: 'Ask how rested they feel instead of changing the plan from sleep hours alone.',
      actionLabel: 'Write support note', actionSection: 'feedback',
      data: recentTrends.map((day) => Number(day.sleep) || 0), labels: recentTrends.map((day) => day.day),
    },
    {
      id: 'sessions', icon: Dumbbell, label: 'Logged sessions',
      value: completedSessions, detail: 'recent history',
      title: 'Training history', context: `${sessions.length} recent session records`,
      explanation: 'Completed, modified, and stopped sessions help you adjust pacing without treating modification as failure.',
      prompt: 'Review the most recent note before planning progression.',
      actionLabel: 'Open session log', actionSection: 'sessions',
      data: sessions.slice(0, 7).reverse().map((session) => Number(session.duration_minutes) || 0),
      labels: sessions.slice(0, 7).reverse().map((session) => formatShortDate(session.session_date)),
    },
    {
      id: 'goals', icon: Target, label: 'Shared goals',
      value: goals.length, detail: `${goals.filter((goal) => goal.status === 'Complete').length} complete`,
      title: 'Shared goals', context: goals.length ? `${goals.length} goals visible to this trainer` : 'No shared goals yet',
      explanation: 'Only patient-approved lifestyle goals appear here. Clinical notes and private health information stay outside the trainer workspace.',
      prompt: 'Tie the next activity to one goal the patient already cares about.',
      actionLabel: 'Align the plan', actionSection: 'plan',
      data: goals.map((goal) => goal.status === 'Complete' ? 100 : 50), labels: goals.map((_, index) => `G${index + 1}`),
    },
  ];
  const selectedMetricDetail = metricDetails.find((metric) => metric.id === selectedMetric);

  const openTrainerSection = (section) => {
    setActiveSection(section);
    setStatusMessage('');
    setSelectedMetric(null);
  };

  if (loading) return <div className="trainer-workspace single-state"><div className="loading-center" role="status">Loading trainer workspace...</div></div>;
  if (error && !selectedPatient) {
    return (
      <div className="trainer-workspace single-state">
        <section className="state-panel" role="alert">
          <Users size={28} /><h2>We could not load your patient list</h2><p>{error}</p>
          <button className="primary-btn" type="button" onClick={fetchPatients}><RefreshCw size={16} /> Try again</button>
        </section>
      </div>
    );
  }

  return (
    <div className="trainer-workspace">
      <header className="trainer-workspace-header">
        <div className="trainer-brand"><span><Dumbbell size={21} /></span><div><strong>WellPath Coach</strong><small>Mobile training support</small></div></div>
        <div className="trainer-account"><span>Signed in as <strong>{user?.name}</strong></span>
          <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button type="button" onClick={onLogout} aria-label="Sign out"><LogOut size={17} /></button>
        </div>
      </header>

      <div className="trainer-patient-strip" aria-label="Assigned patients">
        {patients.map((patient) => (
          <button key={patient.patient_id} type="button" className={selectedPatient?.patient_id === patient.patient_id ? 'active' : ''} onClick={() => loadPatient(patient)} aria-pressed={selectedPatient?.patient_id === patient.patient_id}>
            <span>{patient.full_name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span>
            <div><strong>{patient.full_name}</strong><small>{patient.primary_focus}</small></div>
          </button>
        ))}
      </div>

      <div className="trainer-title-row">
        <div><span className="section-kicker">Supporting</span><h1>{selectedPatient?.full_name}</h1><p>{selectedPatient?.primary_focus}</p></div>
        <div className="trainer-title-meta"><span><ShieldCheck size={15} /> Shared support data</span><span><RefreshCw size={15} /> Updated today</span></div>
      </div>

      <nav className="trainer-section-tabs" aria-label="Trainer workspace sections">
        {trainerSections.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className={activeSection === id ? 'active' : ''} onClick={() => openTrainerSection(id)} aria-current={activeSection === id ? 'page' : undefined}>
            <Icon size={17} /> {label}
          </button>
        ))}
      </nav>

      {patientLoading && <p className="form-feedback" role="status">Updating patient support data...</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      {statusMessage && <p className="trainer-global-status" role="status">{statusMessage}</p>}

      <main className="trainer-workspace-main" aria-busy={patientLoading}>
        {activeSection === 'overview' && (
          <>
            <section className="trainer-quick-actions" aria-label="Trainer quick actions">
              <div><span className="section-kicker">Quick actions</span><strong>What do you need to do?</strong></div>
              <button type="button" onClick={() => openTrainerSection('plan')}><ClipboardList size={17} /><span>Adjust plan</span></button>
              <button type="button" onClick={() => openTrainerSection('sessions')}><Plus size={17} /><span>Log session</span></button>
              <button type="button" onClick={() => openTrainerSection('feedback')}><MessageSquare size={17} /><span>Write note</span></button>
            </section>
            <div className="trainer-kpi-grid">
              {metricDetails.map((metric) => (
                <TrainerMetric key={metric.id} {...metric} selected={selectedMetric === metric.id} onSelect={() => setSelectedMetric((current) => current === metric.id ? null : metric.id)} />
              ))}
            </div>

            {selectedMetricDetail && (
              <TrainerMetricDetail detail={selectedMetricDetail} detailRef={metricDetailRef} onClose={() => setSelectedMetric(null)} onAction={() => openTrainerSection(selectedMetricDetail.actionSection)} />
            )}

            <div className="trainer-dashboard-grid">
              <section className="trainer-panel trainer-readiness-panel">
                <div className="trainer-panel-heading"><div><span className="section-kicker">Next session</span><h2>{lighterSession ? 'Keep the load flexible' : 'Plan looks appropriate to continue'}</h2></div><span className={`coach-status ${lighterSession ? 'recovery' : 'ready'}`}>{lighterSession ? 'Check in first' : 'Ready'}</span></div>
                <p>{lighterSession
                  ? 'Recent sleep or recovery is below the usual support range. Ask how the patient feels and be ready to shorten or simplify the session.'
                  : 'Recent activity and recovery are steady. Confirm energy, comfort, and confidence before progressing the plan.'}</p>
                <div className="trainer-check-grid">
                  <span><CheckCircle2 size={16} /> Confirm today&apos;s energy</span>
                  <span><CheckCircle2 size={16} /> Review last-session feedback</span>
                  <span><CheckCircle2 size={16} /> Keep effort near {plan?.effort_target || 6}/10</span>
                  <span><CheckCircle2 size={16} /> Offer an easier option</span>
                </div>
                <div className="trainer-safety-note"><ShieldCheck size={17} /><p>WellPath does not clear a patient for exercise. Stop and follow facility referral or emergency policy when a patient reports a concerning symptom.</p></div>
              </section>

              <section className="trainer-panel">
                <div className="trainer-panel-heading"><div><span className="section-kicker">Weekly target</span><h2>{weeklyExercise} of {weeklyTarget} minutes</h2></div><strong>{exerciseProgress}%</strong></div>
                <div className="progress" role="progressbar" aria-label="Weekly workout goal progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={exerciseProgress}><span style={{ width: `${exerciseProgress}%` }} /></div>
                <div className="trainer-chart-selection" aria-live="polite">
                  <span>{selectedTrendDay?.day || 'Day'}</span>
                  <strong>{Number(selectedTrendDay?.exercise) || 0} min</strong>
                </div>
                <div className="trainer-exercise-bars" aria-label="Select a day to review exercise minutes">
                  {recentTrends.map((day, index) => (
                    <button key={`${day.recordDate}-${index}`} type="button" className={selectedDayIndex === index ? 'selected' : ''} onClick={() => setSelectedDayIndex(index)} aria-label={`${day.day}: ${day.exercise} exercise minutes`} aria-pressed={selectedDayIndex === index}>
                      <span style={{ height: `${Math.max(12, (day.exercise / maxExercise) * 100)}%` }} /><small>{day.day}</small>
                    </button>
                  ))}
                </div>
                <p className="panel-note">Shorter sessions and recovery days remain useful parts of a repeatable plan.</p>
              </section>

              <section className="trainer-panel">
                <div className="trainer-panel-heading"><div><span className="section-kicker">Current plan</span><h2>{plan?.session_type}</h2></div><button className="text-action" type="button" onClick={() => setActiveSection('plan')}>Edit plan</button></div>
                <SummaryRow label="Focus" value={plan?.focus || 'Not set'} />
                <SummaryRow label="Session length" value={`${plan?.duration_minutes || 0} minutes`} />
                <SummaryRow label="Effort target" value={`${plan?.effort_target || 0}/10`} />
                <div className="trainer-activity-chips">{plan?.exercises?.map((activity) => <span key={activity}>{activity}</span>)}</div>
              </section>

              <section className="trainer-panel">
                <div className="trainer-panel-heading"><div><span className="section-kicker">Patient voice</span><h2>Latest feedback</h2></div><UserCheck size={22} /></div>
                {latestFeedback ? (
                  <>
                    <div className="feedback-score-grid"><FeedbackScore label="Energy" value={latestFeedback.energy} /><FeedbackScore label="Confidence" value={latestFeedback.confidence} /><FeedbackScore label="Difficulty" value={latestFeedback.difficulty} inverse /></div>
                    <blockquote>{latestFeedback.comment}</blockquote><small>{formatDate(latestFeedback.session_date)}</small>
                  </>
                ) : <p className="empty-state">No patient feedback has been shared yet.</p>}
              </section>
            </div>
          </>
        )}

        {activeSection === 'plan' && planForm && (
          <div className="trainer-split-layout">
            <form className="trainer-panel trainer-plan-form" onSubmit={savePlan}>
              <div className="trainer-panel-heading"><div><span className="section-kicker">Program builder</span><h2>Weekly training plan</h2></div><ClipboardList size={22} /></div>
              <div className="trainer-form-grid">
                <label><span>Primary focus</span><input value={planForm.focus} onChange={(event) => setPlanForm({ ...planForm, focus: event.target.value })} maxLength="180" required /></label>
                <label><span>Weekly target</span><div className="input-with-unit"><input type="number" min="30" max="600" value={planForm.weekly_target} onChange={(event) => setPlanForm({ ...planForm, weekly_target: Number(event.target.value) })} /><em>min</em></div></label>
                <label><span>Session type</span><select value={planForm.session_type} onChange={(event) => setPlanForm({ ...planForm, session_type: event.target.value })}><option>Full body</option><option>Strength</option><option>Conditioning</option><option>Mobility + cardio</option><option>Recovery session</option></select></label>
                <label><span>Planned duration</span><div className="input-with-unit"><input type="number" min="10" max="180" value={planForm.duration_minutes} onChange={(event) => setPlanForm({ ...planForm, duration_minutes: Number(event.target.value) })} /><em>min</em></div></label>
              </div>
              <label className="range-field"><span>Effort target <strong>{planForm.effort_target}/10</strong></span><input type="range" min="1" max="10" value={planForm.effort_target} onChange={(event) => setPlanForm({ ...planForm, effort_target: Number(event.target.value) })} /></label>
              <div className="plan-activity-editor"><div className="trainer-panel-heading"><h3>Session activities</h3><button className="text-action" type="button" onClick={addPlanActivity}><Plus size={15} /> Add activity</button></div>
                {planForm.exercises.map((activity, index) => (
                  <div className="plan-activity-row" key={index}><span>{index + 1}</span><input value={activity} onChange={(event) => updatePlanActivity(index, event.target.value)} maxLength="80" aria-label={`Activity ${index + 1}`} /><button type="button" onClick={() => removePlanActivity(index)} aria-label={`Remove ${activity}`} disabled={planForm.exercises.length === 1}><X size={16} /></button></div>
                ))}
              </div>
              <button className="primary-btn" type="submit" disabled={saving === 'plan'}><Save size={16} /> {saving === 'plan' ? 'Saving...' : 'Save training plan'}</button>
            </form>
            <aside className="trainer-panel trainer-plan-preview"><span className="section-kicker">Plan preview</span><h2>{planForm.session_type}</h2><p>{planForm.focus}</p><div className="plan-preview-stat"><strong>{planForm.duration_minutes}</strong><span>minutes</span></div><div className="plan-preview-stat"><strong>{planForm.effort_target}/10</strong><span>planned effort</span></div><div className="trainer-activity-chips">{planForm.exercises.map((activity) => <span key={activity}>{activity}</span>)}</div><div className="trainer-safety-note"><Info size={16} /><p>Progress only after checking patient feedback and comfort. Lifestyle data supports the conversation; it does not replace professional screening.</p></div></aside>
          </div>
        )}

        {activeSection === 'sessions' && (
          <div className="trainer-split-layout session-layout">
            <form className="trainer-panel trainer-session-form" onSubmit={logSession}>
              <div className="trainer-panel-heading"><div><span className="section-kicker">Session record</span><h2>Log completed work</h2></div><Dumbbell size={22} /></div>
              <div className="trainer-form-grid">
                <label><span>Date</span><input type="date" value={sessionForm.session_date} onChange={(event) => setSessionForm({ ...sessionForm, session_date: event.target.value })} /></label>
                <label><span>Duration</span><div className="input-with-unit"><input type="number" min="5" max="240" value={sessionForm.duration_minutes} onChange={(event) => setSessionForm({ ...sessionForm, duration_minutes: Number(event.target.value) })} /><em>min</em></div></label>
                <label><span>Session type</span><select value={sessionForm.session_type} onChange={(event) => setSessionForm({ ...sessionForm, session_type: event.target.value })}><option>Full body</option><option>Strength</option><option>Conditioning</option><option>Mobility + cardio</option><option>Recovery session</option></select></label>
                <label><span>Outcome</span><select value={sessionForm.completion} onChange={(event) => setSessionForm({ ...sessionForm, completion: event.target.value })}><option>Completed</option><option>Modified</option><option>Stopped early</option></select></label>
              </div>
              <label className="range-field"><span>Observed effort <strong>{sessionForm.effort}/10</strong></span><input type="range" min="1" max="10" value={sessionForm.effort} onChange={(event) => setSessionForm({ ...sessionForm, effort: Number(event.target.value) })} /></label>
              <label><span>Session note</span><textarea value={sessionForm.notes} onChange={(event) => setSessionForm({ ...sessionForm, notes: event.target.value })} rows="4" maxLength="500" placeholder="Record modifications, pacing, and patient-reported comfort" /></label>
              <button className="primary-btn" type="submit" disabled={saving === 'session'}><Plus size={16} /> {saving === 'session' ? 'Saving...' : 'Log session'}</button>
            </form>
            <section className="trainer-panel"><div className="trainer-panel-heading"><div><span className="section-kicker">History</span><h2>Recent sessions</h2></div><ListChecks size={22} /></div><div className="session-history">{sessions.map((session) => <article key={session.id}><span className={`session-outcome ${session.completion.toLowerCase().replace(' ', '-')}`}>{session.completion}</span><div><strong>{session.session_type}</strong><small>{formatDate(session.session_date)} - {session.duration_minutes} min - effort {session.effort}/10</small><p>{session.notes || 'No session note.'}</p></div></article>)}{!sessions.length && <p className="empty-state">No sessions have been logged yet.</p>}</div></section>
          </div>
        )}

        {activeSection === 'feedback' && (
          <div className="trainer-dashboard-grid feedback-layout">
            <section className="trainer-panel"><div className="trainer-panel-heading"><div><span className="section-kicker">Patient check-ins</span><h2>Feedback history</h2></div><UserCheck size={22} /></div><div className="feedback-history">{feedback.map((entry) => <article key={entry.id}><div className="feedback-score-grid"><FeedbackScore label="Energy" value={entry.energy} /><FeedbackScore label="Confidence" value={entry.confidence} /><FeedbackScore label="Difficulty" value={entry.difficulty} inverse /></div><p>{entry.comment}</p><small>{formatDate(entry.session_date)}</small></article>)}{!feedback.length && <p className="empty-state">No check-ins have been shared yet.</p>}</div></section>
            <section className="trainer-panel">
              <div className="trainer-panel-heading"><div><span className="section-kicker">Support message</span><h2>Encouragement note</h2></div><MessageSquare size={22} /></div>
              <div className="note-template-row" aria-label="Quick note templates">{noteTemplates.map((template) => <button key={template} type="button" onClick={() => setNote(template)}>{template}</button>)}</div>
              <label><span className="sr-only">Encouragement note</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows="6" maxLength="500" placeholder="Write a supportive note" /></label>
              <p className="panel-note">AI can help draft lifestyle encouragement, but it may miss context. Review every draft before sharing it.</p>
              <div className="trainer-note-actions">
                <small>{note.length}/500</small>
                <button className="trainer-ai-draft" type="button" onClick={draftNoteWithAi} disabled={draftingNote}>
                  {draftingNote ? <><RefreshCw size={15} className="spinning" /> Drafting...</> : <><Sparkles size={15} /> Draft with AI</>}
                </button>
                <button className="secondary-btn" type="button" onClick={saveNote} disabled={saving === 'note' || !note.trim()}><Save size={16} /> {saving === 'note' ? 'Saving...' : 'Save note'}</button>
              </div>
            </section>
            <section className="trainer-panel trainer-sharing-panel"><div className="trainer-panel-heading"><div><span className="section-kicker">Access boundary</span><h2>Shared with this trainer</h2></div><ShieldCheck size={22} /></div><div className="sharing-scope-grid"><span>Activity consistency</span><span>Workout progress</span><span>Sleep summary</span><span>Patient feedback</span><span>Shared goals</span><span>Encouragement notes</span></div><p>Clinical readings, clinician notes, AI conversations, and private mood entries are not available in this workspace.</p></section>
          </div>
        )}
      </main>
    </div>
  );
}

function TrainerMetric({ id, icon: Icon, label, value, detail, selected, onSelect }) {
  return (
    <button className={`trainer-metric-button ${selected ? 'selected' : ''}`} type="button" onClick={onSelect} aria-expanded={selected} aria-controls={`trainer-metric-${id}`} aria-label={`${selected ? 'Close' : 'Open'} ${label} details`}>
      <span className="trainer-metric-icon"><Icon size={18} /></span>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
      <ChevronRight className="trainer-metric-chevron" size={17} aria-hidden="true" />
    </button>
  );
}

function TrainerMetricDetail({ detail, detailRef, onClose, onAction }) {
  const maxValue = Math.max(...detail.data, 1);
  const Icon = detail.icon;
  return (
    <section ref={detailRef} className="trainer-metric-detail" id={`trainer-metric-${detail.id}`} aria-labelledby={`trainer-metric-title-${detail.id}`}>
      <div className="trainer-metric-detail-heading">
        <span><Icon size={19} /></span>
        <div><small>Coach detail</small><h2 id={`trainer-metric-title-${detail.id}`}>{detail.title}</h2></div>
        <button type="button" onClick={onClose} aria-label={`Close ${detail.title} details`} title="Close details"><X size={17} /></button>
      </div>
      <strong className="trainer-metric-context">{detail.context}</strong>
      {!!detail.data.length && (
        <div className="trainer-detail-bars" role="img" aria-label={`${detail.title} recent pattern`}>
          {detail.data.map((value, index) => (
            <div key={`${detail.labels[index] || index}-${index}`}><span style={{ height: `${Math.max(12, (value / maxValue) * 100)}%` }} /><small>{detail.labels[index] || index + 1}</small></div>
          ))}
        </div>
      )}
      <p>{detail.explanation}</p>
      <div className="trainer-coaching-prompt"><MessageSquare size={16} /><p><strong>Coaching prompt</strong>{detail.prompt}</p></div>
      <button className="secondary-btn trainer-detail-action" type="button" onClick={onAction}>{detail.actionLabel}<ChevronRight size={16} /></button>
    </section>
  );
}

function FeedbackScore({ label, value, inverse = false }) {
  const tone = inverse ? 6 - Number(value) : Number(value);
  return <div><span>{label}</span><strong>{value}/5</strong><i className={tone >= 4 ? 'good' : tone >= 3 ? 'steady' : 'watch'} style={{ '--score-width': `${Number(value) * 20}%` }} /></div>;
}

function SummaryRow({ label, value }) {
  return <div className="summary-line"><strong>{label}</strong><span>{value}</span></div>;
}

function formatDate(value) {
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatShortDate(value) {
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default TrainerView;
