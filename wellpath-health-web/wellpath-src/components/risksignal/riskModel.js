// Native (JS) scorer for the exported per-condition NHANES logistic models.
// Non-diagnostic: converts inputs into a qualitative BAND, never a raw probability.
import multi from './multiModel.json';

export const modelSet = multi;
export const conditionKeys = Object.keys(multi.conditions);

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

export function computeCondition(cond, inputs) {
  let logit = cond.intercept;
  const contributions = [];
  for (const f of cond.features) {
    let x = Number(inputs[f.key]);
    if (Number.isNaN(x)) x = 0;
    const z = f.type === 'cont' ? (x - f.mean) / f.std : x;
    const c = f.coef * z;
    logit += c;
    contributions.push({ key: f.key, label: f.label, value: c });
  }
  const prob = sigmoid(logit);
  const [lo, hi] = cond.band_cuts;
  const band = prob < lo ? 'lower' : prob < hi ? 'typical' : 'higher';
  const drivers = contributions
    .filter((d) => Math.abs(d.value) > 0.08)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  // Honest confidence label from cross-validated AUC.
  const confidence = cond.cv_auc >= 0.70 ? 'moderate' : cond.cv_auc >= 0.62 ? 'limited' : 'low';
  return { prob, band, drivers, confidence };
}
