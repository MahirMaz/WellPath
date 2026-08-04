import React, { useState, useEffect } from 'react';
import {
  Stethoscope, Users, LogOut, Moon, Sun, RefreshCw,
  Footprints, HeartPulse, Check, Droplets, Scale, Ruler, Activity,
} from 'lucide-react';
import { api } from '../api';
import { Sparkline } from './shared/Sparkline.jsx';

// Clinician dashboard — raw data only. No AI summaries, no risk/health scores or
// other predictors: just measured values, trends, open alerts, and recorded KPIs.
function ClinicianView({ user, onLogout, theme, setTheme }) {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Overview');
  const [resolvingIds, setResolvingIds] = useState([]);

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const data = await api.getClinicianPatients();
      setPatients(data);
      if (data.length > 0) {
        const details = await api.getPatientDetails(data[0].patient_id);
        setSelectedPatient({ ...data[0], details });
      }
    } catch (err) {
      console.error('Failed to load patients:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectPatient = async (patient) => {
    try {
      const details = await api.getPatientDetails(patient.patient_id);
      setSelectedPatient({ ...patient, details });
    } catch (err) {
      console.error('Failed to load patient details:', err);
    }
  };

  // Mark an alert resolved and drop it from the current view without a refetch.
  const resolveAlert = async (alertId) => {
    setResolvingIds((ids) => [...ids, alertId]);
    try {
      await api.resolveAlert(alertId);
      setSelectedPatient((current) => {
        if (!current?.details) return current;
        return {
          ...current,
          details: {
            ...current.details,
            alerts: current.details.alerts.filter((a) => a.alert_id !== alertId),
          },
        };
      });
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    } finally {
      setResolvingIds((ids) => ids.filter((id) => id !== alertId));
    }
  };

  const providerTabs = ['Overview', 'Signals', 'Reports'];

  if (loading) {
    return (
      <div className="provider-shell">
        <div className="loading-center">Loading patients...</div>
      </div>
    );
  }

  const profile = selectedPatient?.details?.profile || {};
  const health = selectedPatient?.details?.health || {};
  // Reports: keep recorded KPIs, but not the derived score/risk predictors
  // (Health Score, Risk Score, Recovery Score, etc.).
  const rawKpis = (selectedPatient?.details?.kpis || [])
    .filter((k) => !/score|risk/i.test(k.kpi_name));

  const vitals = [
    { icon: HeartPulse, label: 'Resting HR', value: fmtUnit(health.resting_heart_rate, 'bpm', roundNum) },
    {
      icon: Droplets, label: 'Blood pressure',
      value: (health.systolic_bp && health.diastolic_bp) ? `${roundNum(health.systolic_bp)}/${roundNum(health.diastolic_bp)} mmHg` : '—',
    },
    { icon: Footprints, label: 'Steps', value: fmtNum(health.steps) },
    { icon: Moon, label: 'Sleep', value: fmtUnit(health.sleep_hours, 'hrs', oneDpNum) },
    { icon: Activity, label: 'Exercise', value: fmtUnit(health.exercise_minutes, 'min', roundNum) },
    { icon: Scale, label: 'Weight', value: fmtUnit(profile.weight_lbs, 'lb', roundNum) },
    { icon: Ruler, label: 'Height', value: profile.height_inches ? heightText(profile.height_inches) : '—' },
  ];

  return (
    <div className="provider-shell">
      <aside className="provider-nav">
        <div className="provider-logo"><Stethoscope size={23} /> WellPath</div>
        {providerTabs.map((item) => (
          <button key={item} className={activeTab === item ? 'active' : ''} onClick={() => setActiveTab(item)}>
            {item}
          </button>
        ))}
        <button className="logout-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button className="logout-btn" onClick={onLogout}>
          <LogOut size={16} /> Sign Out
        </button>
      </aside>

      <section className="provider-main">
        <div className="provider-top">
          <div>
            <h1>Clinician Dashboard <span className="provider-tab-label">· {activeTab}</span></h1>
            <p>Welcome, {user?.name}</p>
          </div>
        </div>

        <div className="schema-banner">
          <Users size={18} />
          <span>{patients.length} patients under your care</span>
        </div>

        <div className="provider-grid">
          <div className="panel">
            <h3>Patient List</h3>
            {patients.map((patient) => (
              <button
                key={patient.patient_id}
                className={`patient-row ${selectedPatient?.patient_id === patient.patient_id ? 'selected' : ''}`}
                onClick={() => selectPatient(patient)}
              >
                <div className="avatar small">
                  {patient.full_name.split(' ').map(p => p[0]).join('')}
                </div>
                <div>
                  <strong>{patient.full_name}</strong>
                  <span>{patient.primary_focus || 'General wellness'}</span>
                </div>
              </button>
            ))}
          </div>

          {selectedPatient && (
            <div className="panel wide">
              <h3>Patient Profile: {selectedPatient.full_name}</h3>
              <div className="workout-list">
                <div>
                  <strong>Primary Focus</strong>
                  <span>{selectedPatient.primary_focus || 'None'}</span>
                </div>
                <div>
                  <strong>Age</strong>
                  <span>{profile.age ? roundNum(profile.age) : '—'}</span>
                </div>
                <div>
                  <strong>Sex</strong>
                  <span>{profile.gender || '—'}</span>
                </div>
                <div>
                  <strong>Consent</strong>
                  <span>{selectedPatient.consent_status ? 'Granted' : 'Pending'}</span>
                </div>
              </div>

              <h4>Latest vitals</h4>
              <div className="clin-vitals">
                {vitals.map((v) => (
                  <div className="clin-vital" key={v.label}>
                    <span className="clin-vital-icon"><v.icon size={15} /></span>
                    <span className="clin-vital-label">{v.label}</span>
                    <strong className="clin-vital-value">{v.value}</strong>
                  </div>
                ))}
              </div>

              {activeTab === 'Overview' && selectedPatient.details?.health && (
                <div>
                  <h4>14-day trends</h4>
                  <div className="clin-trend-grid">
                    <ClinTrend icon={Footprints} label="Steps" color="var(--wellpath-accent)"
                      trends={selectedPatient.details.trends} field="steps" format={fmtNum} />
                    <ClinTrend icon={HeartPulse} label="Resting HR" color="#f0805a" unit="bpm"
                      trends={selectedPatient.details.trends} field="resting_heart_rate" format={roundNum} />
                    <ClinTrend icon={Moon} label="Sleep" color="#8b5cf6" unit="hrs"
                      trends={selectedPatient.details.trends} field="sleep_hours" format={oneDpNum} />
                    <ClinTrend icon={Droplets} label="Systolic BP" color="#e0596b" unit="mmHg"
                      trends={selectedPatient.details.trends} field="systolic_bp" format={roundNum} />
                  </div>
                </div>
              )}

              {activeTab === 'Signals' && (selectedPatient.details?.alerts?.length > 0 ? (
                <div>
                  <h4>Open alerts <span className="clin-alert-count">{selectedPatient.details.alerts.length}</span></h4>
                  <div className="clin-alert-list">
                    {selectedPatient.details.alerts.map((alert) => (
                      <div key={alert.alert_id} className={`clin-alert-row level-${alert.alert_level}`}>
                        <span className="clin-alert-dot" />
                        <div className="clin-alert-body">
                          <div className="clin-alert-top">
                            <strong>{alert.alert_type}</strong>
                            <em className={`severity ${alert.alert_level}`}>{alert.alert_level}</em>
                          </div>
                          {alert.alert_message && <p>{alert.alert_message}</p>}
                        </div>
                        <button
                          type="button"
                          className="clin-alert-resolve"
                          onClick={() => resolveAlert(alert.alert_id)}
                          disabled={resolvingIds.includes(alert.alert_id)}
                          title="Mark resolved"
                        >
                          {resolvingIds.includes(alert.alert_id) ? <RefreshCw size={14} className="spinning" /> : <Check size={14} />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="provider-empty">No open alerts for this patient.</p>
              ))}

              {activeTab === 'Reports' && (rawKpis.length > 0 ? (
                <div>
                  <h4>KPI Values</h4>
                  <div className="workout-list">
                    {rawKpis.map((kpi) => (
                      <div key={kpi.kpi_name}>
                        <strong>{kpi.kpi_name}</strong>
                        <span>{[kpi.numeric_value, kpi.text_value].filter((x) => x != null && x !== '').join(' · ') || '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="provider-empty">No recorded KPI values for this patient.</p>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// A labelled 14-day trend row: icon, name, sparkline, and the latest value.
function ClinTrend({ icon: Icon, label, color, unit, trends, field, format }) {
  const values = (trends || []).map((d) => d[field]);
  const nums = values.map(Number).filter((v) => Number.isFinite(v));
  const latest = nums.length ? nums[nums.length - 1] : null;
  return (
    <div className="clin-trend-row">
      <span className="clin-trend-icon" style={{ color }}><Icon size={15} /></span>
      <span className="clin-trend-label">{label}</span>
      <Sparkline values={values} color={color} width={110} height={30} />
      <span className="clin-trend-latest">
        <strong>{latest != null && format ? format(latest) : latest ?? '—'}</strong>
        {unit && <em>{unit}</em>}
      </span>
    </div>
  );
}

const fmtNum = (v) => (Number.isFinite(Number(v)) ? Number(v).toLocaleString() : '—');
const roundNum = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : '—');
const oneDpNum = (v) => (Number.isFinite(Number(v)) ? Number(v).toFixed(1) : '—');
const fmtUnit = (v, unit, format) => (Number.isFinite(Number(v)) ? `${format(v)} ${unit}` : '—');
const heightText = (inches) => `${Math.floor(inches / 12)}′${Math.round(inches % 12)}″`;

export default ClinicianView;
