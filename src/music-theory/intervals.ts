/**
 * Chord-degree intervals. A degree label ("b9", "#11", "bb7") carries both a
 * generic degree number (used for letter-name spelling) and a semitone size
 * (used for pitch). The two are never conflated: b5 and #11 share a pitch class
 * but are spelled with different letters.
 */
import { mod12 } from './note-parser';

export interface ChordInterval {
  /** Generic degree number 1..13 (letter distance + 1). */
  degree: number;
  /** Semitones above the root, may exceed 12 for compound intervals (9, 11, 13). */
  semitones: number;
  /** Canonical label, e.g. "1", "b3", "5", "bb7", "b9", "#11", "13". */
  label: DegreeLabel;
}

export type DegreeLabel = string;

/** Semitones of the major-scale degree (1..7) → used as the reference for accidentals. */
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];

export function baseSemitones(degree: number): number {
  if (degree < 1 || degree > 15) throw new Error(`Unsupported degree ${degree}`);
  const idx = (degree - 1) % 7;
  const octaves = Math.floor((degree - 1) / 7);
  return MAJOR_SCALE[idx] + 12 * octaves;
}

const LABEL_RE = /^(bb|b|#|##)?(\d{1,2})$/;

export function parseDegreeLabel(label: string): ChordInterval {
  const m = LABEL_RE.exec(label.trim());
  if (!m) throw new Error(`Invalid degree label "${label}"`);
  const degree = parseInt(m[2], 10);
  const accStr = m[1] ?? '';
  const acc = accStr === 'b' ? -1 : accStr === 'bb' ? -2 : accStr === '#' ? 1 : accStr === '##' ? 2 : 0;
  return { degree, semitones: baseSemitones(degree) + acc, label: canonicalLabel(degree, acc) };
}

export function canonicalLabel(degree: number, acc: number): DegreeLabel {
  const a = acc === -2 ? 'bb' : acc === -1 ? 'b' : acc === 1 ? '#' : acc === 2 ? '##' : '';
  return `${a}${degree}`;
}

export function intervalFromDegree(degree: number, acc = 0): ChordInterval {
  return { degree, semitones: baseSemitones(degree) + acc, label: canonicalLabel(degree, acc) };
}

/** Pitch class (0..11) of a degree label relative to the root. */
export function labelPitchClass(label: string): number {
  return mod12(parseDegreeLabel(label).semitones);
}

/** Simple interval names for display / explanation. */
const SIMPLE_NAMES = ['unison', 'minor 2nd', 'major 2nd', 'minor 3rd', 'major 3rd', 'perfect 4th', 'tritone',
  'perfect 5th', 'minor 6th', 'major 6th', 'minor 7th', 'major 7th'];

export function semitoneIntervalName(semitones: number): string {
  const s = Math.abs(semitones);
  if (s === 12) return 'octave';
  if (s < 12) return SIMPLE_NAMES[s];
  const comp: Record<number, string> = { 13: 'minor 9th', 14: 'major 9th', 15: 'minor 10th', 16: 'major 10th', 17: 'perfect 11th', 18: 'augmented 11th', 19: 'perfect 12th' };
  return comp[s] ?? `${SIMPLE_NAMES[s % 12]} + ${Math.floor(s / 12)} octave(s)`;
}

/** Functional role of a degree, used for colour-coding and explanations. */
export type ToneRole = 'root' | 'third' | 'fifth' | 'seventh' | 'sixth' | 'sus' | 'extension' | 'alteration';

export function roleOfLabel(label: string): ToneRole {
  const { degree, semitones } = parseDegreeLabel(label);
  const acc = semitones - baseSemitones(degree);
  switch (degree) {
    case 1: return 'root';
    case 3: return 'third';
    case 2: case 4: return 'sus';
    case 5: return acc === 0 ? 'fifth' : 'alteration';
    case 6: return 'sixth';
    case 7: return 'seventh';
    case 9: return acc === 0 ? 'extension' : 'alteration';
    case 11: return acc === 0 ? 'extension' : 'alteration';
    case 13: return acc === 0 ? 'extension' : 'alteration';
    default: return 'extension';
  }
}
