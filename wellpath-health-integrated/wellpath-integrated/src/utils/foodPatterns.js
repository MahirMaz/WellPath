const NUTRIENT_RULES = [
  { key: 'sodium', label: 'sodium', metricKey: 'sleep', metricLabel: 'sleep', higherIsBetter: true, threshold: 2300, unit: 'mg' },
  { key: 'sodium', label: 'sodium', metricKey: 'hr', metricLabel: 'resting heart rate', higherIsBetter: false, threshold: 2300, unit: 'mg' },
  { key: 'fibre', label: 'fibre', metricKey: 'sleep', metricLabel: 'sleep', higherIsBetter: true, threshold: 20, unit: 'g' },
  { key: 'fibre', label: 'fibre', metricKey: 'activeMinutes', metricLabel: 'active minutes', higherIsBetter: true, threshold: 20, unit: 'g' },
  { key: 'protein', label: 'protein', metricKey: 'activeMinutes', metricLabel: 'active minutes', higherIsBetter: true, threshold: 60, unit: 'g' },
];

function dayKey(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

export function buildDailyNutritionTotals(entries = []) {
  const byDate = new Map();
  entries.forEach((entry) => {
    const date = dayKey(entry.recordDate || entry.record_date || entry.createdAt || entry.created_at || new Date());
    if (!date) return;
    const current = byDate.get(date) || {
      date, meals: 0, kcal: 0, protein: 0, carbs: 0, sugar: 0,
      fibre: 0, fat: 0, satfat: 0, sodium: 0,
    };
    current.meals += 1;
    ['kcal', 'protein', 'carbs', 'sugar', 'fibre', 'fat', 'satfat', 'sodium'].forEach((key) => {
      current[key] += Number(entry[key]) || 0;
    });
    byDate.set(date, current);
  });
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

const mean = (values) => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : null;

export function buildFoodHealthAssociations(entries = [], healthLog = []) {
  const nutrition = buildDailyNutritionTotals(entries);
  const healthByDate = new Map(healthLog.map((day) => [
    dayKey(day.recordDate || day.record_date || day.date),
    day,
  ]));
  const paired = nutrition
    .map((day) => ({ nutrition: day, health: healthByDate.get(day.date) }))
    .filter((day) => day.health);

  if (paired.length < 7) return { pairedDays: paired.length, associations: [] };

  const associations = NUTRIENT_RULES.flatMap((rule) => {
    const higherDays = paired.filter(({ nutrition: item }) => Number(item[rule.key]) >= rule.threshold);
    const lowerDays = paired.filter(({ nutrition: item }) => Number(item[rule.key]) < rule.threshold);
    if (higherDays.length < 3 || lowerDays.length < 3) return [];
    const higherMetric = mean(higherDays.map(({ health }) => Number(health[rule.metricKey])).filter(Number.isFinite));
    const lowerMetric = mean(lowerDays.map(({ health }) => Number(health[rule.metricKey])).filter(Number.isFinite));
    if (higherMetric == null || lowerMetric == null) return [];
    const difference = higherMetric - lowerMetric;
    const relativeDifference = lowerMetric ? Math.abs(difference / lowerMetric) : 0;
    if (relativeDifference < 0.025) return [];
    return [{
      id: `${rule.key}-${rule.metricKey}`,
      title: `${rule.label[0].toUpperCase()}${rule.label.slice(1)} and ${rule.metricLabel}`,
      nutrientLabel: rule.label,
      metricLabel: rule.metricLabel,
      threshold: rule.threshold,
      nutrientUnit: rule.unit,
      higherMetric,
      lowerMetric,
      difference,
      higherDays: higherDays.length,
      lowerDays: lowerDays.length,
      direction: difference > 0 ? 'higher' : 'lower',
      tone: rule.higherIsBetter === null
        ? 'neutral'
        : ((difference > 0) === rule.higherIsBetter ? 'good' : 'watch'),
    }];
  }).sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

  return { pairedDays: paired.length, associations: associations.slice(0, 3) };
}
