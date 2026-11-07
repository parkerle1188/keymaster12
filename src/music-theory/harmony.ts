/**
 * Keys, scales, Roman numerals and harmonic function.
 *
 * Chords inside a key are spelled from the tonic by degree (the root of ii in Db is Eb,
 * the root of bVII in C is Bb), so every chord symbol a progression produces is spelled
 * by function. A root that would need a double accidental (bII in Db = Ebb) is respelled
 * enharmonically, as lead sheets do.
 */
import { DEFAULT_ROOTS, spellInterval } from './enharmonic-spelling';
import { parseDegreeLabel } from './intervals';
import { formatNote, mod12, pitchClassOf, type SpelledNote } from './note-parser';
import { cycleOfFifths } from './transposition';

export type HarmonicFunction = 'tonic' | 'predominant' | 'dominant';

export const FUNCTION_INFO: Record<HarmonicFunction, { short: string; name: string; color: string; text: string }> = {
  tonic: { short: 'T', name: 'Tonic', color: '#3BA7FF', text: 'Home: stable, at rest.' },
  predominant: { short: 'PD', name: 'Predominant', color: '#4ADE80', text: 'Moves away from home and prepares the dominant.' },
  dominant: { short: 'D', name: 'Dominant', color: '#FB7185', text: 'Tension that wants to resolve (to the tonic or to the chord it targets).' },
};

export const MAJOR_SCALE_LABELS = ['1', '2', '3', '4', '5', '6', '7'] as const;
export const NATURAL_MINOR_LABELS = ['1', '2', 'b3', '4', '5', 'b6', 'b7'] as const;

export function majorScale(tonic: SpelledNote): SpelledNote[] {
  return MAJOR_SCALE_LABELS.map((l) => spellInterval(tonic, l));
}

export function naturalMinorScale(tonic: SpelledNote): SpelledNote[] {
  return NATURAL_MINOR_LABELS.map((l) => spellInterval(tonic, l));
}

/** Signed key-signature count for a major key: +n sharps, −n flats. */
export function keySignature(tonic: SpelledNote): number {
  return majorScale(tonic).reduce((s, n) => s + n.acc, 0);
}

export function keySignatureText(tonic: SpelledNote): string {
  const n = keySignature(tonic);
  if (n === 0) return 'no sharps or flats';
  const k = Math.abs(n);
  return `${k} ${n > 0 ? 'sharp' : 'flat'}${k > 1 ? 's' : ''}`;
}

/** Diatonic harmonic function of a scale degree in a major key (iii and vi are tonic substitutes; vii° is dominant). */
export function functionOfDegree(degree: number): HarmonicFunction {
  switch (((degree - 1) % 7) + 1) {
    case 1: case 3: case 6: return 'tonic';
    case 2: case 4: return 'predominant';
    default: return 'dominant';
  }
}

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const MINOR_FAMILY = /^(m(?!aj)|dim)/;

/**
 * Roman numeral for a chord on a degree label of the key, e.g.
 * ('2','m7') → "ii7", ('5','13') → "V13", ('7','m7b5') → "viiø7", ('b7','7') → "♭VII7", ('1','maj9') → "Imaj9".
 */
export function romanNumeral(degreeLabel: string, quality: string): string {
  const iv = parseDegreeLabel(degreeLabel);
  const deg = ((iv.degree - 1) % 7) + 1;
  const acc = iv.semitones - [0, 2, 4, 5, 7, 9, 11][deg - 1] - 12 * Math.floor((iv.degree - 1) / 7);
  const prefix = acc < 0 ? '♭'.repeat(-acc) : '♯'.repeat(acc);
  const lower = MINOR_FAMILY.test(quality);
  const base = lower ? NUMERALS[deg - 1].toLowerCase() : NUMERALS[deg - 1];
  let suffix: string;
  if (quality === 'maj' || quality === 'm') suffix = '';
  else if (quality === 'dim') suffix = '°';
  else if (quality === 'dim7') suffix = '°7';
  else if (/^m\d+b5/.test(quality)) suffix = 'ø' + quality.slice(1).replace('b5', '');
  else if (quality.startsWith('mmaj')) suffix = quality.slice(1);
  else if (lower) suffix = quality.slice(1);
  else if (quality === 'aug') suffix = '+';
  else suffix = quality;
  return prefix + base + suffix;
}

export interface DiatonicChord {
  degree: number;
  degreeLabel: string;
  numeral: string;
  root: SpelledNote;
  quality: string;
  symbol: string;
  function: HarmonicFunction;
}

const SEVENTH_QUALITIES = ['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7b5'];
const TRIAD_QUALITIES = ['maj', 'm', 'm', 'maj', 'maj', 'm', 'dim'];

export function diatonicChords(tonic: SpelledNote, sevenths = true): DiatonicChord[] {
  const qs = sevenths ? SEVENTH_QUALITIES : TRIAD_QUALITIES;
  return MAJOR_SCALE_LABELS.map((label, i) => {
    const root = spellInterval(tonic, label);
    const quality = qs[i];
    return {
      degree: i + 1, degreeLabel: label, numeral: romanNumeral(label, quality), root, quality,
      symbol: formatNote(root) + (quality === 'maj' ? '' : quality), function: functionOfDegree(i + 1),
    };
  });
}

/** Spell a chord root by its degree in the key, respelling double accidentals enharmonically. */
export function rootInKey(tonic: SpelledNote, degreeLabel: string): SpelledNote {
  const r = spellInterval(tonic, degreeLabel);
  if (Math.abs(r.acc) < 2) return r;
  return DEFAULT_ROOTS[pitchClassOf(r)];
}

/** Chord symbol for a degree/quality (and optional slash-bass degree) in a key. */
export function chordInKey(tonic: SpelledNote, degreeLabel: string, quality: string, bassLabel?: string): string {
  const root = rootInKey(tonic, degreeLabel);
  let sym = formatNote(root) + (quality === 'maj' ? '' : quality);
  if (bassLabel) sym += '/' + formatNote(rootInKey(tonic, bassLabel));
  return sym;
}

export interface CircleKey {
  /** Position on the circle: 0 = C (top), clockwise by fifths. */
  index: number;
  tonic: SpelledNote;
  pc: number;
  name: string;
  /** Enharmonic alternative name for keys at the bottom of the circle (F#/Gb, Db/C#, B/Cb). */
  altName?: string;
  signature: number;
  relativeMinor: SpelledNote;
}

const ALT_KEY_NAMES: Record<string, string> = { B: 'Cb', 'F#': 'Gb', Db: 'C#' };

/** The 12 major keys clockwise around the circle of fifths, starting at C. */
export const CIRCLE_OF_FIFTHS: readonly CircleKey[] = cycleOfFifths().map((tonic, index) => ({
  index, tonic, pc: pitchClassOf(tonic), name: formatNote(tonic), altName: ALT_KEY_NAMES[formatNote(tonic)],
  signature: keySignature(tonic), relativeMinor: spellInterval(tonic, '6'),
}));

export function circleKeyForPc(pc: number): CircleKey {
  return CIRCLE_OF_FIFTHS.find((k) => k.pc === mod12(pc))!;
}

/** Steps between two keys around the circle (0..6): neighbours share all but one note. */
export function circleDistance(a: number, b: number): number {
  const ia = circleKeyForPc(a).index;
  const ib = circleKeyForPc(b).index;
  const d = Math.abs(ia - ib) % 12;
  return Math.min(d, 12 - d);
}

/** Conventional minor-key tonic spellings (C# minor, not Db minor; G# minor, not Ab minor). */
const MINOR_TONICS: readonly SpelledNote[] = [
  { letter: 'C', acc: 0 }, { letter: 'C', acc: 1 }, { letter: 'D', acc: 0 }, { letter: 'E', acc: -1 },
  { letter: 'E', acc: 0 }, { letter: 'F', acc: 0 }, { letter: 'F', acc: 1 }, { letter: 'G', acc: 0 },
  { letter: 'G', acc: 1 }, { letter: 'A', acc: 0 }, { letter: 'B', acc: -1 }, { letter: 'B', acc: 0 },
];

/** Tonic spelling for a key by pitch class and mode. */
export function tonicFor(pc: number, mode: 'major' | 'minor' = 'major'): SpelledNote {
  return mode === 'minor' ? MINOR_TONICS[mod12(pc)] : DEFAULT_ROOTS[mod12(pc)];
}

export function keyName(pc: number, mode: 'major' | 'minor' = 'major'): string {
  return `${formatNote(tonicFor(pc, mode))} ${mode}`;
}
