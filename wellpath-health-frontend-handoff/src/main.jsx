import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  Download,
  Dumbbell,
  EyeOff,
  Gauge,
  Handshake,
  HeartPulse,
  Home,
  Leaf,
  Lock,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  MessageSquare,
  Moon,
  Plus,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  Sun,
  Target,
  TrendingUp,
  Trash2,
  Users,
  UserRound,
  UsersRound,
  Settings as SettingsIcon,
} from 'lucide-react';
import './styles.css';

const patient = {
  name: 'Alex Johnson',
  steps: 8432,
  stepGoal: 10000,
  sleep: 7.1,
  heartRate: 72,
  exercise: 45,
  exerciseGoal: 60,
  recovery: 'Good',
  trendScore: 82,
  bloodPressure: '135/88',
  bmi: 26.2,
};

const weeklyTrend = [
  { day: 'Wed', steps: 7200, sleep: 6.2, hr: 74, exercise: 35 },
  { day: 'Thu', steps: 6500, sleep: 5.7, hr: 76, exercise: 30 },
  { day: 'Fri', steps: 9100, sleep: 7.0, hr: 70, exercise: 55 },
  { day: 'Sat', steps: 8500, sleep: 6.6, hr: 73, exercise: 50 },
  { day: 'Sun', steps: 7600, sleep: 6.1, hr: 75, exercise: 40 },
  { day: 'Mon', steps: 9500, sleep: 6.8, hr: 71, exercise: 60 },
  { day: 'Tue', steps: 8700, sleep: 7.1, hr: 72, exercise: 45 },
];

const longTerm = [
  { label: 'Apr 15', steps: 6400, sleep: 6.0, hr: 76 },
  { label: 'Apr 22', steps: 7200, sleep: 6.3, hr: 74 },
  { label: 'Apr 29', steps: 7600, sleep: 6.5, hr: 73 },
  { label: 'May 6', steps: 8100, sleep: 6.7, hr: 72 },
  { label: 'May 13', steps: 8450, sleep: 7.0, hr: 71 },
];

const patients = [
  { name: 'Alex Johnson', lastSync: '8:20 AM', risk: 'Low', focus: 'Maintain routine', adherence: '86%', nextCheck: 'May 17' },
  { name: 'Maria Garcia', lastSync: '8:15 AM', risk: 'Medium', focus: 'Sleep consistency', adherence: '72%', nextCheck: 'May 16' },
  { name: 'James Kim', lastSync: '7:50 AM', risk: 'High', focus: 'Activity drop', adherence: '58%', nextCheck: 'Today' },
  { name: 'Sophie Patel', lastSync: '7:45 AM', risk: 'Low', focus: 'Exercise progress', adherence: '91%', nextCheck: 'May 20' },
  { name: 'Daniel Lee', lastSync: '7:30 AM', risk: 'Medium', focus: 'Recovery balance', adherence: '68%', nextCheck: 'May 18' },
];

const patientRecordsSeed = [
  {
    id: 1,
    name: 'Alex Johnson',
    dob: '2002-04-12',
    gender: 'Male',
    email: 'alex@example.com',
    clinician: 'Dr. Rivera',
    trainer: 'Jordan Lee',
    consent: true,
    clinical: { systolic: 135, diastolic: 88, bmi: 26.2, restingHr: 72, notes: 'Sample baseline only', medications: 'None listed' },
    wearable: { steps: 8700, activeMinutes: 45, sleep: 7.1, calories: 2240, workouts: 4 },
    lifestyle: { exerciseFrequency: 4, dietaryScore: 7, stressLevel: 4, sedentaryHours: 6 },
    createdAt: '2026-05-27',
  },
];

const recommendations = [
  'Try a 10-minute walk after meals.',
  'Keep bedtime within the same 30-minute window.',
  'Add one light stretching session after workouts.',
  'Drink water before afternoon activity.',
];

const alertSignals = [
  { title: 'Low sleep on Thursday', severity: 'Medium', detail: 'Sleep was below 6 hours. Try checking bedtime routine.' },
  { title: 'Activity dip on Sunday', severity: 'Low', detail: 'Steps were lower than usual, but the weekly trend stayed steady.' },
  { title: 'Heart rate stable', severity: 'Info', detail: 'Resting heart rate stayed within the sample baseline.' },
];

const nextGoals = [
  { id: 1, title: 'Walk 10,000 steps at least 5 days this week', status: 'In progress' },
  { id: 2, title: 'Sleep 7 hours for the next 3 nights', status: 'In progress' },
  { id: 3, title: 'Complete three 45-minute workouts', status: 'Planned' },
  { id: 4, title: 'Review history signals every Friday', status: 'Planned' },
];

const projectRoadmap = [
  'Add backend authentication and user accounts',
  'Connect wearable or simulated device data',
  'Add stronger trend analysis',
  'Expand provider reporting and care-team notes',
  'Keep recommendations clear while avoiding medical diagnosis',
];

const defaultSummaryMetrics = ['steps', 'sleep', 'heartRate', 'exercise', 'recovery'];

const aiPromptTemplates = {
  steps: [
    { id: 'steps_change', label: 'Why did steps change?' },
    { id: 'steps_focus', label: 'What should I focus on?' },
  ],
  sleep: [
    { id: 'sleep_pattern', label: 'How was my sleep?' },
    { id: 'sleep_better', label: 'How can I improve tonight?' },
  ],
  heartRate: [
    { id: 'hr_meaning', label: 'What does this trend mean?' },
    { id: 'hr_context', label: 'What affects this number?' },
  ],
  exercise: [
    { id: 'exercise_balance', label: 'Was this enough activity?' },
    { id: 'exercise_next', label: 'What workout fits today?' },
  ],
  recovery: [
    { id: 'recovery_score', label: 'Why this recovery score?' },
    { id: 'recovery_plan', label: 'How do I recover better?' },
  ],
};

const aiResponseSamples = {
  steps_change: 'Your steps rose compared with yesterday. A short walk after lunch would keep the trend moving without making the plan feel heavy.',
  steps_focus: 'Focus on consistency first: try one 10-minute walk and one extra set of stairs. This is lifestyle guidance, not medical advice.',
  sleep_pattern: 'Your sleep is close to the target range, but the weekly pattern still changes a bit. A steadier bedtime could help recovery feel more predictable.',
  sleep_better: 'Try keeping your bedtime within the same 30-minute window and reduce intense activity right before bed.',
  hr_meaning: 'Resting heart rate is stable in this sample. It can change with sleep, stress, activity, caffeine, and hydration.',
  hr_context: 'Compare heart rate with sleep and exercise before reacting to one number. For medical concerns, ask a professional.',
  exercise_balance: 'You are close to today’s activity target. A lighter recovery session would still count if you feel tired.',
  exercise_next: 'A 25-minute walk plus light stretching fits today’s sleep and activity pattern.',
  recovery_score: 'Recovery combines sleep, resting heart rate, and recent workouts. Today looks steady but sleep consistency can improve it.',
  recovery_plan: 'Keep tonight simple: hydration, stretching, and a steady bedtime. Avoid treating this as a diagnosis.',
  general: 'This question is ready for backend AI. The frontend sends a metric id and prompt id so the API can answer with context.',
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function calculateKpis(record) {
  const stepsScore = clamp(record.wearable.steps / 10000, 0, 1) * 25;
  const sleepScore = clamp(record.wearable.sleep / 8, 0, 1) * 25;
  const stressScore = clamp((10 - record.lifestyle.stressLevel) / 10, 0, 1) * 20;
  const bpScore = (record.clinical.systolic < 130 && record.clinical.diastolic < 85 ? 1 : 0.58) * 15;
  const movementScore = clamp((12 - record.lifestyle.sedentaryHours) / 12, 0, 1) * 15;
  const healthScore = Math.round(stepsScore + sleepScore + stressScore + bpScore + movementScore);

  const riskScore = clamp(
    (record.clinical.systolic >= 140 ? 25 : record.clinical.systolic >= 130 ? 14 : 0) +
    (record.clinical.restingHr >= 85 ? 18 : record.clinical.restingHr >= 76 ? 9 : 0) +
    (record.wearable.steps < 6000 ? 22 : record.wearable.steps < 8000 ? 11 : 0) +
    (record.wearable.sleep < 6 ? 20 : record.wearable.sleep < 7 ? 10 : 0) +
    (record.lifestyle.sedentaryHours > 8 ? 15 : record.lifestyle.sedentaryHours > 6 ? 7 : 0),
    0,
    100
  );

  return {
    healthScore,
    riskScore,
    activityConsistency: clamp(Math.round((record.wearable.workouts / 5) * 100), 0, 100),
    recoveryScore: clamp(Math.round((record.wearable.sleep / 8) * 65 + ((90 - record.clinical.restingHr) / 30) * 35), 0, 100),
    engagementLevel: record.wearable.activeMinutes >= 45 ? 'Strong' : record.wearable.activeMinutes >= 25 ? 'Moderate' : 'Needs support',
  };
}

function buildGeneratedAlerts(record, kpis) {
  const alerts = [];
  if (record.wearable.steps < 6500) alerts.push('Low activity trend');
  if (record.wearable.sleep < 6.5) alerts.push('Sleep recovery needs attention');
  if (record.clinical.systolic >= 135 || record.clinical.diastolic >= 88) alerts.push('Blood pressure lifestyle review');
  if (record.lifestyle.stressLevel >= 8) alerts.push('High stress input');
  if (kpis.riskScore >= 55 && record.wearable.sleep < 7 && record.wearable.steps < 8000) alerts.push('Combined low activity and sleep flag');
  return alerts.length ? alerts : ['No urgent lifestyle flags'];
}

function enrichPatientRecord(record) {
  const kpis = calculateKpis(record);
  return { ...record, kpis, alerts: record.alerts || buildGeneratedAlerts(record, kpis) };
}

function patientDirectory(records) {
  const generated = records.map((raw) => {
    const record = enrichPatientRecord(raw);
    const risk = record.kpis.riskScore >= 70 ? 'High' : record.kpis.riskScore >= 40 ? 'Medium' : 'Low';
    return {
      name: record.name,
      lastSync: 'Intake saved',
      risk,
      focus: record.alerts[0],
      adherence: `${record.kpis.activityConsistency}%`,
      nextCheck: 'This week',
      sourceRecord: record,
    };
  });
  const existingNames = new Set(generated.map((p) => p.name));
  return [...generated, ...patients.filter((p) => !existingNames.has(p.name))];
}

function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = window.localStorage.getItem(key);
      return saved ? JSON.parse(saved) : initialValue;
    } catch {
      return initialValue;
    }
  });
  const [serverReady, setServerReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/state')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('No app API')))
      .then((data) => {
        if (cancelled) return;
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          setValue(data[key]);
        }
        setServerReady(true);
      })
      .catch(() => setServerReady(false));

    return () => {
      cancelled = true;
    };
  }, [key]);

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Local storage is optional; the UI still works without it.
    }

    if (serverReady) {
      fetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      }).catch(() => {
        // The Vite-only dev server has no API; local storage keeps the app usable.
      });
    }
  }, [key, value, serverReady]);

  return [value, setValue];
}

function App() {
  const [isSignedIn, setIsSignedIn] = usePersistentState('is-signed-in', false);
  const [role, setRole] = usePersistentState('active-role', 'patient');
  const [screen, setScreen] = usePersistentState('patient-screen', 'dashboard');
  const [theme, setTheme] = usePersistentState('theme-mode', 'light');
  const [healthLog, setHealthLog] = usePersistentState('health-log', weeklyTrend);
  const [goals, setGoals] = usePersistentState('health-goals', nextGoals);
  const [patientRecords, setPatientRecords] = usePersistentState('patient-records', patientRecordsSeed);
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  const installApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const currentPatient = useMemo(() => {
    const primaryRecord = enrichPatientRecord(patientRecords[0] || patientRecordsSeed[0]);
    const latest = healthLog[healthLog.length - 1] || weeklyTrend[weeklyTrend.length - 1];
    return {
      ...patient,
      name: primaryRecord.name,
      steps: latest.steps,
      sleep: latest.sleep,
      heartRate: latest.hr,
      exercise: latest.exercise,
      trendScore: primaryRecord.kpis.healthScore,
      bloodPressure: `${primaryRecord.clinical.systolic}/${primaryRecord.clinical.diastolic}`,
      bmi: primaryRecord.clinical.bmi,
    };
  }, [healthLog, patientRecords]);

  const activeView = useMemo(() => {
    if (role === 'trainer') return <TrainerView healthLog={healthLog} patient={currentPatient} />;
    if (role === 'provider') return <ProviderView healthLog={healthLog} patientRecords={patientRecords} setPatientRecords={setPatientRecords} />;
    return (
      <PatientView
        screen={screen}
        setScreen={setScreen}
        healthLog={healthLog}
        goals={goals}
        setGoals={setGoals}
        patientData={currentPatient}
        theme={theme}
        setTheme={setTheme}
        setIsSignedIn={setIsSignedIn}
        installPrompt={installPrompt}
        installApp={installApp}
      />
    );
  }, [role, screen, healthLog, goals, setGoals, currentPatient, patientRecords, setPatientRecords, theme, setTheme, setIsSignedIn, installPrompt]);

  if (!isSignedIn) {
    return <AuthPage selectedRole={role} setSelectedRole={setRole} onLogin={() => setIsSignedIn(true)} theme={theme} setTheme={setTheme} />;
  }

  const roleMeta = {
    patient: { label: 'Patient app', icon: UserRound, helper: 'Daily personal view' },
    trainer: { label: 'Trainer support', icon: UsersRound, helper: 'Client support view' },
    provider: { label: 'Clinician trend review', icon: Stethoscope, helper: 'Provider-only workspace' },
  }[role];
  const RoleIcon = roleMeta.icon;

  return (
    <main className={role === 'patient' ? 'app patient-app-root' : 'app'}>
      {role !== 'patient' && (
      <header className="topbar">
        <div className="brand" aria-label="WellPath Health home">
          <span className="brand-mark"><HeartPulse size={25} /></span>
          <span>
            <strong>WellPath Health</strong>
            <small>Lifestyle trend support</small>
          </span>
        </div>
        <div className="role-badge">
          <RoleIcon size={18} />
          <span><strong>{roleMeta.label}</strong><small>{roleMeta.helper}</small></span>
        </div>
        <p className="disclaimer"><ShieldCheck size={17} /> Info only</p>
        <button className="logout-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle color mode">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
        {installPrompt && <button className="logout-btn install-btn" onClick={installApp}><Download size={16} /> Install App</button>}
        <button className="logout-btn" onClick={() => setIsSignedIn(false)}><LogOut size={16} /> Switch role</button>
      </header>
      )}
      {activeView}
    </main>
  );
}

function AuthPage({ selectedRole, setSelectedRole, onLogin, theme, setTheme }) {
  const roleOptions = [
    { id: 'patient', title: 'Patient', detail: 'Daily mobile app for your own habits.', icon: UserRound },
    { id: 'trainer', title: 'Trainer', detail: 'Support view for activity and recovery.', icon: UsersRound },
    { id: 'provider', title: 'Clinician', detail: 'Separate trend review dashboard.', icon: Stethoscope },
  ];

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand auth-brand">
          <span className="brand-mark"><HeartPulse size={25} /></span>
          <span><strong>WellPath Health</strong><small>Complete local health tracking workspace</small></span>
        </div>
        <div className="login-mode-row">
          <span>Choose demo role</span>
          <button className="logout-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} type="button">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
        <div className="role-picker" aria-label="Choose role">
          {roleOptions.map(({ id, title, detail, icon: Icon }) => (
            <button
              key={id}
              aria-label={`Choose ${title} role`}
              aria-pressed={selectedRole === id}
              className={selectedRole === id ? 'selected' : ''}
              onClick={() => setSelectedRole(id)}
              type="button"
            >
              <Icon size={18} />
              <span><strong>{title}</strong><small>{detail}</small></span>
            </button>
          ))}
        </div>
        <WelcomeScreen onLogin={onLogin} loginLabel={`Enter ${roleOptions.find((item) => item.id === selectedRole)?.title || 'App'} View`} />
      </section>
      <section className="auth-copy">
        <div className="app-preview-card">
          <div className="preview-ring"><HeartPulse size={28} /></div>
          <h1>Open your health workspace.</h1>
          <p>Choose the role you are presenting, then continue into the app. WellPath keeps patient, trainer, and clinician views separate.</p>
          <div className="auth-points">
            <span><CheckCircle2 size={18} /> Patient daily tracking</span>
            <span><CheckCircle2 size={18} /> Trainer workout support</span>
            <span><CheckCircle2 size={18} /> Clinician trend review</span>
          </div>
        </div>
      </section>
    </main>
  );
}

function PatientView({ screen, setScreen, healthLog, goals, setGoals, patientData, theme, setTheme, setIsSignedIn, installPrompt, installApp }) {
  const [aiEnabled, setAiEnabled] = usePersistentState('ai-enabled', true);
  const [visibleMetrics, setVisibleMetrics] = usePersistentState('visible-summary-metrics', defaultSummaryMetrics);
  const [aiAnswer, setAiAnswer] = useState(null);
  const metrics = useMemo(() => buildSummaryMetrics(patientData, healthLog), [patientData, healthLog]);
  const nav = [
    ['dashboard', 'Today', Home],
    ['summary', 'Summary', Activity],
    ['ai', 'AI', Sparkles],
    ['partner', 'Partner', Handshake],
    ['settings', 'Settings', SettingsIcon],
  ];

  const askAi = (metric, prompt) => {
    if (!aiEnabled) {
      setAiAnswer({
        metric: metric.label,
        prompt: prompt.label,
        text: 'AI insights are turned off. Turn them back on in Settings if you want generated explanations.',
      });
      return;
    }

    setAiAnswer({
      metric: metric.label,
      prompt: prompt.label,
      text: aiResponseSamples[prompt.id] || aiResponseSamples.general,
    });
  };

  const contentByScreen = {
    welcome: <WelcomeScreen />,
    dashboard: <PatientToday patientData={patientData} healthLog={healthLog} metrics={metrics} aiEnabled={aiEnabled} onAskAi={askAi} setScreen={setScreen} />,
    summary: <HealthSummary metrics={metrics} visibleMetrics={visibleMetrics} aiEnabled={aiEnabled} aiAnswer={aiAnswer} onAskAi={askAi} />,
    ai: <AiInsightsPage metrics={metrics} aiEnabled={aiEnabled} setAiEnabled={setAiEnabled} aiAnswer={aiAnswer} onAskAi={askAi} />,
    partner: <PartnerPage patientData={patientData} healthLog={healthLog} goals={goals} setGoals={setGoals} />,
    settings: (
      <PatientSettingsPage
        metrics={metrics}
        visibleMetrics={visibleMetrics}
        setVisibleMetrics={setVisibleMetrics}
        aiEnabled={aiEnabled}
        setAiEnabled={setAiEnabled}
        theme={theme}
        setTheme={setTheme}
        setIsSignedIn={setIsSignedIn}
        installPrompt={installPrompt}
        installApp={installApp}
      />
    ),
  };
  const content = contentByScreen[screen] || contentByScreen.dashboard;

  return (
    <section className="patient-app-shell">
      <PatientAppHeader patientData={patientData} aiEnabled={aiEnabled} />
      <div className="patient-screen-stage">{content}</div>
      <nav className="patient-bottom-tabs" aria-label="Patient app sections">
        {nav.map(([id, label, Icon]) => (
          <button key={id} className={screen === id ? 'active' : ''} onClick={() => setScreen(id)} aria-label={label}>
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </section>
  );
}

function buildSummaryMetrics(patientData, healthLog) {
  const latest = healthLog[healthLog.length - 1] || weeklyTrend[weeklyTrend.length - 1];
  const previous = healthLog[healthLog.length - 2] || latest;
  const delta = (key, digits = 0) => Number((latest[key] - previous[key]).toFixed(digits));
  const deltaLabel = (value, suffix = '') => `${value >= 0 ? '+' : ''}${value.toLocaleString()}${suffix} vs yesterday`;
  const recoveryScore = clamp(Math.round((patientData.sleep / 8) * 62 + ((90 - patientData.heartRate) / 30) * 38), 0, 100);

  return [
    {
      id: 'steps',
      label: 'Steps',
      icon: Activity,
      value: latest.steps.toLocaleString(),
      unit: 'steps',
      note: 'Daily movement',
      detail: deltaLabel(delta('steps')),
      source: 'Phone motion + wearable sync',
      progress: Math.min(100, Math.round((latest.steps / patientData.stepGoal) * 100)),
      data: healthLog.map((day) => day.steps),
      color: 'var(--teal)',
      prompts: aiPromptTemplates.steps,
      backendPayload: { metricId: 'steps', source: 'wearable.steps' },
    },
    {
      id: 'sleep',
      label: 'Sleep',
      icon: Moon,
      value: latest.sleep,
      unit: 'hrs',
      note: 'Recovery habit',
      detail: deltaLabel(delta('sleep', 1), ' hrs'),
      source: 'Sleep schedule sync',
      progress: Math.min(100, Math.round((latest.sleep / 8) * 100)),
      data: healthLog.map((day) => day.sleep),
      color: 'var(--blue)',
      prompts: aiPromptTemplates.sleep,
      backendPayload: { metricId: 'sleep', source: 'wearable.sleep' },
    },
    {
      id: 'heartRate',
      label: 'Heart Rate',
      icon: HeartPulse,
      value: latest.hr,
      unit: 'bpm',
      note: 'Resting',
      detail: deltaLabel(delta('hr'), ' bpm'),
      source: 'Wearable heart sensor',
      progress: Math.max(0, Math.min(100, Math.round(((88 - latest.hr) / 24) * 100))),
      data: healthLog.map((day) => day.hr),
      color: 'var(--coral)',
      prompts: aiPromptTemplates.heartRate,
      backendPayload: { metricId: 'heartRate', source: 'clinical.restingHr' },
    },
    {
      id: 'exercise',
      label: 'Exercise',
      icon: Dumbbell,
      value: latest.exercise,
      unit: 'min',
      note: 'Active time',
      detail: deltaLabel(delta('exercise'), ' min'),
      source: 'Workout sync',
      progress: Math.min(100, Math.round((latest.exercise / patientData.exerciseGoal) * 100)),
      data: healthLog.map((day) => day.exercise),
      color: 'var(--green)',
      prompts: aiPromptTemplates.exercise,
      backendPayload: { metricId: 'exercise', source: 'wearable.activeMinutes' },
    },
    {
      id: 'recovery',
      label: 'Recovery',
      icon: Gauge,
      value: recoveryScore,
      unit: '/100',
      note: 'Sleep + activity balance',
      detail: patientData.sleep >= 7 ? 'Steady recovery window' : 'Sleep can improve recovery',
      source: 'Calculated from sample data',
      progress: recoveryScore,
      data: healthLog.map((day) => Math.round((day.sleep / 8) * 60 + ((90 - day.hr) / 30) * 40)),
      color: 'var(--amber)',
      prompts: aiPromptTemplates.recovery,
      backendPayload: { metricId: 'recovery', source: 'derived.recoveryScore' },
    },
  ];
}

function PatientAppHeader({ patientData, aiEnabled }) {
  return (
    <header className="patient-app-header">
      <div>
        <span>WellPath</span>
        <strong>Hi, {patientData.name.split(' ')[0]}</strong>
      </div>
      <div className="patient-header-actions">
        <span className={aiEnabled ? 'ai-status on' : 'ai-status off'}>{aiEnabled ? 'AI on' : 'AI off'}</span>
        <div className="mini-avatar">{patientData.name.split(' ').map((part) => part[0]).join('')}</div>
      </div>
    </header>
  );
}

function WelcomeScreen({ compact = false, onLogin, loginLabel = 'Log In' }) {
  return (
    <div className={compact ? 'welcome compact' : 'welcome'}>
      <HeartPulse className="welcome-logo" size={58} />
      <h1>Welcome Back</h1>
      <p>Review your lifestyle habits, goals, and weekly progress.</p>
      <label className="field"><Mail size={16} /><input defaultValue="student@example.com" aria-label="Email" /></label>
      <label className="field"><Lock size={16} /><input type="password" defaultValue="password" aria-label="Password" /></label>
      <div className="check-row">
        <label><input type="checkbox" /> Remember me</label>
        <button>Forgot?</button>
      </div>
      <button className="primary-btn" onClick={onLogin}>{loginLabel}</button>
      <small>Secure sample workspace. Lifestyle support only.</small>
    </div>
  );
}

function PatientToday({ patientData, metrics, aiEnabled, onAskAi, setScreen }) {
  const priorityMetrics = metrics.slice(0, 4);
  const recovery = metrics.find((metric) => metric.id === 'recovery');

  return (
    <div className="mobile-flow">
      <section className="today-hero-card">
        <div>
          <span>Today</span>
          <h1>{patientData.trendScore}</h1>
          <p>Readiness score from lifestyle trends.</p>
        </div>
        <div className="readiness-ring" style={{ '--score': `${patientData.trendScore}%` }}>
          <strong>{patientData.recovery}</strong>
          <small>recovery</small>
        </div>
      </section>

      <section className="focus-strip">
        <Target size={18} />
        <div>
          <strong>Best next move</strong>
          <p>{patientData.sleep < 7 ? 'Keep tonight calm and aim for a steady bedtime.' : 'Take a short walk to keep your activity pattern steady.'}</p>
        </div>
      </section>

      <div className="mobile-section-title">
        <div>
          <span>Summary</span>
          <h2>Your key cards</h2>
        </div>
        <button onClick={() => setScreen('summary')}>View all <ChevronRight size={15} /></button>
      </div>

      <div className="today-card-grid">
        {priorityMetrics.map((metric) => (
          <CompactMetricCard key={metric.id} metric={metric} onOpen={() => setScreen('summary')} />
        ))}
      </div>

      <section className="ai-preview-card">
        <div className="ai-preview-head">
          <Sparkles size={18} />
          <div>
            <strong>AI insight preview</strong>
            <p>{aiEnabled ? 'Ask one quick question about today.' : 'AI is off in Settings.'}</p>
          </div>
        </div>
        {recovery && (
          <AiPromptChips metric={recovery} aiEnabled={aiEnabled} onAskAi={onAskAi} compact />
        )}
      </section>

      <div className="quiet-disclaimer"><ShieldCheck size={15} /> Lifestyle support only. Not diagnosis or medical advice.</div>
    </div>
  );
}

function CompactMetricCard({ metric, onOpen }) {
  const Icon = metric.icon;
  return (
    <button className="compact-metric-card" onClick={onOpen} type="button">
      <div className="metric-card-top">
        <span style={{ color: metric.color }}><Icon size={17} /></span>
        <em>{metric.progress}%</em>
      </div>
      <strong>{metric.value} <small>{metric.unit}</small></strong>
      <p>{metric.label}</p>
      <MiniLine data={metric.data} color={metric.color} />
    </button>
  );
}

function PatientDashboard({ patientData, healthLog }) {
  const latest = healthLog[healthLog.length - 1] || weeklyTrend[weeklyTrend.length - 1];
  const keyMetrics = [
    { icon: Activity, label: 'Steps', value: patientData.steps.toLocaleString(), detail: `${patientData.stepGoal.toLocaleString()} goal`, progress: Math.min(100, Math.round((patientData.steps / patientData.stepGoal) * 100)) },
    { icon: Moon, label: 'Sleep', value: `${patientData.sleep} hrs`, detail: 'Last night', progress: Math.min(100, Math.round((patientData.sleep / 8) * 100)), tone: 'blue' },
    { icon: HeartPulse, label: 'Heart Rate', value: `${patientData.heartRate} bpm`, detail: 'Resting', tone: 'coral', spark: true },
    { icon: Dumbbell, label: 'Exercise', value: `${patientData.exercise} min`, detail: 'Today', progress: Math.min(100, Math.round((patientData.exercise / patientData.exerciseGoal) * 100)) },
  ];

  return (
    <>
      <section className="blue-band">
        <div>
          <p>Wednesday, May 27</p>
          <h1>Good Morning, {patientData.name.split(' ')[0]}</h1>
          <span>Small steps for today, deeper trends when you need them.</span>
        </div>
        <div className="score-card circular-score" style={{ '--score': `${patientData.trendScore}%` }}>
          <small>Score</small>
          <strong>{patientData.trendScore}</strong>
          <span>trend</span>
        </div>
      </section>
      <div className="dashboard-content">
        <div className="daily-brief">
          <div>
            <span>Today&apos;s focus</span>
            <strong>{latest.sleep < 7 ? 'Protect recovery tonight' : 'Keep your routine steady'}</strong>
          </div>
          <p>{latest.steps.toLocaleString()} steps, {latest.exercise} active minutes, {latest.sleep} hours of sleep.</p>
        </div>
        <ScreenHeader title="Today" note="Synced lifestyle snapshot." />
        <div className="metric-grid figma-metrics compact-metrics">
          {keyMetrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
        </div>
        <h2 className="section-title">Today&apos;s Next Steps</h2>
        <div className="recommendation-stack">
          <InsightCard tone="red" title="Increase Your Daily Activity" text={`You're currently at ${patientData.steps.toLocaleString()} steps. Try a short walk to move closer to your daily step goal.`} />
          <InsightCard tone="red" title="Lifestyle Trend Note" text="Your sample blood pressure reading changed from the usual baseline. Keep tracking the trend and ask a professional for medical advice." />
          <InsightCard tone="yellow" title="Improve Sleep Duration" text={`You logged ${patientData.sleep} hours. Aim for a steady 7-9 hour sleep routine for recovery.`} />
        </div>
        <div className="compact-alert-strip">
          <Bell size={17} />
          <span>2 lifestyle signals to review in History</span>
        </div>
        <div className="progress-score-grid">
          <WeeklyProgress patientData={patientData} />
          <ScoreBreakdown />
        </div>
        <h2 className="section-title">7-Day Trends</h2>
        <div className="trend-grid">
          <TrendCard title="Daily Steps" data={healthLog} />
          <BarCard title="Exercise Minutes" data={healthLog} />
          <TrendCard title="Multi-Variable Trend" data={healthLog} />
        </div>
        <div className="quiet-disclaimer"><ShieldCheck size={15} /> Lifestyle insights only. This app does not diagnose or replace medical advice.</div>
      </div>
    </>
  );
}

function InsightCard({ tone, title, text }) {
  return (
    <article className={`insight-card ${tone}`}>
      <span />
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </article>
  );
}

function WeeklyProgress({ patientData }) {
  return (
    <article className="card progress-panel">
      <h3><TrendingUp size={18} /> Weekly Progress</h3>
      <ProgressRow label="Daily Steps" value={Math.min(100, Math.round((patientData.steps / patientData.stepGoal) * 100))} color="var(--blue)" />
      <ProgressRow label="Sleep Target" value={Math.min(100, Math.round((patientData.sleep / 8) * 100))} color="var(--green)" />
      <ProgressRow label="Exercise" value={Math.min(100, Math.round((patientData.exercise / patientData.exerciseGoal) * 100))} color="#8b1cf6" />
    </article>
  );
}

function ProgressRow({ label, value, color }) {
  return (
    <div className="progress-row">
      <div><span>{label}</span><strong>{value}%</strong></div>
      <div className="progress"><span style={{ width: `${value}%`, background: color }} /></div>
    </div>
  );
}

function ScoreBreakdown() {
  return (
    <article className="card score-breakdown">
      <h3><CheckCircle2 size={18} /> Score Breakdown</h3>
      <SummaryRow label="Physical Activity" value="Fair" status="Needs focus" />
      <SummaryRow label="Sleep Quality" value="Good" status="Stable" />
      <SummaryRow label="Heart Health" value="Moderate" status="Track" />
      <SummaryRow label="Body Composition" value="Good" status="Stable" />
    </article>
  );
}

function HealthSummary({ metrics, visibleMetrics, aiEnabled, aiAnswer, onAskAi }) {
  const [selectedMetricId, setSelectedMetricId] = useState(visibleMetrics[0] || defaultSummaryMetrics[0]);
  const displayedMetrics = metrics.filter((metric) => visibleMetrics.includes(metric.id));
  const selectedMetric = displayedMetrics.find((metric) => metric.id === selectedMetricId) || displayedMetrics[0] || metrics[0];

  return (
    <div className="mobile-flow">
      <div className="mobile-section-title">
        <div>
          <span>Custom summary</span>
          <h2>Health cards</h2>
        </div>
        <SlidersHorizontal size={19} />
      </div>

      <section className="ai-toggle-strip">
        <Bot size={18} />
        <div>
          <strong>{aiEnabled ? 'AI prompts are on' : 'AI prompts are off'}</strong>
          <p>Prompt chips are frontend hooks for backend AI answers.</p>
        </div>
      </section>

      <div className="summary-card-list">
        {displayedMetrics.map((metric) => (
          <SummaryMetricCard
            key={metric.id}
            metric={metric}
            selected={selectedMetric.id === metric.id}
            aiEnabled={aiEnabled}
            onSelect={() => setSelectedMetricId(metric.id)}
            onAskAi={onAskAi}
          />
        ))}
      </div>

      {selectedMetric && (
        <section className="metric-detail-panel">
          <div className="metric-detail-header">
            <div>
              <span>{selectedMetric.source}</span>
              <h3>{selectedMetric.label} detail</h3>
            </div>
            <strong>{selectedMetric.value} <small>{selectedMetric.unit}</small></strong>
          </div>
          <MiniLine data={selectedMetric.data} color={selectedMetric.color} />
          <SummaryRow label="Today" value={`${selectedMetric.value} ${selectedMetric.unit}`} status={selectedMetric.note} />
          <SummaryRow label="Change" value={selectedMetric.detail} status="Trend" />
          <SummaryRow label="Backend key" value={selectedMetric.backendPayload.metricId} status="API ready" />
        </section>
      )}

      {aiAnswer && (
        <section className="ai-answer-panel">
          <span>{aiAnswer.metric}</span>
          <h3>{aiAnswer.prompt}</h3>
          <p>{aiAnswer.text}</p>
        </section>
      )}
    </div>
  );
}

function SummaryMetricCard({ metric, selected, aiEnabled, onSelect, onAskAi }) {
  const Icon = metric.icon;
  return (
    <article className={selected ? 'summary-metric-card selected' : 'summary-metric-card'} data-metric-id={metric.id}>
      <button className="summary-metric-main" onClick={onSelect} type="button">
        <span className="summary-icon" style={{ color: metric.color }}><Icon size={20} /></span>
        <div>
          <small>{metric.note}</small>
          <strong>{metric.label}</strong>
          <p>{metric.detail}</p>
        </div>
        <div className="summary-value">
          <strong>{metric.value}</strong>
          <small>{metric.unit}</small>
        </div>
      </button>
      <ProgressLine value={metric.progress} />
      <AiPromptChips metric={metric} aiEnabled={aiEnabled} onAskAi={onAskAi} />
    </article>
  );
}

function AiPromptChips({ metric, aiEnabled, onAskAi, compact = false }) {
  return (
    <div className={compact ? 'ai-prompt-row compact' : 'ai-prompt-row'}>
      {metric.prompts.map((prompt) => (
        <button
          key={prompt.id}
          className="ai-prompt-chip"
          data-ai-prompt-id={prompt.id}
          data-metric-id={metric.id}
          disabled={!aiEnabled}
          onClick={() => onAskAi(metric, prompt)}
          type="button"
        >
          <Sparkles size={13} />
          {prompt.label}
        </button>
      ))}
    </div>
  );
}

function ReadOnlyInsight({ icon: Icon, title, value, detail, source }) {
  return (
    <article className="readonly-insight">
      <div className="insight-icon"><Icon size={19} /></div>
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
        <p>{detail}</p>
        <small>{source}</small>
      </div>
    </article>
  );
}

function SourceRow({ label, status }) {
  return (
    <div className="source-row">
      <span>{label}</span>
      <em>{status}</em>
    </div>
  );
}

function AiInsightsPage({ metrics, aiEnabled, setAiEnabled, aiAnswer, onAskAi }) {
  const priority = metrics.find((metric) => metric.id === 'sleep') || metrics[0];
  const recovery = metrics.find((metric) => metric.id === 'recovery') || metrics[0];

  return (
    <div className="mobile-flow">
      <section className="ai-insights-hero">
        <div className="ai-orb"><Bot size={24} /></div>
        <span>AI Insights</span>
        <h2>{aiEnabled ? 'Ask better questions about your habits.' : 'AI insights are off.'}</h2>
        <p>Backend teams can connect these prompts to a real AI service. Answers must stay lifestyle-focused and non-diagnostic.</p>
        <button className={aiEnabled ? 'toggle-pill on' : 'toggle-pill'} onClick={() => setAiEnabled(!aiEnabled)} type="button">
          {aiEnabled ? <Sparkles size={16} /> : <EyeOff size={16} />}
          {aiEnabled ? 'AI on by default' : 'AI off'}
        </button>
      </section>

      <section className="ai-brief-card">
        <h3>Morning brief</h3>
        <p>Your steps and sleep are steady. Focus on a short walk and a consistent bedtime before adding a harder workout.</p>
        <AiPromptChips metric={priority} aiEnabled={aiEnabled} onAskAi={onAskAi} />
      </section>

      <section className="ai-brief-card">
        <h3>Common questions</h3>
        <AiPromptChips metric={recovery} aiEnabled={aiEnabled} onAskAi={onAskAi} />
      </section>

      {aiEnabled && aiAnswer ? (
        <section className="ai-answer-panel featured">
          <span>{aiAnswer.metric}</span>
          <h3>{aiAnswer.prompt}</h3>
          <p>{aiAnswer.text}</p>
        </section>
      ) : (
        <section className="ai-empty-state">
          <MessageSquare size={20} />
          <strong>Choose a prompt to preview the answer area.</strong>
          <p>The UI is ready for a backend endpoint like <code>/api/ai/insights</code>.</p>
        </section>
      )}
    </div>
  );
}

function PartnerPage({ patientData, healthLog, goals, setGoals }) {
  const completedWorkouts = healthLog.filter((day) => day.exercise >= 45).length;
  const recoveryReady = patientData.sleep >= 7 && patientData.heartRate <= 74;

  return (
    <div className="mobile-flow">
      <section className="partner-hero">
        <div>
          <span>Gym Partner</span>
          <h2>Share support, not pressure.</h2>
          <p>Useful check-ins for a trainer or gym partner while the patient stays in control.</p>
        </div>
        <Handshake size={28} />
      </section>

      <div className="partner-grid">
        <article className="partner-mini-card">
          <strong>{completedWorkouts}/{healthLog.length}</strong>
          <span>active days</span>
        </article>
        <article className="partner-mini-card">
          <strong>{patientData.sleep} hrs</strong>
          <span>sleep last night</span>
        </article>
      </div>

      <section className="support-card partner-card">
        <h3><ClipboardList size={18} /> Today&apos;s partner plan</h3>
        <div className="workout-list">
          <div><strong>{recoveryReady ? 'Strength circuit' : 'Recovery walk'}</strong><span>{recoveryReady ? '30 min' : '20 min'}</span></div>
          <div><strong>Mobility reset</strong><span>8 min</span></div>
          <div><strong>Check-in question</strong><span>Energy level</span></div>
        </div>
      </section>

      <section className="support-card partner-card">
        <h3><MessageCircle size={18} /> Encouragement prompts</h3>
        {['Nice work keeping the week steady.', 'Want to do a short walk together?', 'Let’s keep recovery easy today.'].map((message) => (
          <button className="message-template" key={message} type="button">{message}</button>
        ))}
      </section>

      <section className="support-card partner-card">
        <h3><ShieldCheck size={18} /> Sharing controls</h3>
        <SourceRow label="Share steps and workouts" status="On" />
        <SourceRow label="Share sleep summary" status="Optional" />
        <SourceRow label="Share clinician data" status="Off" />
        <p>The partner view focuses on motivation and consistency, not diagnosis.</p>
      </section>

      <NextGoalsSection goals={goals} setGoals={setGoals} embedded />
    </div>
  );
}

function PatientSettingsPage({ metrics, visibleMetrics, setVisibleMetrics, aiEnabled, setAiEnabled, theme, setTheme, setIsSignedIn, installPrompt, installApp }) {
  const toggleMetric = (metricId) => {
    setVisibleMetrics((items) => {
      if (items.includes(metricId)) {
        return items.length > 1 ? items.filter((item) => item !== metricId) : items;
      }
      return [...items, metricId];
    });
  };

  return (
    <div className="mobile-flow">
      <div className="mobile-section-title">
        <div>
          <span>Personalize</span>
          <h2>Settings</h2>
        </div>
      </div>

      <section className="settings-panel">
        <h3><SlidersHorizontal size={18} /> Summary cards</h3>
        {metrics.map((metric) => (
          <label className="setting-row" key={metric.id}>
            <span>{metric.label}</span>
            <input type="checkbox" checked={visibleMetrics.includes(metric.id)} onChange={() => toggleMetric(metric.id)} />
          </label>
        ))}
      </section>

      <section className="settings-panel">
        <h3><Bot size={18} /> AI preferences</h3>
        <label className="setting-row">
          <span>AI insights default on</span>
          <input type="checkbox" checked={aiEnabled} onChange={(event) => setAiEnabled(event.target.checked)} />
        </label>
        <p>Users can opt out. Backend AI should only return lifestyle explanations and suggestions.</p>
      </section>

      <section className="settings-panel">
        <h3><SettingsIcon size={18} /> App controls</h3>
        <button className="settings-action" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} type="button">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          Switch to {theme === 'dark' ? 'light' : 'dark'} mode
        </button>
        {installPrompt && <button className="settings-action" onClick={installApp} type="button"><Download size={16} /> Install app</button>}
        <button className="settings-action" onClick={() => setIsSignedIn(false)} type="button"><LogOut size={16} /> Switch role</button>
      </section>
    </div>
  );
}

function TrendsPage({ healthLog }) {
  return (
    <>
      <ScreenHeader title="Trends" note="Compare habits across the week." />
      <TrendCard title="Steps and Sleep" data={healthLog} />
      <BarCard title="Weekly Exercise Trend" data={healthLog} />
      <div className="info-panel">
        <h3>Trend note</h3>
        <p>Exercise was strongest on Monday. Sleep stayed close to the target range later in the week.</p>
      </div>
    </>
  );
}

function PlanPage({ goals, setGoals }) {
  const [completed, setCompleted] = usePersistentState('completed-recommendations', []);
  const [planMessage, setPlanMessage] = useState('');
  const smartSuggestions = [
    'Turn the 10-minute walk recommendation into a weekday after-lunch goal.',
    'Set a 7-hour sleep goal for three nights before adding harder workout goals.',
    'Pair one stretching session with your next strength workout.',
  ];

  const toggle = (item) => {
    setCompleted((items) => items.includes(item) ? items.filter((current) => current !== item) : [...items, item]);
  };
  const addSuggestedGoal = (suggestion) => {
    setGoals((items) => {
      const exists = items.some((goal) => goal.title.trim().toLowerCase() === suggestion.trim().toLowerCase());
      if (exists) {
        setPlanMessage('That goal is already in your list.');
        return items;
      }
      setPlanMessage('Added to your goals.');
      return [...items, { id: Date.now() + suggestion.length, title: suggestion, status: 'Planned' }];
    });
  };

  return (
    <>
      <ScreenHeader title="Plan" note="Recommendations and goals in one simple place." />
      <section className="smart-plan">
        <div>
          <h3><Leaf size={18} /> Smart goal ideas</h3>
          <p>Rule-based suggestions turn trend notes into specific goals. A future AI layer can make these more personal.</p>
        </div>
        <span>AI-ready</span>
      </section>
      <div className="smart-suggestion-list">
        {smartSuggestions.map((suggestion) => (
          <button key={suggestion} className="rec-item compact" onClick={() => addSuggestedGoal(suggestion)}>
            <Target size={17} />
            <span>{suggestion}</span>
            <em>Add</em>
          </button>
        ))}
      </div>
      {planMessage && <p className="form-feedback" role="status">{planMessage}</p>}
      <h3 className="mini-heading">Recommendations</h3>
      {recommendations.map((item) => (
        <RecommendationItem
          key={item}
          text={item}
          complete={completed.includes(item)}
          onToggle={() => toggle(item)}
        />
      ))}
      <NextGoalsSection goals={goals} setGoals={setGoals} embedded />
      <div className="quiet-disclaimer"><ShieldCheck size={15} /> Recommendations are lifestyle support only.</div>
    </>
  );
}

function HistoryPage() {
  const [reviewed, setReviewed] = usePersistentState('reviewed-alerts', []);

  return (
    <>
      <ScreenHeader title="History" note="Recent lifestyle signals and reviewed updates." />
      {alertSignals.map((alert) => (
        <AlertCard
          key={alert.title}
          {...alert}
          reviewed={reviewed.includes(alert.title)}
          onReview={() => setReviewed((items) => items.includes(alert.title) ? items : [...items, alert.title])}
        />
      ))}
    </>
  );
}

function NextGoalsSection({ goals, setGoals, embedded = false }) {
  const [newGoal, setNewGoal] = useState('');
  const [goalMessage, setGoalMessage] = useState('');
  const addGoal = (event) => {
    event.preventDefault();
    const title = newGoal.trim();
    if (!title) return;
    setGoals((items) => {
      const exists = items.some((goal) => goal.title.trim().toLowerCase() === title.toLowerCase());
      if (exists) {
        setGoalMessage('That goal is already in your list.');
        return items;
      }
      setGoalMessage('Goal added.');
      setNewGoal('');
      return [...items, { id: Date.now(), title, status: 'Planned' }];
    });
  };

  const toggleGoal = (id) => {
    setGoals((items) => items.map((goal) => goal.id === id ? { ...goal, status: goal.status === 'Complete' ? 'In progress' : 'Complete' } : goal));
  };

  const deleteGoal = (id) => {
    setGoals((items) => items.filter((goal) => goal.id !== id));
  };

  return (
    <>
      {!embedded && <ScreenHeader title="Next Goals" note="Create and manage personal health goals." />}
      {embedded && <h3 className="mini-heading">Goals</h3>}
      <form className="goal-form" onSubmit={addGoal}>
        <input value={newGoal} onChange={(event) => setNewGoal(event.target.value)} placeholder="Add a new goal..." />
        <button className="secondary-btn"><Plus size={16} /> Add</button>
      </form>
      {goalMessage && <p className="form-feedback" role="status">{goalMessage}</p>}
      <div className="goal-list">
        {goals.map((goal) => (
          <div key={goal.id} className={goal.status === 'Complete' ? 'complete-goal' : ''}>
            <button onClick={() => toggleGoal(goal.id)} aria-label={`Toggle ${goal.title}`}><CheckCircle2 size={18} /></button>
            <span>{goal.title}</span>
            <em>{goal.status}</em>
            <button onClick={() => deleteGoal(goal.id)} aria-label={`Delete ${goal.title}`}><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </>
  );
}

function TrainerView({ healthLog, patient: patientData }) {
  const [note, setNote] = usePersistentState('trainer-note', 'You are building a great routine. Consistency is the key this week.');
  const [draft, setDraft] = useState(note);

  return (
    <section className="trainer-shell">
      <div className="trainer-header">
        <Menu size={20} />
        <div className="avatar">AJ</div>
        <div><h2>Alex Johnson</h2><p>Client progress at a glance</p></div>
      </div>
      <SupportCard icon={CalendarDays} title="Activity Consistency">
        <div className="big-stat">{healthLog.filter((d) => d.steps >= 7500).length} <span>of {healthLog.length} days</span></div>
        <WeekDots />
      </SupportCard>
      <SupportCard icon={Target} title="Workout Goal Progress">
        <ProgressLine value={75} />
        <p><strong>{patientData.exercise} / 60 min</strong> completed today.</p>
      </SupportCard>
      <SupportCard icon={Dumbbell} title="Workout Focus">
        <div className="workout-list">
          <div><strong>Warm-up walk</strong><span>10 min</span></div>
          <div><strong>Strength circuit</strong><span>3 rounds</span></div>
          <div><strong>Stretch and recovery</strong><span>8 min</span></div>
        </div>
      </SupportCard>
      <SupportCard icon={Gauge} title="Readiness Check">
        <div className="partner-grid embedded">
          <article className="partner-mini-card"><strong>{patientData.trendScore}</strong><span>trend score</span></article>
          <article className="partner-mini-card"><strong>{patientData.recovery}</strong><span>recovery</span></article>
        </div>
        <p>Use this to choose workout intensity. It is not a medical risk score.</p>
      </SupportCard>
      <SupportCard icon={Moon} title="Sleep and Recovery">
        <div className="split-row"><strong>{patientData.sleep} hrs</strong><span className="status good">Good recovery</span></div>
        <MiniLine data={healthLog.map((d) => d.sleep)} color="var(--blue)" />
      </SupportCard>
      <SupportCard icon={BarChart3} title="Weekly Exercise Trend">
        <BarChart data={healthLog.map((d) => d.exercise)} labels={healthLog.map((d) => d.day)} />
      </SupportCard>
      <SupportCard icon={ClipboardList} title="Shared Goals">
        <div className="workout-list">
          <div><strong>Walk 10,000 steps</strong><span>5 days</span></div>
          <div><strong>Complete workouts</strong><span>3 this week</span></div>
          <div><strong>Recovery check-in</strong><span>Friday</span></div>
        </div>
      </SupportCard>
      <SupportCard icon={MessageSquare} title="Quick Encouragement">
        {['Keep it steady today.', 'Short workout still counts.', 'Want a walking check-in later?'].map((message) => (
          <button className="message-template" key={message} type="button">{message}</button>
        ))}
      </SupportCard>
      <SupportCard icon={ShieldCheck} title="Support Boundaries">
        <SourceRow label="Activity and workout summary" status="Visible" />
        <SourceRow label="Sleep recovery summary" status="Limited" />
        <SourceRow label="Clinician notes" status="Hidden" />
        <p>Trainer support is for encouragement and habit consistency only.</p>
      </SupportCard>
      <SupportCard icon={Leaf} title="Encouragement Notes">
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="Encouragement note" />
        <button className="secondary-btn" onClick={() => setNote(draft)}>Save Note</button>
        <p><strong>Saved note:</strong> {note}</p>
      </SupportCard>
    </section>
  );
}

function ProviderView({ healthLog, patientRecords, setPatientRecords }) {
  const directory = useMemo(() => patientDirectory(patientRecords), [patientRecords]);
  const [selectedPatientName, setSelectedPatientName] = useState(directory[0]?.name || patients[0].name);
  const [query, setQuery] = useState('');
  const [activeProviderTab, setActiveProviderTab] = useState('Overview');
  const selectedPatient = directory.find((p) => p.name === selectedPatientName) || directory[0];
  const filteredPatients = directory.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()) || p.risk.toLowerCase().includes(query.toLowerCase()));
  const highRiskCount = directory.filter((p) => p.risk === 'High').length;
  const mediumRiskCount = directory.filter((p) => p.risk === 'Medium').length;
  const lowActivityCount = patientRecords.filter((record) => record.wearable.steps < 8000).length;
  const averageHealthScore = Math.round(patientRecords.reduce((sum, record) => sum + enrichPatientRecord(record).kpis.healthScore, 0) / patientRecords.length);
  const avgSteps = Math.round(patientRecords.reduce((sum, record) => sum + Number(record.wearable.steps), 0) / patientRecords.length);
  const avgSleep = (patientRecords.reduce((sum, record) => sum + Number(record.wearable.sleep), 0) / patientRecords.length).toFixed(1);
  const avgHr = Math.round(patientRecords.reduce((sum, record) => sum + Number(record.clinical.restingHr), 0) / patientRecords.length);
  const avgExercise = Math.round(patientRecords.reduce((sum, record) => sum + Number(record.wearable.activeMinutes), 0) / patientRecords.length);
  const exportReport = () => {
    const lines = [
      'WellPath Health Clinician Trend Review',
      `Generated: ${new Date().toLocaleString()}`,
      `Selected patient: ${selectedPatient.name}`,
      `Risk level: ${selectedPatient.risk}`,
      `Focus: ${selectedPatient.focus}`,
      `Goal adherence: ${selectedPatient.adherence}`,
      selectedPatient.sourceRecord ? `Health score: ${selectedPatient.sourceRecord.kpis.healthScore}` : 'Health score: sample dashboard patient',
      selectedPatient.sourceRecord ? `Generated review signals: ${selectedPatient.sourceRecord.alerts.join(', ')}` : 'Generated review signals: sample dashboard patient',
      'Clinical note: Lifestyle trend review only. Not a diagnosis or automated assessment.',
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'lifestyle-analytics-report.txt';
    link.click();
    URL.revokeObjectURL(url);
  };
  const providerTabs = ['Overview', 'Patients', 'Trends', 'Signals', 'Plans', 'Reports'];
  const showAll = activeProviderTab === 'Overview';
  const showPatients = showAll || activeProviderTab === 'Patients';
  const showTrends = showAll || activeProviderTab === 'Trends';
  const showSignals = showAll || activeProviderTab === 'Signals';
  const showPlans = showAll || activeProviderTab === 'Plans';
  const showReports = showAll || activeProviderTab === 'Reports';
  const providerGridClass = [
    'provider-grid',
    activeProviderTab === 'Patients' ? 'patients-grid' : '',
    activeProviderTab === 'Trends' ? 'trends-grid' : '',
    activeProviderTab === 'Signals' ? 'signals-grid' : '',
    activeProviderTab === 'Plans' ? 'plans-grid' : '',
    activeProviderTab === 'Reports' ? 'reports-grid' : '',
  ].filter(Boolean).join(' ');

  return (
    <section className="provider-shell">
      <aside className="provider-nav">
        <div className="provider-logo"><Stethoscope size={23} /> WellPath</div>
        {providerTabs.map((item) => (
          <button key={item} className={activeProviderTab === item ? 'active' : ''} onClick={() => setActiveProviderTab(item)}>
            {item}
          </button>
        ))}
      </aside>
      <section className="provider-main">
        <div className="provider-top">
          <div><h1>{activeProviderTab === 'Overview' ? 'Clinician Trend Review' : activeProviderTab}</h1><p>Review lifestyle patterns between visits. The system supports conversations; it does not assess or diagnose patients.</p></div>
          <div className="provider-actions">
            <button>All Patients</button>
            <button>May 8 - May 14</button>
            <button onClick={exportReport}><Download size={16} /> Export</button>
          </div>
        </div>
        <div className="schema-banner">
          <ShieldCheck size={18} />
          <span>Integrated trend view: patient profile, clinical metrics, wearable metrics, lifestyle metrics, KPI summaries, and review signals.</span>
        </div>
        <div className="provider-tab-summary">
          <span>{activeProviderTab}</span>
          <strong>{showAll ? 'Full workspace overview' : `${activeProviderTab} workspace`}</strong>
          <p>{activeProviderTab === 'Patients' ? 'Add and review patient records.' : activeProviderTab === 'Trends' ? 'Focus on longer-term lifestyle movement.' : activeProviderTab === 'Signals' ? 'Review non-diagnostic lifestyle signals.' : activeProviderTab === 'Plans' ? 'Check goals and recommendations.' : activeProviderTab === 'Reports' ? 'Prepare a simple exportable trend report.' : 'Use the sidebar to focus the dashboard.'}</p>
        </div>
        {(showAll || activeProviderTab === 'Trends') && (
          <div className="provider-metrics">
            <MetricCard icon={Activity} label="Avg Steps" value={avgSteps.toLocaleString()} detail="From intake records" trendUp />
            <MetricCard icon={Moon} label="Avg Sleep" value={`${avgSleep} hrs`} detail="Wearable + lifestyle" tone="blue" trendUp />
            <MetricCard icon={HeartPulse} label="Avg Resting HR" value={`${avgHr} bpm`} detail="Clinical metric" tone="coral" trendUp />
            <MetricCard icon={Dumbbell} label="Avg Exercise" value={`${avgExercise} min`} detail="Workout activity" trendUp />
          </div>
        )}
        {activeProviderTab === 'Patients' && (
          <div className="provider-metrics compact-metrics">
            <MetricCard icon={Users} label="Visible Records" value={filteredPatients.length} detail="Matches current search" trendUp />
            <MetricCard icon={ShieldCheck} label="Consent Ready" value={`${patientRecords.filter((record) => record.consent).length}/${patientRecords.length}`} detail="Shared records" tone="blue" trendUp />
            <MetricCard icon={CalendarDays} label="Next Review" value={selectedPatient.nextCheck} detail={selectedPatient.name} tone="coral" />
          </div>
        )}
        {activeProviderTab === 'Signals' && (
          <div className="provider-metrics compact-metrics">
            <MetricCard icon={ShieldAlert} label="High Priority" value={highRiskCount} detail="Needs review" tone="coral" />
            <MetricCard icon={Activity} label="Low Activity" value={lowActivityCount} detail="Below step target" />
            <MetricCard icon={Moon} label="Sleep Watch" value={mediumRiskCount} detail="Recovery pattern" tone="blue" />
          </div>
        )}
        {activeProviderTab === 'Plans' && (
          <div className="provider-metrics compact-metrics">
            <MetricCard icon={Target} label="Plan Focus" value="3 goals" detail="Activity, sleep, workouts" trendUp />
            <MetricCard icon={CheckCircle2} label="Adherence" value={selectedPatient.adherence} detail={selectedPatient.name} tone="blue" />
            <MetricCard icon={MessageCircle} label="Coaching Note" value="Ready" detail="Simple lifestyle wording" />
          </div>
        )}
        {activeProviderTab === 'Reports' && (
          <div className="provider-metrics compact-metrics">
            <MetricCard icon={Download} label="Export Type" value="TXT" detail="Simple review file" />
            <MetricCard icon={BarChart3} label="Included KPIs" value="4" detail="Steps, sleep, HR, activity" tone="blue" />
            <MetricCard icon={ShieldCheck} label="Safety Label" value="Non-diagnostic" detail="For trend review only" tone="coral" />
          </div>
        )}
        <div className={providerGridClass}>
          {activeProviderTab === 'Patients' && (
            <Panel title="Patient Workspace">
              <SummaryRow label="Selected patient" value={selectedPatient.name} status="Active" />
              <SummaryRow label="Visible records" value={filteredPatients.length} status="List" />
              <SummaryRow label="Review focus" value={selectedPatient.focus} status="Focus" />
              <p className="panel-note">Use this tab for patient lookup, intake records, and profile details before reviewing trends.</p>
            </Panel>
          )}
          {showPatients && (
            <Panel title="Patient Intake Form" wide>
              <PatientIntakeForm onCreate={(record) => setPatientRecords((items) => [record, ...items])} />
            </Panel>
          )}
          {showReports && (
            <Panel title="KPI Engine">
              <SummaryRow label="Avg health score" value={averageHealthScore} status="patient_kpi" />
              <SummaryRow label="Trend flag logic" value={`${highRiskCount + mediumRiskCount} flagged`} status="clinician_kpi" />
              <SummaryRow label="Trainer consistency" value="Auto" status="trainer_kpi" />
              <p className="panel-note">Rules combine steps, sleep, stress, sedentary hours, resting heart rate, and BP indicators. Outputs are lifestyle trend summaries only.</p>
            </Panel>
          )}
          {showSignals && (
            <Panel title="Review Signals">
              <RiskRow label="High review priority" count={`${highRiskCount} patients`} severity="high" />
              <RiskRow label="Medium review priority" count={`${mediumRiskCount} patients`} severity="medium" />
              <RiskRow label="Low activity" count={`${lowActivityCount} records`} severity="low" />
            </Panel>
          )}
          {activeProviderTab === 'Signals' && (
            <Panel title="Signal Review Queue">
              <RecommendationItem text="Review James Kim resting heart rate trend" compact />
              <RecommendationItem text="Check Maria Garcia sleep consistency" compact />
              <RecommendationItem text="Compare low activity records with weekly workout notes" compact />
              <p className="panel-note">Signals are conversation starters for lifestyle review, not medical alerts or diagnosis.</p>
            </Panel>
          )}
          {showPlans && (
            <Panel title="Recommendation Summary">
              <Donut />
            </Panel>
          )}
          {showPlans && (
            <Panel title="Next Goals Focus">
              {['Improve daily activity', 'Better sleep consistency', 'Increase workout duration'].map((goal) => (
                <div className="goal-row" key={goal}><CheckCircle2 size={17} /> {goal}</div>
              ))}
            </Panel>
          )}
          {showTrends && (
            <Panel title="Long-Term Progress" wide>
              <MultiLineChart data={longTerm} />
            </Panel>
          )}
          {activeProviderTab === 'Trends' && (
            <Panel title="Trend Notes">
              <SummaryRow label="Activity movement" value="Improving" status="Trend" />
              <SummaryRow label="Sleep pattern" value="Needs consistency" status="Review" />
              <SummaryRow label="Exercise minutes" value={`${avgExercise} min avg`} status="KPI" />
              <p className="panel-note">This tab keeps the clinician focused on movement over time instead of intake forms or report actions.</p>
            </Panel>
          )}
          {showPatients && (
            <Panel title="Patient List">
              <label className="search"><Search size={16} /><input placeholder="Search patients or risk..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
              {filteredPatients.map((p) => (
                <PatientRow
                  key={p.name}
                  patient={p}
                  selected={selectedPatient.name === p.name}
                  onSelect={() => setSelectedPatientName(p.name)}
                />
              ))}
              {!filteredPatients.length && <p className="empty-state">No matching patients found.</p>}
            </Panel>
          )}
          {(showPatients || showReports) && (
            <Panel title="Selected Patient Profile">
              <div className="profile-card">
                <div className="avatar">{selectedPatient.name.split(' ').map((part) => part[0]).join('')}</div>
                <div>
                  <h4>{selectedPatient.name}</h4>
                  <p>Primary focus: {selectedPatient.focus}</p>
                </div>
              </div>
              <SummaryRow label="Risk level" value={selectedPatient.risk} status="Review" />
              <SummaryRow label="Goal adherence" value={selectedPatient.adherence} status="Trend" />
              <SummaryRow label="Next check-in" value={selectedPatient.nextCheck} status="Scheduled" />
              {selectedPatient.sourceRecord && (
                <>
                  <SummaryRow label="Consent" value={selectedPatient.sourceRecord.consent ? 'Granted' : 'Pending'} status="patient_profile" />
                  <SummaryRow label="Recovery score" value={selectedPatient.sourceRecord.kpis.recoveryScore} status="trainer_kpi" />
                </>
              )}
            </Panel>
          )}
          {showSignals && (
            <Panel title="Recent Review Signals">
              <AlertCard title="Maria Garcia - low sleep for 3 days" severity="Medium" detail="May 14, 8:15 AM" compact />
              <AlertCard title="James Kim - high resting HR trend" severity="High" detail="May 14, 7:50 AM" compact />
            </Panel>
          )}
          {showPlans && (
            <Panel title="Recent Recommendations">
              <RecommendationItem text="Increase daily steps by 1,500" compact />
              <RecommendationItem text="Add 10-minute evening walk" compact />
            </Panel>
          )}
          {activeProviderTab === 'Reports' && (
            <Panel title="Report Actions" wide>
              <p className="panel-note">Export a simple lifestyle trend review for the selected patient. The report is informational and non-diagnostic.</p>
              <button className="secondary-btn report-export-btn" onClick={exportReport}><Download size={16} /> Export selected patient report</button>
            </Panel>
          )}
          {activeProviderTab === 'Reports' && (
            <Panel title="Report Preview">
              <SummaryRow label="Patient" value={selectedPatient.name} status="Selected" />
              <SummaryRow label="Included" value="KPIs + review signals" status="Report" />
              <SummaryRow label="Use" value="Lifestyle discussion" status="Safe" />
              <p className="panel-note">The export avoids diagnostic language and keeps the report focused on trends, goals, and next check-in.</p>
            </Panel>
          )}
        </div>
      </section>
    </section>
  );
}

function PatientIntakeForm({ onCreate }) {
  const [form, setForm] = useState({
    name: '',
    dob: '',
    gender: 'Prefer not to say',
    email: '',
    clinician: 'Dr. Rivera',
    trainer: 'Jordan Lee',
    systolic: 128,
    diastolic: 82,
    bmi: 24.8,
    restingHr: 72,
    notes: '',
    medications: '',
    steps: 7600,
    activeMinutes: 35,
    sleep: 6.8,
    calories: 2100,
    workouts: 3,
    exerciseFrequency: 3,
    dietaryScore: 7,
    stressLevel: 5,
    sedentaryHours: 7,
    consent: true,
  });
  const [savedRecord, setSavedRecord] = useState(null);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const submit = (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.dob) return;

    const record = {
      id: Date.now(),
      name: form.name.trim(),
      dob: form.dob,
      gender: form.gender,
      email: form.email.trim(),
      clinician: form.clinician,
      trainer: form.trainer,
      consent: form.consent,
      clinical: {
        systolic: Number(form.systolic),
        diastolic: Number(form.diastolic),
        bmi: Number(form.bmi),
        restingHr: Number(form.restingHr),
        notes: form.notes.trim() || 'No notes entered',
        medications: form.medications.trim() || 'None listed',
      },
      wearable: {
        steps: Number(form.steps),
        activeMinutes: Number(form.activeMinutes),
        sleep: Number(form.sleep),
        calories: Number(form.calories),
        workouts: Number(form.workouts),
      },
      lifestyle: {
        exerciseFrequency: Number(form.exerciseFrequency),
        dietaryScore: Number(form.dietaryScore),
        stressLevel: Number(form.stressLevel),
        sedentaryHours: Number(form.sedentaryHours),
      },
      createdAt: new Date().toISOString().slice(0, 10),
    };

    const enriched = enrichPatientRecord(record);
    onCreate(enriched);
    setSavedRecord(enriched);
    setForm((current) => ({ ...current, name: '', dob: '', email: '', notes: '', medications: '' }));
  };

  return (
    <form className="intake-form" onSubmit={submit}>
      <div className="intake-grid">
        <FieldText label="Patient name" value={form.name} onChange={(value) => update('name', value)} required />
        <FieldText label="Date of birth" type="date" value={form.dob} onChange={(value) => update('dob', value)} required />
        <label>
          <span>Gender</span>
          <select value={form.gender} onChange={(event) => update('gender', event.target.value)}>
            <option>Prefer not to say</option>
            <option>Female</option>
            <option>Male</option>
            <option>Non-binary</option>
          </select>
        </label>
        <FieldText label="Email" type="email" value={form.email} onChange={(value) => update('email', value)} required />
        <FieldText label="Clinician" value={form.clinician} onChange={(value) => update('clinician', value)} />
        <FieldText label="Trainer / partner" value={form.trainer} onChange={(value) => update('trainer', value)} />
      </div>
      <div className="intake-columns">
        <fieldset>
          <legend>Clinical metrics</legend>
          <FieldNumber label="Systolic BP" value={form.systolic} onChange={(value) => update('systolic', value)} />
          <FieldNumber label="Diastolic BP" value={form.diastolic} onChange={(value) => update('diastolic', value)} />
          <FieldNumber label="BMI" step="0.1" value={form.bmi} onChange={(value) => update('bmi', value)} />
          <FieldNumber label="Resting HR" value={form.restingHr} onChange={(value) => update('restingHr', value)} />
        </fieldset>
        <fieldset>
          <legend>Wearable data</legend>
          <FieldNumber label="Daily steps" value={form.steps} onChange={(value) => update('steps', value)} />
          <FieldNumber label="Active minutes" value={form.activeMinutes} onChange={(value) => update('activeMinutes', value)} />
          <FieldNumber label="Sleep hours" step="0.1" value={form.sleep} onChange={(value) => update('sleep', value)} />
          <FieldNumber label="Workouts/week" value={form.workouts} onChange={(value) => update('workouts', value)} />
        </fieldset>
        <fieldset>
          <legend>Lifestyle inputs</legend>
          <FieldNumber label="Exercise days/week" value={form.exerciseFrequency} onChange={(value) => update('exerciseFrequency', value)} />
          <FieldNumber label="Diet score 1-10" value={form.dietaryScore} onChange={(value) => update('dietaryScore', value)} />
          <FieldNumber label="Stress level 1-10" value={form.stressLevel} onChange={(value) => update('stressLevel', value)} />
          <FieldNumber label="Sedentary hrs/day" value={form.sedentaryHours} onChange={(value) => update('sedentaryHours', value)} />
        </fieldset>
      </div>
      <div className="intake-grid">
        <label className="notes-field">
          <span>Clinical notes</span>
          <textarea value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Optional context only. This app does not create diagnoses." />
        </label>
        <label className="notes-field">
          <span>Medication notes</span>
          <textarea value={form.medications} onChange={(event) => update('medications', event.target.value)} placeholder="Optional medication notes for the simulated profile." />
        </label>
      </div>
      <label className="consent-check">
        <input type="checkbox" checked={form.consent} onChange={(event) => update('consent', event.target.checked)} />
        Consent to share simulated data with assigned care partners
      </label>
      <button className="primary-btn" type="submit"><Plus size={16} /> Create Patient Record</button>
      {savedRecord && (
        <div className="intake-result">
          <strong>{savedRecord.name} added</strong>
          <span>Mapped into users, patient_profile, clinical_metrics, wearable_metrics, lifestyle_metrics, KPI tables, and review signals.</span>
          <em>Health score {savedRecord.kpis.healthScore} · Risk score {savedRecord.kpis.riskScore}</em>
        </div>
      )}
    </form>
  );
}

function FieldText({ label, value, onChange, type = 'text', required }) {
  return (
    <label>
      <span>{label}</span>
      <input type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function FieldNumber({ label, value, onChange, step = '1' }) {
  return (
    <label>
      <span>{label}</span>
      <input type="number" step={step} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ScreenHeader({ title, note }) {
  return (
    <div className="screen-header">
      <div><h2>{title}</h2><p>{note}</p></div>
      <Bell size={20} />
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail, progress, tone = 'teal', spark, trendUp }) {
  return (
    <article className={`metric-card ${tone}`}>
      <div className="metric-label"><Icon size={18} /> {label}</div>
      <strong>{value}</strong>
      <span>{trendUp && <TrendingUp size={14} />} {detail}</span>
      {progress && <ProgressLine value={progress} />}
      {spark && <MiniLine data={weeklyTrend.map((d) => d.hr)} color="var(--coral)" />}
    </article>
  );
}

function ProgressLine({ value }) {
  return <div className="progress"><span style={{ width: `${value}%` }} /></div>;
}

function TrendCard({ title, data = weeklyTrend }) {
  return (
    <article className="card trend-card">
      <h3>{title}</h3>
      <MultiLineChart data={data} compact />
    </article>
  );
}

function BarCard({ title, data = weeklyTrend }) {
  return (
    <article className="card">
      <h3>{title}</h3>
      <BarChart data={data.map((d) => d.exercise)} labels={data.map((d) => d.day)} />
    </article>
  );
}

function RecommendationCard() {
  return (
    <article className="recommendation-card">
      <Leaf size={20} />
      <div>
        <h3>Today's Recommendation</h3>
        <p>Great job staying active. Try a 10-minute walk after meals to keep momentum going.</p>
      </div>
    </article>
  );
}

function RecommendationItem({ text, compact, complete, onToggle }) {
  const content = (
    <>
      <CheckCircle2 size={18} />
      <span>{text}</span>
      {complete && <em>Done</em>}
    </>
  );

  if (onToggle) {
    return (
      <button className={complete ? 'rec-item complete' : 'rec-item'} onClick={onToggle}>
        {content}
      </button>
    );
  }

  return (
    <div className={compact ? 'rec-item compact' : 'rec-item'}>
      {content}
    </div>
  );
}

function SummaryRow({ label, value, status }) {
  return (
    <div className="summary-row">
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{status}</em>
    </div>
  );
}

function AlertCard({ title, severity, detail, compact, reviewed, onReview }) {
  return (
    <article className={compact ? 'alert-card compact' : 'alert-card'}>
      <AlertTriangle size={18} />
      <div><h3>{title}</h3><p>{detail}</p></div>
      {reviewed ? <span className="severity info">Reviewed</span> : <span className={`severity ${severity.toLowerCase()}`}>{severity}</span>}
      {onReview && !reviewed && <button className="review-btn" onClick={onReview}>Review</button>}
    </article>
  );
}

function SupportCard({ icon: Icon, title, children }) {
  return (
    <article className="support-card">
      <h3><Icon size={18} /> {title}</h3>
      {children}
    </article>
  );
}

function Panel({ title, children, wide }) {
  return (
    <article className={wide ? 'panel wide' : 'panel'}>
      <h3>{title}</h3>
      {children}
    </article>
  );
}

function WeekDots() {
  return (
    <div className="week-dots">
      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
        <span key={`${day}-${index}`} className={index < 5 ? 'done' : ''}>{day}</span>
      ))}
    </div>
  );
}

function MiniLine({ data, color }) {
  const points = data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - ((v - Math.min(...data)) / (Math.max(...data) - Math.min(...data) || 1)) * 70 - 15}`).join(' ');
  return (
    <svg className="mini-line" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MultiLineChart({ data, compact }) {
  const width = 360;
  const height = compact ? 170 : 230;
  const line = (key, min, max) => data.map((d, i) => {
    const x = 28 + (i / (data.length - 1)) * (width - 52);
    const y = height - 34 - ((d[key] - min) / (max - min || 1)) * (height - 72);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Line chart showing lifestyle trends">
      {[0, 1, 2].map((i) => <line key={i} x1="28" x2={width - 24} y1={42 + i * 45} y2={42 + i * 45} />)}
      <polyline points={line('steps', 6000, 10000)} className="steps-line" />
      <polyline points={line('sleep', 5, 8)} className="sleep-line" />
      <polyline points={line('hr', 68, 78)} className="hr-line" />
      {data.map((d, i) => <text key={d.day || d.label} x={28 + (i / (data.length - 1)) * (width - 52)} y={height - 10}>{d.day || d.label}</text>)}
      <g className="legend">
        <text x="28" y="20">Steps</text><text x="88" y="20">Sleep</text><text x="148" y="20">Heart rate</text>
      </g>
    </svg>
  );
}

function BarChart({ data, labels }) {
  const max = Math.max(...data);
  return (
    <div className="bars">
      {data.map((value, i) => (
        <div key={`${labels[i]}-${value}`} className="bar-wrap">
          <span className="bar" style={{ height: `${(value / max) * 100}%` }} />
          <small>{labels[i]}</small>
        </div>
      ))}
    </div>
  );
}

function Donut() {
  return (
    <div className="donut-wrap">
      <div className="donut"><strong>28</strong><span>Total</span></div>
      <div className="donut-list">
        <p><span className="dot green" /> Completed 12</p>
        <p><span className="dot blue" /> In progress 10</p>
        <p><span className="dot gray" /> Not started 6</p>
      </div>
    </div>
  );
}

function RiskRow({ label, count, severity }) {
  return (
    <div className="risk-row">
      <span className={severity} />
      <p>{label}</p>
      <strong>{count}</strong>
    </div>
  );
}

function PatientRow({ patient: p, selected, onSelect }) {
  return (
    <button className={selected ? 'patient-row selected' : 'patient-row'} onClick={onSelect}>
      <div className="avatar small">{p.name.split(' ').map((part) => part[0]).join('')}</div>
      <div><strong>{p.name}</strong><span>Last synced: {p.lastSync}</span></div>
      <em className={`risk ${p.risk.toLowerCase()}`}>Risk: {p.risk}</em>
    </button>
  );
}

createRoot(document.getElementById('root')).render(<App />);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // The app still works if service worker registration is blocked.
    });
  });
}
