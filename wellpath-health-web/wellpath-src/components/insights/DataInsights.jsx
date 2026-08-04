import React from 'react';
import { Dna, Activity, MapPin, TrendingUp, Database, Flag, Layers } from 'lucide-react';

// ---------------------------------------------------------------------------
// Real numbers computed from public datasets (see data-research/*.md).
// NHANES 2017-2018 (US, N=5,856) · CDC PLACES 2025 (2,956 counties) ·
// StatsCan CCHS 2019-2020 (Canada, N=108,252, weighted to 32.1M).
// ---------------------------------------------------------------------------
const ACC = 'var(--wellpath-accent)';
const CORAL = 'var(--coral)';
const GREEN = 'var(--green)';
const AMBER = 'var(--amber)';

const familyHistory = [
  { label: 'No family history', value: 33.0, color: GREEN },
  { label: 'Family history of diabetes', value: 50.1, color: CORAL },
];
const riskGradient = [
  { label: 'Low (score 0–1)', value: 7.3, color: GREEN },
  { label: 'Score 2–3', value: 27.1, color: AMBER },
  { label: 'Score 4–5', value: 48.2, color: AMBER },
  { label: 'High (score 6+)', value: 68.3, color: CORAL },
];
const countyTop = [
  { label: 'Greene, AL', value: 27.1, color: CORAL },
  { label: 'Sharkey, MS', value: 25.2, color: CORAL },
  { label: 'Tensas, LA', value: 25.1, color: CORAL },
  { label: 'US median county', value: 13.3, color: ACC },
  { label: 'Douglas, CO', value: 6.8, color: GREEN },
  { label: 'Madison, ID', value: 4.9, color: GREEN },
];
const countyCorr = [
  { label: 'High blood pressure', value: 0.89 },
  { label: 'Physical inactivity', value: 0.85 },
  { label: 'Current smoking', value: 0.71 },
  { label: 'Obesity', value: 0.67 },
];
const provinceDiabetes = [
  { label: 'Newfoundland & Lab.', value: 8.5, color: CORAL },
  { label: 'New Brunswick', value: 7.7, color: CORAL },
  { label: 'Ontario', value: 7.1, color: ACC },
  { label: 'Nova Scotia', value: 7.0, color: ACC },
  { label: 'Quebec', value: 6.6, color: ACC },
  { label: 'Alberta', value: 6.2, color: ACC },
  { label: 'PEI', value: 6.1, color: ACC },
  { label: 'Manitoba', value: 5.1, color: ACC },
  { label: 'British Columbia', value: 4.9, color: GREEN },
  { label: 'Saskatchewan', value: 4.6, color: GREEN },
  { label: 'Territories', value: 1.6, color: GREEN },
];
const canadaLifestyle = [
  { label: 'Normal / underweight', value: 3.7, color: GREEN },
  { label: 'Overweight / obese', value: 9.4, color: CORAL },
];
// Gap between highest- and lowest-diabetes... county for each condition (percentage points), CDC PLACES.
const countyGaps = [
  { label: 'High blood pressure', value: 42.5, color: CORAL },
  { label: 'Physical inactivity', value: 37.4, color: AMBER },
  { label: 'Obesity', value: 36.2, color: AMBER },
  { label: 'Current smoking', value: 33.4, color: AMBER },
  { label: 'Diabetes', value: 22.2, color: ACC },
];
// Independent effect on prediabetes+ odds, all KPIs mutually adjusted (logistic regression).
// OR > 1 raises risk (coral), < 1 protective (green).
const drivers = [
  { label: 'Older age', or: 2.67 },
  { label: 'Family history of diabetes', or: 2.00 },
  { label: 'Higher BMI', or: 1.63 },
  { label: 'Higher resting heart rate', or: 1.20 },
  { label: 'Higher blood pressure', or: 1.12 },
  { label: 'More sleep', or: 0.88 },
  { label: 'Vigorous activity', or: 0.81 },
  { label: 'Being female', or: 0.68 },
];

function Bars({ data, max, unit = '%', decimals = 1 }) {
  const m = max ?? Math.max(...data.map((d) => d.value));
  return (
    <div className="di-bars">
      {data.map((d) => (
        <div className="di-bar-row" key={d.label}>
          <span className="di-bar-label">{d.label}</span>
          <span className="di-bar-track">
            <span className="di-bar-fill" style={{ width: `${Math.max(2, (d.value / m) * 100)}%`, background: d.color || ACC }} />
          </span>
          <span className="di-bar-val">{d.value.toFixed(decimals)}{unit}</span>
        </div>
      ))}
    </div>
  );
}

// Diverging effect bars for odds ratios: length ∝ |ln(OR)|, colored by direction.
function EffectBars({ data }) {
  const max = Math.max(...data.map((d) => Math.abs(Math.log(d.or))));
  return (
    <div className="di-bars">
      {data.map((d) => {
        const up = d.or >= 1;
        const w = Math.max(4, (Math.abs(Math.log(d.or)) / max) * 100);
        return (
          <div className="di-bar-row" key={d.label}>
            <span className="di-bar-label">{d.label}</span>
            <span className="di-bar-track"><span className="di-bar-fill" style={{ width: `${w}%`, background: up ? CORAL : GREEN }} /></span>
            <span className="di-bar-val">×{d.or.toFixed(2)}</span>
          </div>
        );
      })}
      <div className="di-legend"><span><i style={{ background: CORAL }} /> raises risk</span><span><i style={{ background: GREEN }} /> lowers risk</span></div>
    </div>
  );
}

function Stats({ items }) {
  return (
    <div className="di-stats">
      {items.map((s) => (
        <div className="di-stat" key={s.label}><span className="di-stat-val">{s.value}</span><span className="di-stat-label">{s.label}</span></div>
      ))}
    </div>
  );
}

function Card({ icon: Icon, kicker, title, children, source }) {
  return (
    <section className="di-card">
      <div className="di-card-head">
        <span className="di-card-icon"><Icon size={16} /></span>
        <div>
          <span className="di-kicker">{kicker}</span>
          <h3>{title}</h3>
        </div>
      </div>
      {children}
      {source && <p className="di-source">{source}</p>}
    </section>
  );
}

export function DataInsights() {
  return (
    <div className="di-wrap">
      <header className="di-hero">
        <span className="di-hero-icon"><Database size={22} /></span>
        <h2>Data Insights</h2>
        <p>The science behind WellPath — patterns from <strong>real public-health datasets</strong>: NHANES (US),
          CDC PLACES (US counties), and StatsCan CCHS (Canada).</p>
      </header>

      <div className="di-flag-row"><Flag size={13} /> United States</div>

      <Card icon={Dna} kicker="Genetics · NHANES" title="Family history predicts a measured outcome"
        source="NHANES 2017–2018 · 4,946 adults · outcome = HbA1c ≥ 5.7 (prediabetes+)">
        <p className="di-note">A single survey question — “diabetes in the family?” — splits real, measured blood-sugar risk almost in half. This is why family history works as a genetics stand-in.</p>
        <Bars data={familyHistory} max={70} />
      </Card>

      <Card icon={TrendingUp} kicker="Algorithm · NHANES" title="A simple risk score tracks real risk"
        source="Additive score (lifestyle + family history + demographics) vs measured prediabetes+ · AUC 0.71 · N=4,795">
        <p className="di-note">No machine learning — just adding up risk factors. The measured outcome rate climbs cleanly from the low-score to high-score group.</p>
        <Bars data={riskGradient} max={80} />
        <div className="di-badge">Separates risk at <strong>AUC&nbsp;0.71</strong></div>
      </Card>

      <Card icon={Layers} kicker="All KPIs together · NHANES" title="What independently drives risk"
        source="Logistic regression, N=3,892 · outcome HbA1c ≥ 5.7 · every predictor mutually adjusted">
        <p className="di-note">When all KPIs compete in one model — each controlling for the others — these stand out. The key finding: <strong>family history holds its own even against BMI, diet and activity.</strong></p>
        <EffectBars data={drivers} />
        <div className="di-badge">Full-KPI model reaches <strong>AUC&nbsp;0.78</strong> (vs 0.71 for the simple score)</div>
      </Card>


      <Card icon={MapPin} kicker="Geography · CDC PLACES" title="Where you live matters — 5× swing"
        source="CDC PLACES 2025 · adult diagnosed diabetes across 2,956 US counties">
        <p className="di-note">Diagnosed diabetes ranges from 4.9% to 27.1% depending on the county — the Deep-South “diabetes belt” vs the Mountain West.</p>
        <Bars data={countyTop} max={30} />
      </Card>

      <Card icon={MapPin} kicker="Geography · CDC PLACES" title="Every condition varies by place — not just diabetes"
        source="Gap between the highest- and lowest-rate US county (percentage points), 2,956 counties">
        <p className="di-note">The county you live in swings every chronic-condition rate, not only diabetes — which is why location is a useful context signal across the board.</p>
        <Bars data={countyGaps} max={45} unit=" pts" />
      </Card>

      <Card icon={Activity} kicker="Geography · CDC PLACES" title="Risk factors cluster by place"
        source="County-level correlation with diabetes prevalence (2,956 counties)">
        <p className="di-note">Counties high in diabetes are also high in these — which is exactly what makes “your area’s baseline” a useful signal.</p>
        <Bars data={countyCorr} max={1} unit="" decimals={2} />
      </Card>

      <div className="di-flag-row"><Flag size={13} /> Canada</div>

      <Card icon={MapPin} kicker="Geography · CCHS" title="Diabetes by province"
        source="StatsCan CCHS 2019–2020 · self-reported · survey-weighted to 32.1M Canadians">
        <p className="di-note">Newfoundland &amp; Labrador runs ~5× the territories. A coherent regional pattern (Atlantic Canada high, BC low) a model can use as context.</p>
        <Bars data={provinceDiabetes} max={9} />
      </Card>

      <Card icon={Layers} kicker="Geography, adjusted · CCHS" title="Mostly who lives there, not where"
        source="Logistic regression adjusting for age, weight, income, smoking & stress · N=86,893">
        <p className="di-note">Newfoundland’s top diabetes rate <strong>nearly vanishes</strong> once you adjust for age, weight and income — its excess is explained by population make-up, not location. Geography is largely a proxy for the individual KPIs you already collect.</p>
        <Stats items={[
          { value: '×1.09', label: 'Newfoundland vs Ontario after adjustment (not significant)' },
          { value: '+0.003', label: 'Prediction gained by adding province' },
        ]} />
      </Card>

      <Card icon={Activity} kicker="Lifestyle · CCHS" title="Modifiable factors still drive it"
        source="CCHS 2019–2020 · diabetes prevalence by weight class · survey-weighted">
        <p className="di-note">Even without lab data, a modifiable factor shows a clean 2.5× gradient on 100k+ Canadians.</p>
        <Bars data={canadaLifestyle} max={12} />
      </Card>

      <p className="di-footer">Two separate cohorts, analyzed independently. Full write-ups &amp; sources in the project’s <code>data-research/</code> folder.</p>
    </div>
  );
}

export default DataInsights;
