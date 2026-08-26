import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app';
import './styles.css';
import './styles/role-refinements.css';
import './styles/trainer-workspace.css';
import './styles/trainer-workspace-extra.css';
import './styles/clinician-workflow.css';
import './styles/clinician-responsive.css';
import './styles/pro-workspaces.css';

createRoot(document.getElementById('root')).render(<App />);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
}
if (window.caches) {
  caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
}
