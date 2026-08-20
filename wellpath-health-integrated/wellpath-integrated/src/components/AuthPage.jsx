import React, { useState } from 'react';
import { HeartPulse, Mail, Lock, Sun, Moon, User, Users, Stethoscope, ClipboardList, ShieldCheck } from 'lucide-react';
import { api, setAuthToken, setCurrentUser } from '../api';
import HealthSurvey from './survey/HealthSurvey';

function AuthPage({ onLogin, theme, setTheme }) {
  const [email, setEmail] = useState('alex@example.com');
  const [password, setPassword] = useState('password123');
  const [selectedRole, setSelectedRole] = useState('patient');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSurvey, setShowSurvey] = useState(false);

  const roleOptions = [
    { id: 'patient', title: 'Patient', detail: 'Daily mobile app for your own habits.', icon: User },
    { id: 'trainer', title: 'Trainer', detail: 'Support view for activity and recovery.', icon: Users },
    { id: 'clinician', title: 'Clinician', detail: 'Separate trend review dashboard.', icon: Stethoscope },
    { id: 'dba', title: 'Admin', detail: 'Accounts, access, connections, and audit.', icon: ShieldCheck },
  ];
  const roleCredentials = {
    patient: 'alex@example.com',
    trainer: 'jordan@example.com',
    clinician: 'rivera@example.com',
    dba: 'admin@wellpath.example',
  };

  const selectRole = (role) => {
    setSelectedRole(role);
    setEmail(roleCredentials[role]);
    setPassword('password123');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await api.login(email, password);
      setAuthToken(response.token);
      setCurrentUser(response.user);
      onLogin(response.user);
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const demoAccounts = [
    { role: 'Patient', name: 'Alex', email: 'alex@example.com' },
    { role: 'Patient', name: 'Maria', email: 'maria@example.com' },
    { role: 'Patient', name: 'James', email: 'james@example.com' },
    { role: 'Patient', name: 'Sophie', email: 'sophie@example.com' },
    { role: 'Patient', name: 'Daniel', email: 'daniel@example.com' },
    { role: 'Patient', name: 'Robert', email: 'robert@example.com' },
    { role: 'Trainer', name: 'Jordan', email: 'jordan@example.com' },
    { role: 'Clinician', name: 'Dr. Rivera', email: 'rivera@example.com' },
    { role: 'Admin', name: 'Morgan', email: 'admin@wellpath.example', roleId: 'dba' },
  ];

  return (
    <main className="auth-shell">
      <div className="auth-panel">
        <div className="brand auth-brand">
          <span className="brand-mark">
            <HeartPulse size={25} />
          </span>
          <span>
            <strong>WellPath Health</strong>
            <small>Your health data, connected and understood</small>
          </span>
        </div>

        <div className="login-mode-row">
          <span>Sign in to your account</span>
          <button
            className="logout-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            type="button"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>

        <div className="role-picker">
          {roleOptions.map(({ id, title, detail, icon: Icon }) => (
            <button
              key={id}
              className={selectedRole === id ? 'selected' : ''}
              onClick={() => selectRole(id)}
              type="button"
            >
              <Icon size={18} />
              <span>
                <strong>{title}</strong>
                <small>{detail}</small>
              </span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <label className="field">
            <Mail size={16} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email or username"
              required
            />
          </label>

          <label className="field">
            <Lock size={16} />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
            />
          </label>

          {error && <div className="error-message">{error}</div>}

          <button className="primary-btn" type="submit" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="demo-accounts">
          <p>Demo accounts (password: password123)</p>
          <div className="demo-grid">
            {demoAccounts.map((acc) => (
              <button
                key={acc.email}
                className="demo-btn"
                onClick={() => {
                  setEmail(acc.email);
                  setPassword('password123');
                  setSelectedRole(acc.roleId || acc.role.toLowerCase());
                }}
                type="button"
              >
                <span className="demo-role">{acc.name} · {acc.role}</span>
                <span className="demo-email">{acc.email}</span>
              </button>
            ))}
          </div>
        </div>

        <small className="auth-footer">Lifestyle support only. Not medical advice.</small>
      </div>

      <div className="auth-copy">
        <div className="app-preview-card">
          <div className="preview-ring">
            <HeartPulse size={28} />
          </div>
          <h1>Your health workspace.</h1>
          <p>
            WellPath keeps patient, trainer, clinician, and admin views separate.
            All data is stored securely in your local database.
          </p>
          <div className="auth-points">
            <span>✓ Patient daily tracking</span>
            <span>✓ Trainer workout support</span>
            <span>✓ Clinician trend review</span>
            <span>✓ Privacy-limited administration</span>
          </div>
          <button type="button" className="survey-preview-btn" onClick={() => setShowSurvey(true)}>
            <ClipboardList size={16} />
            Preview the health survey
          </button>
        </div>
      </div>

      {showSurvey && <HealthSurvey onExit={() => setShowSurvey(false)} />}
    </main>
  );
}

export default AuthPage;
