// API Client for WellPath Health
const API_URL = 'http://localhost:3000/api';

let authToken = null;
let currentUser = null;

export const setAuthToken = (token) => {
  authToken = token;
  if (token) {
    localStorage.setItem('authToken', token);
  } else {
    localStorage.removeItem('authToken');
  }
};

export const getAuthToken = () => {
  if (!authToken) {
    authToken = localStorage.getItem('authToken');
  }
  return authToken;
};

export const setCurrentUser = (user) => {
  currentUser = user;
  localStorage.setItem('currentUser', JSON.stringify(user));
};

export const getCurrentUser = () => {
  if (!currentUser) {
    const stored = localStorage.getItem('currentUser');
    if (stored) {
      currentUser = JSON.parse(stored);
    }
  }
  return currentUser;
};

export const clearAuth = () => {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
  Object.keys(sessionStorage)
    .filter((key) => key.startsWith('wellpath-ai-insight:'))
    .forEach((key) => sessionStorage.removeItem(key));
};

const request = async (endpoint, options = {}) => {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearAuth();
    throw new Error('Session expired. Please login again.');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
};

export const api = {
  // Auth
  login: (email, password) => 
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getMe: () => request('/auth/me'),

  // Patient
  getDashboard: (patientId) => request(`/patient/${patientId}/dashboard`),
  getTrends: (patientId) => request(`/patient/${patientId}/trends`),
  getGoals: (patientId) => request(`/patient/${patientId}/goals`),
  getMoodLog: (patientId) => request(`/patient/${patientId}/mood`),
  getPeriods: (patientId) => request(`/patient/${patientId}/periods`),
  logPeriod: (patientId, startDate, endDate) =>
    request(`/patient/${patientId}/periods`, {
      method: 'POST',
      body: JSON.stringify({ startDate, endDate }),
    }),
  deletePeriod: (patientId, date) =>
    request(`/patient/${patientId}/periods/${date}`, { method: 'DELETE' }),
  logMood: (patientId, mood, date) =>
    request(`/patient/${patientId}/mood`, {
      method: 'POST',
      body: JSON.stringify({ mood, date }),
    }),
  extractMemory: (message) =>
    request('/ai/remember', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
  addGoal: (patientId, title, status) => 
    request(`/patient/${patientId}/goals`, {
      method: 'POST',
      body: JSON.stringify({ title, status }),
    }),
  updateGoal: (goalId, updates) =>
    request(`/patient/goals/${goalId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
  getCareTeam: (patientId) => request(`/patient/${patientId}/care-team`),

  // Clinician
  getClinicianPatients: () => request('/clinician/patients'),
  getPatientDetails: (patientId) => request(`/clinician/patients/${patientId}`),
  getSignals: () => request('/clinician/signals'),
  getClinicianSummary: (patientId) =>
    request('/ai/clinician-summary', {
      method: 'POST',
      body: JSON.stringify({ patientId }),
    }),
  resolveAlert: (alertId) =>
    request(`/clinician/alerts/${alertId}/resolve`, { method: 'PATCH' }),

  // Trainer
  getTrainerPatients: () => request('/trainer/patients'),
  getTrainerNote: (patientId) => request(`/trainer/notes/${patientId}`),
  updateTrainerNote: (patientId, note) =>
    request(`/trainer/notes/${patientId}`, {
      method: 'PATCH',
      body: JSON.stringify({ note }),
    }),
  draftTrainerNote: (patientId) =>
    request('/ai/trainer-note-draft', {
      method: 'POST',
      body: JSON.stringify({ patientId }),
    }),
};

export default api;
