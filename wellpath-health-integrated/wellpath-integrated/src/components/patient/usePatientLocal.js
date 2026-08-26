import { useEffect, useState } from 'react';

const storeKey = (patientId, name) => `wellpath.${name}.${patientId}`;

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
    }
  };

  return [text, save];
}
