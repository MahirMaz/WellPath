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
    preferences: {},
    connections: {},
    nutritionLogs: {},
    patientFeedback: {},
    trainerPlans: {},
    trainerSessions: {},
    clinicianNotes: {},
    carePlans: {},
    accountStatuses: {},
    nextGoalId: 1000,
    nextRecordId: 2000,
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
    if (error?.status && error.status < 500 && ![401, 404].includes(error.status)) throw error;
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

function demoConnections(patientId) {
  const saved = readStore().connections[patientId];
  return saved || ['apple_health', 'health_connect'].map((provider) => ({
    provider, status: 'not_connected', permissions: [], last_sync: null,
  }));
}

function demoNutrition(patientId) {
  const saved = readStore().nutritionLogs[patientId];
  if (saved?.length) return clone(saved);
  const days = buildDemoTrends(patientId, 14);
  return days.map((day, index) => {
    const activeDay = Number(day.activeMinutes) >= 48;
    return {
      id: Number(patientId) * 1000 + index,
      recordDate: day.recordDate,
      name: activeDay ? 'Oatmeal, fruit, and home dinner' : 'Chicken rice bowl',
      kcal: activeDay ? 1840 : 2050,
      protein: activeDay ? 82 : 72,
      carbs: activeDay ? 210 : 245,
      sugar: activeDay ? 34 : 48,
      fibre: activeDay ? 30 : 17,
      fat: activeDay ? 61 : 74,
      satfat: activeDay ? 14 : 21,
      sodium: activeDay ? 1680 : 2550,
      source: 'manual',
    };
  });
}

function demoSignals() {
  return buildDemoClinicianPatients().filter((patient) => patient.riskLevel !== 'Low').map((patient, index) => ({
    alert_id: index + 1,
    patient_id: patient.patient_id,
    full_name: patient.full_name,
    alert_type: `${patient.primary_focus} review`,
    alert_level: patient.riskLevel.toLowerCase(),
    alert_message: 'A repeated lifestyle pattern may be useful to review in conversation.',
    alert_date: new Date(Date.now() - index * 86400000).toISOString(),
    status: 'open',
    assigned_to: null,
    assigned_name: null,
  }));
}

function demoAccountsWithStatus() {
  const statuses = readStore().accountStatuses;
  return demoAccounts.map((account) => ({
    ...account,
    status: statuses[account.id] || 'active',
    consent: account.role === 'patient' ? 'granted' : null,
    lastLogin: new Date().toISOString(),
  }));
}

function demoAudit() {
  return demoAccounts.slice(0, 8).map((account, index) => ({
    id: index + 1,
    actor: account.name,
    role: account.role,
    action: 'login_succeeded',
    resource: 'account',
    resourceId: account.id,
    occurredAt: new Date(Date.now() - index * 3600000).toISOString(),
  }));
}

export const api = {
  getHealth: () => withDemoFallback(() => request('/health'), () => ({ status: 'ok' })),
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

  getPatientPreferences: (patientId) =>
    withDemoFallback(
      () => request(`/patient/${patientId}/preferences`),
      () => readStore().preferences[patientId] || { ai_enabled: true, ui_preferences: null },
    ),

  updatePatientPreferences: (patientId, updates) =>
    withDemoFallback(
      () => request(`/patient/${patientId}/preferences`, { method: 'PATCH', body: JSON.stringify(updates) }),
      () => {
        const store = readStore();
        const current = store.preferences[patientId] || { ai_enabled: true, ui_preferences: null };
        const saved = {
          ai_enabled: typeof updates.aiEnabled === 'boolean' ? updates.aiEnabled : current.ai_enabled,
          ui_preferences: updates.uiPreferences || current.ui_preferences,
        };
        store.preferences[patientId] = saved;
        writeStore(store);
        return saved;
      },
    ),

  getHealthConnections: (patientId) =>
    withDemoFallback(() => request(`/patient/${patientId}/connections`), () => demoConnections(patientId)),

  updateHealthConnection: (patientId, provider, updates) =>
    withDemoFallback(
      () => request(`/patient/${patientId}/connections/${provider}`, { method: 'PATCH', body: JSON.stringify(updates) }),
      () => {
        const store = readStore();
        const saved = { provider, status: updates.status || 'not_connected', permissions: updates.permissions || [], last_sync: updates.last_sync || null };
        store.connections[patientId] = [...demoConnections(patientId).filter((item) => item.provider !== provider), saved];
        writeStore(store);
        return saved;
      },
    ),

  getNutritionLogs: (patientId) =>
    withDemoFallback(() => request(`/patient/${patientId}/nutrition-logs?days=45`), () => demoNutrition(patientId)),

  addNutritionLog: (patientId, entry) =>
    withDemoFallback(
      () => request(`/patient/${patientId}/nutrition-logs`, { method: 'POST', body: JSON.stringify(entry) }),
      () => {
        const store = readStore();
        const saved = { ...entry, id: store.nextRecordId++ };
        store.nutritionLogs[patientId] = [...demoNutrition(patientId), saved];
        writeStore(store);
        return saved;
      },
    ),

  deleteNutritionLog: (patientId, logId) =>
    withDemoFallback(
      () => request(`/patient/${patientId}/nutrition-logs/${logId}`, { method: 'DELETE' }),
      () => {
        const store = readStore();
        store.nutritionLogs[patientId] = demoNutrition(patientId).filter((entry) => String(entry.id) !== String(logId));
        writeStore(store);
        return { success: true };
      },
    ),

  extractMemory: (message) =>
    withDemoFallback(
      () => request('/ai/remember', { method: 'POST', body: JSON.stringify({ message }) }),
      () => ({ facts: [] }),
    ),

  getAiInsight: (payload) =>
    withDemoFallback(
      () => request('/ai/insights', { method: 'POST', body: JSON.stringify(payload) }),
      () => ({ answer: 'Your recent entries suggest focusing on one small, repeatable habit and checking the trend again after several days.', disclaimer: 'Lifestyle support only. Not diagnosis or medical advice.' }),
    ),

  estimateNutrition: (food) =>
    withDemoFallback(
      () => request('/ai/nutrition-estimate', { method: 'POST', body: JSON.stringify({ food }) }),
      () => ({ name: food, kcal: 420, protein: 24, carbs: 48, sugar: 9, fibre: 7, fat: 14, satfat: 4, sodium: 620 }),
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

  deleteGoal: (goalId) =>
    withDemoFallback(
      () => request(`/patient/goals/${goalId}`, { method: 'DELETE' }),
      () => {
        const store = readStore();
        Object.keys(store.goals).forEach((patientId) => { store.goals[patientId] = store.goals[patientId].filter((goal) => goal.id !== goalId); });
        writeStore(store);
        return { success: true };
      },
    ),

  getCareTeam: (patientId) =>
    withDemoFallback(
      () => request(`/patient/${patientId}/care-team`),
      () => ({ primaryFocus: getDemoProfile(patientId).focus, trainer: { name: 'Jordan Lee' }, clinician: { name: 'Dr. Rivera' }, trainerNote: { text: readStore().trainerNotes[patientId] || '', date: new Date().toISOString() } }),
    ),

  addPatientFeedback: (patientId, feedback) =>
    withDemoFallback(
      () => request(`/patient/${patientId}/feedback`, { method: 'POST', body: JSON.stringify(feedback) }),
      () => {
        const store = readStore();
        const saved = { ...feedback, id: store.nextRecordId++ };
        store.patientFeedback[patientId] = [saved, ...(store.patientFeedback[patientId] || [])];
        writeStore(store);
        return saved;
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
      () => demoSignals(),
    ),

  updateSignal: (signalId, updates) =>
    withDemoFallback(
      () => request(`/clinician/signals/${signalId}`, { method: 'PATCH', body: JSON.stringify(updates) }),
      () => ({ ...demoSignals().find((signal) => String(signal.alert_id) === String(signalId)), ...updates }),
    ),

  getClinicianNotes: (patientId) =>
    withDemoFallback(() => request(`/clinician/patients/${patientId}/notes`), () => clone(readStore().clinicianNotes[patientId] || [])),

  addClinicianNote: (patientId, payload) =>
    withDemoFallback(
      () => request(`/clinician/patients/${patientId}/notes`, { method: 'POST', body: JSON.stringify(payload) }),
      () => {
        const store = readStore();
        const saved = { id: store.nextRecordId++, ...payload, author_name: 'Dr. Rivera', created_at: new Date().toISOString() };
        store.clinicianNotes[patientId] = [saved, ...(store.clinicianNotes[patientId] || [])];
        writeStore(store);
        return saved;
      },
    ),

  getCarePlan: (patientId) =>
    withDemoFallback(() => request(`/clinician/patients/${patientId}/care-plan`), () => readStore().carePlans[patientId] || null),

  updateCarePlan: (patientId, plan) =>
    withDemoFallback(
      () => request(`/clinician/patients/${patientId}/care-plan`, { method: 'PUT', body: JSON.stringify(plan) }),
      () => { const store = readStore(); store.carePlans[patientId] = plan; writeStore(store); return plan; },
    ),

  getAuditEvents: (limit = 80) =>
    withDemoFallback(() => request(`/clinician/audit?limit=${limit}`), () => demoAudit().slice(0, limit)),

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

  getTrainerPlan: (patientId) =>
    withDemoFallback(() => request(`/trainer/patients/${patientId}/plan`), () => readStore().trainerPlans[patientId] || null),

  updateTrainerPlan: (patientId, plan) =>
    withDemoFallback(
      () => request(`/trainer/patients/${patientId}/plan`, { method: 'PUT', body: JSON.stringify(plan) }),
      () => { const store = readStore(); store.trainerPlans[patientId] = plan; writeStore(store); return plan; },
    ),

  getTrainerSessions: (patientId) =>
    withDemoFallback(() => request(`/trainer/patients/${patientId}/sessions`), () => clone(readStore().trainerSessions[patientId] || [])),

  addTrainerSession: (patientId, session) =>
    withDemoFallback(
      () => request(`/trainer/patients/${patientId}/sessions`, { method: 'POST', body: JSON.stringify(session) }),
      () => {
        const store = readStore();
        const saved = { ...session, id: store.nextRecordId++ };
        store.trainerSessions[patientId] = [saved, ...(store.trainerSessions[patientId] || [])];
        writeStore(store);
        return saved;
      },
    ),

  getPatientFeedback: (patientId) =>
    withDemoFallback(() => request(`/trainer/patients/${patientId}/feedback`), () => clone(readStore().patientFeedback[patientId] || [])),

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

  draftTrainerNote: (patientId) =>
    withDemoFallback(
      () => request('/ai/trainer-note-draft', { method: 'POST', body: JSON.stringify({ patientId }) }),
      () => ({ draft: 'Nice work staying engaged this week. Let us keep the next session manageable and repeatable.' }),
    ),

  getAdminOverview: () =>
    withDemoFallback(
      () => request('/admin/overview'),
      () => {
        const accounts = demoAccountsWithStatus();
        const count = (status) => accounts.filter((account) => account.status === status).length;
        return {
          accounts: { total: accounts.length, active: count('active'), locked: count('locked'), inactive: count('inactive') },
          roles: ['patient', 'trainer', 'clinician', 'dba'].map((role) => ({ role, count: accounts.filter((account) => account.role === role).length })),
          consent: { totalPatients: accounts.filter((account) => account.role === 'patient').length, consented: accounts.filter((account) => account.role === 'patient').length },
          activeAssignments: 5,
          auditEventsLast24h: demoAudit().length,
          connectedAccounts: 0,
          system: { api: 'operational', database: 'operational', authentication: 'operational' },
        };
      },
    ),

  getAdminUsers: () => withDemoFallback(() => request('/admin/users'), () => demoAccountsWithStatus()),

  updateAdminUserStatus: (userId, status) =>
    withDemoFallback(
      () => request(`/admin/users/${userId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
      () => { const store = readStore(); store.accountStatuses[userId] = status; writeStore(store); return { id: userId, status }; },
    ),

  getAdminAudit: (limit = 80) => withDemoFallback(() => request(`/admin/audit?limit=${limit}`), () => demoAudit().slice(0, limit)),

  getAdminConnections: () => withDemoFallback(
    () => request('/admin/connections'),
    () => [
      { provider: 'apple_health', status: 'not_connected', accounts: 6, last_sync: null },
      { provider: 'health_connect', status: 'not_connected', accounts: 6, last_sync: null },
    ],
  ),
};

export { getDemoProfile };
export default api;
