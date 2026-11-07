/**
 * Daily workout planning: personalised 10-, 20- and 30-minute sessions combining interval
 * recognition, chord construction, voicings and voice leading, weighted toward weak keys and
 * weak categories.
 */
import { CIRCLE_OF_FIFTHS } from '../music-theory/harmony';
import {
  CATEGORY_INFO, accuracyOf, addToTally, emptyTally, keyStats, weakKeys, type Attempt, type Category, type ProgressData, type Tally,
} from './progress';
import { weightedIndex, type Rng } from './rng';

export type WorkoutLength = 10 | 20 | 30;
export const WORKOUT_LENGTHS: WorkoutLength[] = [10, 20, 30];

export interface WorkoutBlock {
  category: Category;
  title: string;
  seconds: number;
  /** Keys this block draws from (weak keys first). */
  keys: number[];
  level: number;
  why: string;
}

export interface WorkoutPlan {
  minutes: WorkoutLength;
  blocks: WorkoutBlock[];
  focusKeys: number[];
  keyOfTheDay: number;
}

/** Base allocation in minutes. Every length covers intervals, construction, voicing and voice leading. */
const BASE: Record<WorkoutLength, [Category, number][]> = {
  10: [['interval', 2], ['construction', 3], ['voicing', 3], ['voice-leading', 2]],
  20: [['interval', 3], ['chord-tone', 3], ['construction', 4], ['voicing', 5], ['voice-leading', 5]],
  30: [['interval', 4], ['chord-tone', 3], ['extension', 3], ['construction', 6], ['voicing', 7], ['voice-leading', 7]],
};

const TITLES: Record<Category, string> = {
  interval: 'Interval warm-up', 'chord-tone': 'Chord-tone spelling', extension: 'Extensions & alterations',
  construction: 'Chord construction', voicing: 'Voicing shapes', 'voice-leading': 'Voice leading',
};

/** Days since 2000-01-01 (local), used to rotate the key of the day around the circle. */
export function dayNumber(d: Date): number {
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(2000, 0, 1)) / 86400000);
}

/** Category weakness 0..1 (unpractised = 0.5). */
export function categoryWeakness(d: ProgressData, c: Category): number {
  const t = d.byCategory[c];
  const smoothed = ((t?.correct ?? 0) + 1) / ((t?.n ?? 0) + 2);
  return 1 - smoothed;
}

export function buildWorkout(minutes: WorkoutLength, d: ProgressData, today = new Date()): WorkoutPlan {
  const keyOfTheDay = CIRCLE_OF_FIFTHS[dayNumber(today) % 12].pc;
  const focusKeys = weakKeys(d, 3);
  const alloc = BASE[minutes].map(([c, m]) => ({ c, s: m * 60 }));

  // Shift one minute (half a minute in a 10-minute session) from the strongest practised category to the weakest.
  if (alloc.length > 1) {
    const ranked = [...alloc].sort((a, b) => categoryWeakness(d, b.c) - categoryWeakness(d, a.c));
    const weakest = ranked[0], strongest = ranked[ranked.length - 1];
    const gap = categoryWeakness(d, weakest.c) - categoryWeakness(d, strongest.c);
    const shift = minutes === 10 ? 30 : 60;
    if (gap >= 0.15 && strongest.s - shift >= 60) { strongest.s -= shift; weakest.s += shift; }
  }

  const blocks: WorkoutBlock[] = alloc.map(({ c, s }) => {
    const catWeak = weakKeys(d, 2, c);
    const keys = [...new Set([...catWeak, ...focusKeys, keyOfTheDay])].slice(0, 4);
    const acc = accuracyOf(d.byCategory[c]);
    const base = BASE[minutes].find(([x]) => x === c)![1] * 60;
    const why = [
      s > base ? 'extra time: your weakest area' : s < base ? 'shorter: your strongest area' : null,
      acc === null ? 'new for you' : `${Math.round(acc * 100)} % so far`,
      `level ${d.levels[c].level}`,
    ].filter(Boolean).join(' · ');
    return { category: c, title: TITLES[c], seconds: s, keys, level: d.levels[c].level, why };
  });

  return { minutes, blocks, focusKeys, keyOfTheDay };
}

/** Pick the key for the next question in a block: weaker keys are more likely. */
export function pickBlockKey(rng: Rng, block: WorkoutBlock, d: ProgressData): number {
  const stats = keyStats(d, block.category);
  const weights = block.keys.map((pc) => 0.25 + stats[pc].weakness);
  return block.keys[weightedIndex(rng, weights)];
}

export interface SessionSummary {
  tally: Tally;
  byCategory: Partial<Record<Category, Tally>>;
  byKey: Record<number, Tally>;
  accuracy: number | null;
  avgSeconds: number | null;
}

export function summarizeAttempts(attempts: Attempt[]): SessionSummary {
  let tally = emptyTally();
  const byCategory: Partial<Record<Category, Tally>> = {};
  const byKey: Record<number, Tally> = {};
  for (const a of attempts) {
    tally = addToTally(tally, a);
    byCategory[a.category] = addToTally(byCategory[a.category], a);
    byKey[a.keyPc] = addToTally(byKey[a.keyPc], a);
  }
  return { tally, byCategory, byKey, accuracy: tally.n ? tally.correct / tally.n : null, avgSeconds: tally.n ? tally.ms / tally.n / 1000 : null };
}

export function categoryLabel(c: Category): string {
  return CATEGORY_INFO[c].label;
}
