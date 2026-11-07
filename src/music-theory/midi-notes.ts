/**
 * MIDI numbers are the single source of truth for pitch & register.
 * Scientific pitch notation: C4 = 60, A4 = 69, A0 = 21, C8 = 108.
 * Octave numbers belong to the *letter*: B#3 = 60, Cb4 = 59.
 */
import { NATURAL_PC, mod12, parseNote, type SpelledNote, formatNote } from './note-parser';

export const MIDI_A0 = 21;
export const MIDI_C8 = 108;
export const MIDI_MIDDLE_C = 60;

const BLACK = new Set([1, 3, 6, 8, 10]);

export function midiToPitchClass(midi: number): number {
  return mod12(midi);
}

export function isBlackKey(midi: number): boolean {
  return BLACK.has(mod12(midi));
}

export function spelledToMidi(note: SpelledNote, octave: number): number {
  return 12 * (octave + 1) + NATURAL_PC[note.letter] + note.acc;
}

/** Parse "C4", "F#3", "Bb-1", "B#3" → MIDI. Octave is required. */
export function noteNameToMidi(name: string): number {
  const p = parseNote(name);
  if (p.octave === undefined) throw new Error(`Note "${name}" has no octave`);
  const midi = spelledToMidi(p, p.octave);
  if (midi < 0 || midi > 127) throw new Error(`Note "${name}" is outside MIDI range`);
  return midi;
}

/** Octave number of a MIDI pitch *as spelled* (so B#3 stays octave 3 even though it sounds as C4). */
export function octaveForSpelling(midi: number, spelling: SpelledNote): number {
  const base = midi - NATURAL_PC[spelling.letter] - spelling.acc;
  return Math.round(base / 12) - 1;
}

export function formatMidiAs(midi: number, spelling: SpelledNote, unicode = false): string {
  return formatNote(spelling, { unicode }) + octaveForSpelling(midi, spelling);
}

const SHARP_NAMES: SpelledNote[] = [
  { letter: 'C', acc: 0 }, { letter: 'C', acc: 1 }, { letter: 'D', acc: 0 }, { letter: 'D', acc: 1 },
  { letter: 'E', acc: 0 }, { letter: 'F', acc: 0 }, { letter: 'F', acc: 1 }, { letter: 'G', acc: 0 },
  { letter: 'G', acc: 1 }, { letter: 'A', acc: 0 }, { letter: 'A', acc: 1 }, { letter: 'B', acc: 0 },
];
const FLAT_NAMES: SpelledNote[] = [
  { letter: 'C', acc: 0 }, { letter: 'D', acc: -1 }, { letter: 'D', acc: 0 }, { letter: 'E', acc: -1 },
  { letter: 'E', acc: 0 }, { letter: 'F', acc: 0 }, { letter: 'G', acc: -1 }, { letter: 'G', acc: 0 },
  { letter: 'A', acc: -1 }, { letter: 'A', acc: 0 }, { letter: 'B', acc: -1 }, { letter: 'B', acc: 0 },
];

/** Context-free spelling for raw MIDI (e.g. keyboard labels, MIDI input without harmonic context). */
export function defaultSpellingForMidi(midi: number, preferFlats = false): SpelledNote {
  return (preferFlats ? FLAT_NAMES : SHARP_NAMES)[mod12(midi)];
}

export function midiToName(midi: number, preferFlats = false): string {
  const s = defaultSpellingForMidi(midi, preferFlats);
  return formatNote(s) + octaveForSpelling(midi, s);
}

/** Equal-tempered frequency (A4 = 440 Hz). */
export function midiToFrequency(midi: number, a4 = 440): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}
