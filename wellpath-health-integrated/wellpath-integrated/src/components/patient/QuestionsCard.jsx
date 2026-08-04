import React, { useState } from 'react';
import { HelpCircle, Plus, Trash2, Check } from 'lucide-react';
import { usePatientList } from './usePatientLocal.js';

// A small add-to-list card for "questions to bring to your trainer/clinician".
// Patient-authored only: type a question, add it, check it off once asked, or
// remove it. Persisted locally per patient. No advice from the app itself.
export function QuestionsCard({ patientId, name, title, placeholder }) {
  const [items, actions] = usePatientList(patientId, name);
  const [text, setText] = useState('');

  const add = (e) => {
    e.preventDefault();
    const q = text.trim();
    if (!q) return;
    actions.add({ text: q, asked: false });
    setText('');
  };

  const toggle = (id) =>
    actions.set(items.map((x) => (x.id === id ? { ...x, asked: !x.asked } : x)));

  const open = items.filter((x) => !x.asked).length;

  return (
    <section className="support-card">
      <div className="careteam-goals-head">
        <h3><HelpCircle size={18} /> {title}</h3>
        {items.length > 0 && <span className="careteam-goal-count">{open} to ask</span>}
      </div>
      <form className="goal-form" onSubmit={add}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
        <button className="secondary-btn" type="submit"><Plus size={16} /> Add</button>
      </form>
      <div className="goal-list">
        {items.length === 0 && (
          <p className="careteam-muted">No questions yet — add one to bring to your next visit.</p>
        )}
        {items.map((q) => (
          <div key={q.id} className={q.asked ? 'complete-goal' : ''}>
            <button onClick={() => toggle(q.id)} aria-label="Mark asked"><Check size={18} /></button>
            <span>{q.text}</span>
            <em>{q.asked ? 'Asked' : 'To ask'}</em>
            <button onClick={() => actions.remove(q.id)} aria-label="Remove question"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </section>
  );
}
