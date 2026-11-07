import { formatNote, letterIndex, mod12, pitchClassOf, type SpelledNote } from './note-parser';
import { DEFAULT_ROOTS, chooseRootSpelling, spellInterval } from './enharmonic-spelling';
import type { ParsedChord } from './chord-parser';
import { intervalFromDegree } from './intervals';

/** Twelve roots in chromatic order using lead-sheet spellings. */
export function twelveRoots(start: SpelledNote = { letter: 'C', acc: 0 }): SpelledNote[] {
  const s = pitchClassOf(start);
  return Array.from({ length: 12 }, (_, i) => DEFAULT_ROOTS[mod12(s + i)]);
}

/** Roots by cycle of fourths (C F Bb Eb Ab Db Gb/F# B E A D G). */
export function cycleOfFourths(start: SpelledNote = { letter: 'C', acc: 0 }): SpelledNote[] {
  const s = pitchClassOf(start);
  return Array.from({ length: 12 }, (_, i) => DEFAULT_ROOTS[mod12(s + 5 * i)]);
}

export function cycleOfFifths(start: SpelledNote = { letter: 'C', acc: 0 }): SpelledNote[] {
  const s = pitchClassOf(start);
  return Array.from({ length: 12 }, (_, i) => DEFAULT_ROOTS[mod12(s + 7 * i)]);
}

/**
 * Transpose a spelled note by a diatonic interval (degree + chromatic size),
 * e.g. transposeSpelled(F#, 'up a major 3rd') → A#.
 */
export function transposeSpelled(note: SpelledNote, degree: number, semitones: number): SpelledNote {
  const base = intervalFromDegree(degree);
  return spellInterval(note, { degree, semitones, label: base.label });
}

/** Transpose a list of MIDI notes. */
export function transposeMidi(notes: number[], semitones: number): number[] {
  return notes.map((n) => n + semitones);
}

/**
 * Re-root a parsed chord symbol to a new pitch class, keeping quality and the
 * root→bass relationship, choosing readable spellings.
 */
export function transposeChordSymbol(chord: ParsedChord, newRootPc: number): string {
  const labels = chord.tones.map((t) => t.label);
  const root = chooseRootSpelling(newRootPc, labels);
  let sym = formatNote(root) + (chord.quality === 'maj' ? '' : chord.quality);
  if (chord.bass && chord.bassPc !== undefined) {
    const degree = ((letterIndex(chord.bass.letter) - letterIndex(chord.root.letter) + 7) % 7) + 1;
    const semis = mod12(chord.bassPc - chord.rootPc);
    let bass = transposeSpelled(root, degree, semis);
    if (Math.abs(bass.acc) > 1) bass = DEFAULT_ROOTS[mod12(newRootPc + semis)];
    sym += '/' + formatNote(bass);
  }
  return sym;
}
