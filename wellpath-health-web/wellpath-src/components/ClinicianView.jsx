import React, { useState, useEffect } from 'react';
import { Stethoscope, Users, LogOut, Moon, Sun, User } from 'lucide-react';
import { api } from '../api';

function ClinicianView({ user, onLogout, theme, setTheme }) {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Overview');

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

  const providerTabs = ['Overview', 'Signals', 'Reports'];

  if (loading) {
    return (
      <div className="provider-shell">
        <div className="loading-center">Loading patients...</div>
      </div>
    );
  }

  return (
    <div className="provider-shell">
      <aside className="provider-nav">
        <div className="provider-logo"><Stethoscope size={23} /> WellPath</div>
        {providerTabs.map((item) => (
          <button key={item} className={activeTab === item ? 'active' : ''} onClick={() => setActiveTab(item)}>
            {item}
          </button>
        ))}
        <button
          className="logout-btn"
          aria-label={theme === 'dark' ? 'Use light theme' : 'Use dark theme'}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
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
                  <span>Risk: {patient.riskLevel || 'N/A'}</span>
                </div>
                <em className={`risk ${(patient.riskLevel || '').toLowerCase()}`}>
                  {patient.riskLevel || 'Unknown'}
                </em>
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
                  <strong>Health Score</strong>
                  <span>{selectedPatient.healthScore || 'N/A'}</span>
                </div>
                <div>
                  <strong>Risk Score</strong>
                  <span>{selectedPatient.riskScore || 'N/A'}</span>
                </div>
                <div>
                  <strong>Consent</strong>
                  <span>{selectedPatient.consent_status ? '✅ Granted' : '❌ Pending'}</span>
                </div>
              </div>

              {activeTab === 'Overview' && selectedPatient.details?.health && (
                <div>
                  <h4>Latest Health Metrics</h4>
                  <div className="workout-list">
                    <div>
                      <strong>Steps</strong>
                      <span>{selectedPatient.details.health.steps?.toLocaleString() || 'N/A'}</span>
                    </div>
                    <div>
                      <strong>Sleep</strong>
                      <span>{selectedPatient.details.health.sleep_hours || 'N/A'} hrs</span>
                    </div>
                    <div>
                      <strong>Heart Rate</strong>
                      <span>{selectedPatient.details.health.resting_heart_rate || 'N/A'} bpm</span>
                    </div>
                    <div>
                      <strong>Exercise</strong>
                      <span>{selectedPatient.details.health.exercise_minutes || 'N/A'} min</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'Signals' && (selectedPatient.details?.alerts?.length > 0 ? (
                <div>
                  <h4>Recent Alerts</h4>
                  <div className="workout-list">
                    {selectedPatient.details.alerts.map((alert) => (
                      <div key={alert.alert_id}>
                        <strong>{alert.alert_type}</strong>
                        <span className={`severity ${alert.alert_level}`}>
                          {alert.alert_level}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="provider-empty">No signals (alerts) for this patient.</p>
              ))}

              {activeTab === 'Reports' && (selectedPatient.details?.kpis?.length > 0 ? (
                <div>
                  <h4>KPI Values</h4>
                  <div className="workout-list">
                    {selectedPatient.details.kpis.map((kpi) => (
                      <div key={kpi.kpi_name}>
                        <strong>{kpi.kpi_name}</strong>
                        <span>{kpi.numeric_value} - {kpi.text_value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="provider-empty">No KPI values recorded for this patient.</p>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default ClinicianView;
