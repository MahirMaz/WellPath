import React, { useState, useEffect } from 'react';
import { SlidersHorizontal, Bot, Settings as SettingsIcon, Sun, Moon, LogOut, Sparkles, EyeOff, BrainCircuit, Plus, X } from 'lucide-react';
import { getMemory, removeFact, addFact } from './aiMemory.js';

export function PatientSettingsPage({ patientId, metrics, visibleMetrics, setVisibleMetrics, aiEnabled, setAiEnabled, theme, setTheme, onLogout, user }) {
  const [memory, setMemory] = useState([]);
  const [newFact, setNewFact] = useState('');

  useEffect(() => { setMemory(getMemory(patientId)); }, [patientId]);

  const dropFact = (fact) => setMemory(removeFact(patientId, fact));
  const submitFact = (e) => {
    e.preventDefault();
    const f = newFact.trim();
    if (!f) return;
    setMemory(addFact(patientId, f));
    setNewFact('');
  };

  const toggleMetric = (metricId) => {
    setVisibleMetrics((items) => {
      if (items.includes(metricId)) {
        return items.length > 1 ? items.filter((item) => item !== metricId) : items;
      }
      return [...items, metricId];
    });
  };

  return (
    <div className="mobile-flow">
      <div className="mobile-section-title">
        <div>
          <span>Personalize</span>
          <h2>Settings</h2>
        </div>
      </div>

      <section className="ai-insights-hero settings-ai-hero">
        <div className="ai-orb"><Bot size={24} /></div>
        <span>AI Insights</span>
        <h2>{aiEnabled ? 'Get personalized health recommendations.' : 'AI insights are off.'}</h2>
        <p>Our AI analyzes your health data to provide lifestyle recommendations. Always consult your healthcare provider for medical advice.</p>
        <button className={aiEnabled ? 'toggle-pill on' : 'toggle-pill'} onClick={() => setAiEnabled(!aiEnabled)} type="button">
          {aiEnabled ? <Sparkles size={16} /> : <EyeOff size={16} />}
          {aiEnabled ? 'AI on' : 'AI off'}
        </button>
      </section>

      <section className="settings-panel">
        <h3><BrainCircuit size={18} /> What your AI remembers</h3>
        <p className="settings-sub">Things you've told your AI, used to tailor every insight. Add your own or remove any.</p>
        <div className="mem-list">
          {memory.length === 0 && (
            <p className="mem-empty">Nothing yet. Ask a question in your own words on any tab, or add something below.</p>
          )}
          {memory.map((fact) => (
            <span className="mem-chip" key={fact}>
              {fact}
              <button type="button" aria-label={`Forget: ${fact}`} onClick={() => dropFact(fact)}><X size={13} /></button>
            </span>
          ))}
        </div>
        <form className="mem-add" onSubmit={submitFact}>
          <input value={newFact} onChange={(e) => setNewFact(e.target.value)} placeholder="e.g. I have knee pain, or I work night shifts" />
          <button type="submit" aria-label="Add" disabled={!newFact.trim()}><Plus size={16} /></button>
        </form>
      </section>

      <section className="settings-panel">
        <h3><SlidersHorizontal size={18} /> Summary cards</h3>
        {metrics.map((metric) => (
          <label className="setting-row" key={metric.id}>
            <span>{metric.label}</span>
            <input type="checkbox" checked={visibleMetrics.includes(metric.id)} onChange={() => toggleMetric(metric.id)} />
          </label>
        ))}
      </section>

      <section className="settings-panel">
        <h3><SettingsIcon size={18} /> App controls</h3>
        <button className="settings-action" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} type="button">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          Switch to {theme === 'dark' ? 'light' : 'dark'} mode
        </button>
        <button className="settings-action" onClick={onLogout} type="button">
          <LogOut size={16} /> Sign Out
        </button>
        <div className="setting-row">
          <span>Logged in as</span>
          <strong>{user?.name}</strong>
        </div>
        <div className="setting-row">
          <span>Email</span>
          <strong>{user?.email}</strong>
        </div>
      </section>
    </div>
  );
}
