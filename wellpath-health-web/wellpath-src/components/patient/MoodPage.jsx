import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, SmilePlus, ShieldCheck } from 'lucide-react';
import { api } from '../../api';

const MOOD_OPTIONS = [
  { value: 1, emoji: '😞', label: 'Rough' },
  { value: 2, emoji: '🙁', label: 'Low' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
];

const MOOD_COLORS = { 1: '#ef5350', 2: '#f59e0b', 3: '#d6c62f', 4: '#7bc96f', 5: '#2fbf71' };

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const mean = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);

function pearson(pairs) {
  if (pairs.length < 5) return 0;
  const ma = mean(pairs.map((p) => p[0]));
  const mb = mean(pairs.map((p) => p[1]));
  let n = 0; let da = 0; let db = 0;
  for (const [x, y] of pairs) { const dx = x - ma; const dy = y - mb; n += dx * dy; da += dx * dx; db += dy * dy; }
  const den = Math.sqrt(da * db);
  return den ? n / den : 0;
}

const dateKey = (value) => String(value).slice(0, 10);

// Correlate mood with same-day physiology. Factors phrased for r > 0 meaning
// "more of this goes with better mood".
const MOOD_FACTORS = [
  { key: 'sleep', label: 'Sleep', pos: 'You tend to feel better after nights with more sleep.', neg: 'Your mood tends to dip after longer sleep — worth watching oversleeping.' },
  { key: 'activeMinutes', label: 'Active minutes', pos: 'More active days usually come with a better mood.', neg: 'Very active days tend to coincide with lower moods — pacing may help.' },
  { key: 'steps', label: 'Steps', pos: 'Days with more steps tend to be better-mood days.', neg: 'Higher-step days tend to be lower-mood days for you.' },
  { key: 'sedentaryHours', label: 'Sitting time', pos: 'More sitting oddly lines up with better moods in your data.', neg: 'Long sitting days tend to be your lower-mood days.' },
  { key: 'hr', label: 'Resting heart rate', pos: 'Higher resting heart rate days line up with better moods in your data.', neg: 'Days with a raised resting heart rate tend to be lower-mood days.' },
];

function buildMoodDrivers(moodLog, healthLog) {
  const healthByDate = new Map(healthLog.map((d) => [dateKey(d.recordDate || d.day), d]));
  const drivers = [];
  for (const factor of MOOD_FACTORS) {
    const pairs = moodLog
      .map((m) => {
        const day = healthByDate.get(dateKey(m.date));
        return day ? [num(day[factor.key]), num(m.mood)] : null;
      })
      .filter((p) => p && p[0] !== null && p[1] !== null);
    const r = pearson(pairs);
    if (Math.abs(r) < 0.3) continue;
    drivers.push({
      label: factor.label,
      r,
      strength: Math.abs(r) >= 0.55 ? 'strong' : Math.abs(r) >= 0.4 ? 'clear' : 'mild',
      text: r >= 0 ? factor.pos : factor.neg,
    });
  }
  return drivers.sort((a, b) => Math.abs(b.r) - Math.abs(a.r)).slice(0, 3);
}

export function MoodPage({ patientId, healthLog = [], aiEnabled, onGenerateAiInsight }) {
  const [moodLog, setMoodLog] = useState([]);
  const [todayMood, setTodayMood] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState('');
  const [aiText, setAiText] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    let cancelled = false;
    api.getMoodLog(patientId)
      .then((rows) => {
        if (cancelled) return;
        setMoodLog(rows);
        const todays = rows.find((r) => dateKey(r.date) === today);
        if (todays) setTodayMood(todays.mood);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [patientId]);

  const drivers = useMemo(() => buildMoodDrivers(moodLog, healthLog), [moodLog, healthLog]);
  const recent = moodLog.slice(-14);
  const avgMood = mean(moodLog.map((m) => num(m.mood)).filter((v) => v !== null));

  const saveMood = async (value) => {
    setTodayMood(value);
    setSaving(true);
    setSaveNote('');
    try {
      await api.logMood(patientId, value, today);
      setMoodLog((current) => {
        const rest = current.filter((m) => dateKey(m.date) !== today);
        return [...rest, { date: today, mood: value }];
      });
      setSaveNote('Saved for today.');
    } catch (error) {
      setSaveNote('Could not save — try again.');
    } finally {
      setSaving(false);
    }
  };

  const askAiAboutMood = async () => {
    if (!aiEnabled || !onGenerateAiInsight || aiLoading) return;
    setAiLoading(true);
    setAiText(null);
    try {
      const text = await onGenerateAiInsight({
        insightType: 'mood',
        targetId: 'mood',
        targetTitle: 'Mood drivers',
        targetContext: {
          recentMoods: moodLog.slice(-14).map((m) => ({ date: dateKey(m.date), mood: m.mood })),
          averageMood: avgMood != null ? Math.round(avgMood * 10) / 10 : null,
          correlations: drivers.map((d) => ({ factor: d.label, r: Math.round(d.r * 100) / 100, strength: d.strength })),
        },
      });
      setAiText(text);
    } catch (error) {
      setAiText("I'm having trouble analyzing your mood right now. Please try again later.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="mobile-flow">
      <div className="mobile-section-title">
        <div>
          <span>Daily check-in</span>
          <h2>Mood</h2>
        </div>
        <SmilePlus size={19} />
      </div>

      <section className="mood-entry-card">
        <strong>How are you feeling today?</strong>
        <div className="mood-options">
          {MOOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={todayMood === option.value ? 'mood-option selected' : 'mood-option'}
              style={{ '--mood-color': MOOD_COLORS[option.value] }}
              onClick={() => saveMood(option.value)}
              disabled={saving}
            >
              <span className="mood-emoji">{option.emoji}</span>
              <span className="mood-label">{option.label}</span>
            </button>
          ))}
        </div>
        {saveNote && <small className="mood-save-note">{saveNote}</small>}
      </section>

      <section className="mood-history-card">
        <div className="mood-history-head">
          <strong>Last two weeks</strong>
          {avgMood != null && <em>{(Math.round(avgMood * 10) / 10).toFixed(1)} avg</em>}
        </div>
        {recent.length ? (
          <MoodChart entries={recent} />
        ) : (
          <p className="mood-empty">No mood entries yet — log today above to start building your history.</p>
        )}
      </section>

      <div className="mobile-section-title">
        <div>
          <span>What moves your mood</span>
          <h2>Patterns</h2>
        </div>
      </div>

      <section className="mood-drivers">
        {drivers.length ? (
          drivers.map((d) => (
            <div className="connection-item" key={d.label}>
              <Sparkles size={15} />
              <p>{d.text}</p>
              <em className={`connection-strength ${d.strength}`}>{d.strength} link</em>
            </div>
          ))
        ) : (
          <div className="connection-item">
            <p>Not enough overlapping mood and health data yet — keep logging daily and patterns will appear here.</p>
          </div>
        )}
      </section>

      <section className="score-ai-insight mood-ai-card">
        <span className="score-ai-icon"><Sparkles size={22} /></span>
        <div>
          <strong>AI mood analysis</strong>
          {aiText ? (
            <p>{aiText}</p>
          ) : aiLoading ? (
            <p className="ai-loading-text">Looking at your mood and health patterns...</p>
          ) : (
            <p>{aiEnabled ? 'Ask the AI what in your health data may be affecting your mood.' : 'AI is off in Settings.'}</p>
          )}
          {aiEnabled && !aiLoading && (
            <button type="button" className="mood-ai-btn" onClick={askAiAboutMood}>
              {aiText ? 'Analyze again' : 'Analyze my mood'}
            </button>
          )}
        </div>
      </section>

      <div className="quiet-disclaimer"><ShieldCheck size={15} /> Mood tracking is for self-reflection only. Not a mental-health assessment.</div>
    </div>
  );
}

// 14-day mood chart: 1-5 scale on the left, gridlines, color-coded bars, and a
// hover/tap tooltip with the emoji, score, and date per day.
function MoodChart({ entries }) {
  const [hover, setHover] = useState(null);

  return (
    <div className="mood-chart">
      <div className="mood-chart-axis" aria-hidden="true">
        {[5, 4, 3, 2, 1].map((v) => <span key={v}>{v}</span>)}
      </div>
      <div className="mood-chart-plot">
        <div className="mood-chart-grid" aria-hidden="true">
          {[5, 4, 3, 2, 1].map((v) => <span key={v} />)}
        </div>
        <div className="mood-chart-bars">
          {entries.map((m, index) => {
            const value = Number(m.mood);
            const option = MOOD_OPTIONS.find((o) => o.value === value);
            const d = new Date(m.date);
            const dayLabel = Number.isNaN(d.getTime())
              ? ''
              : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            return (
              <button
                type="button"
                className={hover === index ? 'mood-chart-day active' : 'mood-chart-day'}
                key={dateKey(m.date)}
                onMouseEnter={() => setHover(index)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(index)}
                onBlur={() => setHover(null)}
                aria-label={`${dayLabel}: mood ${value} of 5 (${option?.label ?? ''})`}
              >
                <span
                  className="mood-chart-bar"
                  style={{
                    // Map the 1-5 scale onto the track so a mood of 1 rests on the
                    // "1" baseline and 5 reaches the top (keep a sliver for the low end).
                    height: `${Math.max(6, ((value - 1) / 4) * 100)}%`,
                    background: MOOD_COLORS[value] || 'var(--muted)',
                  }}
                />
                <small>{Number.isNaN(d.getTime()) ? '' : d.getDate()}</small>
                {hover === index && (
                  <span className={`mood-chart-tooltip bubble-anim ${index < 2 ? 'align-left' : index > entries.length - 3 ? 'align-right' : ''}`}>
                    <strong>{option?.emoji} {value}/5</strong>
                    <em>{option?.label} · {dayLabel}</em>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
