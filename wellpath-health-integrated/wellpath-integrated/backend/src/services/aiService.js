import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../../.env') });

// Support one or many Groq API keys. Each key from a SEPARATE Groq account has
// its own daily token quota, so listing several here roughly multiplies the
// budget. Multiple keys from the SAME account share one quota and won't help.
// Set either GROQ_API_KEYS (comma-separated) or a single GROQ_API_KEY.
function parseGroqApiKeys() {
  const raw = [
    ...(process.env.GROQ_API_KEYS ? process.env.GROQ_API_KEYS.split(',') : []),
    process.env.GROQ_API_KEY || '',
  ];
  return [...new Set(raw.map((key) => key.trim()).filter(Boolean))];
}

const groqApiKeys = parseGroqApiKeys();
const groqClients = groqApiKeys.map((apiKey) => new Groq({ apiKey }));

// Primary client kept for the general (non-targeted) insight path.
const groq = groqClients[0] || new Groq({ apiKey: process.env.GROQ_API_KEY });

// Fast non-reasoning instruct model. gpt-oss-20b is a reasoning model that
// spends its token budget on internal reasoning and often returns empty content
// for short insights, so we default to llama-3.1-8b-instant (higher free daily
// limit, faster, reliable). Override with GROQ_MODEL in .env if desired
// (e.g. llama-3.3-70b-versatile for higher quality).
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

// Rotates the starting key so load is spread across accounts when no specific
// key is preferred.
let clientCursor = 0;

// Route each insight type to a preferred key so score cards and KPI cards lean
// on separate accounts: scores -> key 1, KPIs -> key 2. With only one key
// configured, everything uses it. Failover still applies if the preferred key
// is rate-limited, so a user is never blocked while the other key has capacity.
function preferredClientIndex(insightType) {
  if (groqClients.length < 2) return 0;
  return insightType === 'score' ? 0 : 1;
}

/**
 * Create a chat completion, failing over to the next API key when one hits a
 * temporary/rate-limit error. Each request is fully self-contained, so keys
 * never need to coordinate — whichever key answers produces the same result.
 * When preferredIndex is given, that key is tried first (others as failover);
 * otherwise keys are used round-robin.
 */
async function createCompletionWithFailover(params, preferredIndex = null) {
  const clientCount = groqClients.length;
  if (clientCount === 0) {
    throw new Error('No Groq API key configured (set GROQ_API_KEY or GROQ_API_KEYS).');
  }

  const start = preferredIndex === null ? clientCursor : preferredIndex % clientCount;
  let lastError = null;
  for (let offset = 0; offset < clientCount; offset += 1) {
    const index = (start + offset) % clientCount;
    const client = groqClients[index];
    try {
      const completion = await client.chat.completions.create(params);
      // Advance the round-robin cursor only when no preferred key was requested.
      if (preferredIndex === null) {
        clientCursor = (index + 1) % clientCount;
      }
      return completion;
    } catch (error) {
      lastError = error;
      // Only try another key for rate-limit/temporary errors. A genuine bad
      // request (e.g. bad model name) would fail on every key, so bail early.
      if (!isTemporaryGroqError(error)) {
        throw error;
      }
      if (clientCount > 1) {
        console.warn(`Groq key ${index + 1}/${clientCount} rate-limited, trying next key.`);
      }
    }
  }

  throw lastError;
}

export const TARGETED_INSIGHT_FALLBACK = "I'm having trouble generating this insight right now. Please try again later.";

export function isCompleteInsightText(text) {
  const value = String(text || '').trim();
  if (value.length < 30) return false;
  return /[.!?]$/.test(value);
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isTemporaryGroqError(error) {
  const status = error?.status || error?.response?.status;
  const code = String(error?.code || error?.error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    code.includes('rate') ||
    message.includes('rate') ||
    message.includes('timeout') ||
    message.includes('temporarily')
  );
}

async function requestTargetedInsight(systemPrompt, userPayload, preferredIndex = null) {
  const retryDelays = [0, 1200, 2600];
  let lastError = null;

  for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
    if (retryDelays[attempt] > 0) {
      await wait(retryDelays[attempt]);
    }

    try {
      const completion = await createCompletionWithFailover({
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPayload,
          },
        ],
        model: GROQ_MODEL,
        temperature: 0.4,
        max_tokens: 400,
      }, preferredIndex);

      return completion.choices[0]?.message?.content?.trim() || '';
    } catch (error) {
      lastError = error;
      if (!isTemporaryGroqError(error) || attempt === retryDelays.length - 1) {
        throw error;
      }
      console.warn(`Retrying targeted Groq insight after temporary error (${attempt + 1}/${retryDelays.length - 1})`);
    }
  }

  throw lastError;
}

/**
 * Generate health insights and recommendations for a patient
 */
export async function generateHealthInsights(patientData, metrics, trends) {
  try {
    const systemPrompt = buildHealthPrompt(patientData, metrics, trends);
    
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: "Based on my health data, what insights and recommendations do you have for me today?"
        }
      ],
      model: GROQ_MODEL,
      temperature: 0.7,
      max_tokens: 500,
    });

    return completion.choices[0]?.message?.content || "No insights available at this time.";
  } catch (error) {
    console.error('Groq API Error:', error);
    return "I'm having trouble generating insights right now. Please try again later.";
  }
}

export async function generateTargetedDashboardInsight({
  patientData,
  latestMetrics,
  trends,
  insightType,
  targetId,
  targetTitle,
  targetContext,
}) {
  try {
    const isClinical = ['heartRate', 'bloodPressure'].includes(targetId);
    const isScore = insightType === 'score';
    const isMood = insightType === 'mood';
    const isPrediction = insightType === 'prediction';
    const isCycle = insightType === 'cycle';
    const systemPrompt = buildTargetedInsightPrompt({ patientData, latestMetrics, trends, isClinical, isScore, isMood, isPrediction, isCycle });
    const targetPayload = JSON.stringify({
      insightType,
      targetId,
      targetTitle,
      targetContext,
    });

    // Scores and KPIs prefer separate keys (with failover to the other).
    const preferredIndex = preferredClientIndex(insightType);

    let insight = await requestTargetedInsight(systemPrompt, targetPayload, preferredIndex);

    if (!isCompleteInsightText(insight)) {
      insight = await requestTargetedInsight(
        systemPrompt,
        `${targetPayload}\n\nReturn a complete, brief insight of 1-2 short sentences (about 20-30 words), straight to the point, that does not name the score/metric, its status word, or restate numbers on the card. End with punctuation.`,
        preferredIndex
      );
    }

    if (!isCompleteInsightText(insight)) {
      throw new Error('Groq returned an empty or incomplete targeted dashboard insight.');
    }

    return insight;
  } catch (error) {
    console.error('Groq targeted insight error:', error);
    return TARGETED_INSIGHT_FALLBACK;
  }
}

/**
 * Generate a concise, clinician-facing visit-prep briefing for a patient.
 *
 * Follows the app's core principle: the numbers, trends, and out-of-range flags
 * are computed deterministically upstream and passed in as `computed`; the model
 * only NARRATES them into a skimmable briefing. It never recalculates or invents
 * figures. Returns a structured object so the UI can render clean sections.
 */
export async function generateClinicianSummary({ patientData, computed, alerts }) {
  const system = `You are a clinical-support assistant preparing a WellPath provider for a patient visit. You are given metrics, trends, and flags that were ALREADY computed from the patient's data. Narrate them into a brief, skimmable briefing — do NOT recalculate, invent, or add any number that is not in the provided data.

Return ONLY a compact JSON object (no markdown, no commentary) with EXACTLY these keys:
{
  "headline": one plain sentence summarizing where this patient stands right now,
  "observations": array of 2-4 short strings — the most decision-relevant data-driven findings (trend direction and what changed, adherence to goals). Reference the actual signals in the data.
  "watch": array of 0-2 short strings — clinical items to keep an eye on (e.g. blood pressure or resting heart rate running outside the usual range, or an open alert). Empty array if nothing clinical stands out.
  "discuss": array of 1-3 short strings — concrete talking points or questions to raise with the patient at the visit.
}

Rules:
- Each string is one short line (roughly 8-18 words), plain professional language for a clinician, not the patient.
- Ground every point in the provided data. If a signal is flat or missing, do not manufacture a finding.
- This is decision SUPPORT, not a diagnosis or a treatment plan. Frame clinical items as "monitor" / "discuss" / "consider reviewing", never as definitive diagnosis or prescriptions.
- Prefer specifics ("resting HR up ~6 bpm over 3 weeks") over vague statements ("metrics changed").
- Do not address the patient in second person; write for the clinician (third person about the patient).`;

  const userPayload = JSON.stringify({
    patient: {
      name: patientData.name,
      ageRange: patientData.ageRange,
      gender: patientData.gender,
      primaryFocus: patientData.primaryFocus,
    },
    computed,
    openAlerts: Array.isArray(alerts) ? alerts : [],
  });

  const completion = await createCompletionWithFailover({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: `Prepare the visit briefing from this data:\n${userPayload}` },
    ],
    model: GROQ_MODEL,
    temperature: 0.3,
    max_tokens: 600,
  });

  const raw = completion.choices[0]?.message?.content || '';
  const obj = extractJsonObject(raw);
  const cleanList = (value, max) =>
    (Array.isArray(value) ? value : [])
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, max);

  const summary = {
    headline: String(obj.headline || '').trim(),
    observations: cleanList(obj.observations, 4),
    watch: cleanList(obj.watch, 2),
    discuss: cleanList(obj.discuss, 3),
  };

  if (!summary.headline || summary.observations.length === 0) {
    throw new Error('Groq returned an incomplete clinician summary.');
  }
  return summary;
}

/**
 * Draft a short, warm encouragement note a TRAINER can send to a patient.
 * The week's highlights are computed deterministically upstream and passed in as
 * `computed`; the model only turns them into a friendly, personal message that
 * the trainer will review and edit before saving. Returns a plain string.
 */
export async function generateTrainerNote({ patientData, computed }) {
  const system = `You are helping a fitness trainer write a short, warm encouragement note to their client. You are given the client's recent activity highlights, already computed from their data. Write the note the trainer would send.

Rules:
- 2-3 sentences, ~35-55 words. Warm, personal, motivating — like a real coach who has seen the week's data.
- Address the client by first name, in second person ("you"/"your").
- Anchor the encouragement in ONE real, specific win or effort from the data (e.g. steps trending up, hitting most of a goal, a consistent habit). Do not invent numbers not in the data.
- End with one gentle, doable nudge for the week ahead that fits their primary focus.
- Encouraging and supportive only. No medical, clinical, or diagnostic language. Do not mention blood pressure, heart rate readings, or any condition. Keep it about movement, effort, and consistency.
- Write ONLY the note text — no preamble, no quotation marks, no signature.`;

  const userPayload = JSON.stringify({
    client: {
      name: (patientData.name || '').split(' ')[0] || patientData.name,
      primaryFocus: patientData.primaryFocus,
    },
    highlights: computed,
  });

  const note = await requestTargetedInsight(system, `Client activity highlights:\n${userPayload}`);
  const clean = String(note || '').trim().replace(/^["']|["']$/g, '').trim();
  if (clean.length < 20) {
    throw new Error('Groq returned an empty trainer note.');
  }
  return clean;
}

// Pull the first JSON object out of a model response (handles stray prose / fences).
function extractJsonObject(text) {
  const s = String(text || '');
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a < 0 || b < 0 || b < a) throw new Error('No JSON object in model response');
  return JSON.parse(s.slice(a, b + 1));
}

/**
 * Estimate nutrition for a free-text food/meal description via the LLM.
 * Returns approximate per-item totals; the caller sums them for the day.
 */
export async function estimateFoodNutrition(foodText) {
  const system = `You are a nutrition estimator. Given a short description of a food or meal, estimate its nutrition for the amount described. If no quantity is given, assume ONE typical serving.
Return ONLY a compact JSON object (no markdown, no commentary, no units inside values) with EXACTLY these keys:
{"name": short label of the food, "kcal": number, "protein_g": number, "carbs_g": number, "sugar_g": number, "fibre_g": number, "fat_g": number, "satfat_g": number, "sodium_mg": number}
All nutrient values are plain numbers (grams, except kcal and sodium_mg). Estimates are approximate.`;

  const completion = await createCompletionWithFailover({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: `Estimate nutrition for: ${foodText}` },
    ],
    model: GROQ_MODEL,
    temperature: 0.2,
    max_tokens: 220,
  });

  const raw = completion.choices[0]?.message?.content || '';
  const obj = extractJsonObject(raw);
  const num = (v, lo, hi) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : 0;
  };
  return {
    name: String(obj.name || foodText).slice(0, 60),
    kcal: Math.round(num(obj.kcal, 0, 4000)),
    protein: num(obj.protein_g ?? obj.protein, 0, 500),
    carbs: num(obj.carbs_g ?? obj.carbs, 0, 900),
    sugar: num(obj.sugar_g ?? obj.sugar, 0, 600),
    fibre: num(obj.fibre_g ?? obj.fibre ?? obj.fiber_g ?? obj.fiber, 0, 150),
    fat: num(obj.fat_g ?? obj.fat, 0, 500),
    satfat: num(obj.satfat_g ?? obj.satfat ?? obj.saturated_fat_g, 0, 300),
    sodium: Math.round(num(obj.sodium_mg ?? obj.sodium, 0, 20000)),
  };
}

/**
 * Build the system prompt for health analysis
 */
function buildHealthPrompt(patientData, metrics, trends) {
  const latest = metrics[metrics.length - 1] || {};
  const average = calculateAverages(trends);
  
  return `
You are a supportive, knowledgeable health and wellness coach. Your role is to analyze health data and provide helpful, encouraging lifestyle recommendations. 

IMPORTANT RULES:
- NEVER diagnose medical conditions
- NEVER give medical advice, treatment instructions, medication, or dosing guidance
- ALWAYS encourage users to consult healthcare professionals for medical concerns
- Focus on lifestyle habits: sleep, exercise, nutrition, stress management, and activity
- Keep responses encouraging and actionable (2-4 sentences)
- Use simple, friendly language
- Be genuinely useful, not generic: tie each recommendation to the specific pattern in THIS person's data, make the action concrete and anchored to a cue or time of day, and add a brief reason it helps. Avoid advice that could apply to anyone.

PATIENT PROFILE:
- Name: ${patientData.name || 'User'}
- Age range: ${patientData.ageRange || 'Adult'}
- Primary focus: ${patientData.primaryFocus || 'Overall wellness'}

TODAY'S METRICS:
- Steps: ${latest.steps || 'N/A'}
- Sleep: ${latest.sleep || 'N/A'} hours
- Heart Rate: ${latest.hr || 'N/A'} bpm
- Exercise: ${latest.exercise || 'N/A'} minutes
- BMI: ${latest.bmi || 'N/A'}
- Stress Level: ${latest.stress || 'N/A'}/10
- Diet Score: ${latest.diet || 'N/A'}/10

RECENT TRENDS (${trends?.length || 0} days available):
- Average Steps: ${average.steps || 'N/A'}
- Average Sleep: ${average.sleep || 'N/A'} hours
- Average Heart Rate: ${average.hr || 'N/A'} bpm
- Average Exercise: ${average.exercise || 'N/A'} minutes
- Trend Direction: ${getTrendDirection(trends)}

If a value is N/A or missing, say that more data is needed for that part instead of guessing. Based on the available data, call out the 1-2 patterns that matter most and give a specific, actionable lifestyle recommendation for each — anchored to a cue or time of day, with a brief reason it helps. Keep it encouraging and focused on small, achievable improvements that build on what they already do.
`;
}

// Drop null/undefined fields so we don't spend tokens sending empty values.
function compactRecord(record) {
  if (!record || typeof record !== 'object') return {};
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== null && value !== undefined && value !== '')
  );
}

function buildTargetedInsightPrompt({ patientData, latestMetrics, trends, isClinical, isScore, isMood, isPrediction, isCycle }) {
  const compactLatest = compactRecord(latestMetrics);
  const compactTrends = Array.isArray(trends) ? trends.map(compactRecord) : [];

  return `
You are the WellPath AI insight writer for a patient dashboard.

Write 1-2 sentences, roughly 25-40 words. Be skimmable and specific — no opening summary, no filler.
Speak directly to the user using "you" and "your".
Make every insight genuinely useful, not generic. First, name the specific pattern in THEIR data that actually matters here (e.g. "your bedtime keeps drifting later", "you sit for long unbroken stretches in the afternoon"). Then give ONE concrete, realistic action they could start today — tied to a cue or time of day — and, when it fits in the word budget, a short reason it helps so it teaches rather than just tells. Avoid advice so generic it could apply to anyone.
Never restate the score or metric's name or its status word (do not write "WellPath Score", "Moderate", "Good", "Excellent", or "Needs Attention"). Lead with the substance.
Do NOT restate numbers the card already shows (its current value, goal/target/limit, or 7-day average) — the user can already see those. Instead say what the data means and give the next step. You may cite a less-obvious derived figure (such as a change from baseline or a weekly total) only if it genuinely adds insight.
Do not start with "AI Insight".
Do not mention that you are an AI model.
Do not invent missing values. If key data is missing, say more data is needed.
End with a complete sentence and punctuation.
Use the provided patient data and target context.

Safety:
- Do not diagnose medical conditions.
- Do not give medical treatment instructions.
- Keep guidance lifestyle-focused and low-risk.
- Include clinician review only for repeated, persistent, unusual, or elevated clinical patterns.

For lifestyle KPIs such as steps, sleep, exercise, active minutes, sedentary time, and calories:
- If there is room to improve, name what the data shows, then give ONE concrete action anchored to a cue or time of day (e.g. a 10-minute walk after lunch, a 30-minute wind-down before bed, a 3-5 minute standing break each hour), plus a short reason it helps.
- If it is already going well, say specifically what is working and the one habit most worth protecting to keep it there.
- Prefer actions that build on what they already do rather than a generic prescription.

For clinical/range KPIs such as resting heart rate and blood pressure:
- Do not frame the metric as something the user can directly "improve" with a quick tip.
- Briefly note whether it is steady or shifting versus the normal range, then give one monitoring-oriented step (recheck under similar conditions, or review a persistent pattern with a clinician).

For mood analysis (the target context contains daily mood ratings 1-5 alongside the health data, plus precomputed mood-vs-metric correlations):
- Identify which physiological factor(s) most plausibly moved their mood — lean on the provided correlations, do not invent links.
- Allow 2-3 sentences (up to ~45 words) for this type only. Name the pattern in plain words (e.g. "your mood dips after short-sleep nights"), then give ONE concrete action targeting the strongest factor.
- Mood is subjective — say "tends to" or "often", never claim certainty, and never mention depression or any diagnosis.

For predictive analysis (the target context contains per-metric trend slopes and projected next-week values computed from the last 30 days):
- Describe where their habits are heading IF the current pattern holds — always conditional ("if this continues", "at this pace"), never certain.
- Allow 2-3 sentences (up to ~50 words). Pick the 1-2 most consequential projections (improving or worsening), say what next week likely looks like, and give ONE preventive or reinforcing action.
- Do not predict medical events, diagnoses, or specific clinical outcomes — only habit and metric trends.

For cycle analysis (the target context contains cycle statistics computed from the patient's own logged period history, plus how their recent physiology compares with their baseline):
- The predicted date and how soon it is are ALREADY calculated (see predictedStart and daysUntilPredicted). Never recalculate or invent a different date or day count. If you mention how soon it is, use the daysUntilPredicted value exactly — do not state any other number of days.
- The estimate is smarter than a fixed monthly interval: the recency weighting was FITTED to this person's own cycle history (see fittedRecencyWeight / modelAccuracyDays). Explain in plain words that the estimate is tuned to their own history and typically accurate within a couple of days.
- Physiological adjustment: check "signalAdjustmentDays". ONLY if it is non-zero may you say physiology moved the date (e.g. a raised resting heart rate and shorter sleep pulled it earlier). If signalAdjustmentDays is 0 or null, do NOT claim any physiological adjustment — say the estimate rests on their cycle history and that recent signals are near their baseline.
- Treat the physiological signals as soft corroboration only. Say "consistent with" or "often", never state it as proof.
- Allow 2-3 sentences (up to ~45 words).
- If their cycles are flagged irregular, gently suggest tracking a few more and mentioning persistent irregularity to a clinician.
- Never diagnose (no PCOS, endometriosis, pregnancy, or any condition). Never give contraception or fertility advice, and never imply the estimate can be used to prevent or achieve pregnancy.

For an overall score (WellPath, Activity, or Consistency):
- Do NOT write the word "score", and do not write the names WellPath, Activity, or Consistency. Do not restate the numeric value or its status word.
- Read the provided overall value and the individual factor values, and match your tone to how they are actually doing:
  - Doing well (overall around 90+ out of 100, or nearly every factor strong): lead with genuine, specific encouragement. Name the 1-2 habits carrying them and tell them what to keep doing. Do not invent problems; at most add one small optional refinement.
  - Otherwise: name the 1-2 weakest habits holding them back and give one concrete, specific action.
- RIGHT (doing well): "Your steady sleep and daily movement are really paying off — keep protecting that consistent bedtime and you'll hold this."
- RIGHT (needs work): "Your short sleep and long sitting time are the biggest drags right now — start with a 30-minute wind-down before a steady, earlier bedtime."
- WRONG: "Your WellPath Score is moderate; improving your sleep consistency will boost it."

PATIENT:
- Name: ${patientData.name || 'User'}
- Age range: ${patientData.ageRange || 'Adult'}
- Primary focus: ${patientData.primaryFocus || 'Overall wellness'}

LATEST DATABASE METRICS:
${JSON.stringify(compactLatest)}

RECENT TREND DATA:
${JSON.stringify(compactTrends)}

TYPE:
${isCycle ? 'Cycle analysis — interpret the already-calculated prediction and corroborating physiological signals; never recalculate the date, never diagnose' : isPrediction ? 'Predictive analysis — conditional forecast of where current habit trends are heading, with one preventive action' : isMood ? 'Mood analysis — explain which physiological factors most likely affect their mood, using the provided correlations' : isScore ? 'Overall score — skip any summary; target the weakest factors with one concrete action' : isClinical ? 'Clinical/range KPI' : 'Lifestyle KPI'}
`;
}

/**
 * Calculate averages from trend data
 */
function calculateAverages(metrics) {
  if (!metrics || metrics.length === 0) return {};
  
  const sum = metrics.reduce((acc, day) => ({
    steps: (acc.steps || 0) + (day.steps || 0),
    sleep: (acc.sleep || 0) + (day.sleep || 0),
    hr: (acc.hr || 0) + (day.hr || 0),
    exercise: (acc.exercise || 0) + (day.exercise || 0),
  }), {});
  
  const count = metrics.length;
  return {
    steps: Math.round(sum.steps / count),
    sleep: Math.round((sum.sleep / count) * 10) / 10,
    hr: Math.round(sum.hr / count),
    exercise: Math.round(sum.exercise / count),
  };
}

/**
 * Determine trend direction
 */
function getTrendDirection(trends) {
  if (!trends || trends.length < 3) return 'stable';
  
  const recent = trends.slice(-3);
  const first = recent[0];
  const last = recent[recent.length - 1];
  
  const stepsChange = ((last.steps - first.steps) / first.steps) * 100;
  const sleepChange = ((last.sleep - first.sleep) / first.sleep) * 100;
  
  if (stepsChange > 5 && sleepChange > 3) return 'improving';
  if (stepsChange < -5 || sleepChange < -3) return 'declining';
  return 'stable';
}
