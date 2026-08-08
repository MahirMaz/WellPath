import React, { useMemo } from 'react';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays,
  CheckCircle2, Clock3, HeartPulse, ShieldAlert, UserCheck, Users,
} from 'lucide-react';
import { Sparkline } from '../patient/Sparkline.jsx';

const metricDefinitions = [
  { id: 'steps', label: 'Steps', key: 'steps', healthKey: 'steps', unit: '', color: 'var(--teal)', flat: 100 },
  { id: 'sleep', label: 'Sleep', key: 'sleep', healthKey: 'sleep_hours', unit: 'hrs', color: 'var(--blue)', flat: 0.15 },
  { id: 'hr', label: 'Resting heart rate', key: 'hr', healthKey: 'resting_heart_rate', unit: 'bpm', color: 'var(--coral)', flat: 0.5 },
  { id: 'exercise', label: 'Exercise', key: 'exercise', healthKey: 'exercise_minutes', unit: 'min', color: 'var(--green)', flat: 1 },
];

function initials(name = '') {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function formatDate(value, fallback = 'Not scheduled') {
  if (!value) return fallback;
  const parsed = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function comparePeriods(rows, definition, range) {
  const values = rows.map((row) => Number(row?.[definition.key])).filter(Number.isFinite);
  if (values.length < 4) return { delta: 0, text: 'Building history', direction: 'flat' };
  const segment = Math.min(range, Math.max(2, Math.floor(values.length / 2)));
  const current = values.slice(-segment);
  const previous = values.slice(-(segment * 2), -segment);
  if (!previous.length) return { delta: 0, text: 'No earlier period', direction: 'flat' };
  const average = (items) => items.reduce((sum, value) => sum + value, 0) / items.length;
  const delta = average(current) - average(previous);
  if (Math.abs(delta) < definition.flat) return { delta, text: 'Similar to prior period', direction: 'flat' };
  const amount = definition.id === 'steps' ? Math.abs(Math.round(delta)).toLocaleString() : Math.abs(delta).toFixed(1);
  return {
    delta,
    text: `${amount}${definition.unit ? ` ${definition.unit}` : ''} ${delta > 0 ? 'higher' : 'lower'}`,
    direction: delta > 0 ? 'up' : 'down',
  };
}

function reviewReason(patient, patientSignals) {
  const activeSignal = patientSignals.find((signal) => signal.status !== 'resolved');
  if (activeSignal) return activeSignal.alert_message || activeSignal.alert_type || 'Lifestyle signal needs review';
  if (String(patient.riskLevel).toLowerCase() === 'medium') return `${patient.primary_focus || 'Lifestyle'} pattern needs follow-up`;
  return 'Routine lifestyle trend review';
}

export default function ClinicianDashboard({
  patients, selectedPatient, selectedHealth, trends, signals, averages, carePlan,
  trendRange, setTrendRange, onSelectPatient, onOpenTab, onUpdateSignal, savingAction,
}) {
  const activeSignals = signals.filter((signal) => signal.status !== 'resolved');
  const selectedPatientId = Number(selectedPatient?.patient_id);
  const selectedSignals = activeSignals.filter((signal) => Number(signal.patient_id) === selectedPatientId);
  const visibleTrends = trends.slice(-trendRange);
  const roleOrder = { high: 0, medium: 1, low: 2 };
  const queue = useMemo(() => [...patients].sort((a, b) => {
    const aSignal = activeSignals.some((signal) => Number(signal.patient_id) === Number(a.patient_id));
    const bSignal = activeSignals.some((signal) => Number(signal.patient_id) === Number(b.patient_id));
    if (aSignal !== bSignal) return aSignal ? -1 : 1;
    return (roleOrder[String(a.riskLevel).toLowerCase()] ?? 3) - (roleOrder[String(b.riskLevel).toLowerCase()] ?? 3);
  }), [patients, activeSignals]);

  const comparisons = metricDefinitions.map((definition) => ({
    ...definition,
    comparison: comparePeriods(trends, definition, trendRange),
    value: selectedHealth?.[definition.healthKey],
  }));
  const latestSync = selectedHealth?.record_date ? formatDate(selectedHealth.record_date) : 'Not available';
  const followUpDue = carePlan?.review_date ? new Date(`${carePlan.review_date}T12:00:00`) <= new Date(Date.now() + 7 * 86400000) : false;

  return (
    <div className="clinical-command-grid">
      <section className="clinical-main-column">
        <div className="clinical-kpi-row" aria-label="Clinician review summary">
          <ClinicalKpi icon={Users} label="Shared patients" value={patients.length} detail="consented records" />
          <ClinicalKpi icon={ShieldAlert} label="Need review" value={activeSignals.length} detail={`${activeSignals.filter((signal) => !signal.assigned_to).length} unassigned`} tone="alert" />
          <ClinicalKpi icon={CalendarDays} label="Due this week" value={followUpDue ? 1 : 0} detail="plan follow-ups" tone="due" />
          <ClinicalKpi icon={Activity} label="Average score" value={averages.score} detail="lifestyle summary" tone="blue" />
        </div>

        <section className="clinical-work-panel clinical-queue-panel">
          <div className="clinical-section-heading"><div><h2>Review queue</h2><p>Signals and follow-ups that may need attention.</p></div><button type="button" onClick={() => onOpenTab('Signals')}>View all <ArrowRight size={15} /></button></div>
          <div className="clinical-table-wrap">
            <table className="clinical-review-table">
              <thead><tr><th>Patient</th><th>Why it is here</th><th>Level</th><th>Owner</th><th>Last sync</th><th><span className="sr-only">Action</span></th></tr></thead>
              <tbody>{queue.slice(0, 6).map((patient) => {
                const patientSignals = activeSignals.filter((signal) => Number(signal.patient_id) === Number(patient.patient_id));
                const owner = patientSignals.find((signal) => signal.assigned_name)?.assigned_name || 'Unassigned';
                const selected = Number(patient.patient_id) === selectedPatientId;
                return <tr key={patient.patient_id} className={selected ? 'selected' : ''}>
                  <td><button className="clinical-patient-cell" type="button" onClick={() => onSelectPatient(patient)}><span>{initials(patient.full_name)}</span><strong>{patient.full_name}</strong></button></td>
                  <td><span className="clinical-reason">{reviewReason(patient, patientSignals)}</span></td>
                  <td><span className={`risk ${String(patient.riskLevel).toLowerCase()}`}>{patient.riskLevel || 'Routine'}</span></td>
                  <td><span className={owner === 'Unassigned' ? 'clinical-unassigned' : ''}>{owner}</span></td>
                  <td>{selected ? latestSync : 'Shared record'}</td>
                  <td><button className="clinical-review-button" type="button" onClick={() => onSelectPatient(patient)}>{selected ? 'Selected' : 'Review'}</button></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </section>

        <div className="clinical-lower-grid">
          <section className="clinical-work-panel clinical-trends-panel">
            <div className="clinical-section-heading"><div><h2>Recent trends</h2><p>{selectedPatient?.full_name || 'Select a patient'} - directly compared with the prior period.</p></div><div className="clinical-range" aria-label="Trend period">{[7, 14, 30].map((days) => <button key={days} type="button" className={trendRange === days ? 'active' : ''} onClick={() => setTrendRange(days)}>{days}D</button>)}</div></div>
            <div className="clinical-small-multiples">
              {comparisons.map((metric) => <article key={metric.id}>
                <div><span>{metric.label}</span><strong>{metric.value ?? 'N/A'} {metric.value != null && <small>{metric.unit}</small>}</strong></div>
                <Sparkline data={visibleTrends.map((row) => row[metric.key])} color={metric.color} compact />
                <TrendChange {...metric.comparison} />
              </article>)}
            </div>
            <button className="clinical-inline-action" type="button" onClick={() => onOpenTab('Trends')}>Open full trend review <ArrowRight size={15} /></button>
          </section>

          <section className="clinical-work-panel clinical-signals-panel">
            <div className="clinical-section-heading"><div><h2>Open lifestyle signals</h2><p>Conversation prompts, not diagnoses.</p></div><button type="button" onClick={() => onOpenTab('Signals')}>View all</button></div>
            <div className="clinical-signal-list">
              {activeSignals.slice(0, 4).map((signal) => <article key={signal.alert_id}>
                <span className={`clinical-signal-icon ${String(signal.alert_level).toLowerCase()}`}><ShieldAlert size={15} /></span>
                <div><strong>{signal.alert_type}</strong><small>{signal.full_name} - {formatDate(signal.alert_date, 'Recent')}</small></div>
                {!signal.assigned_to && <button type="button" onClick={() => onUpdateSignal(signal.alert_id, { assigned_to: 'me', status: 'in_review' })} disabled={savingAction === `signal-${signal.alert_id}`}>Assign</button>}
                {signal.assigned_to && signal.status !== 'resolved' && <button type="button" onClick={() => onUpdateSignal(signal.alert_id, { status: 'resolved' })} disabled={savingAction === `signal-${signal.alert_id}`}>Resolve</button>}
              </article>)}
              {!activeSignals.length && <div className="clinical-empty"><CheckCircle2 size={18} /> No open signals.</div>}
            </div>
          </section>

          <section className="clinical-work-panel clinical-followup-panel">
            <div className="clinical-section-heading"><div><h2>Plan follow-up</h2><p>Keep review dates and next steps visible.</p></div><button type="button" onClick={() => onOpenTab('Plans')}>Open plan</button></div>
            <div className="clinical-followup-row"><span><CalendarDays size={18} /></span><div><strong>{selectedPatient?.full_name}</strong><small>{carePlan?.focus || 'Lifestyle consistency'}</small></div><time>{formatDate(carePlan?.review_date)}</time></div>
            <div className="clinical-plan-summary"><span>Status <strong>{carePlan?.status || 'Not set'}</strong></span><p>{carePlan?.recommendation || 'Agree on one manageable next step with the patient.'}</p></div>
          </section>
        </div>
      </section>

      <aside className="clinical-patient-rail" aria-label="Selected patient snapshot">
        <div className="clinical-rail-heading"><div><span>{initials(selectedPatient?.full_name)}</span><div><h2>{selectedPatient?.full_name || 'No patient selected'}</h2><p>{selectedPatient?.primary_focus || 'Select a patient to review'}</p></div></div><span className={`risk ${String(selectedPatient?.riskLevel || 'low').toLowerCase()}`}>{selectedPatient?.riskLevel || 'Routine'} review</span></div>
        <div className="clinical-consent"><CheckCircle2 size={15} /> Consent {selectedPatient?.consent_status ? 'granted' : 'not confirmed'}</div>
        <div className="clinical-rail-metrics">
          {comparisons.map((metric) => <div key={metric.id}><span>{metric.label}</span><strong>{metric.value ?? 'N/A'} {metric.value != null && <small>{metric.unit}</small>}</strong><TrendChange {...metric.comparison} compact /></div>)}
        </div>
        <div className="clinical-rail-summary">
          <span>Lifestyle score <strong>{selectedPatient?.healthScore || 'N/A'}</strong></span>
          <span>Latest sync <strong>{latestSync}</strong></span>
          <span>Open signals <strong>{selectedSignals.length}</strong></span>
          <span>Next review <strong>{formatDate(carePlan?.review_date)}</strong></span>
        </div>
        <button className="primary-btn clinical-rail-action" type="button" onClick={() => onOpenTab('Trends')}>Review patient trends <ArrowRight size={16} /></button>
        <div className="clinical-rail-boundary"><HeartPulse size={16} /><p>Lifestyle trend support only. This workspace does not diagnose conditions.</p></div>
      </aside>
    </div>
  );
}

function ClinicalKpi({ icon: Icon, label, value, detail, tone = '' }) {
  return <article className={`clinical-kpi ${tone}`}><span><Icon size={18} /></span><div><small>{label}</small><strong>{value}</strong><p>{detail}</p></div></article>;
}

function TrendChange({ direction, text, compact = false }) {
  const Icon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Clock3;
  return <span className={`clinical-change ${direction} ${compact ? 'compact' : ''}`}><Icon size={compact ? 12 : 13} /> {text}</span>;
}
