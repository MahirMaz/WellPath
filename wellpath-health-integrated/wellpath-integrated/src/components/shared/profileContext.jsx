import React, { createContext, useContext, useState } from 'react';
import { modelSet } from '../risksignal/riskModel.js';

// One shared health profile so the Nutrition tab and the Risk Signal tab read/write
// the SAME inputs — edit nutrition in one place, the risk bands react in the other.
const D = modelSet.defaults;
const DEFAULTS = {
  age: D.age, sex_female: D.sex_female, heightCm: D.heightCm, weightKg: D.weightKg,
  resting_hr: D.resting_hr, sleep_hours: D.sleep_hours,
  vigorous_activity: D.vigorous_activity, moderate_activity: D.moderate_activity,
  smoker_ord: D.smoker_ord, fh_diabetes: D.fh_diabetes,
  fast_food: D.fast_food, meals_not_home: D.meals_not_home,
};

const Ctx = createContext(null);

export function HealthProfileProvider({ children, initial }) {
  // Seed from the logged-in patient's real data where available, defaults otherwise.
  const seed = { ...DEFAULTS, ...(initial || {}) };
  const [profile, setProfile] = useState(seed);
  const set = (k, v) => setProfile((p) => ({ ...p, [k]: v }));
  const reset = () => setProfile(seed);
  return <Ctx.Provider value={{ profile, set, reset, DEFAULTS: seed }}>{children}</Ctx.Provider>;
}

export function useHealthProfile() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useHealthProfile must be used within HealthProfileProvider');
  return ctx;
}
