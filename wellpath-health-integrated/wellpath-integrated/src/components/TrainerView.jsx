import React, { useState, useEffect } from 'react';
import {
  LogOut, Moon, Sun, Users, Sparkles, Save, Footprints, Moon as MoonIcon,
  Timer, HeartPulse, Activity, RefreshCw, Target,
} from 'lucide-react';
import { api } from '../api';
import { Sparkline } from './shared/Sparkline.jsx';

function TrainerView({ user, onLogout, theme, setTheme }) {
  const [patients, setPatients] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState(''); // '', 'saved', 'error'
  const [draftState, setDraftState] = useState('idle'); // 'idle' | 'drafting' | 'error'

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const data = await api.getTrainerPatients();
      setPatients(data);
      if (data.length > 0) {
        setSelectedId(data[0].patient_id);
        loadNote(data[0].patient_id);
      }
    } catch (err) {
      console.error('Failed to load patients:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadNote = async (patientId) => {
    try {
      const noteData = await api.getTrainerNote(patientId);
      setNote(noteData.note || '');
    } catch (err) {
      console.error('Failed to load note:', err);
      setNote('');
    }
  };

  const selectPatient = (patientId) => {
    setSelectedId(patientId);
    setSaveState('');
    setDraftState('idle');
    loadNote(patientId);
  };

  const saveNote = async () => {
    if (!selectedId || !note.trim()) return;
    try {
      await api.updateTrainerNote(selectedId, note);
      setSaveState('saved');
      setTimeout(() => setSaveState(''), 2500);
    } catch (err) {
      setSaveState('error');
      setTimeout(() => setSaveState(''), 4000);
    }
  };

  const draftWithAi = async () => {
    if (!selectedId) return;
    setDraftState('drafting');
    try {
      const { draft } = await api.draftTrainerNote(selectedId);
      setNote(draft);
      setDraftState('idle');
    } catch (err) {
      setDraftState('error');
      setTimeout(() => setDraftState('idle'), 4000);
    }
  };

  const selectedPatient = patients.find((p) => p.patient_id === selectedId);

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
        <div className="avatar">{initials(user?.name) || 'T'}</div>
        <div className="trainer-header-titles">
          <h2>Trainer Dashboard</h2>
          <p>Welcome, {user?.name}</p>
        </div>
        <button className="logout-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button className="logout-btn" onClick={onLogout} aria-label="Sign out">
          <LogOut size={16} />
        </button>
      </div>

      <div className="trainer-layout">
        <div className="support-card trainer-roster">
          <h3><Users size={18} /> Your clients <span className="trainer-count">{patients.length}</span></h3>
          <div className="trainer-client-list">
            {patients.map((patient) => {
              const steps = patient.trend?.map((d) => d.steps) || [];
              return (
                <button
                  key={patient.patient_id}
                  className={`trainer-client-row ${selectedId === patient.patient_id ? 'selected' : ''}`}
                  onClick={() => selectPatient(patient.patient_id)}
                >
                  <div className="trainer-client-main">
                    <strong>{patient.full_name}</strong>
                    <span>{patient.primary_focus || 'No focus set'}</span>
                  </div>
                  <div className="trainer-client-spark">
                    <Sparkline values={steps} />
                    <em>{fmt(patient.metrics?.steps)} steps</em>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {selectedPatient && (
          <div className="trainer-detail">
            <div className="support-card">
              <div className="trainer-detail-head">
                <h3>{selectedPatient.full_name}</h3>
                <span className="trainer-focus-chip"><Target size={13} /> {selectedPatient.primary_focus || 'General'}</span>
              </div>

              <div className="trainer-stat-grid">
                <StatTile icon={Activity} label="Activity consistency"
                  value={pct(selectedPatient.kpis?.['Activity Consistency'])} />
                <StatTile icon={HeartPulse} label="Recovery score"
                  value={num(selectedPatient.kpis?.['Recovery Score'])} />
              </div>

              <h4 className="trainer-subhead">This week</h4>
              <div className="trainer-trend-grid">
                <TrendRow icon={Footprints} label="Steps" color="var(--wellpath-accent)"
                  series={selectedPatient.trend} field="steps" latest={selectedPatient.metrics?.steps} format={fmt} />
                <TrendRow icon={Timer} label="Exercise" color="#6a7cff" unit="min"
                  series={selectedPatient.trend} field="exercise_minutes" latest={selectedPatient.metrics?.exercise_minutes} format={num} />
                <TrendRow icon={MoonIcon} label="Sleep" color="#8b5cf6" unit="hrs"
                  series={selectedPatient.trend} field="sleep_hours" latest={selectedPatient.metrics?.sleep_hours} format={oneDp} />
                <TrendRow icon={HeartPulse} label="Resting HR" color="#f0805a" unit="bpm"
                  series={selectedPatient.trend} field="resting_heart_rate" latest={selectedPatient.metrics?.resting_heart_rate} format={num} />
              </div>
            </div>

            <div className="support-card">
              <div className="trainer-note-head">
                <h4>Encouragement note</h4>
                <button className="trainer-ai-draft" onClick={draftWithAi} disabled={draftState === 'drafting'} type="button">
                  {draftState === 'drafting'
                    ? <><RefreshCw size={14} className="spinning" /> Drafting…</>
                    : <><Sparkles size={14} /> Draft with AI</>}
                </button>
              </div>
              <p className="trainer-note-hint">The client sees this on their Care Team tab. Draft with AI from their week&apos;s data, then edit and send.</p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Write a short, encouraging note…"
                rows="4"
              />
              {draftState === 'error' && <span className="save-msg err">Couldn&apos;t draft a note — try again</span>}
              <div className="trainer-save-row">
                <button className="secondary-btn" onClick={saveNote} disabled={!note.trim()} type="button">
                  <Save size={16} /> Send to client
                </button>
                {saveState === 'saved' && <span className="save-msg ok">Sent ✓</span>}
                {saveState === 'error' && <span className="save-msg err">Couldn&apos;t save — try again</span>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value }) {
  return (
    <div className="trainer-stat-tile">
      <span className="trainer-stat-icon"><Icon size={15} /></span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function TrendRow({ icon: Icon, label, color, unit, series, field, latest, format }) {
  const values = (series || []).map((d) => d[field]);
  return (
    <div className="trainer-trend-row">
      <span className="trainer-trend-icon" style={{ color }}><Icon size={15} /></span>
      <div className="trainer-trend-label">{label}</div>
      <Sparkline values={values} color={color} width={90} height={28} />
      <div className="trainer-trend-latest">
        <strong>{format ? format(latest) : latest ?? '—'}</strong>
        {unit && <span>{unit}</span>}
      </div>
    </div>
  );
}

// ---- small formatters ----
function initials(name) {
  if (!name) return '';
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}
function fmt(v) { return Number.isFinite(Number(v)) ? Number(v).toLocaleString() : '—'; }
function num(v) { return Number.isFinite(Number(v)) ? Math.round(Number(v)) : '—'; }
function oneDp(v) { return Number.isFinite(Number(v)) ? Number(v).toFixed(1) : '—'; }
function pct(v) { return Number.isFinite(Number(v)) ? `${Math.round(Number(v))}%` : '—'; }

export default TrainerView;
