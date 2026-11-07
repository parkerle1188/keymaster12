import type { DegreeLabel, ToneRole } from '../music-theory/intervals';
import type { SpelledNote } from '../music-theory/note-parser';
import type { ParsedChord } from '../music-theory/chord-parser';

export type Hand = 'L' | 'R';
export type Style = 'pop' | 'ballad' | 'jazz' | 'rnb' | 'neosoul';
export const STYLES: Style[] = ['pop', 'ballad', 'jazz', 'rnb', 'neosoul'];
export const STYLE_LABELS: Record<Style, string> = { pop: 'Pop', ballad: 'Ballad', jazz: 'Jazz', rnb: 'R&B', neosoul: 'Neo-Soul' };

export type VoicingFamily =
  | 'triad-inversion' | 'seventh-inversion' | 'shell' | 'rootless-a' | 'rootless-b'
  | 'open' | 'drop-2' | 'quartal' | 'upper-structure' | 'rnb-color';

export const FAMILY_LABELS: Record<VoicingFamily, string> = {
  'triad-inversion': 'Triad inversion', 'seventh-inversion': 'Seventh-chord inversion', shell: 'Shell',
  'rootless-a': 'Rootless Type A', 'rootless-b': 'Rootless Type B', open: 'Open / spread', 'drop-2': 'Drop 2',
  quartal: 'Quartal', 'upper-structure': 'Upper structure', 'rnb-color': 'R&B / Neo-Soul colour',
};

export type BassRequirement =
  /** The template itself contains the root (usually as its lowest note). */
  | 'root-included'
  /** One-hand rootless voicing: a bassist (band) or an added left-hand bass note (solo) supplies the root. */
  | 'external-bass'
  /** Left hand holds guide tones without the root: a bassist must supply it (band mode only). */
  | 'bassist-required';

export type ReviewStatus = 'curated-unreviewed' | 'human-reviewed';

export interface TemplateVoice {
  label: DegreeLabel;
  /** Semitones above the root at the template's reference octave (can exceed 24). */
  semis: number;
  hand: Hand;
}

export interface VoicingTemplate {
  id: string;
  name: string;
  /** Canonical chord-quality key this template is written for (e.g. "m9", "13", "7alt"). */
  quality: string;
  family: VoicingFamily;
  /** Ordered low → high. */
  voices: TemplateVoice[];
  /** true when the whole shape is played by a single hand (hand chosen at generation time). */
  oneHand: boolean;
  labels: DegreeLabel[];
  styles: Style[];
  /** Suggested MIDI range for the voicing's lowest template note. */
  register: { bottomMin: number; bottomMax: number; description: string };
  difficulty: 1 | 2 | 3 | 4 | 5;
  requiredTones: DegreeLabel[];
  optionalTones: DegreeLabel[];
  omittedTones: DegreeLabel[];
  bassRequirement: BassRequirement;
  /** Largest per-hand span in semitones. */
  maxHandSpan: number;
  explanation: string;
  review: { status: ReviewStatus; note: string };
  /** The compact source definition (kept for transparency/debugging). */
  dsl: string;
}

export interface VoicedNote {
  midi: number;
  label: DegreeLabel;
  role: ToneRole | 'bass';
  spelled: SpelledNote;
  name: string;
  hand: Hand;
  /** Added by the generator (solo-mode bass or slash bass), not part of the template. */
  isAddedBass?: boolean;
}

export type GenerationMode = 'solo' | 'band';

export interface GenerationOptions {
  style: Style;
  mode: GenerationMode;
  /** Inclusive MIDI range of the instrument. */
  range: [number, number];
  /** Maximum comfortable span for one hand in semitones (12 = octave, 14 = 9th, 16 = 10th). */
  maxHandSpan: number;
  /** Highest template difficulty to consider. */
  maxDifficulty: number;
  families?: VoicingFamily[];
  allowLowClusters?: boolean;
  limit?: number;
  /** Include templates that add available tensions not named in the symbol. */
  allowEnriched?: boolean;
}

export interface ValidationIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
}

export interface ScoreBreakdown {
  total: number;
  components: { key: string; label: string; cost: number; weight: number }[];
}

export interface GeneratedVoicing {
  id: string;
  template: VoicingTemplate;
  chord: ParsedChord;
  notes: VoicedNote[];
  matchType: 'exact' | 'enriched';
  addedTensions: DegreeLabel[];
  /** Chord tones implied by the symbol but not played. */
  omittedChordTones: DegreeLabel[];
  bassNote?: { name: string; label: DegreeLabel | 'bass'; playedBy: 'left-hand' | 'bassist' };
  issues: ValidationIssue[];
  score: ScoreBreakdown;
  explanation: string[];
}
