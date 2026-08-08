import { api } from '../../api';

// A small, transparent personalization memory kept per patient (on this device).
// It holds durable facts the user has shared so the AI can tailor every insight.
// Nothing here is medical record — it's the "things you told your coach" list.
const key = (patientId) => `wellpath.aimemory.${patientId}`;
const MAX_FACTS = 20;

export function getMemory(patientId) {
  if (!patientId) return [];
  try {
    const raw = localStorage.getItem(key(patientId));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function setMemory(patientId, facts) {
  try {
    localStorage.setItem(key(patientId), JSON.stringify(facts.slice(-MAX_FACTS)));
  } catch {
    /* storage unavailable */
  }
}

export function removeFact(patientId, fact) {
  const next = getMemory(patientId).filter((f) => f !== fact);
  setMemory(patientId, next);
  return next;
}

export function addFact(patientId, fact) {
  const s = String(fact || '').trim();
  if (!s) return getMemory(patientId);
  const existing = getMemory(patientId);
  if (existing.some((f) => f.toLowerCase() === s.toLowerCase())) return existing;
  const next = [...existing, s.slice(0, 120)];
  setMemory(patientId, next);
  return next;
}

// Ask the backend to pull any durable personal facts out of a typed message,
// then merge the new ones into memory. Returns the updated memory list.
export async function learnFromMessage(patientId, message) {
  if (!patientId || !message || !message.trim()) return getMemory(patientId);
  try {
    const { facts } = await api.extractMemory(message.trim());
    if (!Array.isArray(facts) || facts.length === 0) return getMemory(patientId);
    const existing = getMemory(patientId);
    const seen = new Set(existing.map((f) => f.toLowerCase()));
    const merged = [...existing];
    for (const f of facts) {
      const s = String(f).trim();
      if (s && s.length <= 120 && !seen.has(s.toLowerCase())) {
        merged.push(s);
        seen.add(s.toLowerCase());
      }
    }
    setMemory(patientId, merged);
    return merged.slice(-MAX_FACTS);
  } catch {
    return getMemory(patientId);
  }
}
