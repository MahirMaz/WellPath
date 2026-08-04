import React from 'react';
import { SlidersHorizontal, Bot, Settings as SettingsIcon, Sun, Moon, LogOut, Sparkles, EyeOff } from 'lucide-react';

export function PatientSettingsPage({ metrics, visibleMetrics, setVisibleMetrics, aiEnabled, setAiEnabled, theme, setTheme, onLogout, user }) {
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
