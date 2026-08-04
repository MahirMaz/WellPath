const scoreStatus = (score) => {
  if (score == null) return 'Missing data';
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Moderate';
  return 'Needs Attention';
};

const clampScore = (value) => Math.max(0, Math.min(100, Math.round(value)));

const isNumber = (value) => Number.isFinite(Number(value));

const average = (values) => {
  const valid = values.map(Number).filter(Number.isFinite);
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
};

const consistencyScore = (values, targetRange) => {
  const valid = values.map(Number).filter(Number.isFinite);
  if (valid.length < 2) return null;
  const avg = average(valid);
  if (!avg) return null;
  const variance = valid.reduce((sum, value) => sum + Math.abs(value - avg), 0) / valid.length;
  return clampScore(100 - (variance / targetRange) * 100);
};

const metricScores = {
  sleep: (hours) => isNumber(hours) ? clampScore((Number(hours) / 8) * 100) : null,
  steps: (steps) => isNumber(steps) ? clampScore((Number(steps) / 10000) * 100) : null,
  activeMinutes: (minutes) => isNumber(minutes) ? clampScore((Number(minutes) / 45) * 100) : null,
  exerciseMinutes: (minutes) => isNumber(minutes) ? clampScore((Number(minutes) / 60) * 100) : null,
  caloriesBurned: (calories) => isNumber(calories) ? clampScore((Number(calories) / 2400) * 100) : null,
  heartHealth: (bpm) => {
    if (!isNumber(bpm)) return null;
    const value = Number(bpm);
    if (value >= 60 && value <= 75) return 100;
    if (value < 60) return clampScore(100 - (60 - value) * 2);
    return clampScore(100 - (value - 75) * 3);
  },
  bloodPressure: (systolic, diastolic) => {
    if (!isNumber(systolic) || !isNumber(diastolic)) return null;
    const sys = Number(systolic);
    const dia = Number(diastolic);
    const sysScore = sys <= 120 ? 100 : clampScore(100 - (sys - 120) * 2);
    const diaScore = dia <= 80 ? 100 : clampScore(100 - (dia - 80) * 3);
    return clampScore((sysScore + diaScore) / 2);
  },
  sedentary: (hours) => {
    if (!isNumber(hours)) return null;
    return clampScore(100 - Math.max(0, Number(hours) - 5) * 10);
  },
  bmi: (bmi) => {
    if (!isNumber(bmi) || Number(bmi) <= 0) return null;
    const value = Number(bmi);
    if (value >= 18.5 && value <= 24.9) return 100;
    if (value < 18.5) return clampScore(100 - (18.5 - value) * 8);
    return clampScore(100 - (value - 24.9) * 6);
  },
  ageContext: (age) => {
    if (!isNumber(age)) return null;
    const value = Number(age);
    if (value < 40) return 100;
    if (value < 60) return 94;
    if (value < 75) return 88;
    return 82;
  },
};

const weightedScore = (parts) => {
  const valid = parts.filter((part) => part.score != null);
  if (!valid.length) return null;
  const totalWeight = valid.reduce((sum, part) => sum + part.weight, 0);
  const score = valid.reduce((sum, part) => sum + part.score * part.weight, 0) / totalWeight;
  return clampScore(score);
};

const formatFactor = (label, score, value) => ({
  label,
  score,
  value: value ?? 'Missing',
  tone: score == null ? 'missing' : score >= 70 ? 'positive' : 'negative',
});

const pickFactors = (factors) => {
  const available = factors.filter((factor) => factor.score != null);
  const missing = factors.filter((factor) => factor.score == null);
  const strongest = [...available].sort((a, b) => b.score - a.score).slice(0, 1);
  const weakest = [...available].sort((a, b) => a.score - b.score).slice(0, 2);
  return [...strongest, ...weakest, ...missing.slice(0, 2)]
    .filter((factor, index, list) => list.findIndex((item) => item.label === factor.label) === index)
    .slice(0, 4);
};

export function buildPatientScores(patientData, healthLog = []) {
  const latest = healthLog[healthLog.length - 1] || {};
  const current = {
    sleep: patientData.sleep ?? latest.sleep,
    steps: patientData.steps ?? latest.steps,
    heartRate: patientData.heartRate ?? latest.hr,
    exercise: patientData.exercise ?? latest.exercise,
    activeMinutes: patientData.activeMinutes ?? latest.activeMinutes,
    caloriesBurned: patientData.caloriesBurned ?? latest.caloriesBurned,
    sedentaryHours: patientData.sedentaryHours ?? latest.sedentaryHours,
    bmi: patientData.bmi,
    age: patientData.age,
    systolic: patientData.systolicBp,
    diastolic: patientData.diastolicBp,
  };

  const wellPathFactors = [
    formatFactor('Sleep', metricScores.sleep(current.sleep), current.sleep != null ? `${current.sleep} hrs` : null),
    formatFactor('Activity', metricScores.steps(current.steps), current.steps != null ? `${Number(current.steps).toLocaleString()} steps` : null),
    formatFactor('Heart health', metricScores.heartHealth(current.heartRate), current.heartRate != null ? `${current.heartRate} bpm` : null),
    formatFactor('Blood pressure', metricScores.bloodPressure(current.systolic, current.diastolic), current.systolic && current.diastolic ? `${current.systolic}/${current.diastolic}` : null),
    formatFactor('Sedentary time', metricScores.sedentary(current.sedentaryHours), current.sedentaryHours != null ? `${current.sedentaryHours} hrs` : null),
    formatFactor('BMI', metricScores.bmi(current.bmi), current.bmi ? `${current.bmi} BMI` : null),
    formatFactor('Age', metricScores.ageContext(current.age), current.age ? `${current.age} yrs` : null),
  ];

  const activityFactors = [
    formatFactor('Steps', metricScores.steps(current.steps), current.steps != null ? `${Number(current.steps).toLocaleString()} steps` : null),
    formatFactor('Active minutes', metricScores.activeMinutes(current.activeMinutes), current.activeMinutes != null ? `${current.activeMinutes} min` : null),
    formatFactor('Exercise minutes', metricScores.exerciseMinutes(current.exercise), current.exercise != null ? `${current.exercise} min` : null),
    formatFactor('Sedentary time', metricScores.sedentary(current.sedentaryHours), current.sedentaryHours != null ? `${current.sedentaryHours} hrs` : null),
    formatFactor('Calories burned', metricScores.caloriesBurned(current.caloriesBurned), current.caloriesBurned != null ? `${Number(current.caloriesBurned).toLocaleString()} cal` : null),
  ];

  const sleepConsistency = consistencyScore(healthLog.map((day) => day.sleep), 2);
  const activityConsistency = consistencyScore(healthLog.map((day) => day.steps), 3500);
  const exerciseConsistency = consistencyScore(healthLog.map((day) => day.exercise), 35);
  const sedentaryConsistency = consistencyScore(healthLog.map((day) => day.sedentaryHours), 3);
  const historyLabel = healthLog.length ? `${healthLog.length} days` : null;

  const consistencyFactors = [
    formatFactor('Sleep consistency', sleepConsistency, sleepConsistency == null ? null : historyLabel),
    formatFactor('Activity consistency', activityConsistency, activityConsistency == null ? null : historyLabel),
    formatFactor('Exercise frequency consistency', exerciseConsistency, exerciseConsistency == null ? null : historyLabel),
    formatFactor('Sedentary-time consistency', sedentaryConsistency, sedentaryConsistency == null ? null : historyLabel),
  ];

  const scores = [
    {
      id: 'wellpath',
      title: 'WellPath Score',
      shortLabel: 'WellPath',
      color: '#38bdf8',
      score: weightedScore([
        { score: wellPathFactors[0].score, weight: 22 },
        { score: wellPathFactors[1].score, weight: 22 },
        { score: wellPathFactors[2].score, weight: 18 },
        { score: wellPathFactors[3].score, weight: 14 },
        { score: wellPathFactors[4].score, weight: 10 },
        { score: wellPathFactors[5].score, weight: 8 },
        { score: wellPathFactors[6].score, weight: 6 },
      ]),
      description: 'A single, at-a-glance read on your overall health — an easy way to tell whether your everyday habits are keeping you on a healthy track.',
      factors: wellPathFactors,
    },
    {
      id: 'activity',
      title: 'Activity Score',
      shortLabel: 'Activity',
      color: '#35d48d',
      score: weightedScore([
        { score: activityFactors[0].score, weight: 30 },
        { score: activityFactors[1].score, weight: 25 },
        { score: activityFactors[2].score, weight: 20 },
        { score: activityFactors[3].score, weight: 15 },
        { score: activityFactors[4].score, weight: 10 },
      ]),
      description: 'Captures how much you moved today, giving you a quick sense of whether you are active enough to support your energy and long-term health.',
      factors: activityFactors,
    },
    {
      id: 'consistency',
      title: 'Consistency Score',
      shortLabel: 'Consistency',
      color: '#a855f7',
      score: weightedScore([
        { score: consistencyFactors[0].score, weight: 35 },
        { score: consistencyFactors[1].score, weight: 30 },
        { score: consistencyFactors[2].score, weight: 20 },
        { score: consistencyFactors[3].score, weight: 15 },
      ]),
      description: 'Reflects how steady your habits have been recently — the day-to-day regularity that tends to drive lasting progress more than any single strong day.',
      factors: consistencyFactors,
    },
  ];

  return scores.map((score) => ({
    ...score,
    status: scoreStatus(score.score),
    visibleFactors: pickFactors(score.factors),
    insight: null,
  }));
}
