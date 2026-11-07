/**
 * Practice progress: pure functions over a serialisable ProgressData object.
 * Persistence and React wiring live in state/progress-store.ts.
 */
export type Category = 'interval' | 'chord-tone' | 'extension' | 'construction' | 'voicing' | 'voice-leading';

export const CATEGORIES: Category[] = ['interval', 'chord-tone', 'extension', 'construction', 'voicing', 'voice-leading'];

export const CATEGORY_INFO: Record<Category, { label: string; target: number; text: string }> = {
  interval: { label: 'Intervals', target: 5000, text: 'Name the note an interval above a root, or name the interval between two notes.' },
  'chord-tone': { label: 'Chord tones', target: 5000, text: 'Spell the 3rd, 5th or 7th of a chord instantly.' },
  extension: { label: 'Extensions', target: 6000, text: 'Spell 9ths, 11ths, 13ths and altered tensions.' },
  construction: { label: 'Chord construction', target: 12000, text: 'Build a chord on the keyboard from its symbol.' },
  voicing: { label: 'Voicings', target: 15000, text: 'Play a named voicing shape (inversion, shell, rootless…).' },
  'voice-leading': { label: 'Voice leading', target: 15000, text: 'Move to the next chord with the least motion.' },
};

export interface Tally {
  n: number;
  correct: number;
  /** Total response time in ms. */
  ms: number;
  /** Sum of response time / category target (normalises speed across categories). */
  rel: number;
}

export const emptyTally = (): Tally => ({ n: 0, correct: 0, ms: 0, rel: 0 });

export interface LevelState {
  level: number;
  recent: { c: boolean; ms: number }[];
}

export interface SessionRecord {
  id: string;
  /** ISO timestamp of the session end. */
  date: string;
  kind: 'workout' | 'drill' | 'exercise';
  title: string;
  plannedMinutes?: number;
  seconds: number;
  tally: Tally;
  byCategory: Partial<Record<Category, Tally>>;
  byKey: Record<number, Tally>;
}

export interface ProgressData {
  version: 1;
  byKey: Record<number, Tally>;
  byCategory: Record<Category, Tally>;
  /** `${category}:${pc}` → tally. */
  byKeyCategory: Record<string, Tally>;
  levels: Record<Category, LevelState>;
  sessions: SessionRecord[];
  /** YYYY-MM-DD (local) → tally, for streaks and the activity chart. */
  daily: Record<string, Tally>;
}

export interface Attempt {
  category: Category;
  keyPc: number;
  correct: boolean;
  ms: number;
}

export const MAX_LEVEL = 5;
export const LEVEL_WINDOW = 10;
export const MAX_SESSIONS = 200;

export function emptyProgress(): ProgressData {
  const byCategory = {} as Record<Category, Tally>;
  const levels = {} as Record<Category, LevelState>;
  for (const c of CATEGORIES) { byCategory[c] = emptyTally(); levels[c] = { level: 1, recent: [] }; }
  return { version: 1, byKey: {}, byCategory, byKeyCategory: {}, levels, sessions: [], daily: {} };
}

/** Repair partially missing / older data so the UI never crashes on load. */
export function normaliseProgress(d: Partial<ProgressData> | null | undefined): ProgressData {
  const base = emptyProgress();
  if (!d || typeof d !== 'object') return base;
  return {
    version: 1,
    byKey: d.byKey ?? {},
    byCategory: { ...base.byCategory, ...(d.byCategory ?? {}) },
    byKeyCategory: d.byKeyCategory ?? {},
    levels: { ...base.levels, ...(d.levels ?? {}) },
    sessions: Array.isArray(d.sessions) ? d.sessions : [],
    daily: d.daily ?? {},
  };
}

export function addToTally(t: Tally | undefined, a: Pick<Attempt, 'correct' | 'ms' | 'category'>): Tally {
  const x = t ?? emptyTally();
  return { n: x.n + 1, correct: x.correct + (a.correct ? 1 : 0), ms: x.ms + a.ms, rel: x.rel + a.ms / CATEGORY_INFO[a.category].target };
}

export function mergeTally(a: Tally, b: Tally): Tally {
  return { n: a.n + b.n, correct: a.correct + b.correct, ms: a.ms + b.ms, rel: a.rel + b.rel };
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Adaptive difficulty: level up after 8/10 correct at target speed, down below 50 % over 6+. */
export function updateLevel(state: LevelState, category: Category, correct: boolean, ms: number): { state: LevelState; change: -1 | 0 | 1 } {
  const recent = [...state.recent, { c: correct, ms }].slice(-LEVEL_WINDOW);
  const acc = recent.filter((r) => r.c).length / recent.length;
  const avg = recent.reduce((s, r) => s + r.ms, 0) / recent.length;
  if (recent.length >= LEVEL_WINDOW && acc >= 0.8 && avg <= CATEGORY_INFO[category].target && state.level < MAX_LEVEL) {
    return { state: { level: state.level + 1, recent: [] }, change: 1 };
  }
  if (recent.length >= 6 && acc < 0.5 && state.level > 1) {
    return { state: { level: state.level - 1, recent: [] }, change: -1 };
  }
  return { state: { level: state.level, recent }, change: 0 };
}

export function recordAttempt(d: ProgressData, a: Attempt, now = new Date(), adapt = true): { data: ProgressData; levelChange: -1 | 0 | 1 } {
  const kc = `${a.category}:${a.keyPc}`;
  const day = dayKey(now);
  const lv = adapt ? updateLevel(d.levels[a.category], a.category, a.correct, a.ms) : { state: d.levels[a.category], change: 0 as const };
  return {
    levelChange: lv.change,
    data: {
      ...d,
      byKey: { ...d.byKey, [a.keyPc]: addToTally(d.byKey[a.keyPc], a) },
      byCategory: { ...d.byCategory, [a.category]: addToTally(d.byCategory[a.category], a) },
      byKeyCategory: { ...d.byKeyCategory, [kc]: addToTally(d.byKeyCategory[kc], a) },
      levels: { ...d.levels, [a.category]: lv.state },
      daily: { ...d.daily, [day]: addToTally(d.daily[day], a) },
    },
  };
}

export function addSession(d: ProgressData, s: SessionRecord): ProgressData {
  return { ...d, sessions: [s, ...d.sessions].slice(0, MAX_SESSIONS) };
}

export interface KeyStat {
  pc: number;
  n: number;
  accuracy: number | null;
  avgMs: number | null;
  /** 0 (strong) … 1 (weak). Unpractised keys sit in the middle so they get explored. */
  weakness: number;
}

export function keyStat(pc: number, t: Tally | undefined): KeyStat {
  const n = t?.n ?? 0;
  const smoothed = ((t?.correct ?? 0) + 1) / (n + 2);
  const relAvg = n ? t!.rel / n : 1;
  const speed = Math.max(0, Math.min(1, (relAvg - 0.5) / 1.5));
  return {
    pc, n, accuracy: n ? t!.correct / n : null, avgMs: n ? t!.ms / n : null,
    weakness: 0.75 * (1 - smoothed) + 0.25 * speed,
  };
}

export function keyStats(d: ProgressData, category?: Category): KeyStat[] {
  return Array.from({ length: 12 }, (_, pc) => keyStat(pc, category ? d.byKeyCategory[`${category}:${pc}`] : d.byKey[pc]));
}

/** The n weakest keys (practised keys with poor accuracy/speed first; ties broken by fewer attempts). */
export function weakKeys(d: ProgressData, n = 3, category?: Category): number[] {
  return keyStats(d, category)
    .sort((a, b) => b.weakness - a.weakness || a.n - b.n || a.pc - b.pc)
    .slice(0, n)
    .map((k) => k.pc);
}

/** Consecutive days with practice, ending today (or yesterday, if today has none yet). */
export function streak(d: ProgressData, today = new Date()): number {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!d.daily[dayKey(day)]?.n) day.setDate(day.getDate() - 1);
  let count = 0;
  while (d.daily[dayKey(day)]?.n) { count++; day.setDate(day.getDate() - 1); }
  return count;
}

export const accuracyOf = (t: Tally | undefined) => (t && t.n ? t.correct / t.n : null);
export const avgSecondsOf = (t: Tally | undefined) => (t && t.n ? t.ms / t.n / 1000 : null);
