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

// This app intentionally does not use a service worker. Remove any that was
// installed by an earlier version (and clear its caches) so the browser always
// loads the latest app instead of a stale saved copy.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
}
if (window.caches) {
  caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
}
