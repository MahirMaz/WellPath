// API Client for WellPath Health
const API_URL = import.meta.env.VITE_API_URL || '/api';

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
      try {
        currentUser = JSON.parse(stored);
      } catch {
        localStorage.removeItem('currentUser');
      }
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

  let response;

  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error('WellPath could not connect. Check your connection and try again.');
  }

  if (response.status === 401) {
    clearAuth();
    window.dispatchEvent(new CustomEvent('wellpath:session-expired'));
    const sessionError = new Error('Session expired. Please login again.');
    sessionError.status = 401;
    sessionError.endpoint = endpoint;
    throw sessionError;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    const requestError = new Error(error.error || 'Request failed');
    requestError.status = response.status;
    requestError.endpoint = endpoint;
    throw requestError;
  }

  return response.json();
};

export const api = {
  getHealth: () => request('/health'),

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
  getAiInsight: (payload) =>
    request('/ai/insights', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  estimateNutrition: (food) =>
    request('/ai/nutrition-estimate', {
      method: 'POST',
      body: JSON.stringify({ food }),
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
  getPatientPreferences: (patientId) => request(`/patient/${patientId}/preferences`),
  updatePatientPreferences: (patientId, updates) =>
    request(`/patient/${patientId}/preferences`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
  getHealthConnections: (patientId) => request(`/patient/${patientId}/connections`),
  updateHealthConnection: (patientId, provider, updates) =>
    request(`/patient/${patientId}/connections/${provider}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
  addPatientFeedback: (patientId, feedback) =>
    request(`/patient/${patientId}/feedback`, {
      method: 'POST',
      body: JSON.stringify(feedback),
    }),
  deleteGoal: (goalId) =>
    request(`/patient/goals/${goalId}`, { method: 'DELETE' }),

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
  updateSignal: (signalId, updates) =>
    request(`/clinician/signals/${signalId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
  getClinicianNotes: (patientId) => request(`/clinician/patients/${patientId}/notes`),
  addClinicianNote: (patientId, payload) =>
    request(`/clinician/patients/${patientId}/notes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getCarePlan: (patientId) => request(`/clinician/patients/${patientId}/care-plan`),
  updateCarePlan: (patientId, payload) =>
    request(`/clinician/patients/${patientId}/care-plan`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  getAuditEvents: (limit = 80) => request(`/clinician/audit?limit=${limit}`),

  // Trainer
  getTrainerPatients: () => request('/trainer/patients'),
  getTrainerNote: (patientId) => request(`/trainer/notes/${patientId}`),
  getTrainerPlan: (patientId) => request(`/trainer/patients/${patientId}/plan`),
  updateTrainerPlan: (patientId, plan) =>
    request(`/trainer/patients/${patientId}/plan`, {
      method: 'PUT',
      body: JSON.stringify(plan),
    }),
  getTrainerSessions: (patientId) => request(`/trainer/patients/${patientId}/sessions`),
  addTrainerSession: (patientId, session) =>
    request(`/trainer/patients/${patientId}/sessions`, {
      method: 'POST',
      body: JSON.stringify(session),
    }),
  getPatientFeedback: (patientId) => request(`/trainer/patients/${patientId}/feedback`),
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
