import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Armchair,
  CalendarCheck,
  ChevronUp,
  Droplets,
  Flame,
  Footprints,
  Gauge,
  HeartPulse,
  Moon,
  Scale,
  Sparkles,
  Target,
  Timer,
  ShieldCheck,
  ChevronRight,
  Minus,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { AiInsightBox, PersonalizedHint } from './AiInsightBox.jsx';
import { getMemory } from './aiMemory.js';

function hashString(value) {
  let hash = 0;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function buildInsightRequest(cardType, card) {
  if (cardType === 'score') {
    return {
      insightType: 'score',
      targetId: card.id,
      targetTitle: card.title,
      targetContext: {
        score: card.score,
        status: card.status,
        description: card.description,
        factors: card.factors,
      },
    };
  }

  return {
    insightType: 'kpi',
    targetId: card.id,
    targetTitle: card.title,
    targetContext: {
      main: card.main,
      unit: card.unit,
      ringLabel: card.ringLabel,
      ringSubtext: card.ringSubtext,
      targetLabel: card.targetLabel,
      statusLabel: card.statusLabel,
      trend: card.trend,
      trendDirection: card.trendDirection,
      rows: card.rows,
    },
  };
}

function buildInsightCacheKey(patientData, cardType, card) {
  const request = buildInsightRequest(cardType, card);
  const signature = hashString(JSON.stringify(request.targetContext));
  // Bump this version (v2 -> v3 ...) whenever the insight style/prompt changes so
  // the browser discards its old saved insights instead of showing stale text.
  return `wellpath-ai-insight:v6-useful:${patientData.name || 'patient'}:${cardType}:${card.id}:${signature}`;
}

function isCacheableInsight(text) {
  const value = String(text || '').trim();
  return (
    value.length >= 30 &&
    /[.!?]$/.test(value) &&
    !value.includes('No insight available right now') &&
    !value.includes("I'm having trouble")
  );
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildInsightPrefetchQueue(scores, kpis) {
  const queue = [];
  const used = new Set();
  const addCard = (type, card, delayBefore = 1800) => {
    if (!card) return;
    const key = `${type}:${card.id}`;
    if (used.has(key)) return;
    used.add(key);
    queue.push({ type, card, delayBefore });
  };

  addCard('score', scores.find((score) => score.id === 'wellpath'), 0);

  ['sleep', 'steps', 'heartRate', 'bloodPressure', 'sedentary', 'calories'].forEach((id) => {
    addCard('kpi', kpis.find((kpi) => kpi.id === id));
  });

  addCard('score', scores.find((score) => score.id === 'activity'), 6500);
  addCard('kpi', kpis.find((kpi) => kpi.id === 'exercise'));
  addCard('kpi', kpis.find((kpi) => kpi.id === 'activeMinutes'));
  addCard('score', scores.find((score) => score.id === 'consistency'));

  scores.forEach((score) => addCard('score', score));
  kpis.forEach((kpi) => addCard('kpi', kpi));

  return queue;
}

// A concrete "next move" per metric that needs attention.
const NEXT_MOVE_ACTIONS = {
  bloodPressure: 'This reading is above your personal target. Recheck it when calm, and review a repeated pattern with a clinician.',
  heartRate: 'Your resting heart rate is outside its usual range — recheck it when rested and watch for a lasting pattern.',
  sleep: 'Your sleep is short — start winding down 30 minutes earlier tonight and keep a steady bedtime.',
  steps: 'You are under your step goal — a brisk 10-minute walk is an easy way to close the gap.',
  exercise: 'Exercise is below target — fit in a short 20-minute session today.',
  activeMinutes: 'Active minutes are low — add a few short movement breaks through the day.',
  calories: 'Active calories are behind — a short walk or workout will help you catch up.',
  sedentary: 'You are sitting past your daily limit — stand and move for 3-5 minutes each hour.',
};

// Pick the single most important thing for this patient to act on right now,
// based on their real KPI data. Returns the action text and which card it maps to.
function buildBestNextMove(kpis = []) {
  const byId = (id) => kpis.find((kpi) => kpi.id === id);
  const isConcern = (id) => {
    const kpi = byId(id);
    return kpi && kpi.trendDirection === 'down';
  };

  // 1. Clinical concerns first (safety): elevated blood pressure, or a resting
  //    heart rate that is ABOVE baseline. A low resting HR is healthy, so it is
  //    not treated as a concern here.
  if (isConcern('bloodPressure')) return { kpiId: 'bloodPressure', text: NEXT_MOVE_ACTIONS.bloodPressure };
  const hr = byId('heartRate');
  if (hr && hr.trendDirection === 'down' && /above/i.test(hr.statusLabel || '')) {
    return { kpiId: 'heartRate', text: NEXT_MOVE_ACTIONS.heartRate };
  }

  // 2. The lifestyle metric furthest below its goal (progress = % of goal reached).
  const worst = ['sleep', 'steps', 'exercise', 'activeMinutes', 'calories']
    .map(byId)
    .filter((kpi) => kpi && Number.isFinite(kpi.progress) && kpi.progress < 85)
    .sort((a, b) => a.progress - b.progress)[0];
  if (worst) return { kpiId: worst.id, text: NEXT_MOVE_ACTIONS[worst.id] };

  // 3. Sitting too much (near or over the daily limit).
  if (isConcern('sedentary')) return { kpiId: 'sedentary', text: NEXT_MOVE_ACTIONS.sedentary };

  // 4. Everything on track.
  return { kpiId: null, text: 'You are on track across the board — keep your routine steady today.' };
}

export function PatientToday({
  patientId, patientData, scores, kpis, metrics, aiEnabled, onGenerateAiInsight,
  onOpenBreakdown, uiPreferences,
}) {
  const recovery = metrics.find((metric) => metric.id === 'recovery');
  const [expandedScore, setExpandedScore] = useState(null);
  const [expandedKpi, setExpandedKpi] = useState(null);
  const [cardInsights, setCardInsights] = useState({});
  const prefetchSignatureRef = useRef('');
  const inFlightInsightsRef = useRef(new Map());
  const focusedScore = scores.find((score) => score.id === expandedScore);
  const visibleIds = uiPreferences?.visibleMetricIds;
  const metricOrder = uiPreferences?.metricOrder;
  const visibleKpis = useMemo(() => {
    const allowed = visibleIds || kpis.map((kpi) => kpi.id);
    const order = metricOrder || kpis.map((kpi) => kpi.id);
    return order
      .map((id) => kpis.find((kpi) => kpi.id === id))
      .filter((kpi) => kpi && allowed.includes(kpi.id));
  }, [kpis, visibleIds, metricOrder]);
  const bestNextMove = buildBestNextMove(visibleKpis);
  const personalized = patientId ? getMemory(patientId).length > 0 : false;
  const kpiRows = [];

  // From a score's factor, jump to that metric's KPI card: collapse the score,
  // expand the matching KPI, and scroll it into view.
  const openKpiFromFactor = (kpiId) => {
    if (!kpiId) return;
    setExpandedScore(null);
    setExpandedKpi(kpiId);
    setTimeout(() => {
      document.querySelector('.expanded-kpi-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  };

  for (let index = 0; index < visibleKpis.length; index += 2) {
    kpiRows.push(visibleKpis.slice(index, index + 2));
  }

  useEffect(() => {
    setCardInsights({});
    inFlightInsightsRef.current.clear();
    prefetchSignatureRef.current = '';
  }, [patientData.name, aiEnabled]);

  const loadCardInsight = async (key, payload, cacheKey) => {
    if (!aiEnabled) return;
    const currentInsight = cardInsights[key];
    if (
      !onGenerateAiInsight ||
      currentInsight?.status === 'loading' ||
      (currentInsight?.status === 'ready' && isCacheableInsight(currentInsight.text))
    ) {
      return;
    }

    const cached = sessionStorage.getItem(cacheKey);
    if (isCacheableInsight(cached)) {
      setCardInsights((current) => ({
        ...current,
        [key]: { status: 'ready', text: cached },
      }));
      return;
    }

    setCardInsights((current) => ({
      ...current,
      [key]: { status: 'loading', text: 'Generating your AI insight...' },
    }));

    try {
      let insightPromise = inFlightInsightsRef.current.get(cacheKey);

      if (!insightPromise) {
        insightPromise = onGenerateAiInsight(payload);
        inFlightInsightsRef.current.set(cacheKey, insightPromise);
      }

      const text = await insightPromise;
      if (isCacheableInsight(text)) {
        sessionStorage.setItem(cacheKey, text);
      }
      setCardInsights((current) => ({
        ...current,
        [key]: { status: 'ready', text },
      }));
    } catch (error) {
      setCardInsights((current) => ({
        ...current,
        [key]: {
          status: 'error',
          text: "I'm having trouble generating this insight right now. Please try again later.",
        },
      }));
    } finally {
      inFlightInsightsRef.current.delete(cacheKey);
    }
  };

  useEffect(() => {
    if (!focusedScore) return;
    loadCardInsight(
      `score:${focusedScore.id}`,
      buildInsightRequest('score', focusedScore),
      buildInsightCacheKey(patientData, 'score', focusedScore)
    );
  }, [focusedScore?.id]);

  useEffect(() => {
    const kpi = kpis.find((item) => item.id === expandedKpi);
    if (!kpi) return;
    loadCardInsight(
      `kpi:${kpi.id}`,
      buildInsightRequest('kpi', kpi),
      buildInsightCacheKey(patientData, 'kpi', kpi)
    );
  }, [expandedKpi]);

  useEffect(() => {
    if (!aiEnabled || !onGenerateAiInsight) return;

    let cancelled = false;
    const cards = buildInsightPrefetchQueue(scores, visibleKpis);
    const prefetchSignature = cards
      .map(({ type, card }) => buildInsightCacheKey(patientData, type, card))
      .join('|');

    if (prefetchSignatureRef.current === prefetchSignature) return;
    prefetchSignatureRef.current = prefetchSignature;

    const primeInsights = async () => {
      for (let index = 0; index < cards.length; index += 1) {
        const { type, card } = cards[index];
        if (cancelled) return;
        if (card.delayBefore > 0) {
          await wait(card.delayBefore);
        }
        const key = `${type}:${card.id}`;
        const cacheKey = buildInsightCacheKey(patientData, type, card);
        await loadCardInsight(key, buildInsightRequest(type, card), cacheKey);
      }
    };

    primeInsights();
    return () => {
      cancelled = true;
    };
  }, [aiEnabled, patientData.name, scores, visibleKpis, onGenerateAiInsight]);

  return (
    <div className="mobile-flow">
      {uiPreferences?.sections?.wellnessScores !== false && <section className="patient-score-board" aria-label="Patient wellness scores">
        {focusedScore ? (
          <FocusedScoreCard
            score={focusedScore}
            aiEnabled={aiEnabled}
            personalized={personalized}
            aiInsight={cardInsights[`score:${focusedScore.id}`]?.text}
            aiStatus={cardInsights[`score:${focusedScore.id}`]?.status}
            onClose={() => setExpandedScore(null)}
            onFactorClick={openKpiFromFactor}
          />
        ) : (
          <div className="patient-score-grid">
            {scores.map((score) => (
              <ScoreCard
                key={score.id}
                score={score}
                onToggle={() => setExpandedScore(score.id)}
              />
            ))}
          </div>
        )}
      </section>}

      {uiPreferences?.sections?.nextMove !== false && (bestNextMove.kpiId ? (
        <button
          type="button"
          className="focus-strip focus-strip-actionable"
          onClick={() => {
            setExpandedKpi(bestNextMove.kpiId);
            setTimeout(() => {
              document.querySelector('.expanded-kpi-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 60);
          }}
        >
          <Target size={18} />
          <div>
            <strong>Best next move</strong>
            <p>{bestNextMove.text}</p>
          </div>
          <ChevronRight size={16} className="focus-strip-arrow" />
        </button>
      ) : (
        <section className="focus-strip">
          <Target size={18} />
          <div>
            <strong>Best next move</strong>
            <p>{bestNextMove.text}</p>
          </div>
        </section>
      ))}

      <div className="mobile-section-title">
        <div>
          <h2>Today&apos;s metrics</h2>
        </div>
        <button onClick={() => onOpenBreakdown(null)}>View all <ChevronRight size={15} /></button>
      </div>

      <div className="patient-kpi-grid">
        {kpiRows.map((row) => {
          const expandedInRow = row.find((kpi) => expandedKpi === kpi.id);
          const collapsedInRow = row.filter((kpi) => expandedKpi !== kpi.id);

          if (expandedInRow) {
            return (
              <React.Fragment key={row.map((kpi) => kpi.id).join('-')}>
                <ExpandedKpiCard
                  kpi={expandedInRow}
                  aiEnabled={aiEnabled}
                  personalized={personalized}
                  aiInsight={cardInsights[`kpi:${expandedInRow.id}`]?.text}
                  aiStatus={cardInsights[`kpi:${expandedInRow.id}`]?.status}
                  onClose={() => setExpandedKpi(null)}
                  onViewDetails={() => onOpenBreakdown(expandedInRow.id)}
                />
                {collapsedInRow.map((kpi) => (
                  <PatientKpiCard key={kpi.id} kpi={kpi} onOpen={() => setExpandedKpi(kpi.id)} />
                ))}
              </React.Fragment>
            );
          }

          return row.map((kpi) => (
            <PatientKpiCard key={kpi.id} kpi={kpi} onOpen={() => setExpandedKpi(kpi.id)} />
          ));
        })}
      </div>

      {aiEnabled && uiPreferences?.sections?.aiQuestions !== false && (
        <AiInsightBox
          title="Ask your AI"
          aiEnabled={aiEnabled}
          patientId={patientId}
          presets={[
            { label: 'What should I focus on?', question: "Looking at my recent data, what's the single most useful thing to focus on right now?" },
            { label: "How's my week going?", question: 'How are my main health habits trending this week?' },
            { label: 'Improve my sleep', question: 'What could I try to improve my sleep?' },
            { label: 'Choose an activity step', question: 'Which small activity step best fits my recent routine today?' },
          ]}
          onAsk={(question) => onGenerateAiInsight({
            insightType: 'daily',
            targetId: 'today',
            targetTitle: 'Today',
            targetContext: { userQuestion: question },
          })}
        />
      )}

      <div className="quiet-disclaimer"><ShieldCheck size={15} /> Lifestyle support only. Not diagnosis or medical advice.</div>
    </div>
  );
}

// ===== Sub-components for PatientToday =====
// Map a score status to a color class: green (good/excellent), yellow
// (moderate), red (needs attention), grey (missing data).
function statusToneClass(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('excellent') || s.includes('good')) return 'status-good';
  if (s.includes('moderate')) return 'status-moderate';
  if (s.includes('needs') || s.includes('attention')) return 'status-attention';
  return 'status-missing';
}

function ScoreCard({ score, onToggle }) {
  return (
    <button className={`patient-score-button ${statusToneClass(score.status)}`} onClick={onToggle} type="button" aria-expanded="false" style={{ '--score-color': score.color }}>
      <div className="score-ring" style={{ '--score': `${score.score ?? 0}%`, '--score-color': score.color }}>
        <strong>{score.score != null ? `${score.score}%` : '--'}</strong>
      </div>
      <span>{score.shortLabel}</span>
      <em>{score.status}</em>
    </button>
  );
}

// Maps a score factor label to the KPI card it corresponds to (some factors,
// like BMI and Age, have no matching KPI card and stay non-clickable).
const FACTOR_TO_KPI = {
  Sleep: 'sleep',
  Activity: 'steps',
  Steps: 'steps',
  'Heart health': 'heartRate',
  'Blood pressure': 'bloodPressure',
  'Sedentary time': 'sedentary',
  'Active minutes': 'activeMinutes',
  'Exercise minutes': 'exercise',
  'Calories burned': 'calories',
  'Sleep consistency': 'sleep',
  'Activity consistency': 'steps',
  'Exercise frequency consistency': 'exercise',
  'Sedentary-time consistency': 'sedentary',
};

function FocusedScoreCard({ score, aiEnabled, personalized, aiInsight, aiStatus, onClose, onFactorClick }) {
  if (!score) return null;
  const HeaderIcon = getScoreIcon(score.id);

  return (
    <article className={`focused-score-card bubble-anim ${statusToneClass(score.status)}`} onClick={onClose} style={{ '--score-color': score.color }}>
      <div className="focused-score-header">
        <span className="focused-score-icon"><HeaderIcon size={22} /></span>
        <h2>{score.title}</h2>
        <div className="focused-score-number">
          <strong>{score.score ?? '--'}</strong>
          <span>%</span>
        </div>
        <em>{score.status}</em>
        <button className="score-collapse-btn" onClick={(event) => {
          event.stopPropagation();
          onClose();
        }} type="button" aria-label="Collapse score details">
          <ChevronUp size={17} />
        </button>
      </div>

      <p className="focused-score-description">{score.description}</p>

      {aiEnabled && (
        <div className="score-ai-insight">
          <span className="score-ai-icon"><Sparkles size={22} /></span>
          <div>
            <strong>AI Insight</strong>
            <p className={aiStatus === 'loading' ? 'ai-loading-text' : ''}>{aiInsight || 'Generating your AI insight...'}</p>
            {personalized && aiStatus === 'ready' && <div className="ai-tailored-row"><PersonalizedHint /></div>}
          </div>
        </div>
      )}

      <div className="focused-score-factors">
        <span>Factors</span>
        <div className="score-factor-list">
          {score.factors.map((factor) => {
            const kpiId = FACTOR_TO_KPI[factor.label];
            const content = (
              <>
                <span className="score-factor-icon">{renderFactorIcon(factor.label)}</span>
                <div>
                  <span>{factor.label}</span>
                  <strong>{factor.value}</strong>
                </div>
              </>
            );
            return kpiId ? (
              <button
                type="button"
                className={`score-factor clickable ${factor.tone}`}
                key={factor.label}
                onClick={(event) => {
                  event.stopPropagation();
                  onFactorClick(kpiId);
                }}
              >
                {content}
              </button>
            ) : (
              <div className={`score-factor ${factor.tone}`} key={factor.label}>
                {content}
              </div>
            );
          })}
        </div>
      </div>

    </article>
  );
}

function getScoreIcon(scoreId) {
  if (scoreId === 'activity') return Footprints;
  if (scoreId === 'consistency') return CalendarCheck;
  return HeartPulse;
}

function renderFactorIcon(label) {
  const iconProps = { size: 16 };
  if (label.includes('Sleep')) return <Moon {...iconProps} />;
  if (label.includes('Activity') || label === 'Steps') return <Footprints {...iconProps} />;
  if (label.includes('Heart')) return <HeartPulse {...iconProps} />;
  if (label.includes('Blood')) return <Droplets {...iconProps} />;
  if (label.includes('Sedentary')) return <Armchair {...iconProps} />;
  if (label.includes('BMI') || label.includes('weight')) return <Scale {...iconProps} />;
  if (label.includes('Age')) return <CalendarCheck {...iconProps} />;
  if (label.includes('Active')) return <Activity {...iconProps} />;
  if (label.includes('Exercise')) return <Timer {...iconProps} />;
  if (label.includes('Calories')) return <Flame {...iconProps} />;
  return <Gauge {...iconProps} />;
}

function PatientKpiCard({ kpi, onOpen }) {
  const Icon = getKpiIcon(kpi.id);
  const TrendIcon = getTrendIcon(kpi.trendDirection, kpi.trend);
  const progress = kpi.progress ?? 0;

  return (
    <button className="patient-kpi-card" onClick={onOpen} type="button" style={{ '--kpi-color': kpi.color }}>
      <div className="patient-kpi-head">
        <div className="patient-kpi-title">
          <span><Icon size={16} /></span>
          <strong>{kpi.title}</strong>
        </div>
      </div>
      <div className="patient-kpi-body">
        <div className="patient-kpi-value">
          <b>{kpi.main}</b>
          <small>{kpi.ringSubtext || kpi.targetLabel || kpi.unit}</small>
        </div>
        <div className="collapsed-kpi-ring-wrap">
          <div className="kpi-progress-ring" style={{ '--score': `${progress}%`, '--ring-color': kpi.color }}>
            <strong>{kpi.ringLabel}</strong>
          </div>
        </div>
      </div>
      <div className="patient-kpi-foot">
        <span><TrendIcon size={12} />{kpi.trend}</span>
      </div>
    </button>
  );
}

function ExpandedKpiCard({ kpi, aiEnabled, personalized, aiInsight, aiStatus, onClose, onViewDetails }) {
  const Icon = getKpiIcon(kpi.id);
  const progress = kpi.progress ?? 0;

  return (
    <article className="expanded-kpi-card bubble-anim" style={{ '--kpi-color': kpi.color }} onClick={onClose}>
      <div className="expanded-kpi-header">
        <span><Icon size={20} /></span>
        <h3>{kpi.title}</h3>
        <em className={kpi.trend === 'Watch' ? 'watch' : ''}>{kpi.trend}</em>
        <button onClick={(event) => {
          event.stopPropagation();
          onClose();
        }} type="button" aria-label="Collapse KPI details">
          <ChevronUp size={18} />
        </button>
      </div>

      <div className="expanded-kpi-main">
        <div className="expanded-kpi-value">
          <strong>{kpi.main}</strong>
          <span>{kpi.unit}</span>
          <div className="kpi-progress-ring large" style={{ '--score': `${progress}%`, '--ring-color': kpi.color }}>
            <strong>{kpi.ringLabel}</strong>
          </div>
          <small>{kpi.ringSubtext || kpi.targetLabel}</small>
        </div>
        <div className="expanded-kpi-chart">
          <span>{kpi.chartLabel}</span>
          <BarTrend data={kpi.series} color={kpi.color} unit={kpi.unit} />
        </div>
      </div>

      <div className="expanded-kpi-stats">
        {kpi.rows.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      {aiEnabled && (
        <div className="expanded-kpi-insight">
          <Sparkles size={16} />
          <div>
            <strong>AI Insight</strong>
            <p className={aiStatus === 'loading' ? 'ai-loading-text' : ''}>{aiInsight || 'Generating your AI insight...'}</p>
            {personalized && aiStatus === 'ready' && <div className="ai-tailored-row"><PersonalizedHint /></div>}
          </div>
        </div>
      )}

      <button className="expanded-kpi-details-link" onClick={(event) => {
        event.stopPropagation();
        onViewDetails();
      }} type="button">
        View more details <ChevronRight size={15} />
      </button>
    </article>
  );
}

function MiniTrend({ data, color }) {
  const values = data.map((point) => point.value).filter((value) => value !== null);
  if (values.length < 2) return <div className="mini-trend missing">No trend</div>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const points = data.map((point, index) => {
    const value = point.value ?? min;
    const x = (index / Math.max(data.length - 1, 1)) * 100;
    const y = 48 - ((value - min) / (max - min || 1)) * 34;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg className="mini-trend" viewBox="0 0 100 54" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatBarValue(value, unit) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'N/A';
  const rounded = Math.abs(Number(value)) >= 100 ? Math.round(Number(value)) : Number(value).toFixed(1).replace(/\.0$/, '');
  if (unit === 'total sleep' || unit === 'today' || unit === 'current') return rounded;
  if (unit === 'mmHg') return rounded;
  return Number(rounded).toLocaleString();
}

// Round a rough interval to a tidy 1/2/5 × 10ⁿ step (e.g. 380 → 500, 1400 → 2000)
// so axis bounds land on readable numbers instead of raw data values.
function niceStep(rough) {
  if (!(rough > 0)) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const frac = rough / pow;
  const niceFrac = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return niceFrac * pow;
}

function BarTrend({ data, color, unit }) {
  const values = data.map((point) => point.value).filter((value) => value !== null);
  if (!values.length) return <div className="bar-trend-missing">Missing history</div>;
  const dataMax = Math.max(...values);
  const dataMin = Math.min(...values);
  const span = dataMax - dataMin;
  // Tighten the axis to the data so ordinary day-to-day variation is visible
  // (instead of anchoring to zero, which flattens everything into similar tall bars),
  // then snap the bounds to nice round numbers — floor the min, ceil the max — for a
  // slightly wider, more readable range. A genuine off-day (e.g. 10 steps) still drops
  // the bar to the floor because it pulls dataMin, and the whole range, down with it.
  const step = niceStep(span > 0 ? span / 3 : Math.max(Math.abs(dataMax) * 0.1, 1));
  const axisMin = Math.max(0, Math.floor(dataMin / step) * step);
  let axisMax = Math.ceil(dataMax / step) * step;
  if (axisMax <= axisMin) axisMax = axisMin + step;
  const axisMid = (axisMax + axisMin) / 2;
  const range = Math.max(axisMax - axisMin, 1);

  return (
    <div className="bar-trend">
      <div className="bar-trend-axis" aria-hidden="true">
        <span>{formatBarValue(axisMax, unit)}</span>
        <span>{formatBarValue(axisMid, unit)}</span>
        <span>{formatBarValue(axisMin, unit)}</span>
      </div>
      <div className="bar-trend-plot">
        <div className="bar-trend-gridlines" aria-hidden="true"><span /><span /><span /></div>
        {data.map((point, index) => {
          const hasValue = point.value !== null && point.value !== undefined;
          // Scale within the tightened [axisMin, axisMax] range across the full track,
          // so the baseline sits on the bottom axis line and differences read clearly.
          const height = hasValue ? Math.max(3, Math.min(100, ((Number(point.value) - axisMin) / range) * 100)) : 0;
          const valueLabel = formatBarValue(point.value, unit);
          return (
            <div key={`${point.label}-${index}`} className="bar-trend-item">
              <em>{valueLabel}</em>
              <span
                style={{ height: `${height}%`, background: color }}
                title={`${point.label}: ${valueLabel}${unit && !['today', 'current', 'total sleep'].includes(unit) ? ` ${unit}` : ''}`}
                aria-label={`${point.label}: ${valueLabel}`}
              />
              <small>{point.label}</small>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getKpiIcon(kpiId) {
  const iconMap = {
    steps: Footprints,
    sleep: Moon,
    recovery: ShieldCheck,
    heartRate: HeartPulse,
    exercise: Timer,
    activeMinutes: Activity,
    sedentary: Armchair,
    calories: Flame,
    bloodPressure: Droplets,
  };
  return iconMap[kpiId] || Gauge;
}

function getTrendIcon(direction, trend = '') {
  if (direction === 'up') return TrendingUp;
  if (direction === 'down') return TrendingDown;
  if (direction === 'neutral') return Minus;

  const normalized = String(trend).toLowerCase();
  if (
    normalized.includes('improved') ||
    normalized.includes('above weekly average') ||
    normalized.includes('goal exceeded') ||
    normalized.includes('goal nearly reached')
  ) {
    return TrendingUp;
  }
  if (
    normalized.includes('below') ||
    normalized.includes('above limit') ||
    normalized.includes('elevated') ||
    normalized.includes('review') ||
    normalized.includes('high') ||
    normalized.includes('check')
  ) {
    return TrendingDown;
  }
  if (
    normalized.includes('stable') ||
    normalized.includes('within') ||
    normalized.includes('baseline') ||
    normalized.includes('not enough') ||
    normalized.includes('not set') ||
    normalized.includes('missing')
  ) {
    return Minus;
  }
  return TrendingUp;
}

function AiPromptChips({ metric, aiEnabled, onAskAi, compact = false }) {
  return (
    <div className={compact ? 'ai-prompt-row compact' : 'ai-prompt-row'}>
      {metric.prompts.map((prompt) => (
        <button
          key={prompt.id}
          className="ai-prompt-chip"
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
