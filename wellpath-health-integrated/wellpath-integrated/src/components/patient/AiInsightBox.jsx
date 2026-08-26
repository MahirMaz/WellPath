import React, { useState } from 'react';
import { Sparkles, ArrowUp, Check } from 'lucide-react';
import { getMemory, learnFromMessage } from './aiMemory.js';

export function PersonalizedHint() {
  return (
    <span className="ai-tailored"><Sparkles size={11} /> Tailored to what you&apos;ve shared</span>
  );
}

export function AiInsightBox({
  title = 'AI insight',
  aiEnabled = true,
  presets = [],
  onAsk,
  patientId = null,
  disclaimer = null,
}) {
  const [answer, setAnswer] = useState(null);
  const [asked, setAsked] = useState(null);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [learned, setLearned] = useState(false);

  const run = async (question, label, learn = false) => {
    if (!aiEnabled || loading || !question.trim() || !onAsk) return;
    setLoading(true);
    setAsked(label || question.trim());
    setAnswer(null);
    setLearned(false);
    try {
      setAnswer(await onAsk(question.trim()));
      if (learn && patientId) {
        const before = getMemory(patientId).length;
        learnFromMessage(patientId, question.trim()).then((mem) => {
          if (mem.length > before) setLearned(true);
        });
      }
    } catch {
      setAnswer("I'm having trouble answering that right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    const q = text.trim();
    if (!q) return;
    run(q, q, true);
    setText('');
  };

  return (
    <section className="aibox">
      <div className="aibox-head">
        <span className="aibox-icon"><Sparkles size={17} /></span>
        <strong>{title}</strong>
      </div>

      {!aiEnabled ? (
        <p className="aibox-off">AI is off in Settings.</p>
      ) : (
        <>
          {(loading || answer) && (
            <div className="aibox-answer">
              {asked && <span className="aibox-q">{asked}</span>}
              {loading
                ? <p className="ai-loading-text">Thinking…</p>
                : <p>{answer}</p>}
              {!loading && answer && patientId && getMemory(patientId).length > 0 && (
                <div className="aibox-tailored"><PersonalizedHint /></div>
              )}
            </div>
          )}

          {learned && (
            <div className="aibox-learned"><Check size={13} /> Noted for next time</div>
          )}

          {presets.length > 0 && (
            <div className="aibox-presets">
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="aibox-chip"
                  disabled={loading}
                  onClick={() => run(p.question, p.label)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          <form className="aibox-ask" onSubmit={submit}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ask your own question…"
              disabled={loading}
            />
            <button type="submit" className="aibox-send" disabled={loading || !text.trim()} aria-label="Ask">
              <ArrowUp size={17} />
            </button>
          </form>

          {disclaimer && <p className="aibox-disclaimer">{disclaimer}</p>}
        </>
      )}
    </section>
  );
}
