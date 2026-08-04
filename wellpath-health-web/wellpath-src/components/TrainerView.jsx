import React, { useState, useEffect } from 'react';
import { Menu, LogOut, Moon, Sun, MessageSquare, Users } from 'lucide-react';
import { api } from '../api';

function TrainerView({ user, onLogout, theme, setTheme }) {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState(''); // '', 'saved', 'error'

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const data = await api.getTrainerPatients();
      setPatients(data);
      if (data.length > 0) {
        setSelectedPatient(data[0]);
        const noteData = await api.getTrainerNote(data[0].patient_id);
        setNote(noteData.note || '');
      }
    } catch (err) {
      console.error('Failed to load patients:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectPatient = async (patient) => {
    setSelectedPatient(patient);
    try {
      const noteData = await api.getTrainerNote(patient.patient_id);
      setNote(noteData.note || '');
    } catch (err) {
      console.error('Failed to load note:', err);
    }
  };

  const saveNote = async () => {
    if (!selectedPatient) return;
    try {
      await api.updateTrainerNote(selectedPatient.patient_id, note);
      setSaveState('saved');
      setTimeout(() => setSaveState(''), 2500);
    } catch (err) {
      setSaveState('error');
      setTimeout(() => setSaveState(''), 4000);
    }
  };

  if (loading) {
    return (
      <div className="trainer-shell">
        <div className="loading-center">Loading patients...</div>
      </div>
    );
  }

  return (
    <div className="trainer-shell">
      <div className="trainer-header">
        <Menu size={20} />
        <div className="avatar">T</div>
        <div>
          <h2>Trainer Dashboard</h2>
          <p>Welcome, {user?.name}</p>
        </div>
        <button
          className="logout-btn"
          aria-label={theme === 'dark' ? 'Use light theme' : 'Use dark theme'}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button className="logout-btn" aria-label="Sign out" onClick={onLogout}>
          <LogOut size={16} />
        </button>
      </div>

      <div className="support-card">
        <h3><Users size={18} /> Your Patients</h3>
        <div className="patient-list">
          {patients.map((patient) => (
            <button
              key={patient.patient_id}
              className={`patient-row ${selectedPatient?.patient_id === patient.patient_id ? 'selected' : ''}`}
              onClick={() => selectPatient(patient)}
            >
              <strong>{patient.full_name}</strong>
              <span>{patient.primary_focus || 'No focus set'}</span>
            </button>
          ))}
        </div>
      </div>

      {selectedPatient && (
        <div className="support-card">
          <h3>Patient: {selectedPatient.full_name}</h3>
          <div className="workout-list">
            <div>
              <strong>Activity Consistency</strong>
              <span>{selectedPatient.kpis?.['Activity Consistency'] || 'N/A'}%</span>
            </div>
            <div>
              <strong>Recovery Score</strong>
              <span>{selectedPatient.kpis?.['Recovery Score'] || 'N/A'}</span>
            </div>
            <div>
              <strong>Steps</strong>
              <span>{selectedPatient.metrics?.steps?.toLocaleString() || 'N/A'}</span>
            </div>
            <div>
              <strong>Sleep</strong>
              <span>{selectedPatient.metrics?.sleep_hours || 'N/A'} hrs</span>
            </div>
          </div>

          <h4>Encouragement Note</h4>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Write an encouragement note..."
            rows="4"
          />
          <div className="trainer-save-row">
            <button className="secondary-btn" onClick={saveNote}>
              <MessageSquare size={16} /> Save Note
            </button>
            {saveState === 'saved' && <span className="save-msg ok">Saved ✓</span>}
            {saveState === 'error' && <span className="save-msg err">Couldn't save — try again</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export default TrainerView;
