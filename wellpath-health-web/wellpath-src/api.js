import {
  buildDemoClinicianPatients,
  buildDemoDashboard,
  buildDemoPatientDetails,
  buildDemoTrainerPatients,
  buildDemoTrends,
  demoAccounts,
  getDemoProfile,
  initialDemoGoals,
} from './demoData';

const API_URL = '/api/backend';
const STORE_KEY = 'wellpath-web-showcase-state';

let authToken = null;
let currentUser = null;

const clone = (value) => JSON.parse(JSON.stringify(value));

function defaultStore() {
  return {
    goals: clone(initialDemoGoals),
    moods: {},
    periods: {
      2: [
        { startDate: '2026-02-02', endDate: '2026-02-06' },
        { startDate: '2026-03-03', endDate: '2026-03-07' },
        { startDate: '2026-04-02', endDate: '2026-04-06' },
        { startDate: '2026-05-01', endDate: '2026-05-05' },
        { startDate: '2026-05-31', endDate: '2026-06-04' },
        { startDate: '2026-06-29', endDate: '2026-07-03' },
      ],
      4: [
        { startDate: '2026-02-10', endDate: '2026-02-13' },
        { startDate: '2026-03-10', endDate: '2026-03-13' },
        { startDate: '2026-04-07', endDate: '2026-04-10' },
        { startDate: '2026-05-05', endDate: '2026-05-08' },
        { startDate: '2026-06-02', endDate: '2026-06-05' },
        { startDate: '2026-06-30', endDate: '2026-07-03' },
      ],
    },
    trainerNotes: {
      1: 'Keep protecting your evening recovery routine. Your movement consistency is strong this week.',
    },
    nextGoalId: 1000,
  };
}

function readStore() {
  if (typeof window === 'undefined') return defaultStore();
  try {
    const saved = localStorage.getItem(STORE_KEY);
    return saved ? { ...defaultStore(), ...JSON.parse(saved) } : defaultStore();
  } catch {
    return defaultStore();
  }
}

function writeStore(store) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  }
}

export const setAuthToken = (token) => {
  authToken = token;
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem('authToken', token);
  else localStorage.removeItem('authToken');
};

export const getAuthToken = () => {
  if (!authToken && typeof window !== 'undefined') {
    authToken = localStorage.getItem('authToken');
  }
  return authToken;
};

export const setCurrentUser = (user) => {
  currentUser = user;
  if (typeof window !== 'undefined') {
    localStorage.setItem('currentUser', JSON.stringify(user));
  }
};

export const getCurrentUser = () => {
  if (!currentUser && typeof window !== 'undefined') {
    const stored = localStorage.getItem('currentUser');
    if (stored) currentUser = JSON.parse(stored);
  }
  return currentUser;
};

export const clearAuth = () => {
  authToken = null;
  currentUser = null;
  if (typeof window === 'undefined') return;
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
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    const exception = new Error(error.error || 'Request failed');
    exception.status = response.status;
    throw exception;
  }
  return response.json();
};

const withDemoFallback = async (liveRequest, fallback) => {
  try {
    return await liveRequest();
  } catch (error) {
    if (error?.status && error.status < 500 && error.status !== 401) throw error;
    return fallback();
  }
};

function demoLogin(email, password) {
  const account = demoAccounts.find(
    (candidate) => candidate.email.toLowerCase() === String(email).toLowerCase(),
  );
  if (!account || password !== 'password123') {
    throw new Error('Invalid email or password');
  }
  return {
    token: `demo-${account.role}-${account.id}`,
    user: { ...account },
  };
}

function getGoals(patientId) {
  const store = readStore();
  return clone(store.goals[patientId] || [
    { id: Number(patientId) * 100 + 1, title: 'Build one steady health habit this week', status: 'In progress' },
  ]);
}

function getMoodLog(patientId) {
  const store = readStore();
  const saved = store.moods[patientId];
  if (saved?.length) return clone(saved);
  const today = new Date();
  return Array.from({ length: 21 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (20 - index));
    return {
      date: date.toISOString().slice(0, 10),
      mood: Math.max(2, Math.min(5, 3 + Math.round(Math.sin((index + Number(patientId)) / 3)))),
      note: null,
    };
  });
}

export const api = {
  login: (email, password) =>
    withDemoFallback(
      () => request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
      () => demoLogin(email, password),
    ),

  getMe: () => request('/auth/me'),

  getDashboard: (patientId) =>
    withDemoFallback(
      () => request(`/patient/${patientId}/dashboard`),
      () => buildDemoDashboard(patientId),
    ),

  getTrends: (patientId) =>
    withDemoFallback(
      () => request(`/patient/${patientId}/trends`),
      () => buildDemoTrends(patientId),
    ),

  getGoals: (patientId) =>
    withDemoFallback(
      () => request(`/patient/${patientId}/goals`),
      () => getGoals(patientId),
    ),

  getMoodLog: (patientId) =>
    withDemoFallback(
      () => request(`/patient/${patientId}/mood`),
      () => getMoodLog(patientId),
    ),

  getPeriods: (patientId) =>
    withDemoFallback(
      () => request(`/patient/${patientId}/periods`),
      () => clone(readStore().periods[patientId] || []),
    ),

  logPeriod: (patientId, startDate, endDate) =>
    withDemoFallback(
      () => request(`/patient/${patientId}/periods`, {
        method: 'POST',
        body: JSON.stringify({ startDate, endDate }),
      }),
      () => {
        const store = readStore();
        const entries = store.periods[patientId] || [];
        const next = { startDate, endDate: endDate || null };
        store.periods[patientId] = [...entries.filter((entry) => entry.startDate !== startDate), next]
          .sort((a, b) => a.startDate.localeCompare(b.startDate));
        writeStore(store);
        return next;
      },
    ),

  deletePeriod: (patientId, date) =>
    withDemoFallback(
      () => request(`/patient/${patientId}/periods/${date}`, { method: 'DELETE' }),
      () => {
        const store = readStore();
        store.periods[patientId] = (store.periods[patientId] || [])
          .filter((entry) => entry.startDate !== date);
        writeStore(store);
        return { removed: date };
      },
    ),

  logMood: (patientId, mood, date) =>
    withDemoFallback(
      () => request(`/patient/${patientId}/mood`, {
        method: 'POST',
        body: JSON.stringify({ mood, date }),
      }),
      () => {
        const store = readStore();
        const entries = getMoodLog(patientId);
        const entry = { date, mood: Number(mood), note: null };
        store.moods[patientId] = [...entries.filter((item) => item.date !== date), entry]
          .sort((a, b) => a.date.localeCompare(b.date));
        writeStore(store);
        return entry;
      },
    ),

  addGoal: (patientId, title, status) =>
    withDemoFallback(
      () => request(`/patient/${patientId}/goals`, {
        method: 'POST',
        body: JSON.stringify({ title, status }),
      }),
      () => {
        const store = readStore();
        const goal = { id: store.nextGoalId++, title, status: status || 'Planned' };
        store.goals[patientId] = [...getGoals(patientId), goal];
        writeStore(store);
        return goal;
      },
    ),

  updateGoal: (goalId, updates) =>
    withDemoFallback(
      () => request(`/patient/goals/${goalId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }),
      () => {
        const store = readStore();
        Object.keys(store.goals).forEach((patientId) => {
          store.goals[patientId] = store.goals[patientId].map((goal) =>
            goal.id === goalId ? { ...goal, ...updates } : goal,
          );
        });
        writeStore(store);
        return { success: true };
      },
    ),

  getClinicianPatients: () =>
    withDemoFallback(
      () => request('/clinician/patients'),
      () => buildDemoClinicianPatients(),
    ),

  getPatientDetails: (patientId) =>
    withDemoFallback(
      () => request(`/clinician/patients/${patientId}`),
      () => buildDemoPatientDetails(patientId),
    ),

  getSignals: () =>
    withDemoFallback(
      () => request('/clinician/signals'),
      () => [],
    ),

  getTrainerPatients: () =>
    withDemoFallback(
      () => request('/trainer/patients'),
      () => buildDemoTrainerPatients(),
    ),

  getTrainerNote: (patientId) =>
    withDemoFallback(
      () => request(`/trainer/notes/${patientId}`),
      () => ({ note: readStore().trainerNotes[patientId] || '' }),
    ),

  updateTrainerNote: (patientId, note) =>
    withDemoFallback(
      () => request(`/trainer/notes/${patientId}`, {
        method: 'PATCH',
        body: JSON.stringify({ note }),
      }),
      () => {
        const store = readStore();
        store.trainerNotes[patientId] = note;
        writeStore(store);
        return { success: true };
      },
    ),
};

export { getDemoProfile };
export default api;
