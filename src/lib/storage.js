const SCHEMA_VERSION = "s2";
export const LS = {
  g1:   "neurolympics_g1",
  g3:   "neurolympics_g3",
  g4:   "neurolympics_g4",
  math: "neurolympics_math",
  ev:   "neurolympics_ev",
  seq:  "neurolympics_seq",
  cascade: "neurolympics_cascade",
  regimes: "neurolympics_regimes_read",
};
// Removed games keep their keys on the reset list so nothing is orphaned.
const LEGACY_KEYS = ["neurolympics_g2","neurolympics_dt","neurolympics_g1_v4","neurolympics_g2_history","neurolympics_g3_history","neurolympics_g4_history","neurolympics_math_history","neurolympics_seq_history"];
export const lsGet = k => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; }};
export const lsSet = (k,v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
export function saveSession(key, entry) { const h=lsGet(key); h.push(entry); lsSet(key,h); }
export function resetAllData(){ try { Object.values(LS).forEach(k=>localStorage.removeItem(k)); LEGACY_KEYS.forEach(k=>localStorage.removeItem(k)); } catch {} }
// One-time reset: the 0-1000 scoring is not comparable to pre-s2 sessions, so wipe once.
(function migrate(){ try { if(localStorage.getItem("neurolympics_schema")!==SCHEMA_VERSION){ resetAllData(); localStorage.setItem("neurolympics_schema",SCHEMA_VERSION); } } catch {} })();
