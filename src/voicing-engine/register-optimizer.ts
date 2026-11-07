/**
 * Octave placement: produce concrete MIDI placements of a root-relative template.
 */
import type { VoicingTemplate } from './voicing-types';

export interface Placement {
  /** MIDI of the (possibly unplayed) root reference for the template. */
  rootMidi: number;
  midis: number[];
}

/**
 * All placements whose lowest template note falls within the template's suggested register
 * (widened by `slack` semitones) and whose notes fit the keyboard range.
 */
export function placeTemplate(template: VoicingTemplate, rootPc: number, range: [number, number], slack = 0): Placement[] {
  const out: Placement[] = [];
  const { bottomMin, bottomMax } = template.register;
  const firstSemis = template.voices[0].semis;
  for (let rootMidi = rootPc; rootMidi <= 127; rootMidi += 12) {
    const bottom = rootMidi + firstSemis;
    if (bottom < bottomMin - slack || bottom > bottomMax + slack) continue;
    const midis = template.voices.map((v) => rootMidi + v.semis);
    if (midis[0] < range[0] || midis[midis.length - 1] > range[1]) continue;
    out.push({ rootMidi, midis });
  }
  return out;
}

/**
 * Choose a bass-note MIDI for a pitch class below a voicing.
 * Prefers the octave closest to `target` that is at least `minGap` semitones below `ceiling`.
 */
export function placeBass(pc: number, ceiling: number, range: [number, number], target = 40, minGap = 7): number | undefined {
  let best: number | undefined;
  for (let m = pc; m <= 127; m += 12) {
    if (m < range[0] || m > range[1]) continue;
    if (m > ceiling - minGap) continue;
    if (m < 28) continue; // below E1 is rarely useful as a chord bass
    if (best === undefined || Math.abs(m - target) < Math.abs(best - target)) best = m;
  }
  return best;
}

export function centroid(midis: number[]): number {
  return midis.reduce((a, b) => a + b, 0) / midis.length;
}
