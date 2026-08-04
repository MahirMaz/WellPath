import React, { useState, useEffect } from 'react';
import { HeartPulse } from 'lucide-react';
import { getCurrentUser, clearAuth } from './api';
import AuthPage from './components/AuthPage';
import PatientView from './components/PatientView';
import TrainerView from './components/TrainerView';
import ClinicianView from './components/ClinicianView';

function App() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [role, setRole] = useState('patient');
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState(() => {
    return typeof window === 'undefined'
      ? 'light'
      : localStorage.getItem('theme-mode') || 'light';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme-mode', theme);
  }, [theme]);

  useEffect(() => {
    // Check if user is already logged in
    const storedUser = getCurrentUser();
    if (storedUser) {
      setUser(storedUser);
      setRole(storedUser.role);
      setIsSignedIn(true);
    }
    setIsLoading(false);
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

  // Render the appropriate view based on role
  const renderView = () => {
    switch (role) {
      case 'trainer':
        return <TrainerView user={user} onLogout={handleLogout} theme={theme} setTheme={setTheme} />;
      case 'clinician':
        return <ClinicianView user={user} onLogout={handleLogout} theme={theme} setTheme={setTheme} />;
      default:
        return <PatientView user={user} onLogout={handleLogout} theme={theme} setTheme={setTheme} />;
    }
  };

  return renderView();
}

export default App;
