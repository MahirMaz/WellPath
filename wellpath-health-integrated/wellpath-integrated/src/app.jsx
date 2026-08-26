import React, { useState, useEffect } from 'react';
import { HeartPulse } from 'lucide-react';
import { api, getAuthToken, clearAuth } from './api';
import AuthPage from './components/AuthPage';
import PatientView from './components/PatientView';
import TrainerView from './components/TrainerView';
import ClinicianView from './components/ClinicianView';
import AdminView from './components/AdminView';
import './styles.css';

function App() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [role, setRole] = useState('patient');
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState(() => (
    typeof window === 'undefined' ? 'light' : localStorage.getItem('theme-mode') || 'light'
  ));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme-mode', theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    const restoreSession = async () => {
      if (!getAuthToken()) {
        setIsLoading(false);
        return;
      }
      try {
        const response = await api.getMe();
        if (!cancelled && response.user) {
          setUser(response.user);
          setRole(response.user.role);
          setIsSignedIn(true);
        }
      } catch {
        clearAuth();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    restoreSession();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [isSignedIn, role]);

  useEffect(() => {
    const endExpiredSession = () => {
      setUser(null);
      setRole('patient');
      setIsSignedIn(false);
      setIsLoading(false);
    };
    window.addEventListener('wellpath:session-expired', endExpiredSession);
    return () => window.removeEventListener('wellpath:session-expired', endExpiredSession);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    setRole(userData.role);
    setIsSignedIn(true);
  };

  const handleLogout = () => {
    clearAuth();
    setUser(null);
    setRole('patient');
    setIsSignedIn(false);
  };

  if (isLoading) {
    return (
      <div className="loading-screen">
        <HeartPulse size={48} className="loading-icon" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return <AuthPage onLogin={handleLogin} theme={theme} setTheme={setTheme} />;
  }

  const renderView = () => {
    switch (role) {
      case 'trainer':
        return <TrainerView user={user} onLogout={handleLogout} theme={theme} setTheme={setTheme} />;
      case 'clinician':
        return <ClinicianView user={user} onLogout={handleLogout} theme={theme} setTheme={setTheme} />;
      case 'dba':
        return <AdminView user={user} onLogout={handleLogout} theme={theme} setTheme={setTheme} />;
      default:
        return <PatientView user={user} onLogout={handleLogout} theme={theme} setTheme={setTheme} />;
    }
  };

  return renderView();
}

export default App;
