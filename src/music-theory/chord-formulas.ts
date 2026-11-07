/**
 * Chord-quality knowledge that is independent of any particular root:
 * - which degree labels a chord symbol implies,
 * - which are required vs optional in a practical voicing,
 * - which extra "available tensions" a style may add without contradicting the symbol.
 */
import type { DegreeLabel } from './intervals';

export type TriadType = 'maj' | 'min' | 'dim' | 'aug' | 'sus2' | 'sus4';
export type SeventhType = 'none' | 'b7' | '7' | 'bb7';
export type ChordFamily =
  | 'major' | 'minor' | 'dominant' | 'diminished' | 'half-diminished' | 'augmented' | 'suspended';

export type ToneKind = 'root' | 'chord' | 'extension' | 'alteration' | 'added';

export interface ToneSpec {
  label: DegreeLabel;
  required: boolean;
  kind: ToneKind;
  /** Why the tone is optional / conventionally omitted. */
  note?: string;
}

/** Ordering of degree labels for display (by semitone size within degree order). */
export const DEGREE_ORDER: DegreeLabel[] = [
  '1', 'b2', '2', 'b3', '3', '4', '#4', 'b5', '5', '#5', 'b6', '6', 'bb7', 'b7', '7',
  'b9', '9', '#9', '11', '#11', 'b13', '13',
];

export function sortLabels(labels: DegreeLabel[]): DegreeLabel[] {
  return [...labels].sort((a, b) => DEGREE_ORDER.indexOf(a) - DEGREE_ORDER.indexOf(b));
}

export const ALTERATION_LABELS = ['b5', '#5', 'b9', '#9', '#11', 'b13'] as const;

/** Human-readable names for canonical quality keys (used in UI and tests). */
export const QUALITY_NAMES: Record<string, string> = {
  maj: 'major triad', m: 'minor triad', dim: 'diminished triad', aug: 'augmented triad',
  sus2: 'suspended 2nd', sus4: 'suspended 4th', add9: 'major add 9', add2: 'major add 2', madd9: 'minor add 9',
  '6': 'major 6th', m6: 'minor 6th', '69': 'major 6/9', m69: 'minor 6/9',
  maj7: 'major 7th', m7: 'minor 7th', '7': 'dominant 7th', maj9: 'major 9th', m9: 'minor 9th', '9': 'dominant 9th',
  '11': 'dominant 11th', m11: 'minor 11th', '13': 'dominant 13th', m13: 'minor 13th', maj13: 'major 13th',
  m7b5: 'half-diminished (minor 7 flat 5)', dim7: 'diminished 7th', mmaj7: 'minor-major 7th', mmaj9: 'minor-major 9th',
  '7b9': 'dominant 7 flat 9', '7#9': 'dominant 7 sharp 9', '7#11': 'dominant 7 sharp 11', '7b13': 'dominant 7 flat 13',
  '7alt': 'altered dominant', '7sus4': 'dominant 7 sus 4', '9sus4': 'dominant 9 sus 4', '13sus4': 'dominant 13 sus 4',
  'maj7#11': 'major 7 sharp 11 (Lydian)', 'maj9#11': 'major 9 sharp 11', '7#5': 'augmented 7th', '7b5': 'dominant 7 flat 5',
  '13b9': 'dominant 13 flat 9', '13#11': 'dominant 13 sharp 11', '9#11': 'dominant 9 sharp 11', '7#9b13': 'dominant 7 sharp 9 flat 13',
  '7b9b13': 'dominant 7 flat 9 flat 13', '7b9#11': 'dominant 7 flat 9 sharp 11', m9b5: 'half-diminished 9', 'maj7#5': 'major 7 sharp 5',
  m11b5: 'half-diminished 11', '13b9#11': 'dominant 13 flat 9 sharp 11', 'maj13#11': 'major 13 sharp 11',
};

export function familyName(f: ChordFamily): string {
  return f.replace('-', ' ');
}
