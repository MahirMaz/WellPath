import React, { useState } from 'react';
import {
  Stethoscope, HeartPulse, Droplets, Scale, Ruler, Moon, Footprints, ShieldCheck,
  CalendarDays, Download, Printer, Plus, Trash2,
} from 'lucide-react';
import { usePatientList } from './usePatientLocal.js';
import { QuestionsCard } from './QuestionsCard.jsx';

const fmt = (v, d = 0) =>
  (v == null || v === '' || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString(undefined, { maximumFractionDigits: d }));

const heightText = (inches) => {
  if (!inches) return '—';
  return `${Math.floor(inches / 12)}′${Math.round(inches % 12)}″`;
};
const shortDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const DAYS_SHOWN = 14;

export function ClinicalDataPage({ patientId, patientData = {}, healthLog = [] }) {
  const p = patientData;
  const [bpSys, setBpSys] = useState('');
  const [bpDia, setBpDia] = useState('');
  const [bpPulse, setBpPulse] = useState('');
  const [bpReadings, bpLog] = usePatientList(patientId, 'bplog');

  const bpTarget = (p.bpSystolicTargetMax && p.bpDiastolicTargetMax)
    ? `Target < ${p.bpSystolicTargetMax}/${p.bpDiastolicTargetMax}` : null;
  const hrBaseline = (p.restingHrBaselineLow && p.restingHrBaselineHigh)
    ? `Baseline ${p.restingHrBaselineLow}–${p.restingHrBaselineHigh} bpm` : null;

  const vitals = [
    { icon: Droplets, label: 'Blood pressure', value: p.bloodPressure || '—', unit: 'mmHg', sub: bpTarget },
    { icon: HeartPulse, label: 'Resting heart rate', value: p.heartRate ? fmt(p.heartRate) : '—', unit: 'bpm', sub: hrBaseline },
    { icon: Scale, label: 'Weight', value: p.weightLbs ? fmt(p.weightLbs) : '—', unit: 'lb', sub: p.bmi ? `BMI ${fmt(p.bmi, 1)}` : null },
    { icon: Ruler, label: 'Height', value: heightText(p.heightInches), unit: '', sub: p.age ? `Age ${fmt(p.age)}` : null },
    { icon: Moon, label: 'Sleep', value: fmt(p.sleep, 1), unit: 'hrs', sub: p.sleepConsistency ? `${fmt(p.sleepConsistency)}% consistency` : null },
    { icon: Footprints, label: 'Steps today', value: fmt(p.steps), unit: '', sub: p.stepGoal ? `Goal ${fmt(p.stepGoal)}` : null },
  ];

  const dateText = (row) => {
    const d = row.recordDate ? new Date(row.recordDate) : null;
    if (d && !Number.isNaN(d.getTime())) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return row.day ?? '—';
  };
  const columns = [
    { key: 'date', label: 'Date', day: true, render: (r) => dateText(r), raw: (r) => dateText(r) },
    { key: 'steps', label: 'Steps', render: (r) => fmt(r.steps), raw: (r) => r.steps ?? '' },
    { key: 'sleep', label: 'Sleep', render: (r) => fmt(r.sleep, 1), raw: (r) => r.sleep ?? '' },
    { key: 'hr', label: 'Rest HR', render: (r) => fmt(r.hr), raw: (r) => r.hr ?? '' },
    { key: 'bp', label: 'BP', render: (r) => (r.systolicBp && r.diastolicBp ? `${fmt(r.systolicBp)}/${fmt(r.diastolicBp)}` : '—'), raw: (r) => (r.systolicBp && r.diastolicBp ? `${r.systolicBp}/${r.diastolicBp}` : '') },
    { key: 'exercise', label: 'Exercise', render: (r) => fmt(r.exercise), raw: (r) => r.exercise ?? '' },
    { key: 'activeMinutes', label: 'Active', render: (r) => fmt(r.activeMinutes), raw: (r) => r.activeMinutes ?? '' },
    { key: 'sedentaryHours', label: 'Sedentary', render: (r) => fmt(r.sedentaryHours, 1), raw: (r) => r.sedentaryHours ?? '' },
    { key: 'caloriesBurned', label: 'Calories', render: (r) => fmt(r.caloriesBurned), raw: (r) => r.caloriesBurned ?? '' },
  ];
  const rows = [...healthLog].reverse().slice(0, DAYS_SHOWN);

  const fileStamp = new Date().toISOString().slice(0, 10);
  const patientSlug = (p.name || 'patient').toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const downloadCsv = () => {
    const header = columns.map((c) => c.label).join(',');
    const body = rows.map((r) => columns.map((c) => String(c.raw(r))).join(',')).join('\n');
    const csv = `${header}\n${body}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wellpath-${patientSlug}-${fileStamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const addBp = (e) => {
    e.preventDefault();
    const sys = Number(bpSys);
    const dia = Number(bpDia);
    const pulse = bpPulse ? Number(bpPulse) : null;
    if (!sys || !dia || sys <= 0 || dia <= 0) return;
    bpLog.add({ sys, dia, pulse, date: new Date().toISOString() });
    setBpSys('');
    setBpDia('');
    setBpPulse('');
  };

  return (
    <div className="mobile-flow">
      <div className="mobile-section-title">
        <div>
          <span>Clinical data</span>
          <h2>Clinician</h2>
        </div>
        <Stethoscope size={19} />
      </div>

      <section className="support-card">
        <h3><HeartPulse size={18} /> Latest vitals</h3>
        <p className="trainer-sub">Most recent measured values{p.lastMeasurementDate ? ` · recorded ${shortDate(p.lastMeasurementDate)}` : ''}.</p>
        <div className="trainer-stats">
          {vitals.map((v) => (
            <div className="trainer-stat" key={v.label}>
              <span className="trainer-stat-icon"><v.icon size={16} /></span>
              <span className="trainer-stat-label">{v.label}</span>
              <strong className="trainer-stat-value">{v.value}{v.unit ? <span className="clin-unit"> {v.unit}</span> : ''}</strong>
              {v.sub && <em className="trainer-stat-sub">{v.sub}</em>}
            </div>
          ))}
        </div>
      </section>

      <section className="support-card">
        <div className="careteam-goals-head">
          <h3><CalendarDays size={18} /> Recent daily log</h3>
          {rows.length > 0 && (
            <div className="data-actions">
              <button type="button" className="data-action-btn" onClick={downloadCsv}><Download size={14} /> CSV</button>
              <button type="button" className="data-action-btn" onClick={() => window.print()}><Printer size={14} /> Print</button>
            </div>
          )}
        </div>
        <p className="trainer-sub">Raw daily readings — last {Math.min(DAYS_SHOWN, rows.length)} days, most recent first.</p>
        {rows.length ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>{columns.map((c) => <th key={c.key} className={c.day ? 'data-day' : ''}>{c.label}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.recordDate || i}>
                    {columns.map((c) => (
                      <td key={c.key} className={c.day ? 'data-day' : ''}>{c.render(row)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="careteam-muted">No daily readings available yet.</p>
        )}
      </section>

      {/* Home BP log — self-measured readings the clinician relies on */}
      <section className="support-card">
        <div className="careteam-goals-head">
          <h3><Droplets size={18} /> Home blood pressure log</h3>
          {bpReadings.length > 0 && <span className="careteam-goal-count">{bpReadings.length} logged</span>}
        </div>
        <form className="exercise-form" onSubmit={addBp}>
          <div className="exercise-form-row bp-row">
            <input type="number" min="1" value={bpSys} onChange={(e) => setBpSys(e.target.value)} placeholder="Systolic" />
            <input type="number" min="1" value={bpDia} onChange={(e) => setBpDia(e.target.value)} placeholder="Diastolic" />
            <input type="number" min="1" value={bpPulse} onChange={(e) => setBpPulse(e.target.value)} placeholder="Pulse" />
            <button className="secondary-btn" type="submit"><Plus size={16} /> Log</button>
          </div>
        </form>
        <div className="exercise-list">
          {bpReadings.length === 0 && (
            <p className="careteam-muted">No home readings yet. Log one taken at rest.</p>
          )}
          {bpReadings.map((b) => (
            <div className="exercise-item" key={b.id}>
              <span className="ex-min-val">{b.sys}/{b.dia} <span className="clin-unit">mmHg</span></span>
              <div className="ex-main">
                <em>{shortDate(b.date)}{b.pulse ? ` · ${b.pulse} bpm` : ''}</em>
              </div>
              <button onClick={() => bpLog.remove(b.id)} aria-label="Remove reading"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </section>

      {/* Questions to bring to the appointment — patient-authored */}
      <QuestionsCard
        patientId={patientId}
        name="questions.clinician"
        title="Questions for your clinician"
        placeholder="e.g. Should I keep monitoring my BP at home?"
      />

      <div className="quiet-disclaimer">
        <ShieldCheck size={15} /> Measured values only — no scores, predictions, or interpretation. Not medical advice.
      </div>
    </div>
  );
}
