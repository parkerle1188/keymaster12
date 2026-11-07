/**
 * Style profiles: the musical preferences that steer voicing choice (Phase 1)
 * and, in Phase 2, transition costs for progression-wide voice leading.
 */
import type { Style, VoicingFamily } from '../voicing-engine/voicing-types';

export interface StyleProfile {
  id: Style;
  name: string;
  description: string;
  /** Ideal MIDI centre of the voicing (average pitch). */
  center: number;
  /** -1 strongly prefers exactly what the symbol names … +1 welcomes added tensions. */
  colorAttitude: number;
  /** -1 avoids seconds/clusters … +1 seeks them. */
  clusterAttitude: number;
  /** Preference (0..1) for each voicing family. */
  familyWeight: Record<VoicingFamily, number>;
  /** Preference for colour tones (rather than the root) on top. */
  colorTopPreference: number;
  /** Phase 2: how progression-wide voice leading trades smoothness against individual voicing quality. */
  voiceLeading: {
    /** Cost per semitone of upper-voice movement. */
    movementWeight: number;
    /** Cost multiplier for a chord's individual (1 − score). */
    qualityWeight: number;
    text: string;
  };
}

export const STYLE_PROFILES: Record<Style, StyleProfile> = {
  pop: {
    id: 'pop', name: 'Pop', center: 62,
    description: 'Clear triads and open harmony, comfortable hand positions, the melody note easy to hear.',
    colorAttitude: -0.6, clusterAttitude: -0.5, colorTopPreference: 0,
    voiceLeading: { movementWeight: 1, qualityWeight: 1.2, text: 'Keep the hand in one position with inversions; common tones stay put.' },
    familyWeight: { 'triad-inversion': 1, 'seventh-inversion': 0.8, shell: 0.3, 'rootless-a': 0.25, 'rootless-b': 0.25, open: 1, 'drop-2': 0.5, quartal: 0.35, 'upper-structure': 0.2, 'rnb-color': 0.5 },
  },
  ballad: {
    id: 'ballad', name: 'Ballad', center: 60,
    description: 'Spacious, sustained voicings with a singing top line; light colour tones welcome.',
    colorAttitude: -0.1, clusterAttitude: -0.2, colorTopPreference: 0.2,
    voiceLeading: { movementWeight: 1, qualityWeight: 1, text: 'Smooth inner voices under a singing top line; avoid jumps that break the legato.' },
    familyWeight: { 'triad-inversion': 0.7, 'seventh-inversion': 0.7, shell: 0.6, 'rootless-a': 0.6, 'rootless-b': 0.6, open: 1, 'drop-2': 0.85, quartal: 0.5, 'upper-structure': 0.5, 'rnb-color': 0.6 },
  },
  jazz: {
    id: 'jazz', name: 'Jazz', center: 59,
    description: 'Guide tones, rootless voicings and smooth inner voices; extensions are expected.',
    colorAttitude: 0.4, clusterAttitude: 0, colorTopPreference: 0.5,
    voiceLeading: { movementWeight: 1.2, qualityWeight: 0.9, text: 'Guide tones (3rds and 7ths) move by half or whole step; rootless A and B alternate.' },
    familyWeight: { 'triad-inversion': 0.15, 'seventh-inversion': 0.35, shell: 0.85, 'rootless-a': 1, 'rootless-b': 1, open: 0.5, 'drop-2': 0.85, quartal: 0.8, 'upper-structure': 0.85, 'rnb-color': 0.4 },
  },
  rnb: {
    id: 'rnb', name: 'R&B', center: 60,
    description: 'Rich extensions, mid-register clusters and gospel-derived colour.',
    colorAttitude: 0.6, clusterAttitude: 0.6, colorTopPreference: 0.4,
    voiceLeading: { movementWeight: 0.9, qualityWeight: 1.1, text: 'Lush clusters slide by step; colour matters as much as smoothness.' },
    familyWeight: { 'triad-inversion': 0.35, 'seventh-inversion': 0.45, shell: 0.4, 'rootless-a': 0.7, 'rootless-b': 0.7, open: 0.75, 'drop-2': 0.45, quartal: 0.6, 'upper-structure': 0.75, 'rnb-color': 1 },
  },
  neosoul: {
    id: 'neosoul', name: 'Neo-Soul', center: 59,
    description: 'Quartal harmony, upper structures and colourful voice-leading.',
    colorAttitude: 0.7, clusterAttitude: 0.5, colorTopPreference: 0.6,
    voiceLeading: { movementWeight: 0.9, qualityWeight: 1.1, text: 'Parallel quartal and cluster shapes are welcome; colour over strict economy.' },
    familyWeight: { 'triad-inversion': 0.15, 'seventh-inversion': 0.3, shell: 0.4, 'rootless-a': 0.8, 'rootless-b': 0.8, open: 0.6, 'drop-2': 0.55, quartal: 1, 'upper-structure': 0.95, 'rnb-color': 1 },
  },
};
