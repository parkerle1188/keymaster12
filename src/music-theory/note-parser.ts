/**
 * Note names: letter + accidental, independent of pitch/register.
 * A SpelledNote is the *theoretical* name of a pitch class (E# ≠ F).
 */
export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

export const LETTERS: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
/** Pitch class of each natural letter. */
export const NATURAL_PC: Readonly<Record<Letter, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export interface SpelledNote {
  letter: Letter;
  /** -2 = double flat, -1 = flat, 0 = natural, 1 = sharp, 2 = double sharp */
  acc: number;
}

export interface ParsedNote extends SpelledNote {
  octave?: number;
}

export const mod12 = (n: number): number => ((n % 12) + 12) % 12;

export function letterIndex(letter: Letter): number {
  return LETTERS.indexOf(letter);
}

export function pitchClassOf(note: SpelledNote): number {
  return mod12(NATURAL_PC[note.letter] + note.acc);
}

const NOTE_RE = /^([A-Ga-g])(bb|𝄫|♭♭|##|x|𝄪|♯♯|b|♭|#|♯)?(-?\d+)?$/;

/**
 * Parse "C", "F#", "Bb", "Ebb", "C##", "Cx", "F#4", "Bb-1", unicode ♯/♭.
 * Throws on invalid input.
 */
export function parseNote(input: string): ParsedNote {
  const s = input.trim();
  const m = NOTE_RE.exec(s);
  if (!m) throw new Error(`Invalid note name: "${input}"`);
  const letter = m[1].toUpperCase() as Letter;
  const accStr = m[2] ?? '';
  let acc = 0;
  switch (accStr) {
    case 'b': case '♭': acc = -1; break;
    case 'bb': case '♭♭': case '𝄫': acc = -2; break;
    case '#': case '♯': acc = 1; break;
    case '##': case '♯♯': case 'x': case '𝄪': acc = 2; break;
  }
  const out: ParsedNote = { letter, acc };
  if (m[3] !== undefined) out.octave = parseInt(m[3], 10);
  return out;
}

/** Try to parse a note name prefix from the start of a string (used by the chord parser). */
export function parseNotePrefix(input: string): { note: SpelledNote; rest: string } | null {
  const m = /^([A-Ga-g])(bb|##|b|#|♭|♯|x)?/.exec(input);
  if (!m) return null;
  // "b" after a root is ambiguous only for root "B" itself — "Bb" is B-flat. A chord like "Bbm" -> Bb + m.
  const note = parseNote(m[0]);
  return { note: { letter: note.letter, acc: note.acc }, rest: input.slice(m[0].length) };
}

export interface FormatOptions {
  unicode?: boolean;
}

export function accidentalString(acc: number, unicode = false): string {
  if (acc === 0) return '';
  if (unicode) {
    if (acc === 1) return '♯';
    if (acc === -1) return '♭';
    if (acc === 2) return '𝄪';
    if (acc === -2) return '𝄫';
    return (acc > 0 ? '♯' : '♭').repeat(Math.abs(acc));
  }
  return (acc > 0 ? '#' : 'b').repeat(Math.abs(acc));
}

export function formatNote(note: SpelledNote, opts: FormatOptions = {}): string {
  return note.letter + accidentalString(note.acc, opts.unicode);
}

export function formatNoteWithOctave(note: SpelledNote, octave: number, opts: FormatOptions = {}): string {
  return formatNote(note, opts) + octave;
}

export function sameSpelling(a: SpelledNote, b: SpelledNote): boolean {
  return a.letter === b.letter && a.acc === b.acc;
}
