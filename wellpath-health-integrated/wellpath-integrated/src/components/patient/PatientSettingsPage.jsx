import React, { useMemo, useState } from 'react';
import {
  Bot, CheckCircle2, Database, EyeOff, Link2, LogOut, Moon, RefreshCw,
  Settings as SettingsIcon, ShieldCheck, SlidersHorizontal, Smartphone, Sparkles, Sun,
} from 'lucide-react';
import {
  getHealthBridgeStatus, openHealthPermissionSettings, requestHealthPermissions, syncHealthData,
} from '../../integrations/healthBridge.js';

const connectionLabels = {
  apple_health: 'Apple Health',
  health_connect: 'Health Connect',
};

export function PatientSettingsPage({
  metrics, visibleMetrics, setVisibleMetrics, aiEnabled, setAiEnabled, theme, setTheme,
  onLogout, user, healthConnections = [], onUpdateHealthConnection,
}) {
  const [preferenceMessage, setPreferenceMessage] = useState('');
  const [connectionMessage, setConnectionMessage] = useState('');
  const [connectionBusy, setConnectionBusy] = useState(false);
  const bridge = useMemo(getHealthBridgeStatus, []);

  const toggleMetric = (metricId) => {
    setVisibleMetrics((items) => {
      if (items.includes(metricId)) return items.length > 1 ? items.filter((item) => item !== metricId) : items;
      return [...items, metricId];
    });
  };

  const toggleAi = async () => {
    setPreferenceMessage('Saving AI preference...');
    try {
      await setAiEnabled(!aiEnabled);
      setPreferenceMessage(`AI Insights turned ${aiEnabled ? 'off' : 'on'}.`);
    } catch (error) {
      setPreferenceMessage(error.message || 'The AI preference could not be saved.');
    }
  };

  const connectHealthSource = async () => {
    setConnectionBusy(true);
    setConnectionMessage('Checking this device...');
    try {
      const result = await requestHealthPermissions();
      if (!result.ok) {
        setConnectionMessage(result.message);
        return;
      }
      const provider = bridge.provider;
      if (provider) {
        await onUpdateHealthConnection(provider, {
          status: result.status === 'authorized' || result.status === 'connected' ? 'connected' : 'not_connected',
          permissions: result.permissions || bridge.requestedReadTypes,
          last_sync: result.lastSync || null,
        });
      }
      setConnectionMessage(result.status === 'requested' ? 'Permission request opened in the installed app.' : 'Health source connected.');
    } catch (error) {
      setConnectionMessage(error.message || 'The health source could not be connected.');
    } finally {
      setConnectionBusy(false);
    }
  };

  const syncConnection = async () => {
    setConnectionBusy(true);
    setConnectionMessage('Syncing approved health data...');
    try {
      const result = await syncHealthData();
      if (!result.ok) {
        setConnectionMessage(result.message);
        return;
      }
      if (bridge.provider) {
        await onUpdateHealthConnection(bridge.provider, {
          status: 'connected',
          permissions: result.permissions || bridge.requestedReadTypes,
          last_sync: result.lastSync || new Date().toISOString(),
        });
      }
      setConnectionMessage('Approved health data synced.');
    } catch (error) {
      setConnectionMessage(error.message || 'Health data could not be synced.');
    } finally {
      setConnectionBusy(false);
    }
  };

  const activeConnection = bridge.provider
    ? healthConnections.find((item) => item.provider === bridge.provider)
    : null;

  return (
    <div className="mobile-flow">
      <div className="mobile-section-title">
        <div><span>Personalize</span><h2>Settings</h2></div>
      </div>

      <section className="ai-insights-hero settings-ai-hero">
        <div className="ai-orb"><Bot size={24} /></div>
        <span>AI Insights</span>
        <h2>{aiEnabled ? 'Optional lifestyle explanations are on.' : 'AI Insights are off.'}</h2>
        <p>AI may miss context or be incorrect. It cannot diagnose, prescribe treatment, or edit your health records.</p>
        <button className={aiEnabled ? 'toggle-pill on' : 'toggle-pill'} onClick={toggleAi} type="button" aria-pressed={aiEnabled}>
          {aiEnabled ? <Sparkles size={16} /> : <EyeOff size={16} />}
          {aiEnabled ? 'AI on' : 'AI off'}
        </button>
        {preferenceMessage && <p className="form-feedback" role="status">{preferenceMessage}</p>}
      </section>

      <section className="settings-panel health-connections-panel">
        <div className="settings-heading-row">
          <h3><Database size={18} /> Health data connections</h3>
          <span className={`connection-state ${activeConnection?.status === 'connected' ? 'connected' : ''}`}>
            {activeConnection?.status === 'connected'
              ? 'Connected'
              : bridge.available
                ? 'Available'
                : bridge.platform === 'web' ? 'Mobile app required' : 'Native health module required'}
          </span>
        </div>
        <div className="connection-list">
          {healthConnections.map((connection) => (
            <div className="connection-row" key={connection.provider}>
              <span className="connection-icon"><Smartphone size={18} /></span>
              <div>
                <strong>{connectionLabels[connection.provider]}</strong>
                <small>{connection.status === 'connected'
                  ? `${connection.permissions.length} approved data types${connection.last_sync ? ` - synced ${new Date(connection.last_sync).toLocaleDateString()}` : ''}`
                  : 'Not connected'}</small>
              </div>
              {connection.status === 'connected' && <CheckCircle2 size={18} className="connection-check" />}
            </div>
          ))}
        </div>
        <p>WellPath requests read-only access only to the data types used in your summary. Permission is controlled by Apple Health or Health Connect and can be revoked there.</p>
        <div className="connection-actions">
          <button className="secondary-btn" type="button" onClick={connectHealthSource} disabled={connectionBusy || !bridge.available}>
            <Link2 size={16} /> Connect this device
          </button>
          {activeConnection?.status === 'connected' && (
            <button className="secondary-btn" type="button" onClick={syncConnection} disabled={connectionBusy}>
              <RefreshCw size={16} /> Sync now
            </button>
          )}
          {bridge.available && (
            <button className="text-action" type="button" onClick={openHealthPermissionSettings}>Manage access</button>
          )}
        </div>
        {!bridge.available && (
          <p className="connection-help"><Smartphone size={15} />
            {bridge.platform === 'web'
              ? 'Open this screen in the installed iOS or Android build to request system health permissions.'
              : 'This app wrapper is installed, but the platform health permission module must be completed before device data can sync.'}
          </p>
        )}
        {connectionMessage && <p className="form-feedback" role="status">{connectionMessage}</p>}
      </section>

      <section className="settings-panel">
        <h3><SlidersHorizontal size={18} /> Summary cards</h3>
        {metrics.map((metric) => (
          <label className="setting-row" key={metric.id}>
            <span>{metric.label}</span>
            <input
              type="checkbox"
              checked={visibleMetrics.includes(metric.id)}
              disabled={visibleMetrics.length === 1 && visibleMetrics.includes(metric.id)}
              onChange={() => toggleMetric(metric.id)}
            />
          </label>
        ))}
        <p>Keep at least one card visible. Your card choices stay on this device.</p>
      </section>

      <section className="settings-panel">
        <h3><ShieldCheck size={18} /> Privacy and control</h3>
        <p>Synced cards are read-only. AI requests are logged without storing the generated answer, and trainer sharing excludes private mood and AI conversations.</p>
      </section>

      <section className="settings-panel">
        <h3><SettingsIcon size={18} /> App controls</h3>
        <button className="settings-action" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} type="button">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          Switch to {theme === 'dark' ? 'light' : 'dark'} mode
        </button>
        <button className="settings-action" onClick={onLogout} type="button"><LogOut size={16} /> Sign out</button>
        <div className="setting-row"><span>Logged in as</span><strong>{user?.name}</strong></div>
        <div className="setting-row"><span>Email</span><strong>{user?.email}</strong></div>
      </section>
    </div>
  );
}
