import React, { useMemo, useState } from 'react';
import {
  ArrowDown, ArrowUp, Bot, CheckCircle2, Database, EyeOff, LayoutGrid,
  Link2, LogOut, Moon, RefreshCw, Settings as SettingsIcon, ShieldCheck,
  SlidersHorizontal, Smartphone, Sparkles, Sun,
} from 'lucide-react';
import {
  getHealthBridgeStatus, openHealthPermissionSettings, requestHealthPermissions, syncHealthData,
} from '../../integrations/healthBridge.js';
import { PATIENT_KPI_OPTIONS, PATIENT_START_SCREENS, PATIENT_VIEW_MODES } from '../../utils/patientUiPreferences.js';

const connectionLabels = {
  apple_health: 'Apple Health',
  health_connect: 'Health Connect',
};

const sectionOptions = [
  { id: 'wellnessScores', label: 'Wellness score strip' },
  { id: 'nextMove', label: 'Best next move' },
  { id: 'aiQuestions', label: 'AI quick questions' },
];

export function PatientSettingsPage({
  kpis = [], uiPreferences, setUiPreferences, aiEnabled, setAiEnabled, theme, setTheme,
  onLogout, user, healthConnections = [], onUpdateHealthConnection,
}) {
  const [preferenceMessage, setPreferenceMessage] = useState('');
  const [connectionMessage, setConnectionMessage] = useState('');
  const [connectionBusy, setConnectionBusy] = useState(false);
  const bridge = useMemo(() => getHealthBridgeStatus(), []);
  const labels = useMemo(() => new Map([
    ...PATIENT_KPI_OPTIONS.map((item) => [item.id, item.label]),
    ...kpis.map((item) => [item.id, item.title]),
  ]), [kpis]);

  const visibleIds = uiPreferences.visibleMetricIds;
  const orderedOptions = uiPreferences.metricOrder.map((id) => ({ id, label: labels.get(id) || id }));

  const updatePreferences = (updater, message = 'Display preferences saved.') => {
    setUiPreferences(updater);
    setPreferenceMessage(message);
  };

  const toggleMetric = (metricId) => {
    updatePreferences((current) => {
      const visible = current.visibleMetricIds;
      if (visible.includes(metricId)) {
        if (visible.length === 1) return current;
        return { ...current, visibleMetricIds: visible.filter((id) => id !== metricId) };
      }
      return { ...current, visibleMetricIds: [...visible, metricId] };
    });
  };

  const moveMetric = (metricId, direction) => {
    updatePreferences((current) => {
      const order = [...current.metricOrder];
      const index = order.indexOf(metricId);
      const destination = index + direction;
      if (index < 0 || destination < 0 || destination >= order.length) return current;
      [order[index], order[destination]] = [order[destination], order[index]];
      return { ...current, metricOrder: order };
    }, 'Card order saved.');
  };

  const toggleSection = (sectionId) => {
    updatePreferences((current) => ({
      ...current,
      sections: { ...current.sections, [sectionId]: !current.sections[sectionId] },
    }));
  };

  const toggleAi = async () => {
    const next = !aiEnabled;
    setPreferenceMessage('Saving AI preference...');
    try {
      await setAiEnabled(next);
      setPreferenceMessage(`AI Insights turned ${next ? 'on' : 'off'}.`);
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
      if (bridge.provider) {
        await onUpdateHealthConnection(bridge.provider, {
          status: ['authorized', 'connected'].includes(result.status) ? 'connected' : 'not_connected',
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

      <section className="settings-panel settings-customize-panel">
        <div className="settings-heading-row">
          <h3><LayoutGrid size={18} /> Today screen</h3>
          <span className="settings-count">{visibleIds.length} visible</span>
        </div>
        <p>Choose which cards matter to you and put the most useful ones first.</p>
        <div className="settings-card-order">
          {orderedOptions.map((metric, index) => (
            <div className="settings-card-row" key={metric.id}>
              <label>
                <input
                  type="checkbox"
                  checked={visibleIds.includes(metric.id)}
                  disabled={visibleIds.length === 1 && visibleIds.includes(metric.id)}
                  onChange={() => toggleMetric(metric.id)}
                />
                <span>{metric.label}</span>
              </label>
              <div className="reorder-actions">
                <button type="button" onClick={() => moveMetric(metric.id, -1)} disabled={index === 0} aria-label={`Move ${metric.label} up`}><ArrowUp size={15} /></button>
                <button type="button" onClick={() => moveMetric(metric.id, 1)} disabled={index === orderedOptions.length - 1} aria-label={`Move ${metric.label} down`}><ArrowDown size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="settings-panel">
        <h3><SlidersHorizontal size={18} /> Layout options</h3>
        {sectionOptions.map((option) => (
          <label className="setting-row" key={option.id}>
            <span>{option.label}</span>
            <input type="checkbox" checked={uiPreferences.sections[option.id]} onChange={() => toggleSection(option.id)} />
          </label>
        ))}
        <div className="setting-control-block">
          <span>View</span>
          <div className="settings-segmented" role="group" aria-label="View mode">
            {PATIENT_VIEW_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={(uiPreferences.viewMode || 'auto') === mode.id ? 'active' : ''}
                onClick={() => updatePreferences((current) => ({ ...current, viewMode: mode.id }), `View set to ${mode.label}.`)}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
        <p className="setting-hint">Auto uses the app layout on phones and the wide layout on desktop. App and Desktop force one regardless of screen.</p>
        <div className="setting-control-block">
          <span>Card spacing</span>
          <div className="settings-segmented" role="group" aria-label="Card spacing">
            {['comfortable', 'compact'].map((density) => (
              <button key={density} type="button" className={uiPreferences.density === density ? 'active' : ''} onClick={() => updatePreferences((current) => ({ ...current, density }))}>
                {density[0].toUpperCase() + density.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="setting-control-block">
          <span>Open the app on</span>
          <select aria-label="Default start screen" value={uiPreferences.startScreen} onChange={(event) => updatePreferences((current) => ({ ...current, startScreen: event.target.value }), 'Start screen saved.')}>
            {PATIENT_START_SCREENS.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}
          </select>
        </div>
        <label className="setting-row">
          <span>Reduce animations</span>
          <input type="checkbox" checked={uiPreferences.reduceMotion} onChange={() => updatePreferences((current) => ({ ...current, reduceMotion: !current.reduceMotion }), 'Animation preference saved.')} />
        </label>
        {preferenceMessage && <p className="form-feedback" role="status">{preferenceMessage}</p>}
      </section>

      <section className="ai-insights-hero settings-ai-hero">
        <div className="ai-orb"><Bot size={24} /></div>
        <span>AI Insights</span>
        <h2>{aiEnabled ? 'Optional lifestyle explanations are on.' : 'AI Insights are off.'}</h2>
        <p>AI may miss context or be incorrect. It cannot diagnose, prescribe treatment, or edit your health records.</p>
        <button className={aiEnabled ? 'toggle-pill on' : 'toggle-pill'} onClick={toggleAi} type="button" aria-pressed={aiEnabled}>
          {aiEnabled ? <Sparkles size={16} /> : <EyeOff size={16} />}
          {aiEnabled ? 'AI on' : 'AI off'}
        </button>
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
        <p>WellPath requests read-only access only to the data types used in your summary. Permission stays under Apple Health or Health Connect control.</p>
        <div className="connection-actions">
          <button className="secondary-btn" type="button" onClick={connectHealthSource} disabled={connectionBusy || !bridge.available}><Link2 size={16} /> Connect this device</button>
          {activeConnection?.status === 'connected' && <button className="secondary-btn" type="button" onClick={syncConnection} disabled={connectionBusy}><RefreshCw size={16} /> Sync now</button>}
          {bridge.available && <button className="text-action" type="button" onClick={openHealthPermissionSettings}>Manage access</button>}
        </div>
        {!bridge.available && <p className="connection-help"><Smartphone size={15} /> Open this screen in the installed iOS or Android build to request system health permissions.</p>}
        {connectionMessage && <p className="form-feedback" role="status">{connectionMessage}</p>}
      </section>

      <section className="settings-panel">
        <h3><ShieldCheck size={18} /> Privacy and control</h3>
        <p>Synced cards are read-only. Trainer sharing excludes private mood entries, health records, and AI conversations.</p>
      </section>

      <section className="settings-panel">
        <h3><SettingsIcon size={18} /> App controls</h3>
        <button className="settings-action" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} type="button">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />} Switch to {theme === 'dark' ? 'light' : 'dark'} mode
        </button>
        <button className="settings-action" onClick={onLogout} type="button"><LogOut size={16} /> Sign out</button>
        <div className="setting-row"><span>Logged in as</span><strong>{user?.name}</strong></div>
        <div className="setting-row"><span>Email</span><strong>{user?.email}</strong></div>
      </section>
    </div>
  );
}
