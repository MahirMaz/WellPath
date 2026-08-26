export const PATIENT_KPI_OPTIONS = [
  { id: 'steps', label: 'Steps' },
  { id: 'sleep', label: 'Sleep' },
  { id: 'recovery', label: 'Recovery' },
  { id: 'heartRate', label: 'Resting heart rate' },
  { id: 'exercise', label: 'Exercise' },
  { id: 'activeMinutes', label: 'Active minutes' },
  { id: 'sedentary', label: 'Sitting time' },
  { id: 'calories', label: 'Active calories' },
  { id: 'bloodPressure', label: 'Blood pressure' },
];

export const PATIENT_START_SCREENS = [
  { id: 'dashboard', label: 'Today' },
  { id: 'summary', label: 'Breakdown' },
  { id: 'mood', label: 'Mood' },
  { id: 'nutrition', label: 'Nutrition' },
];

export const PATIENT_VIEW_MODES = [
  { id: 'auto', label: 'Auto' },
  { id: 'app', label: 'App' },
  { id: 'desktop', label: 'Desktop' },
];

export const DEFAULT_PATIENT_UI_PREFERENCES = {
  version: 2,
  visibleMetricIds: ['steps', 'sleep', 'recovery', 'heartRate', 'exercise', 'activeMinutes'],
  metricOrder: PATIENT_KPI_OPTIONS.map((item) => item.id),
  sections: {
    wellnessScores: true,
    nextMove: true,
    aiQuestions: true,
  },
  density: 'comfortable',
  startScreen: 'dashboard',
  reduceMotion: false,
  viewMode: 'auto',
};

const validViewModes = new Set(PATIENT_VIEW_MODES.map((item) => item.id));

const validMetricIds = new Set(PATIENT_KPI_OPTIONS.map((item) => item.id));
const validStartScreens = new Set(PATIENT_START_SCREENS.map((item) => item.id));

export function normalizePatientUiPreferences(value = {}) {
  const incomingOrder = Array.isArray(value.metricOrder)
    ? value.metricOrder.filter((id) => validMetricIds.has(id))
    : [];
  const metricOrder = [...new Set([
    ...incomingOrder,
    ...DEFAULT_PATIENT_UI_PREFERENCES.metricOrder,
  ])];
  const incomingVisible = Array.isArray(value.visibleMetricIds)
    ? value.visibleMetricIds.filter((id) => validMetricIds.has(id))
    : DEFAULT_PATIENT_UI_PREFERENCES.visibleMetricIds;
  const visibleMetricIds = incomingVisible.length
    ? [...new Set(incomingVisible)]
    : [DEFAULT_PATIENT_UI_PREFERENCES.visibleMetricIds[0]];

  return {
    ...DEFAULT_PATIENT_UI_PREFERENCES,
    ...value,
    version: DEFAULT_PATIENT_UI_PREFERENCES.version,
    visibleMetricIds,
    metricOrder,
    sections: {
      ...DEFAULT_PATIENT_UI_PREFERENCES.sections,
      ...(value.sections || {}),
    },
    density: value.density === 'compact' ? 'compact' : 'comfortable',
    startScreen: validStartScreens.has(value.startScreen) ? value.startScreen : 'dashboard',
    reduceMotion: Boolean(value.reduceMotion),
    viewMode: validViewModes.has(value.viewMode) ? value.viewMode : 'auto',
  };
}

function storageKey(userId) {
  return `wellpath:patient-ui:v2:${userId || 'patient'}`;
}

export function loadPatientUiPreferences(userId) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey(userId)) || '{}');
    return normalizePatientUiPreferences(saved);
  } catch {
    return normalizePatientUiPreferences();
  }
}

export function savePatientUiPreferences(userId, preferences) {
  const normalized = normalizePatientUiPreferences(preferences);
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(normalized));
  } catch {
  }
  return normalized;
}
