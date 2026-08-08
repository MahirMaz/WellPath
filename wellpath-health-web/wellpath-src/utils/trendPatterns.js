export const TREND_METRICS = [
  { key: 'sleep', label: 'Sleep', unit: 'hrs', digits: 1, higherIsBetter: true },
  { key: 'steps', label: 'Steps', unit: '', digits: 0, higherIsBetter: true },
  { key: 'activeMinutes', label: 'Active minutes', unit: 'min', digits: 0, higherIsBetter: true },
  { key: 'sedentaryHours', label: 'Sitting time', unit: 'hrs', digits: 1, higherIsBetter: false },
  { key: 'hr', label: 'Resting HR', unit: 'bpm', digits: 0, higherIsBetter: null },
  { key: 'systolicBp', label: 'Systolic BP', unit: 'mmHg', digits: 0, higherIsBetter: null },
];

const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

export function buildRecentComparisons(healthLog = [], metrics = TREND_METRICS) {
  return metrics.flatMap((metric) => {
    const values = healthLog
      .map((day) => Number(day?.[metric.key]))
      .filter(Number.isFinite);
    if (values.length < 10) return [];

    const recent = values.slice(-7);
    const previous = values.slice(-14, -7);
    if (previous.length < 3) return [];

    const recentAverage = average(recent);
    const previousAverage = average(previous);
    const change = recentAverage - previousAverage;
    const relativeChange = previousAverage ? Math.abs(change / previousAverage) : 0;
    const direction = relativeChange < 0.03 ? 'flat' : change > 0 ? 'up' : 'down';
    const tone = direction === 'flat' || metric.higherIsBetter == null
      ? 'neutral'
      : (direction === 'up') === metric.higherIsBetter ? 'good' : 'bad';

    return [{
      ...metric,
      recentAverage,
      previousAverage,
      change,
      direction,
      tone,
      relativeChange,
    }];
  }).sort((a, b) => b.relativeChange - a.relativeChange);
}

export function formatTrendValue(value, digits = 0) {
  return digits ? Number(value).toFixed(digits) : Math.round(value).toLocaleString();
}
