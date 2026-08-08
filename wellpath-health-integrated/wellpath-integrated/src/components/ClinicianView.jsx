import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, BarChart3, CalendarDays, CheckCircle2, ClipboardList, Clock3, Download,
  FileText, HeartPulse, History, LayoutDashboard, ListChecks, Lock, LogOut, Moon, Save, Search,
  ShieldAlert, Stethoscope, Sun, Target, UserCheck, Users,
} from 'lucide-react';
import { api } from '../api';
import { Sparkline } from './patient/Sparkline.jsx';
import ClinicianDashboard from './clinician/ClinicianDashboard.jsx';

const providerTabs = [
  { id: 'Overview', icon: LayoutDashboard, description: 'A concise view of current lifestyle trends and review needs.' },
  { id: 'Patients', icon: Users, description: 'Find a patient and review the information they have shared.' },
  { id: 'Trends', icon: BarChart3, description: 'Compare recent steps, sleep, heart rate, and exercise patterns.' },
  { id: 'Signals', icon: ShieldAlert, description: 'Review non-diagnostic lifestyle signals that may support a conversation.' },
  { id: 'Plans', icon: ClipboardList, description: 'Review patient goals and manageable lifestyle recommendations.' },
  { id: 'Reports', icon: FileText, description: 'Preview and export a plain-language trend summary.' },
];

async function optionalFeature(request, fallback) {
  try {
    return await request;
  } catch (error) {
    if (error.status === 404) return fallback;
    throw error;
  }
}

function starterCarePlan(patient) {
  return {
    focus: patient?.primary_focus || 'Lifestyle consistency',
    recommendation: 'Review recent patterns with the patient and agree on one manageable next step.',
    review_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    status: 'active',
  };
}

function ClinicianView({ user, onLogout, theme, setTheme }) {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [signals, setSignals] = useState([]);
  const [trends, setTrends] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('Overview');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [reportStatus, setReportStatus] = useState('');
  const [trendRange, setTrendRange] = useState(7);
  const [notes, setNotes] = useState([]);
  const [carePlan, setCarePlan] = useState(null);
  const [carePlanForm, setCarePlanForm] = useState(null);
  const [auditEvents, setAuditEvents] = useState([]);
  const [actionStatus, setActionStatus] = useState('');
  const [savingAction, setSavingAction] = useState('');

  useEffect(() => {
    fetchPatients();
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeTab]);

  const loadPatient = async (patient) => {
    setDetailLoading(true);
    setError('');
    setReportStatus('');
    try {
      const fallbackPlan = starterCarePlan(patient);
      const [details, trendData, goalData, noteData, carePlanData] = await Promise.all([
        api.getPatientDetails(patient.patient_id),
        api.getTrends(patient.patient_id),
        api.getGoals(patient.patient_id),
        optionalFeature(api.getClinicianNotes(patient.patient_id), []),
        optionalFeature(api.getCarePlan(patient.patient_id), fallbackPlan),
      ]);
      setSelectedPatient({ ...patient, details });
      setTrends(Array.isArray(trendData) ? trendData : []);
      setGoals(Array.isArray(goalData) ? goalData : []);
      setNotes(Array.isArray(noteData) ? noteData : []);
      setCarePlan(carePlanData || fallbackPlan);
      setCarePlanForm(carePlanData || fallbackPlan);
    } catch (loadError) {
      setError(loadError.message || 'The patient details could not be loaded.');
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchPatients = async () => {
    setLoading(true);
    setError('');
    try {
      const [patientData, signalData, auditData] = await Promise.all([
        api.getClinicianPatients(),
        optionalFeature(api.getSignals(), []),
        optionalFeature(api.getAuditEvents(80), []),
      ]);
      setPatients(patientData);
      setSignals(Array.isArray(signalData) ? signalData : []);
      setAuditEvents(Array.isArray(auditData) ? auditData : []);
      if (patientData.length) await loadPatient(patientData[0]);
    } catch (loadError) {
      setError(loadError.message || 'The clinician workspace could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  const filteredPatients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return patients;
    return patients.filter((patient) => (
      patient.full_name.toLowerCase().includes(normalizedQuery)
      || patient.primary_focus?.toLowerCase().includes(normalizedQuery)
      || patient.riskLevel?.toLowerCase().includes(normalizedQuery)
    ));
  }, [patients, query]);

  const selectedHealth = selectedPatient?.details?.health;
  const visibleTrends = trends.slice(-trendRange);
  const activeTabInfo = providerTabs.find((tab) => tab.id === activeTab) || providerTabs[0];
  const openSignalCount = signals.filter((signal) => signal.status !== 'resolved').length;
  const averages = useMemo(() => {
    if (!patients.length) return { score: 0, mediumRisk: 0 };
    return {
      score: Math.round(patients.reduce((sum, patient) => sum + Number(patient.healthScore || 0), 0) / patients.length),
      mediumRisk: patients.filter((patient) => patient.riskLevel === 'Medium').length,
    };
  }, [patients]);

  const exportReport = () => {
    if (!selectedPatient) return;
    const reportLines = [
      'WellPath Health - Lifestyle Trend Summary',
      `Generated: ${new Date().toLocaleString()}`,
      `Patient: ${selectedPatient.full_name}`,
      `Primary focus: ${selectedPatient.primary_focus || 'Not set'}`,
      `Lifestyle review level: ${selectedPatient.riskLevel || 'Not available'}`,
      `Steps: ${selectedHealth?.steps ?? 'Not available'}`,
      `Sleep: ${selectedHealth?.sleep_hours ?? 'Not available'} hours`,
      `Resting heart rate: ${selectedHealth?.resting_heart_rate ?? 'Not available'} bpm`,
      `Exercise: ${selectedHealth?.exercise_minutes ?? 'Not available'} minutes`,
      `Goals: ${goals.map((goal) => `${goal.title} (${goal.status})`).join('; ') || 'No current goals'}`,
      'Use: Lifestyle trend review only. This report is not a diagnosis or medical recommendation.',
    ];
    const blob = new Blob([reportLines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wellpath-${selectedPatient.patient_id}-trend-summary.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setReportStatus('Report downloaded.');
  };

  const reviewSignalPatient = async (patientId) => {
    const patient = patients.find((item) => item.patient_id === Number(patientId));
    if (!patient) return;
    await loadPatient(patient);
    setActiveTab('Trends');
  };

  const updateSignalRecord = async (signalId, updates) => {
    setSavingAction(`signal-${signalId}`);
    setActionStatus('');
    try {
      const saved = await api.updateSignal(signalId, updates);
      setSignals((items) => items.map((signal) => signal.alert_id === saved.alert_id ? saved : signal));
      setActionStatus('Review signal updated.');
      return saved;
    } catch (actionError) {
      setActionStatus(actionError.message || 'The review signal could not be updated.');
      return null;
    } finally {
      setSavingAction('');
    }
  };

  const addSecureNote = async (payload) => {
    if (!selectedPatient) return null;
    setSavingAction('note');
    setActionStatus('');
    try {
      const saved = await api.addClinicianNote(selectedPatient.patient_id, payload);
      setNotes((items) => [saved, ...items]);
      setActionStatus('Secure review note saved.');
      return saved;
    } catch (actionError) {
      setActionStatus(actionError.message || 'The note could not be saved.');
      return null;
    } finally {
      setSavingAction('');
    }
  };

  const saveCarePlan = async (event) => {
    event.preventDefault();
    if (!selectedPatient || !carePlanForm) return;
    setSavingAction('care-plan');
    setActionStatus('');
    try {
      const saved = await api.updateCarePlan(selectedPatient.patient_id, carePlanForm);
      setCarePlan(saved);
      setCarePlanForm(saved);
      setActionStatus('Lifestyle follow-up plan saved.');
    } catch (actionError) {
      setActionStatus(actionError.message || 'The follow-up plan could not be saved.');
    } finally {
      setSavingAction('');
    }
  };

  const submitPatientSearch = async (event) => {
    event.preventDefault();
    const normalized = query.trim().toLowerCase();
    if (normalized) {
      const match = patients.find((patient) => patient.full_name.toLowerCase().includes(normalized));
      if (match) await loadPatient(match);
    }
    setActiveTab('Patients');
  };

  if (loading) {
    return <div className="provider-shell"><div className="loading-center" role="status">Loading clinician workspace...</div></div>;
  }

  if (error && !selectedPatient) {
    return (
      <div className="provider-shell single-state">
        <section className="state-panel" role="alert">
          <Stethoscope size={30} />
          <h2>We could not load the clinician workspace</h2>
          <p>{error}</p>
          <button className="primary-btn" type="button" onClick={fetchPatients}>Try again</button>
        </section>
      </div>
    );
  }

  return (
    <div className="provider-shell">
      <aside className="provider-nav" aria-label="Clinician sections">
        <div className="provider-logo"><span><Stethoscope size={21} /></span><div><strong>WellPath</strong><small>Clinical review</small></div></div>
        {providerTabs.map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? 'active' : ''}
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              aria-label={tab.id}
              title={tab.id}
            >
              <TabIcon size={17} aria-hidden="true" />
              <span>{tab.id}</span>
              {tab.id === 'Signals' && openSignalCount > 0 && <em aria-hidden="true">{openSignalCount}</em>}
            </button>
          );
        })}
        <div className="provider-nav-spacer" />
        <button className="provider-account-action" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>
        <button className="provider-account-action" type="button" onClick={onLogout}><LogOut size={16} /><span>Sign out</span></button>
      </aside>

      <main className="provider-main" aria-busy={detailLoading}>
        <header className="provider-top">
          <div>
            <h1>{activeTab === 'Overview' ? 'Clinician Trend Review' : activeTab}</h1>
            <p>{activeTabInfo.description}</p>
          </div>
          <form className="provider-global-search" onSubmit={submitPatientSearch}>
            <Search size={16} />
            <label className="sr-only" htmlFor="clinician-patient-search">Search patients</label>
            <input id="clinician-patient-search" list="clinician-patient-options" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patients" />
            <datalist id="clinician-patient-options">{patients.map((patient) => <option key={patient.patient_id} value={patient.full_name} />)}</datalist>
          </form>
          <div className="provider-actions">
            <div className="provider-review-context"><UserCheck size={17} /><div><span>Reviewing</span><strong>{selectedPatient?.full_name || 'No patient selected'}</strong></div></div>
            <button type="button" onClick={() => setActiveTab('Patients')}><Users size={16} /> Patient list</button>
            <button type="button" onClick={() => setActiveTab('Signals')}><ShieldAlert size={16} /> Signals</button>
          </div>
        </header>

        <div className="schema-banner">
          <CheckCircle2 size={18} />
          <span>{patients.length} shared patient records. Lifestyle trend support only, not diagnosis.</span>
          {selectedHealth?.record_date && <em><Clock3 size={14} /> Updated {formatReviewDate(selectedHealth.record_date)}</em>}
        </div>
        {detailLoading && <p className="form-feedback" role="status">Updating patient information...</p>}
        {error && <p className="error-message" role="alert">{error}</p>}
        {actionStatus && <p className="provider-action-status" role="status">{actionStatus}</p>}

        {activeTab === 'Overview' && (
          <ClinicianDashboard
            patients={patients}
            selectedPatient={selectedPatient}
            selectedHealth={selectedHealth}
            trends={trends}
            signals={signals}
            averages={averages}
            carePlan={carePlan}
            trendRange={trendRange}
            setTrendRange={setTrendRange}
            onSelectPatient={loadPatient}
            onOpenTab={setActiveTab}
            onUpdateSignal={updateSignalRecord}
            savingAction={savingAction}
          />
        )}
        {activeTab === 'Patients' && (
          <PatientsTab
            patients={filteredPatients}
            selectedPatient={selectedPatient}
            selectedHealth={selectedHealth}
            query={query}
            setQuery={setQuery}
            onSelectPatient={loadPatient}
            notes={notes}
            onAddNote={addSecureNote}
            saving={savingAction === 'note'}
          />
        )}
        {activeTab === 'Trends' && (
          <TrendsTab
            trends={visibleTrends}
            allTrends={trends}
            range={trendRange}
            setRange={setTrendRange}
            health={selectedHealth}
            patient={selectedPatient}
          />
        )}
        {activeTab === 'Signals' && <SignalsTab signals={signals} patients={patients} onReviewPatient={reviewSignalPatient} onUpdateSignal={updateSignalRecord} savingAction={savingAction} clinicianName={user?.name} />}
        {activeTab === 'Plans' && <PlansTab goals={goals} patient={selectedPatient} health={selectedHealth} carePlan={carePlan} carePlanForm={carePlanForm} setCarePlanForm={setCarePlanForm} onSave={saveCarePlan} saving={savingAction === 'care-plan'} />}
        {activeTab === 'Reports' && (
          <ReportsTab patient={selectedPatient} health={selectedHealth} goals={goals} onExport={exportReport} status={reportStatus} auditEvents={auditEvents} />
        )}
      </main>
    </div>
  );
}

function PatientsTab({ patients, selectedPatient, selectedHealth, query, setQuery, onSelectPatient, notes, onAddNote, saving }) {
  return (
    <div className="provider-grid patients-grid">
      <Panel title="Patient directory">
        <label className="search-field">
          <Search size={16} />
          <span className="sr-only">Search patients</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, focus, or level" />
        </label>
        <PatientList patients={patients} selectedPatient={selectedPatient} onSelectPatient={onSelectPatient} />
        {!patients.length && <p className="empty-state">No patients match that search.</p>}
      </Panel>
      <Panel title="Shared patient profile" wide>
        <ProfileSummary patient={selectedPatient} health={selectedHealth} />
        <ClinicianNotes notes={notes} onAddNote={onAddNote} saving={saving} />
      </Panel>
    </div>
  );
}

function TrendsTab({ trends, allTrends, range, setRange, health, patient }) {
  const trendMetrics = [
    { id: 'steps', key: 'steps', label: 'Steps', value: health?.steps, unit: 'steps', color: 'var(--teal)' },
    { id: 'sleep', key: 'sleep', label: 'Sleep', value: health?.sleep_hours, unit: 'hrs', color: 'var(--blue)' },
    { id: 'hr', key: 'hr', label: 'Resting heart rate', value: health?.resting_heart_rate, unit: 'bpm', color: 'var(--coral)' },
    { id: 'exercise', key: 'exercise', label: 'Exercise', value: health?.exercise_minutes, unit: 'min', color: 'var(--green)' },
  ];
  return (
    <div className="provider-grid trends-grid">
      <Panel title={`${patient?.full_name || 'Patient'}: trend review`} wide>
        <div className="trend-review-toolbar">
          <div className="range-control" aria-label="Trend review period">
            {[7, 14, 30].map((days) => (
              <button key={days} type="button" className={range === days ? 'active' : ''} onClick={() => setRange(days)} aria-pressed={range === days}>
                {days} days
              </button>
            ))}
          </div>
          <span><CalendarDays size={15} /> {trends.length} synced days shown</span>
        </div>
        <div className="provider-trend-grid">
          {trendMetrics.map((metric) => {
            const comparison = compareTrendPeriods(allTrends, metric.key, range, metric.id);
            return (
              <article className="provider-trend-card" key={metric.id}>
                <span>{metric.label}</span>
                <strong>{metric.value ?? 'N/A'} <small>{metric.unit}</small></strong>
                <Sparkline data={trends.map((day) => day[metric.key])} color={metric.color} />
                <p className={comparison.tone ? `trend-comparison ${comparison.tone}` : 'trend-comparison'}>{comparison.label}</p>
              </article>
            );
          })}
        </div>
      </Panel>
      <Panel title="Trend interpretation">
        <SummaryLine label="Review period" value={`${trends.length} days`} />
        <SummaryLine label="Primary focus" value={patient?.primary_focus || 'Not set'} />
        <SummaryLine label="Latest sync" value={health?.record_date ? formatReviewDate(health.record_date) : 'Not available'} />
        <p className="panel-note">Use changes over time to guide a conversation. One reading should not be treated as a diagnosis.</p>
      </Panel>
    </div>
  );
}

function SignalsTab({ signals, patients, onReviewPatient, onUpdateSignal, savingAction, clinicianName }) {
  const [level, setLevel] = useState('all');
  const [status, setStatus] = useState('active');
  const visibleSignals = signals.filter((signal) => {
    const levelMatches = level === 'all' || String(signal.alert_level).toLowerCase() === level;
    const statusMatches = status === 'all'
      || (status === 'active' ? signal.status !== 'resolved' : signal.status === status);
    return levelMatches && statusMatches;
  });

  return (
    <div className="provider-grid signals-grid">
      <Panel title="Review queue" wide>
        <div className="signal-filter-row" aria-label="Filter review signals">
          {['all', 'high', 'medium', 'low'].map((filter) => (
            <button key={filter} type="button" className={level === filter ? 'active' : ''} onClick={() => setLevel(filter)} aria-pressed={level === filter}>
              {filter === 'all' ? `All (${signals.length})` : filter}
            </button>
          ))}
        </div>
        <div className="signal-filter-row status-filters" aria-label="Filter review status">
          {['active', 'open', 'in_review', 'resolved', 'all'].map((filter) => (
            <button key={filter} type="button" className={status === filter ? 'active' : ''} onClick={() => setStatus(filter)} aria-pressed={status === filter}>
              {filter === 'in_review' ? 'In review' : filter[0].toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
        {visibleSignals.map((signal) => {
          const patient = patients.find((item) => item.patient_id === Number(signal.patient_id));
          return (
            <article className="signal-row" key={signal.alert_id}>
              <ShieldAlert size={18} />
              <div>
                <strong>{signal.full_name || patient?.full_name || 'Patient'}: {signal.alert_type}</strong>
                <p>{signal.alert_message}</p>
                <small>{signal.alert_date ? formatReviewDate(signal.alert_date) : 'Date not available'} - {signal.assigned_name ? `Owned by ${signal.assigned_name}` : 'Unassigned'}</small>
              </div>
              <div className="signal-actions">
                <span className={`risk ${signal.alert_level}`}>{signal.alert_level} review</span>
                <span className={`signal-status ${signal.status}`}>{signal.status === 'in_review' ? 'in review' : signal.status}</span>
                {!signal.assigned_to && <button type="button" onClick={() => onUpdateSignal(signal.alert_id, { assigned_to: 'me', status: 'in_review' })} disabled={savingAction === `signal-${signal.alert_id}`}>Assign to me</button>}
                {signal.assigned_to && signal.status === 'open' && <button type="button" onClick={() => onUpdateSignal(signal.alert_id, { status: 'in_review' })} disabled={savingAction === `signal-${signal.alert_id}`}>Start review</button>}
                {signal.status !== 'resolved' && <button type="button" onClick={() => onUpdateSignal(signal.alert_id, { status: 'resolved' })} disabled={savingAction === `signal-${signal.alert_id}`}>Resolve</button>}
                {signal.status === 'resolved' && <button type="button" onClick={() => onUpdateSignal(signal.alert_id, { status: 'open' })} disabled={savingAction === `signal-${signal.alert_id}`}>Reopen</button>}
                <button type="button" onClick={() => onReviewPatient(signal.patient_id ?? patient?.patient_id)} disabled={!signal.patient_id && !patient}>Review trend</button>
              </div>
            </article>
          );
        })}
        {!visibleSignals.length && <p className="empty-state">No review signals match these filters.</p>}
      </Panel>
      <Panel title="How to use signals">
        <p className="panel-note">Signals highlight patterns that may be worth discussing. They do not identify a condition or replace clinical judgment.</p>
        <SummaryLine label="Current clinician" value={clinicianName || 'Signed-in clinician'} />
        <SummaryLine label="Open queue" value={`${signals.filter((signal) => signal.status !== 'resolved').length} reviews`} />
        <SummaryLine label="Unassigned" value={`${signals.filter((signal) => !signal.assigned_to && signal.status !== 'resolved').length} reviews`} />
      </Panel>
    </div>
  );
}

function PlansTab({ goals, patient, health, carePlan, carePlanForm, setCarePlanForm, onSave, saving }) {
  return (
    <div className="provider-grid plans-grid">
      <Panel title="Patient goals" wide>
        {goals.map((goal) => (
          <div className="goal-row" key={goal.id}><CheckCircle2 size={17} /><span>{goal.title}</span><em>{goal.status}</em></div>
        ))}
        {!goals.length && <p className="empty-state">No patient goals are available.</p>}
      </Panel>
      <Panel title="Lifestyle follow-up plan">
        {carePlanForm ? (
          <form className="care-plan-form" onSubmit={onSave}>
            <label><span>Shared focus</span><input value={carePlanForm.focus || ''} onChange={(event) => setCarePlanForm({ ...carePlanForm, focus: event.target.value })} maxLength="180" required /></label>
            <label><span>Plain-language recommendation</span><textarea value={carePlanForm.recommendation || ''} onChange={(event) => setCarePlanForm({ ...carePlanForm, recommendation: event.target.value })} rows="5" maxLength="1000" required /></label>
            <div className="care-plan-fields">
              <label><span>Review date</span><input type="date" value={carePlanForm.review_date || ''} onChange={(event) => setCarePlanForm({ ...carePlanForm, review_date: event.target.value })} required /></label>
              <label><span>Status</span><select value={carePlanForm.status || 'active'} onChange={(event) => setCarePlanForm({ ...carePlanForm, status: event.target.value })}><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option></select></label>
            </div>
            <button className="secondary-btn care-plan-save" type="submit" disabled={saving}><Save size={16} /> {saving ? 'Saving...' : 'Save follow-up plan'}</button>
          </form>
        ) : <p className="empty-state">No follow-up plan is available.</p>}
      </Panel>
      <Panel title="Communication guidance">
        <ClipboardList size={22} />
        <p className="panel-note">Use manageable next steps, recognize returning after a break, and avoid pressure around missed days.</p>
        <SummaryLine label="Patient focus" value={patient?.primary_focus || 'Not set'} />
        <SummaryLine label="Current recommendation" value={carePlan?.recommendation || recommendationFor(health)} />
        <div className="provider-boundary-note"><ShieldAlert size={16} /><p>Recommendations here support a lifestyle conversation. They do not automatically diagnose, prescribe, or change the patient&apos;s medical care.</p></div>
      </Panel>
    </div>
  );
}

function ReportsTab({ patient, health, goals, onExport, status, auditEvents }) {
  return (
    <div className="provider-grid reports-grid">
      <Panel title="Report preview" wide>
        <SummaryLine label="Patient" value={patient?.full_name || 'Not selected'} />
        <SummaryLine label="Includes" value="Steps, sleep, heart rate, exercise, goals" />
        <SummaryLine label="Purpose" value="Lifestyle trend conversation" />
        <SummaryLine label="Safety label" value="Non-diagnostic" />
      </Panel>
      <Panel title="Export report">
        <FileText size={24} />
        <p className="panel-note">Download a text summary for the selected patient. The report contains only the sample information shown in this workspace.</p>
        <button className="secondary-btn report-export-btn" type="button" onClick={onExport} disabled={!patient}>
          <Download size={16} /> Download trend summary
        </button>
        {status && <p className="form-feedback" role="status">{status}</p>}
      </Panel>
      <Panel title="Current snapshot">
        <SummaryLine label="Steps" value={health?.steps?.toLocaleString() || 'N/A'} />
        <SummaryLine label="Sleep" value={health?.sleep_hours ? `${health.sleep_hours} hrs` : 'N/A'} />
        <SummaryLine label="Goals" value={`${goals.length} shared`} />
      </Panel>
      <Panel title="Recent access and workflow log" wide>
        <div className="audit-list">
          {auditEvents.slice(0, 12).map((event) => (
            <article key={event.id}>
              <History size={16} />
              <div><strong>{auditLabel(event.event_type)}</strong><small>{event.actor_name || event.actor_role} - {new Date(event.created_at).toLocaleString()}</small></div>
              <span>{event.target_type}{event.target_id ? ` ${event.target_id}` : ''}</span>
            </article>
          ))}
          {!auditEvents.length && <p className="empty-state">No audit events are available.</p>}
        </div>
        <p className="panel-note">The local audit log records access and workflow events without storing AI answers or passwords.</p>
      </Panel>
    </div>
  );
}

function ClinicianNotes({ notes, onAddNote, saving }) {
  const [category, setCategory] = useState('Trend review');
  const [note, setNote] = useState('');

  const submitNote = async (event) => {
    event.preventDefault();
    if (!note.trim()) return;
    const saved = await onAddNote({ category, note: note.trim() });
    if (saved) setNote('');
  };

  return (
    <section className="clinician-notes-section">
      <div className="clinician-notes-heading"><div><Lock size={16} /><strong>Secure clinician notes</strong></div><span>Clinician only</span></div>
      <form className="clinician-note-form" onSubmit={submitNote}>
        <label><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option>Trend review</option><option>Follow-up</option><option>Care coordination</option><option>Patient question</option></select></label>
        <label><span>Note</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows="4" maxLength="2000" placeholder="Record the review context and agreed follow-up" /></label>
        <div><small>{note.length}/2000</small><button className="secondary-btn" type="submit" disabled={saving || !note.trim()}><Save size={15} /> {saving ? 'Saving...' : 'Save secure note'}</button></div>
      </form>
      <div className="clinician-note-list">
        {notes.map((entry) => (
          <article key={entry.id}><div><strong>{entry.category}</strong><span>{entry.author_name} - {new Date(entry.created_at).toLocaleString()}</span></div><p>{entry.note}</p></article>
        ))}
        {!notes.length && <p className="empty-state">No clinician notes for this patient yet.</p>}
      </div>
    </section>
  );
}

function Panel({ title, wide = false, children }) {
  return <section className={`panel ${wide ? 'wide' : ''}`}><h3>{title}</h3>{children}</section>;
}

function PatientList({ patients, selectedPatient, onSelectPatient }) {
  return (
    <div className="patient-list">
      {patients.map((patient) => (
        <button
          key={patient.patient_id}
          type="button"
          className={`patient-row ${selectedPatient?.patient_id === patient.patient_id ? 'selected' : ''}`}
          onClick={() => onSelectPatient(patient)}
          aria-pressed={selectedPatient?.patient_id === patient.patient_id}
        >
          <div className="avatar small">{patient.full_name.split(' ').map((part) => part[0]).join('').slice(0, 3)}</div>
          <div><strong>{patient.full_name}</strong><span>{patient.primary_focus}</span></div>
          <em className={`risk ${(patient.riskLevel || '').toLowerCase()}`}>{patient.riskLevel || 'Unknown'} review</em>
        </button>
      ))}
    </div>
  );
}

function ProfileSummary({ patient, health }) {
  if (!patient) return <p className="empty-state">Select a patient to review their shared profile.</p>;
  return (
    <div className="profile-summary">
      <div className="profile-card">
        <div className="avatar">{patient.full_name.split(' ').map((part) => part[0]).join('').slice(0, 3)}</div>
        <div><h4>{patient.full_name}</h4><p>{patient.primary_focus}</p></div>
      </div>
      <div className="workout-list">
        <SummaryLine label="Lifestyle score" value={patient.healthScore || 'N/A'} />
        <SummaryLine label="Lifestyle review level" value={patient.riskLevel || 'N/A'} />
        <SummaryLine label="Consent" value={patient.consent_status ? 'Granted' : 'Pending'} />
        <SummaryLine label="Age" value={(patient.details?.profile?.age || health?.age) ? `${patient.details?.profile?.age || health.age} years` : 'Not shared'} />
        <SummaryLine label="Latest sync" value={health?.record_date ? formatReviewDate(health.record_date) : 'Not available'} />
        <SummaryLine label="Steps" value={health?.steps?.toLocaleString() || 'N/A'} />
        <SummaryLine label="Sleep" value={health?.sleep_hours ? `${health.sleep_hours} hrs` : 'N/A'} />
        <SummaryLine label="Resting heart rate" value={health?.resting_heart_rate ? `${health.resting_heart_rate} bpm` : 'N/A'} />
        <SummaryLine label="Exercise" value={health?.exercise_minutes ? `${health.exercise_minutes} min` : 'N/A'} />
      </div>
    </div>
  );
}

function SummaryLine({ label, value }) {
  return <div className="summary-line"><strong>{label}</strong><span>{value}</span></div>;
}

function formatReviewDate(value) {
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function auditLabel(eventType) {
  return String(eventType || 'event')
    .split('_')
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ');
}

function compareTrendPeriods(history, key, range, metricId) {
  const values = history
    .map((row) => Number(row?.[key]))
    .filter(Number.isFinite);
  if (values.length < range + 2) return { label: 'No earlier period available', tone: '' };

  const current = values.slice(-range);
  const previous = values.slice(-(range * 2), -range);
  if (!previous.length) return { label: 'No earlier period available', tone: '' };

  const mean = (items) => items.reduce((sum, value) => sum + value, 0) / items.length;
  const delta = mean(current) - mean(previous);
  const nearFlat = Math.abs(delta) < (metricId === 'steps' ? 100 : 0.15);
  if (nearFlat) return { label: 'Similar to the prior period', tone: '' };

  const formatted = metricId === 'steps'
    ? `${Math.abs(Math.round(delta)).toLocaleString()} steps`
    : `${Math.abs(delta).toFixed(1)} ${metricId === 'sleep' ? 'hrs' : metricId === 'hr' ? 'bpm' : 'min'}`;
  const direction = delta > 0 ? 'higher' : 'lower';
  const tone = metricId === 'hr' ? '' : delta > 0 ? 'good' : 'watch';
  return { label: `${formatted} ${direction} than the prior period`, tone };
}

function recommendationFor(health) {
  if (!health) return 'Select a patient to review a relevant lifestyle next step.';
  if (Number(health.sleep_hours) < 7) return 'Protect a steady sleep window and review the pattern again after several nights.';
  if (Number(health.steps) < 8000) return 'Consider one repeatable walking window rather than a large one-day step increase.';
  return 'Recent activity and sleep are steady. Support the routine with one manageable next step.';
}

export default ClinicianView;
