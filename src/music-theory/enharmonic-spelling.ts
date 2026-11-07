/**
 * Theoretical spelling: the letter of a chord tone is determined by the
 * root's letter + (degree − 1); the accidental is whatever makes the pitch class right.
 * This is why F#maj7 contains E# (degree 7 above F = E) and C7b9 contains Db (degree 9 above C = D).
 */
import { LETTERS, NATURAL_PC, letterIndex, mod12, pitchClassOf, type SpelledNote, type Letter, formatNote } from './note-parser';
import { parseDegreeLabel, type ChordInterval } from './intervals';

export function spellInterval(root: SpelledNote, interval: ChordInterval | string): SpelledNote {
  const iv = typeof interval === 'string' ? parseDegreeLabel(interval) : interval;
  const letter = LETTERS[(letterIndex(root.letter) + iv.degree - 1) % 7] as Letter;
  const targetPc = mod12(pitchClassOf(root) + iv.semitones);
  let acc = targetPc - NATURAL_PC[letter];
  if (acc > 6) acc -= 12;
  if (acc < -6) acc += 12;
  return { letter, acc };
}

/** Preferred spelling for chord roots by pitch class (common lead-sheet practice). */
export const DEFAULT_ROOTS: readonly SpelledNote[] = [
  { letter: 'C', acc: 0 }, { letter: 'D', acc: -1 }, { letter: 'D', acc: 0 }, { letter: 'E', acc: -1 },
  { letter: 'E', acc: 0 }, { letter: 'F', acc: 0 }, { letter: 'F', acc: 1 }, { letter: 'G', acc: 0 },
  { letter: 'A', acc: -1 }, { letter: 'A', acc: 0 }, { letter: 'B', acc: -1 }, { letter: 'B', acc: 0 },
];

/** Alternative (enharmonic) root spellings that a user may request. */
export const ALT_ROOTS: Readonly<Record<number, SpelledNote>> = {
  1: { letter: 'C', acc: 1 }, 3: { letter: 'D', acc: 1 }, 6: { letter: 'G', acc: -1 },
  8: { letter: 'G', acc: 1 }, 10: { letter: 'A', acc: 1 }, 11: { letter: 'C', acc: -1 },
};

/** Largest absolute accidental used in a set of spellings. */
export function maxAccidental(notes: SpelledNote[]): number {
  return notes.reduce((m, n) => Math.max(m, Math.abs(n.acc)), 0);
}

/** Sum of |accidentals| — lower is "simpler" reading. */
export function spellingComplexity(notes: SpelledNote[]): number {
  return notes.reduce((s, n) => s + Math.abs(n.acc), 0);
}

/**
 * Choose the clearest root spelling for a pitch class given chord degrees,
 * preferring fewer accidentals and avoiding double accidentals unless unavoidable.
 * The default root set is used when it does not produce double accidentals.
 */
export function chooseRootSpelling(pc: number, intervals: (ChordInterval | string)[]): SpelledNote {
  const primary = DEFAULT_ROOTS[mod12(pc)];
  const alt = ALT_ROOTS[mod12(pc)];
  if (!alt) return primary;
  const score = (r: SpelledNote) => {
    const notes = intervals.map((iv) => spellInterval(r, iv));
    return maxAccidental(notes) * 100 + spellingComplexity(notes);
  };
  const sp = score(primary);
  const sa = score(alt);
  // Only switch away from the default root if the default needs double accidentals and the alternative does not.
  if (maxAccidental(intervals.map((iv) => spellInterval(primary, iv))) >= 2 && sa < sp) return alt;
  return primary;
}

export function enharmonicEquivalent(a: SpelledNote, b: SpelledNote): boolean {
  return pitchClassOf(a) === pitchClassOf(b);
}

export function noteListToString(notes: SpelledNote[]): string {
  return notes.map((n) => formatNote(n)).join(' ');
}
