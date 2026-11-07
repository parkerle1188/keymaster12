/**
 * Reference progressions, written as scale degrees + chord qualities relative to the tonic
 * so they can be realised in any of the 12 keys with function-based spelling.
 */
import { chordInKey, romanNumeral, type HarmonicFunction } from '../music-theory/harmony';
import type { SpelledNote } from '../music-theory/note-parser';
import type { Style } from '../voicing-engine/voicing-types';

export interface ProgressionStep {
  /** Root as a degree label relative to the tonic ("2", "b7", "b2"). */
  degree: string;
  quality: string;
  function: HarmonicFunction;
  /** Optional slash-bass degree relative to the tonic. */
  bass?: string;
  /** Analysis label beyond the plain numeral, e.g. "V7/ii", "subV7", "borrowed iv". */
  analysis?: string;
}

export type ProgressionCategory = 'jazz' | 'pop-ballad' | 'rnb-neosoul';

export const CATEGORY_LABELS: Record<ProgressionCategory, string> = {
  jazz: 'Jazz', 'pop-ballad': 'Pop / Ballad', 'rnb-neosoul': 'R&B / Neo-Soul',
};

export interface Progression {
  id: string;
  name: string;
  category: ProgressionCategory;
  mode: 'major' | 'minor';
  style: Style;
  steps: ProgressionStep[];
  description: string;
}

const s = (degree: string, quality: string, fn: HarmonicFunction, extra: Partial<ProgressionStep> = {}): ProgressionStep => ({ degree, quality, function: fn, ...extra });
const T: HarmonicFunction = 'tonic', PD: HarmonicFunction = 'predominant', D: HarmonicFunction = 'dominant';

export const PROGRESSIONS: readonly Progression[] = [
  // ------------------------------------------------------------------ Jazz
  { id: 'ii-V-I', name: 'ii–V–I (major)', category: 'jazz', mode: 'major', style: 'jazz',
    steps: [s('2', 'm7', PD), s('5', '7', D), s('1', 'maj7', T)],
    description: 'The cadence of jazz. The 3rd of ii becomes the 7th of V, and the 7th of V falls a half step to the 3rd of I.' },
  { id: 'ii-V-I-ext', name: 'ii9–V13–Imaj9', category: 'jazz', mode: 'major', style: 'jazz',
    steps: [s('2', 'm9', PD), s('5', '13', D), s('1', 'maj9', T)],
    description: 'The same cadence with extensions. Rootless A and B voicings let the hand barely move: the 9 of ii is held as the 13 of V.' },
  { id: 'minor-ii-V-i', name: 'Minor iiø–V7♭9–i', category: 'jazz', mode: 'minor', style: 'jazz',
    steps: [s('2', 'm7b5', PD), s('5', '7b9', D), s('1', 'm6', T)],
    description: 'Minor-key cadence. The b5 of iiø becomes the b9 of V, then resolves to the 5th of i.' },
  { id: 'I-vi-ii-V', name: 'I–vi–ii–V (turnaround)', category: 'jazz', mode: 'major', style: 'jazz',
    steps: [s('1', 'maj7', T), s('6', 'm7', T), s('2', 'm7', PD), s('5', '7', D)],
    description: 'The standard turnaround: roots fall by fifths from vi back to I.' },
  { id: 'I-VI7-ii-V', name: 'I–VI7–ii–V (secondary dominant)', category: 'jazz', mode: 'major', style: 'jazz',
    steps: [s('1', 'maj7', T), s('6', '7', D, { analysis: 'V7/ii' }), s('2', 'm7', PD), s('5', '7', D)],
    description: 'vi becomes VI7, the dominant of ii. Its major 3rd is the leading tone that pulls up to the root of ii.' },
  { id: 'iii-vi-ii-V-I', name: 'iii–vi–ii–V–I', category: 'jazz', mode: 'major', style: 'jazz',
    steps: [s('3', 'm7', T), s('6', 'm7', T), s('2', 'm7', PD), s('5', '7', D), s('1', 'maj7', T)],
    description: 'A chain of descending fifths. Guide tones alternate 3rd→7th→3rd all the way down.' },
  { id: 'tritone-sub', name: 'ii–subV–I (tritone sub)', category: 'jazz', mode: 'major', style: 'jazz',
    steps: [s('2', 'm7', PD), s('b2', '7', D, { analysis: 'subV7' }), s('1', 'maj7', T)],
    description: 'bII7 shares its tritone with V7, so it resolves the same way while the bass falls by half step.' },
  { id: 'backdoor', name: 'iv7–♭VII7–I (backdoor)', category: 'jazz', mode: 'major', style: 'jazz',
    steps: [s('4', 'm7', PD, { analysis: 'borrowed iv' }), s('b7', '7', D, { analysis: 'backdoor dominant' }), s('1', 'maj7', T)],
    description: 'Chords borrowed from the parallel minor approach the tonic from a whole step below.' },

  // ------------------------------------------------------------------ Pop / Ballad
  { id: 'I-V-vi-IV', name: 'I–V–vi–IV', category: 'pop-ballad', mode: 'major', style: 'pop',
    steps: [s('1', 'maj', T), s('5', 'maj', D), s('6', 'm', T), s('4', 'maj', PD)],
    description: 'The most common pop progression. With inversions, one hand covers all four chords in a single position.' },
  { id: 'vi-IV-I-V', name: 'vi–IV–I–V', category: 'pop-ballad', mode: 'major', style: 'pop',
    steps: [s('6', 'm', T), s('4', 'maj', PD), s('1', 'maj', T), s('5', 'maj', D)],
    description: 'The same four chords started on vi: a more melancholy colour.' },
  { id: 'I-vi-IV-V', name: 'I–vi–IV–V (’50s)', category: 'pop-ballad', mode: 'major', style: 'pop',
    steps: [s('1', 'maj', T), s('6', 'm', T), s('4', 'maj', PD), s('5', 'maj', D)],
    description: 'Doo-wop changes. I and vi share two notes; IV and V share none, so watch that transition.' },
  { id: 'I-vi-ii-V-pop', name: 'I–vi–ii–V (triads)', category: 'pop-ballad', mode: 'major', style: 'pop',
    steps: [s('1', 'maj', T), s('6', 'm', T), s('2', 'm', PD), s('5', 'maj', D)],
    description: 'The turnaround with plain triads — the first place to practise inversions.' },
  { id: 'descending-bass', name: 'I–V/7–vi–vi/5–IV (descending bass)', category: 'pop-ballad', mode: 'major', style: 'ballad',
    steps: [s('1', 'maj', T), s('5', 'maj', D, { bass: '7' }), s('6', 'm', T), s('6', 'm', T, { bass: '5' }), s('4', 'maj', PD)],
    description: 'Slash chords make the bass walk down the scale while the right hand barely moves.' },
  { id: 'ballad-iv', name: 'Imaj7–iii7–IVmaj7–iv6 (ballad)', category: 'pop-ballad', mode: 'major', style: 'ballad',
    steps: [s('1', 'maj7', T), s('3', 'm7', T), s('4', 'maj7', PD), s('4', 'm6', PD, { analysis: 'borrowed iv' })],
    description: 'The borrowed minor iv lowers the 6th degree by a half step — the classic bittersweet ballad move.' },
  { id: 'IV-V-iii-vi', name: 'IVmaj7–V7–iii7–vi7', category: 'pop-ballad', mode: 'major', style: 'ballad',
    steps: [s('4', 'maj7', PD), s('5', '7', D), s('3', 'm7', T), s('6', 'm7', T)],
    description: 'A deceptive move: V7 resolves to iii instead of I. Very common in J-pop and modern ballads.' },
  { id: 'minor-pop', name: 'i–♭VI–♭III–♭VII (minor pop)', category: 'pop-ballad', mode: 'minor', style: 'pop',
    steps: [s('1', 'm', T), s('b6', 'maj', PD), s('b3', 'maj', T), s('b7', 'maj', D)],
    description: 'Aeolian (natural-minor) progression. ♭VII replaces the dominant, so there is no leading tone.' },

  // ------------------------------------------------------------------ R&B / Neo-Soul
  { id: 'neo-ii-V-I', name: 'ii9–V13–Imaj9 (neo-soul)', category: 'rnb-neosoul', mode: 'major', style: 'neosoul',
    steps: [s('2', 'm9', PD), s('5', '13', D), s('1', 'maj9', T)],
    description: 'Extended cadence with clusters and fourths; let the colour tones sustain across the changes.' },
  { id: 'rnb-descending', name: 'IVmaj9–iii7–ii9–Imaj9', category: 'rnb-neosoul', mode: 'major', style: 'rnb',
    steps: [s('4', 'maj9', PD), s('3', 'm7', T), s('2', 'm9', PD), s('1', 'maj9', T)],
    description: 'Diatonic stepwise descent — the lush R&B slow-jam sound.' },
  { id: 'gospel-sus', name: 'vi9–ii9–V9sus4–Imaj9', category: 'rnb-neosoul', mode: 'major', style: 'rnb',
    steps: [s('6', 'm9', T), s('2', 'm9', PD), s('5', '9sus4', D), s('1', 'maj9', T)],
    description: 'The sus dominant (IV-over-V sound) softens the cadence; a gospel and R&B staple.' },
  { id: 'dorian-vamp', name: 'i9–IV13 (Dorian vamp)', category: 'rnb-neosoul', mode: 'minor', style: 'neosoul',
    steps: [s('1', 'm9', T), s('4', '13', PD, { analysis: 'Dorian IV' })],
    description: 'Two-chord modal vamp. The 13 of IV is the major 6th of the Dorian mode — the colour that defines it.' },
  { id: 'rnb-backdoor', name: 'IVmaj9–iv9–Imaj9', category: 'rnb-neosoul', mode: 'major', style: 'rnb',
    steps: [s('4', 'maj9', PD), s('4', 'm9', PD, { analysis: 'borrowed iv' }), s('1', 'maj9', T)],
    description: 'Major IV to minor iv: one note (the 3rd) drops a half step for an instant emotional shift.' },
];

export function getProgression(id: string): Progression | undefined {
  return PROGRESSIONS.find((p) => p.id === id);
}

export interface RealizedStep extends ProgressionStep {
  symbol: string;
  numeral: string;
}

/** Spell a progression in a key (tonic of the major or minor key). */
export function realizeProgression(p: Progression, tonic: SpelledNote): RealizedStep[] {
  return p.steps.map((st) => ({
    ...st,
    symbol: chordInKey(tonic, st.degree, st.quality, st.bass),
    // Slash numerals name the bass as a scale degree: V/7 = V with the 7th degree in the bass.
    numeral: romanNumeral(st.degree, st.quality) + (st.bass ? '/' + st.bass : ''),
  }));
}
