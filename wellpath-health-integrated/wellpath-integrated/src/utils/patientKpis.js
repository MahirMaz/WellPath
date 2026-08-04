const hasValue = (value) => value !== null && value !== undefined && value !== '';
const isNumber = (value) => Number.isFinite(Number(value));

const numericValues = (items, key) =>
  items
    .map((item) => item?.[key])
    .filter(hasValue)
    .map(Number)
    .filter(Number.isFinite);

const average = (items, key) => {
  const values = numericValues(items, key);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const sum = (items, key) =>
  numericValues(items, key).reduce((total, value) => total + value, 0);

const round = (value, digits = 0) => {
  if (!isNumber(value)) return null;
  return Number(Number(value).toFixed(digits));
};

const clampScore = (value) => {
  if (!isNumber(value)) return null;
  return Math.max(0, Math.min(100, Math.round(Number(value))));
};

const display = (value, suffix = '', fallback = 'Not enough data') => {
  if (!hasValue(value) || !isNumber(value)) return fallback;
  return `${Number(value).toLocaleString()}${suffix}`;
};

const displayText = (value, fallback = 'Not enough data') => hasValue(value) ? value : fallback;

const formatTime = (value) => {
  if (!hasValue(value)) return 'Not enough data';
  const text = String(value);
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return text;
  const hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${suffix}`;
};

const formatMinutes = (value) => {
  if (!isNumber(value)) return 'Not enough data';
  return `${Number(value).toLocaleString()} min`;
};

const cappedProgress = (current, target) => {
  if (!isNumber(current) || !isNumber(target) || Number(target) <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((Number(current) / Number(target)) * 100)));
};

const weightedScore = (parts) => {
  const valid = parts.filter((part) => part.score != null);
  if (!valid.length) return null;
  const totalWeight = valid.reduce((total, part) => total + part.weight, 0);
  const score = valid.reduce((total, part) => total + part.score * part.weight, 0) / totalWeight;
  return clampScore(score);
};

const scoreStatus = (score) => {
  if (score == null) return 'Not enough data';
  if (score >= 85) return 'Excellent recovery';
  if (score >= 70) return 'Good recovery';
  if (score >= 50) return 'Moderate recovery';
  return 'Needs recovery focus';
};

const trendMeta = (label, direction = 'neutral') => ({ label, direction });

const compareToAverageMeta = (current, avg, lowerIsBetter = false) => {
  if (!isNumber(current) || !isNumber(avg)) return trendMeta('Not enough data');
  const diff = Number(current) - Number(avg);
  if (Math.abs(diff) < 0.5) return trendMeta('Stable this week');
  const favorable = lowerIsBetter ? diff < 0 : diff > 0;
  return favorable ? trendMeta('Above weekly average', 'up') : trendMeta('Below weekly average', 'down');
};

const progressMeta = (current, target, targetLabel, overTargetLabel = 'Goal exceeded') => {
  if (!isNumber(current) || !isNumber(target) || Number(target) <= 0) {
    return {
      progress: 0,
      ringLabel: '--',
      ringSubtext: 'Target not set',
      targetLabel: 'Target not set',
      statusLabel: 'Target not set',
      direction: 'neutral',
    };
  }

  const raw = Math.round((Number(current) / Number(target)) * 100);
  return {
    progress: Math.min(100, Math.max(0, raw)),
    ringLabel: `${Math.min(100, Math.max(0, raw))}%`,
    ringSubtext: raw > 100 ? overTargetLabel : targetLabel,
    targetLabel,
    statusLabel: raw >= 100 ? overTargetLabel : raw >= 85 ? 'Goal nearly reached' : 'Below target',
    direction: raw >= 85 ? 'up' : 'down',
  };
};

const sleepMeta = (current, target) => {
  if (!isNumber(current) || !isNumber(target) || Number(target) <= 0) {
    return {
      progress: 0,
      ringLabel: '--',
      ringSubtext: 'Target not set',
      targetLabel: 'Target not set',
      statusLabel: 'Target not set',
      direction: 'neutral',
    };
  }

  const hours = Number(current);
  const goal = Number(target);
  const raw = Math.round((hours / goal) * 100);
  const aboveRange = hours > goal + 1;
  return {
    progress: Math.min(100, Math.max(0, raw)),
    ringLabel: `${Math.min(100, Math.max(0, raw))}%`,
    ringSubtext: `of ${goal} hrs`,
    targetLabel: `of ${goal} hrs`,
    statusLabel: aboveRange ? 'Above target range' : raw >= 90 ? 'Within sleep goal' : 'Below sleep goal',
    direction: aboveRange || raw < 90 ? 'down' : 'up',
  };
};

const sleepDurationRecoveryScore = (hours) => {
  if (!isNumber(hours)) return null;
  const value = Number(hours);
  if (value >= 7 && value <= 9) return 100;
  if (value < 7) return clampScore(100 - (7 - value) * 18);
  return clampScore(100 - (value - 9) * 14);
};

const ageContextScore = (age) => {
  if (!isNumber(age)) return null;
  const value = Number(age);
  if (value < 40) return 100;
  if (value < 60) return 94;
  if (value < 75) return 88;
  return 82;
};

export function calculateRecoveryScore({
  sleepHours,
  sleepConsistency,
  restingHeartRateScore,
  exerciseMinutes,
  activeMinutes,
  age,
}) {
  const score = weightedScore([
    { score: sleepDurationRecoveryScore(sleepHours), weight: 30 },
    { score: isNumber(sleepConsistency) ? clampScore(sleepConsistency) : null, weight: 25 },
    { score: isNumber(restingHeartRateScore) ? clampScore(restingHeartRateScore) : null, weight: 20 },
    { score: cappedProgress(exerciseMinutes, 45), weight: 10 },
    { score: cappedProgress(activeMinutes, 45), weight: 10 },
    { score: ageContextScore(age), weight: 5 },
  ]);

  return {
    score,
    statusLabel: scoreStatus(score),
    direction: score == null ? 'neutral' : score >= 70 ? 'up' : score >= 50 ? 'neutral' : 'down',
  };
}

const sedentaryMeta = (current, limit) => {
  if (!isNumber(current) || !isNumber(limit) || Number(limit) <= 0) {
    return {
      progress: 0,
      ringLabel: '--',
      ringSubtext: 'Limit not set',
      targetLabel: 'Limit not set',
      statusLabel: 'Limit not set',
      direction: 'neutral',
    };
  }

  const usedRatio = Number(current) / Number(limit);
  return {
    // Full ring = good (consistent with every other card). Ring shows headroom
    // left under the limit and depletes as sedentary time rises: e.g. 5 of 8 hrs
    // used -> 38% remaining. Empty ring = at/over the limit.
    progress: Math.round(Math.max(0, 1 - usedRatio) * 100),
    ringLabel: usedRatio <= 0.75 ? 'OK' : usedRatio <= 1 ? 'Near' : 'High',
    ringSubtext: `limit ${limit} hrs`,
    targetLabel: `limit ${limit} hrs`,
    statusLabel: usedRatio <= 0.75 ? 'Within daily limit' : usedRatio <= 1 ? 'Approaching limit' : 'Above limit',
    direction: usedRatio <= 0.75 ? 'neutral' : 'down',
  };
};

const heartRateMeta = (current, baselineValues, baselineLow, baselineHigh) => {
  const hasExplicitRange = isNumber(baselineLow) && isNumber(baselineHigh);
  if (!isNumber(current) || (!hasExplicitRange && baselineValues.length < 3)) {
    return {
      progress: 0,
      ringLabel: '--',
      ringSubtext: 'No baseline',
      targetLabel: 'Baseline not established',
      statusLabel: 'Baseline not established',
      baselineLabel: 'Baseline not established',
      direction: 'neutral',
    };
  }

  const avg = baselineValues.reduce((sumValue, value) => sumValue + value, 0) / baselineValues.length;
  const low = hasExplicitRange ? Number(baselineLow) : Math.round(avg - 3);
  const high = hasExplicitRange ? Number(baselineHigh) : Math.round(avg + 3);
  const value = Number(current);
  const distance = value < low ? low - value : value > high ? value - high : 0;
  const inRange = distance === 0;

  return {
    progress: inRange ? 100 : Math.max(20, 100 - distance * 12),
    ringLabel: inRange ? 'In range' : 'Check',
    ringSubtext: `${low}-${high} bpm`,
    targetLabel: `${low}-${high} bpm baseline`,
    statusLabel: inRange ? 'Within baseline' : value > high ? 'Slightly above baseline' : 'Slightly below baseline',
    baselineLabel: `${low}-${high} bpm`,
    direction: inRange ? 'neutral' : 'down',
  };
};

const bloodPressureMeta = (systolic, diastolic, systolicTarget = 120, diastolicTarget = 80) => {
  if (!isNumber(systolic) || !isNumber(diastolic)) {
    return {
      progress: 0,
      ringLabel: '--',
      ringSubtext: 'No reading',
      targetLabel: 'Not enough data',
      statusLabel: 'Not enough data',
      direction: 'neutral',
    };
  }

  const sys = Number(systolic);
  const dia = Number(diastolic);
  const sysTarget = isNumber(systolicTarget) ? Number(systolicTarget) : 120;
  const diaTarget = isNumber(diastolicTarget) ? Number(diastolicTarget) : 80;
  const targetLabel = `below ${sysTarget}/${diaTarget}`;

  if (sys <= sysTarget && dia <= diaTarget) {
    return { progress: 100, ringLabel: 'OK', ringSubtext: 'in range', targetLabel, statusLabel: 'Within target range', direction: 'neutral' };
  }
  if (sys <= sysTarget + 10 && dia <= diaTarget + 2) {
    return { progress: 76, ringLabel: 'Slight', ringSubtext: 'elevated', targetLabel, statusLabel: 'Slightly elevated', direction: 'down' };
  }
  if (sys <= sysTarget + 20 || dia <= diaTarget + 10) {
    return { progress: 54, ringLabel: 'Elev.', ringSubtext: 'review', targetLabel, statusLabel: 'Elevated', direction: 'down' };
  }
  return { progress: 34, ringLabel: 'Review', ringSubtext: 'needed', targetLabel, statusLabel: 'Review recommended', direction: 'down' };
};

const seriesFor = (items, key) =>
  items.map((item, index) => ({
    label: item?.day || `Day ${index + 1}`,
    value: isNumber(item?.[key]) ? Number(item[key]) : null,
  }));

const seriesFrom = (items, valueGetter) =>
  items.map((item, index) => ({
    label: item?.day || `Day ${index + 1}`,
    value: isNumber(valueGetter(item)) ? Number(valueGetter(item)) : null,
  }));

const palette = {
  steps: '#35d48d',
  sleep: '#8b7cf6',
  heartRate: '#ff5f7a',
  exercise: '#f59e0b',
  activeMinutes: '#38bdf8',
  recovery: '#14b8a6',
  sedentary: '#d6c62f',
  calories: '#f97316',
  bloodPressure: '#a855f7',
};

export function buildPatientKpis(patientData, healthLog = []) {
  const latest = healthLog[healthLog.length - 1] || {};
  const sevenDayHistory = healthLog.slice(-7);

  const current = {
    steps: patientData.steps ?? latest.steps,
    sleep: patientData.sleep ?? latest.sleep,
    sleepConsistency: patientData.sleepConsistency ?? latest.sleepConsistency,
    heartRate: patientData.heartRate ?? latest.hr,
    exercise: patientData.exercise ?? latest.exercise,
    activeMinutes: patientData.activeMinutes ?? latest.activeMinutes,
    sedentaryHours: patientData.sedentaryHours ?? latest.sedentaryHours,
    caloriesBurned: patientData.caloriesBurned ?? latest.caloriesBurned,
    activeCalories: patientData.activeCalories ?? latest.activeCalories,
    systolicBp: patientData.systolicBp ?? latest.systolicBp,
    diastolicBp: patientData.diastolicBp ?? latest.diastolicBp,
    workoutCount: patientData.workoutCount ?? latest.workoutCount,
  };

  const avgSteps = average(sevenDayHistory, 'steps');
  const avgSleep = average(sevenDayHistory, 'sleep');
  const avgHr = average(sevenDayHistory, 'hr');
  const avgExercise = average(sevenDayHistory, 'exercise');
  const avgActiveMinutes = average(sevenDayHistory, 'activeMinutes');
  const avgSedentary = average(sevenDayHistory, 'sedentaryHours');
  const avgCalories = average(sevenDayHistory, 'caloriesBurned');
  const avgActiveCalories = average(sevenDayHistory, 'activeCalories');
  const hrMeta = heartRateMeta(
    current.heartRate,
    numericValues(sevenDayHistory, 'hr'),
    patientData.restingHrBaselineLow,
    patientData.restingHrBaselineHigh
  );
  const sedentary = sedentaryMeta(current.sedentaryHours, patientData.sedentaryLimit);
  const bpMeta = bloodPressureMeta(
    current.systolicBp,
    current.diastolicBp,
    patientData.bpSystolicTargetMax,
    patientData.bpDiastolicTargetMax
  );
  const bpRows = sevenDayHistory.filter((day) => isNumber(day.systolicBp) && isNumber(day.diastolicBp));
  const avgSystolic = average(bpRows, 'systolicBp');
  const avgDiastolic = average(bpRows, 'diastolicBp');
  const activeCaloriesMeta = progressMeta(current.activeCalories, patientData.activeCalorieGoal, patientData.activeCalorieGoal ? `of ${patientData.activeCalorieGoal} cals` : 'Active calorie goal not set');
  const recovery = calculateRecoveryScore({
    sleepHours: current.sleep,
    sleepConsistency: current.sleepConsistency,
    restingHeartRateScore: hrMeta.progress,
    exerciseMinutes: current.exercise,
    activeMinutes: current.activeMinutes,
    age: patientData.age,
  });
  const recoverySeries = seriesFrom(sevenDayHistory, (day) => {
    const dayHrMeta = heartRateMeta(
      day.hr,
      numericValues(sevenDayHistory, 'hr'),
      patientData.restingHrBaselineLow,
      patientData.restingHrBaselineHigh
    );
    return calculateRecoveryScore({
      sleepHours: day.sleep,
      sleepConsistency: day.sleepConsistency,
      restingHeartRateScore: dayHrMeta.progress,
      exerciseMinutes: day.exercise,
      activeMinutes: day.activeMinutes,
      age: patientData.age,
    }).score;
  });
  const avgRecovery = average(recoverySeries, 'value');
  const stepsTrend = compareToAverageMeta(current.steps, avgSteps);
  const sleepTrend = compareToAverageMeta(current.sleep, avgSleep);
  const exerciseTrend = compareToAverageMeta(current.exercise, avgExercise);
  const activeMinutesTrend = compareToAverageMeta(current.activeMinutes, avgActiveMinutes);
  const caloriesTrend = isNumber(current.activeCalories)
    ? compareToAverageMeta(current.activeCalories, avgActiveCalories)
    : trendMeta('Active calories missing');
  const stepsMeta = progressMeta(current.steps, patientData.stepGoal, patientData.stepGoal ? `of ${display(patientData.stepGoal, '')}` : 'Target not set');
  const sleepStatus = sleepMeta(current.sleep, patientData.sleepGoal);
  const exerciseMeta = progressMeta(current.exercise, patientData.exerciseGoal, patientData.exerciseGoal ? `daily goal ${patientData.exerciseGoal} min` : 'Exercise goal not set');
  const activeMinutesMeta = progressMeta(current.activeMinutes, patientData.activeMinuteGoal, patientData.activeMinuteGoal ? `of ${patientData.activeMinuteGoal} min` : 'Active-minute goal not set');

  return [
    {
      id: 'steps',
      title: 'Steps',
      main: display(current.steps, '', 'Not enough data'),
      unit: 'steps',
      color: palette.steps,
      ...stepsMeta,
      trend: stepsTrend.label,
      trendDirection: stepsTrend.direction,
      series: seriesFor(sevenDayHistory, 'steps'),
      chartLabel: 'Daily Steps (7-Day Trend)',
      insight: null,
      rows: [
        ['7-day average', display(round(avgSteps), '')],
        ['Personal target', display(patientData.stepGoal, '')],
      ],
    },
    {
      id: 'sleep',
      title: 'Sleep',
      main: display(current.sleep, ' hrs'),
      unit: 'total sleep',
      color: palette.sleep,
      ...sleepStatus,
      trend: sleepTrend.label,
      trendDirection: sleepTrend.direction,
      series: seriesFor(sevenDayHistory, 'sleep'),
      chartLabel: 'Sleep Duration (7-Day Trend)',
      insight: null,
      rows: [
        ['7-day average', display(round(avgSleep, 1), ' hrs')],
        ['Bedtime', formatTime(patientData.bedtime)],
        ['Wake time', formatTime(patientData.wakeTime)],
        ['Sleep consistency', display(round(avgSleep, 1), ' hrs avg')],
        ['Interruptions', displayText(patientData.sleepInterruptions)],
      ],
    },
    {
      id: 'recovery',
      title: 'Recovery',
      main: recovery.score == null ? 'Not enough data' : `${recovery.score}`,
      unit: 'recovery score',
      color: palette.recovery,
      progress: recovery.score ?? 0,
      ringLabel: recovery.score == null ? '--' : `${recovery.score}%`,
      ringSubtext: recovery.score == null ? 'Not enough data' : 'readiness',
      targetLabel: 'sleep + HR + activity + age',
      statusLabel: recovery.statusLabel,
      trend: recovery.statusLabel,
      trendDirection: recovery.direction,
      series: recoverySeries,
      chartLabel: 'Recovery Score (7-Day Trend)',
      insight: null,
      rows: [
        ['7-day average', display(round(avgRecovery), '')],
        ['Sleep consistency', display(round(current.sleepConsistency), '%')],
        ['Resting HR', display(current.heartRate, ' bpm')],
        ['Age', display(patientData.age, ' yrs')],
      ],
    },
    {
      id: 'heartRate',
      title: 'Resting Heart Rate',
      main: display(current.heartRate, ' bpm'),
      unit: 'current',
      color: palette.heartRate,
      ...hrMeta,
      trend: hrMeta.statusLabel,
      trendDirection: hrMeta.direction,
      series: seriesFor(sevenDayHistory, 'hr'),
      chartLabel: 'Resting Heart Rate (7-Day Trend)',
      insight: null,
      rows: [
        ['7-day average', display(round(avgHr), ' bpm')],
        ['Personal baseline', hrMeta.baselineLabel],
        ['Trend over time', hrMeta.statusLabel],
      ],
    },
    {
      id: 'exercise',
      title: 'Exercise',
      main: display(current.exercise, ' min'),
      unit: 'today',
      color: palette.exercise,
      ...exerciseMeta,
      trend: exerciseTrend.label,
      trendDirection: exerciseTrend.direction,
      series: seriesFor(sevenDayHistory, 'exercise'),
      chartLabel: 'Exercise Minutes (7-Day Trend)',
      insight: null,
      rows: [
        ['Workout count', display(current.workoutCount, '')],
        ['Workout intensity', displayText(patientData.workoutIntensity)],
        ['Weekly total', display(round(sum(sevenDayHistory, 'exercise')), ' min')],
      ],
    },
    {
      id: 'activeMinutes',
      title: 'Active Minutes',
      main: display(current.activeMinutes, ' min'),
      unit: 'today',
      color: palette.activeMinutes,
      ...activeMinutesMeta,
      trend: activeMinutesTrend.label,
      trendDirection: activeMinutesTrend.direction,
      series: seriesFor(sevenDayHistory, 'activeMinutes'),
      chartLabel: 'Active Minutes (7-Day Trend)',
      insight: null,
      rows: [
        ['7-day average', display(round(avgActiveMinutes), ' min')],
        ['Daily target', display(patientData.activeMinuteGoal, ' min')],
      ],
    },
    {
      id: 'sedentary',
      title: 'Sedentary Time',
      main: display(current.sedentaryHours, ' hrs'),
      unit: 'today',
      color: palette.sedentary,
      ...sedentary,
      trend: sedentary.statusLabel,
      trendDirection: sedentary.direction,
      series: seriesFor(sevenDayHistory, 'sedentaryHours'),
      chartLabel: 'Sedentary Time (7-Day Trend)',
      insight: null,
      rows: [
        ['Longest inactive period', formatMinutes(patientData.longestInactivePeriod)],
        ['7-day average', display(round(avgSedentary, 1), ' hrs')],
      ],
    },
    {
      id: 'calories',
      title: 'Calories Burned',
      main: display(current.activeCalories, ' cals'),
      unit: 'active cals',
      color: palette.calories,
      ...activeCaloriesMeta,
      trend: caloriesTrend.label,
      trendDirection: caloriesTrend.direction,
      series: seriesFor(sevenDayHistory, 'activeCalories'),
      chartLabel: 'Active Calories (7-Day Trend)',
      insight: null,
      rows: [
        ['Total calories', display(current.caloriesBurned, ' cals')],
        ['7-day active avg', display(round(avgActiveCalories), ' cals')],
      ],
    },
    {
      id: 'bloodPressure',
      title: 'Blood Pressure',
      main: current.systolicBp && current.diastolicBp ? `${current.systolicBp}/${current.diastolicBp}` : 'Not enough data',
      unit: 'mmHg',
      color: palette.bloodPressure,
      ...bpMeta,
      trend: bpMeta.statusLabel,
      trendDirection: bpMeta.direction,
      series: seriesFor(bpRows.map((day) => ({ ...day, bpCombined: (Number(day.systolicBp) + Number(day.diastolicBp)) / 2 })), 'bpCombined'),
      chartLabel: 'Blood Pressure (Recent Trend)',
      insight: null,
      rows: [
        ['Systolic', display(current.systolicBp, '')],
        ['Diastolic', display(current.diastolicBp, '')],
        ['Recent average', avgSystolic && avgDiastolic ? `${round(avgSystolic)}/${round(avgDiastolic)}` : 'Not enough data'],
        ['Last measured', displayText(patientData.lastMeasurementDate || latest.recordDate)],
      ],
    },
  ];
}
