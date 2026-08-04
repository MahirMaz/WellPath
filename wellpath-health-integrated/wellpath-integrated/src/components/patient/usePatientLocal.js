import { useEffect, useState } from 'react';

// Small helpers for patient-scoped data kept in localStorage (exercise log,
// weight log, home BP readings, appointment notes). No backend needed — these
// are the patient's own self-tracked entries for the demo.
const storeKey = (patientId, name) => `wellpath.${name}.${patientId}`;

// A list of entries (newest first). Returns [items, { add, remove, set }].
export function usePatientList(patientId, name) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!patientId) return;
    try {
      const raw = localStorage.getItem(storeKey(patientId, name));
      setItems(raw ? JSON.parse(raw) : []);
    } catch {
      setItems([]);
    }
  }, [patientId, name]);

  const persist = (list) => {
    setItems(list);
    try {
      localStorage.setItem(storeKey(patientId, name), JSON.stringify(list));
    } catch {
      /* storage unavailable — keep in memory only */
    }
  };

  return [
    items,
    {
      add: (entry) => persist([{ id: Date.now(), ...entry }, ...items]),
      remove: (id) => persist(items.filter((x) => x.id !== id)),
      set: persist,
    },
  ];
}

// A single free-text field (e.g. a notepad). Returns [text, save].
export function usePatientText(patientId, name) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (!patientId) return;
    try {
      setText(localStorage.getItem(storeKey(patientId, name)) || '');
    } catch {
      setText('');
    }
  }, [patientId, name]);

  const save = (value) => {
    setText(value);
    try {
      localStorage.setItem(storeKey(patientId, name), value);
    } catch {
      /* ignore */
    }
  };

  return [text, save];
}
