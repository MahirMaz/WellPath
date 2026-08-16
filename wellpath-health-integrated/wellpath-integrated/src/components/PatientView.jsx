import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Home, Activity, Dumbbell, Settings, Stethoscope,
  LogOut, Moon, Sun, Smile, Droplets, MoreHorizontal, Gauge, Utensils
} from 'lucide-react';
import { api } from '../api';
import { PatientAppHeader } from './patient/PatientAppHeader.jsx';
import { PatientToday } from './patient/PatientToday.jsx';
import { HealthSummary } from './patient/HealthSummary.jsx';
import { PartnerPage } from './patient/PartnerPage.jsx';
import { getMemory } from './patient/aiMemory.js';
import { ClinicalDataPage } from './patient/ClinicalDataPage.jsx';
import { PatientSettingsPage } from './patient/PatientSettingsPage.jsx';
import { MoodPage } from './patient/MoodPage.jsx';
import { CyclePage } from './patient/CyclePage.jsx';
import { RiskSignal } from './risksignal/RiskSignal.jsx';
import { NutritionTab } from './nutrition/NutritionTab.jsx';
import { HealthProfileProvider } from './shared/profileContext.jsx';
import { buildPatientScores } from '../utils/healthScores.js';
import { buildPatientKpis, calculateRecoveryScore } from '../utils/patientKpis.js';
import { useBubbleReveal } from '../utils/useBubbleReveal.js';
import {
  loadPatientUiPreferences, normalizePatientUiPreferences, savePatientUiPreferences,
} from '../utils/patientUiPreferences.js';

// ===== SAMPLE DATA (fallback) =====
const weeklyTrend = [
  { day: 'Wed', steps: 7200, sleep: 6.2, sleepConsistency: 76, hr: 74, exercise: 35, activeMinutes: 42, caloriesBurned: 2100, sedentaryHours: 7, workoutCount: 1 },
  { day: 'Thu', steps: 6500, sleep: 5.7, sleepConsistency: 68, hr: 76, exercise: 30, activeMinutes: 38, caloriesBurned: 2040, sedentaryHours: 8, workoutCount: 1 },
  { day: 'Fri', steps: 9100, sleep: 7.0, sleepConsistency: 88, hr: 70, exercise: 55, activeMinutes: 58, caloriesBurned: 2320, sedentaryHours: 6, workoutCount: 1 },
  { day: 'Sat', steps: 8500, sleep: 6.6, sleepConsistency: 82, hr: 73, exercise: 50, activeMinutes: 54, caloriesBurned: 2260, sedentaryHours: 6, workoutCount: 1 },
  { day: 'Sun', steps: 7600, sleep: 6.1, sleepConsistency: 74, hr: 75, exercise: 40, activeMinutes: 45, caloriesBurned: 2180, sedentaryHours: 7, workoutCount: 1 },
  { day: 'Mon', steps: 9500, sleep: 6.8, sleepConsistency: 86, hr: 71, exercise: 60, activeMinutes: 64, caloriesBurned: 2380, sedentaryHours: 5, workoutCount: 1 },
  { day: 'Tue', steps: 8700, sleep: 7.1, sleepConsistency: 89, hr: 72, exercise: 45, activeMinutes: 52, caloriesBurned: 2240, sedentaryHours: 6, workoutCount: 1 },
];

const defaultHealthConnections = [
  { provider: 'apple_health', status: 'not_connected', permissions: [], last_sync: null },
  { provider: 'health_connect', status: 'not_connected', permissions: [], last_sync: null },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildSummaryMetrics(patientData, healthLog) {
  const latest = healthLog[healthLog.length - 1] || weeklyTrend[weeklyTrend.length - 1];
  const previous = healthLog[healthLog.length - 2] || latest;
  const delta = (key, digits = 0) => Number((latest[key] - previous[key]).toFixed(digits));
  const deltaLabel = (value, suffix = '') => `${value >= 0 ? '+' : ''}${value.toLocaleString()}${suffix} vs yesterday`;
  const recoveryScore = calculateRecoveryScore({
    sleepHours: patientData.sleep,
    sleepConsistency: patientData.sleepConsistency,
    restingHeartRateScore: patientData.heartRate ? clamp(100 - Math.max(0, patientData.heartRate - 74) * 4, 0, 100) : null,
    exerciseMinutes: patientData.exercise,
    activeMinutes: patientData.activeMinutes,
    age: patientData.age,
  }).score ?? 0;

  const aiPromptTemplates = {
    steps: [
      { id: 'steps_change', label: 'What’s driving my steps?', question: 'What’s been shaping my step count lately, and what’s one easy thing I could try today?' },
      { id: 'steps_focus', label: 'Pick a movement goal', question: 'What’s one realistic movement goal that fits how I’ve been moving lately?' },
    ],
    sleep: [
      { id: 'sleep_pattern', label: 'Spot my sleep pattern', question: 'What stands out about how I’ve been sleeping lately?' },
      { id: 'sleep_better', label: 'Plan tonight’s wind-down', question: 'What’s one easy wind-down idea that fits my recent sleep?' },
    ],
    heartRate: [
      { id: 'hr_meaning', label: 'How’s my resting HR trending?', question: 'How has my resting heart rate been trending lately, in plain terms?' },
      { id: 'hr_context', label: 'What can nudge it?', question: 'Which everyday habits tend to nudge resting heart rate up or down?' },
    ],
    exercise: [
      { id: 'exercise_balance', label: 'How’s my activity balance?', question: 'How balanced has my exercise been lately compared with my own goal?' },
      { id: 'exercise_next', label: 'Pick a session for today', question: 'What’s one doable workout that fits my recent routine today?' },
    ],
    recovery: [
      { id: 'recovery_score', label: 'What’s shaping recovery?', question: 'Which sleep or movement habit has been shaping how recovered I feel?' },
      { id: 'recovery_plan', label: 'Pick a recovery step', question: 'What’s one gentle recovery habit that fits where I’m at today?' },
    ],
  };

  return [
    {
      id: 'steps',
      label: 'Steps',
      icon: Activity,
      value: latest.steps?.toLocaleString() || '0',
      unit: 'steps',
      note: 'Daily movement',
      detail: deltaLabel(delta('steps')),
      source: 'Phone motion + wearable sync',
      progress: Math.min(100, Math.round((latest.steps / patientData.stepGoal) * 100)),
      data: healthLog.map((day) => day.steps),
      color: 'var(--wellpath-accent)',
      prompts: aiPromptTemplates.steps,
      backendPayload: { metricId: 'steps', source: 'wearable.steps' },
    },
    {
      id: 'sleep',
      label: 'Sleep',
      icon: Moon,
      value: latest.sleep || 0,
      unit: 'hrs',
      note: 'Recovery habit',
      detail: deltaLabel(delta('sleep', 1), ' hrs'),
      source: 'Sleep schedule sync',
      progress: Math.min(100, Math.round((latest.sleep / 8) * 100)),
      data: healthLog.map((day) => day.sleep),
      color: 'var(--wellpath-accent)',
      prompts: aiPromptTemplates.sleep,
      backendPayload: { metricId: 'sleep', source: 'wearable.sleep' },
    },
    {
      id: 'heartRate',
      label: 'Heart Rate',
      icon: Activity,
      value: latest.hr || 0,
      unit: 'bpm',
      note: 'Resting',
      detail: deltaLabel(delta('hr'), ' bpm'),
      source: 'Wearable heart sensor',
      progress: Math.max(0, Math.min(100, Math.round(((88 - latest.hr) / 24) * 100))),
      data: healthLog.map((day) => day.hr),
      color: 'var(--wellpath-accent)',
      prompts: aiPromptTemplates.heartRate,
      backendPayload: { metricId: 'heartRate', source: 'clinical.restingHr' },
    },
    {
      id: 'exercise',
      label: 'Exercise',
      icon: Activity,
      value: latest.exercise || 0,
      unit: 'min',
      note: 'Active time',
      detail: deltaLabel(delta('exercise'), ' min'),
      source: 'Workout sync',
      progress: Math.min(100, Math.round((latest.exercise / patientData.exerciseGoal) * 100)),
      data: healthLog.map((day) => day.exercise),
      color: 'var(--wellpath-accent)',
      prompts: aiPromptTemplates.exercise,
      backendPayload: { metricId: 'exercise', source: 'wearable.activeMinutes' },
    },
    {
      id: 'recovery',
      label: 'Recovery',
      icon: Activity,
      value: recoveryScore,
      unit: '/100',
      note: 'Sleep + activity balance',
      detail: patientData.sleep >= 7 ? 'Steady recovery window' : 'Sleep can improve recovery',
      source: 'Calculated from sample data',
      progress: recoveryScore,
      data: healthLog.map((day) => Math.round((day.sleep / 8) * 60 + ((90 - day.hr) / 30) * 40)),
      color: 'var(--wellpath-accent)',
      prompts: aiPromptTemplates.recovery,
      backendPayload: { metricId: 'recovery', source: 'derived.recoveryScore' },
    },
  ];
}

function PatientView({ user, onLogout, theme, setTheme }) {
  const initialUiPreferences = useMemo(() => loadPatientUiPreferences(user?.id), [user?.id]);
  const [screen, setScreen] = useState(initialUiPreferences.startScreen);
  const [healthLog, setHealthLog] = useState(weeklyTrend);
  const [goals, setGoals] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const aiPreferenceKey = `wellpath:ai-enabled:${user?.id ?? 'patient'}`;
  const [aiEnabled, setAiEnabled] = useState(() => {
    try {
      return window.localStorage.getItem(aiPreferenceKey) !== 'false';
    } catch {
      return true;
    }
  });
  const [uiPreferences, setUiPreferences] = useState(initialUiPreferences);
  const [aiAnswer, setAiAnswer] = useState(null);
  const [breakdownMetric, setBreakdownMetric] = useState(null);
  const [healthConnections, setHealthConnections] = useState(defaultHealthConnections);
  const more = useBubbleReveal();

  const patientId = user?.patientId;

  useEffect(() => {
    if (patientId) {
      fetchPatientData();
    }
  }, [patientId]);

  // Scroll to the top whenever the screen changes so a new tab starts at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  useEffect(() => {
    try {
      window.localStorage.setItem(aiPreferenceKey, String(aiEnabled));
    } catch {
      // The setting still works for this session when storage is unavailable.
    }
  }, [aiEnabled, aiPreferenceKey]);

  // Open the Breakdown page, optionally focused on a specific KPI's metric.
  const KPI_TO_BREAKDOWN = { calories: 'activeCalories' };
  const openBreakdown = useCallback((kpiId) => {
    setBreakdownMetric(kpiId ? (KPI_TO_BREAKDOWN[kpiId] || kpiId) : null);
    setScreen('summary');
  }, []);

  const fetchPatientData = async () => {
    try {
      setLoading(true);
      const [dashboard, trends, goalsData, connections, serverPreferences] = await Promise.all([
        api.getDashboard(patientId),
        api.getTrends(patientId),
        api.getGoals(patientId),
        api.getHealthConnections(patientId).catch(() => defaultHealthConnections),
        api.getPatientPreferences(patientId).catch(() => null),
      ]);

      setDashboardData(dashboard);
      if (trends && trends.length > 0) {
        setHealthLog(trends);
      }
      if (goalsData && goalsData.length > 0) {
        setGoals(goalsData);
      }
      if (Array.isArray(connections)) {
        setHealthConnections(connections);
      }
      if (serverPreferences) {
        const serverUi = serverPreferences.ui_preferences || serverPreferences.uiPreferences;
        if (serverUi) {
          const normalized = savePatientUiPreferences(user?.id, normalizePatientUiPreferences(serverUi));
          setUiPreferences(normalized);
          setScreen(normalized.startScreen);
        }
        if (typeof serverPreferences.ai_enabled === 'boolean') {
          setAiEnabled(serverPreferences.ai_enabled);
        }
      }
    } catch (error) {
      console.error('Failed to fetch patient data:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentPatient = useMemo(() => {
    const latest = healthLog[healthLog.length - 1] || weeklyTrend[weeklyTrend.length - 1];
    return {
      name: user?.name || 'Patient',
      birthday: dashboardData?.birthday ?? dashboardData?.date_of_birth ?? null,
      age: dashboardData?.age ?? null,
      heightInches: dashboardData?.height_inches ?? null,
      weightLbs: dashboardData?.weight_lbs ?? null,
      steps: dashboardData?.steps ?? latest.steps ?? 0,
      stepGoal: dashboardData?.step_goal ?? null,
      sleep: dashboardData?.sleep_hours ?? latest.sleep ?? 0,
      sleepConsistency: dashboardData?.sleep_consistency ?? latest.sleepConsistency,
      sleepGoal: dashboardData?.sleep_goal_hours ?? null,
      bedtime: dashboardData?.sleep_bedtime ?? latest.bedtime,
      wakeTime: dashboardData?.sleep_wake_time ?? latest.wakeTime,
      sleepInterruptions: dashboardData?.sleep_interruptions ?? latest.sleepInterruptions,
      heartRate: dashboardData?.resting_heart_rate ?? latest.hr ?? 0,
      restingHrBaselineLow: dashboardData?.resting_hr_baseline_low ?? null,
      restingHrBaselineHigh: dashboardData?.resting_hr_baseline_high ?? null,
      exercise: dashboardData?.exercise_minutes ?? latest.exercise ?? 0,
      exerciseGoal: dashboardData?.exercise_goal_minutes ?? null,
      activeMinutes: dashboardData?.active_minutes ?? latest.activeMinutes,
      activeMinuteGoal: dashboardData?.active_minute_goal ?? null,
      caloriesBurned: dashboardData?.calories_burned ?? latest.caloriesBurned,
      activeCalories: dashboardData?.active_calories ?? latest.activeCalories,
      activeCalorieGoal: dashboardData?.active_calorie_goal ?? null,
      sedentaryHours: dashboardData?.sedentary_hours ?? latest.sedentaryHours,
      sedentaryLimit: dashboardData?.sedentary_limit_hours ?? null,
      longestInactivePeriod: dashboardData?.longest_inactive_minutes ?? latest.longestInactiveMinutes,
      workoutCount: dashboardData?.workout_count ?? latest.workoutCount,
      workoutIntensity: dashboardData?.workout_intensity ?? latest.workoutIntensity,
      lastMeasurementDate: dashboardData?.record_date,
      recovery: 'Good',
      trendScore: 78,
      systolicBp: dashboardData?.systolic_bp,
      diastolicBp: dashboardData?.diastolic_bp,
      bpSystolicTargetMax: dashboardData?.bp_systolic_target_max ?? null,
      bpDiastolicTargetMax: dashboardData?.bp_diastolic_target_max ?? null,
      bloodPressure: dashboardData?.systolic_bp && dashboardData?.diastolic_bp 
        ? `${dashboardData.systolic_bp}/${dashboardData.diastolic_bp}` 
        : '--/--',
      bmi: dashboardData?.bmi ?? 0,
    };
  }, [dashboardData, healthLog, user]);

  // Seed the Risk Signal / Nutrition shared profile from the patient's own data
  // so users don't re-type what the app already knows.
  const initialProfile = useMemo(() => {
    const p = {};
    if (currentPatient.age) p.age = Math.round(currentPatient.age);
    const g = String(dashboardData?.gender || '').toLowerCase();
    if (g === 'female' || g === 'male') p.sex_female = g === 'female' ? 1 : 0;
    if (currentPatient.heightInches) p.heightCm = Math.round(currentPatient.heightInches * 2.54);
    if (currentPatient.weightLbs) p.weightKg = Math.round(currentPatient.weightLbs * 0.4536);
    if (currentPatient.heartRate) p.resting_hr = Math.round(currentPatient.heartRate);
    if (currentPatient.sleep) p.sleep_hours = Math.round(currentPatient.sleep * 2) / 2;
    return p;
  }, [currentPatient, dashboardData]);

  const metrics = useMemo(() => buildSummaryMetrics(currentPatient, healthLog), [currentPatient, healthLog]);
  const patientScores = useMemo(() => buildPatientScores(currentPatient, healthLog), [currentPatient, healthLog]);
  const patientKpis = useMemo(() => buildPatientKpis(currentPatient, healthLog), [currentPatient, healthLog]);

  const updateUiPreferences = useCallback((updater) => {
    setUiPreferences((current) => {
      const nextValue = typeof updater === 'function' ? updater(current) : updater;
      const normalized = savePatientUiPreferences(user?.id, nextValue);
      api.updatePatientPreferences(patientId, { uiPreferences: normalized }).catch(() => {});
      return normalized;
    });
  }, [patientId, user?.id]);

  const updateAiEnabled = useCallback(async (enabled) => {
    const next = Boolean(enabled);
    setAiEnabled(next);
    try {
      await api.updatePatientPreferences(patientId, { aiEnabled: next });
    } catch {
      // The browser preference remains active when the API is unavailable.
    }
    return next;
  }, [patientId]);

  // Cycle tracking only applies to some patients, so the tab is conditional
  // (also keeps the nav from getting crowded for everyone else).
  const tracksCycle = String(dashboardData?.gender || '').toLowerCase() === 'female';

  // Primary tabs live directly in the bottom bar; the rest tuck into a "More" popup
  // so the bar doesn't get crowded.
  const nav = [
    ['dashboard', 'Today', Home],
    ['summary', 'Breakdown', Activity],
    ['mood', 'Mood', Smile],
    ['nutrition', 'Nutrition', Utensils],
    ...(tracksCycle ? [['cycle', 'Cycle', Droplets]] : []),
  ];
  const moreNav = [
    ['risk', 'Risk Signals', Gauge],
    ['trainer', 'Partner', Dumbbell],
    ['clinical', 'Health record', Stethoscope],
  ];

  // ===== UPDATED: AI function with Groq API integration =====
  const askAi = async (metric, prompt) => {
    if (!aiEnabled) {
      setAiAnswer({
        metric: metric.label,
        prompt: prompt.label,
        text: 'AI insights are turned off. Turn them back on in Settings if you want generated explanations.',
      });
      return;
    }

    // Set loading state
    setAiAnswer({
      metric: metric.label,
      prompt: prompt.label,
      text: '🤔 Analyzing your health data...',
    });

    try {
      const data = await api.getAiInsight({
        patientId,
        insightType: 'question',
        targetId: metric.id,
        targetTitle: metric.label,
        targetContext: {
          userQuestion: prompt.question || prompt.label,
          metric: metric.backendPayload,
        },
      });

      setAiAnswer({
        metric: metric.label,
        prompt: prompt.label,
        text: data.answer || 'No insights are available right now.',
        disclaimer: data.disclaimer,
      });
    } catch (error) {
      console.error('AI Error:', error);
      setAiAnswer({
        metric: metric.label,
        prompt: prompt.label,
        text: '⚠️ Unable to connect to AI service. Please check your connection and try again.',
      });
    }
  };

  const generateDashboardAiInsight = useCallback(async (target) => {
    if (!aiEnabled) {
      return 'AI insights are turned off. Turn them back on in Settings if you want generated explanations.';
    }

    // Personalization memory: fold anything the user has told the app about
    // themselves into every insight, so guidance stays tailored across tabs.
    const memory = getMemory(patientId);
    const payload = memory.length
      ? { ...target, targetContext: { ...(target.targetContext || {}), userMemory: memory } }
      : target;

    const data = await api.getAiInsight({ patientId, ...payload });

    return data.answer || "I'm having trouble generating this insight right now. Please try again later.";
  }, [aiEnabled, patientId]);

  const updateHealthConnection = async (provider, updates) => {
    const saved = await api.updateHealthConnection(patientId, provider, updates);
    setHealthConnections((items) => [
      ...items.filter((item) => item.provider !== provider),
      saved,
    ]);
    return saved;
  };

  const addGoal = async (title) => {
    try {
      const newGoal = await api.addGoal(patientId, title, 'Planned');
      setGoals((items) => [...items, {
        id: newGoal.id,
        title: newGoal.title,
        status: newGoal.status || 'Planned',
      }]);
      return newGoal;
    } catch (error) {
      throw new Error(error.message || 'The goal could not be added.');
    }
  };

  const toggleGoalStatus = async (goalId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'Complete' ? 'In progress' : 'Complete';
      await api.updateGoal(goalId, { status: newStatus });
      setGoals((items) => items.map((goal) => (
        goal.id === goalId ? { ...goal, status: newStatus } : goal
      )));
      return newStatus;
    } catch (error) {
      throw new Error(error.message || 'The goal could not be updated.');
    }
  };

  const deleteGoal = async (goalId) => {
    try {
      await api.deleteGoal(goalId);
      setGoals((items) => items.filter((goal) => goal.id !== goalId));
    } catch (error) {
      throw new Error(error.message || 'The goal could not be deleted.');
    }
  };

  const submitPatientFeedback = (feedback) => api.addPatientFeedback(patientId, feedback);

  if (loading) {
    return (
      <div className="patient-app-shell">
        <div className="loading-center">
          <Activity size={32} className="spinning" />
          <p>Loading your data...</p>
        </div>
      </div>
    );
  }

  return (
    <HealthProfileProvider initial={initialProfile}>
    <section className={`patient-app-shell density-${uiPreferences.density}${uiPreferences.reduceMotion ? ' reduce-motion' : ''}`}>
      <PatientAppHeader
        patientData={currentPatient}
        aiEnabled={aiEnabled}
        onOpenSettings={() => { more.close(); setBreakdownMetric(null); setScreen('settings'); }}
      />
      <div className="patient-screen-stage">
        {screen === 'dashboard' && (
          <PatientToday
            patientId={patientId}
            patientData={currentPatient}
            scores={patientScores}
            kpis={patientKpis}
            metrics={metrics} 
            aiEnabled={aiEnabled}
            onGenerateAiInsight={generateDashboardAiInsight}
            onAskAi={askAi}
            aiAnswer={aiAnswer}
            setScreen={setScreen}
            onOpenBreakdown={openBreakdown}
            uiPreferences={uiPreferences}
          />
        )}
        {screen === 'summary' && (
          <HealthSummary
            patientId={patientId}
            healthLog={healthLog}
            patientData={currentPatient}
            initialMetricId={breakdownMetric}
            aiEnabled={aiEnabled}
            onGenerateAiInsight={generateDashboardAiInsight}
          />
        )}
        {screen === 'mood' && (
          <MoodPage
            patientId={patientId}
            healthLog={healthLog}
            aiEnabled={aiEnabled}
            onGenerateAiInsight={generateDashboardAiInsight}
          />
        )}
        {screen === 'cycle' && tracksCycle && (
          <CyclePage
            patientId={patientId}
            healthLog={healthLog}
            aiEnabled={aiEnabled}
            onGenerateAiInsight={generateDashboardAiInsight}
          />
        )}
        {screen === 'risk' && (
          <RiskSignal />
        )}
        {screen === 'nutrition' && (
          <NutritionTab
            patientId={patientId}
            aiEnabled={aiEnabled}
            onGenerateAiInsight={generateDashboardAiInsight}
            onGoToRisk={() => { setBreakdownMetric(null); setScreen('risk'); }}
            healthLog={healthLog}
          />
        )}
        {screen === 'trainer' && (
          <PartnerPage
            patientData={currentPatient}
            healthLog={healthLog}
            goals={goals}
            onAddGoal={addGoal}
            onToggleGoal={toggleGoalStatus}
            onDeleteGoal={deleteGoal}
            onSubmitFeedback={submitPatientFeedback}
          />
        )}
        {screen === 'clinical' && (
          <ClinicalDataPage
            patientId={patientId}
            patientData={currentPatient}
            healthLog={healthLog}
          />
        )}
        {screen === 'settings' && (
          <PatientSettingsPage
            patientId={patientId}
            kpis={patientKpis}
            uiPreferences={uiPreferences}
            setUiPreferences={updateUiPreferences}
            aiEnabled={aiEnabled}
            setAiEnabled={updateAiEnabled}
            theme={theme} 
            setTheme={setTheme} 
            onLogout={onLogout}
            user={user}
            healthConnections={healthConnections}
            onUpdateHealthConnection={updateHealthConnection}
          />
        )}
      </div>
      <nav className="patient-bottom-tabs">
        {nav.map(([id, label, Icon]) => (
          <button key={id} className={screen === id ? 'active' : ''} onClick={() => { more.close(); setBreakdownMetric(null); setScreen(id); }}>
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
        <div className="patient-more-tab">
          {more.mounted && (
            <>
              <button
                type="button"
                className="patient-more-backdrop"
                aria-label="Close menu"
                onClick={more.close}
              />
              <ul className={`patient-more-menu bubble-anim${more.closing ? ' closing' : ''}`} role="menu">
                {moreNav.map(([id, label, Icon]) => (
                  <li key={id} role="none">
                    <button
                      role="menuitem"
                      className={screen === id ? 'active' : ''}
                      onClick={() => { more.close(); setBreakdownMetric(null); setScreen(id); }}
                    >
                      <Icon size={18} />
                      <span>{label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <button
            type="button"
            className={more.open || moreNav.some(([id]) => id === screen) ? 'active' : ''}
            aria-haspopup="menu"
            aria-expanded={more.open}
            onClick={more.toggle}
          >
            <MoreHorizontal size={18} />
            <span>More</span>
          </button>
        </div>
      </nav>
    </section>
    </HealthProfileProvider>
  );
}

export default PatientView;
