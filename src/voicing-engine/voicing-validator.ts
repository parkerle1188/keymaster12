/**
 * Hard constraints (errors) and musical warnings for a concrete voicing.
 * Hard constraints are checked before any soft scoring.
 */
import type { GenerationOptions, ValidationIssue, VoicedNote } from './voicing-types';
import { midiToName } from '../music-theory/midi-notes';
import { semitoneIntervalName } from '../music-theory/intervals';

/**
 * Low-interval limits: the lowest MIDI note on which the lower note of an
 * adjacent interval still sounds clear (common arranging guideline, rounded).
 */
export const LOW_INTERVAL_LIMITS: Record<number, number> = {
  1: 52, // m2  E3
  2: 51, // M2  Eb3
  3: 48, // m3  C3
  4: 46, // M3  Bb2
  5: 46, // P4  Bb2
  6: 47, // TT  B2
  7: 34, // P5  Bb1
  8: 43, // m6  G2
  9: 41, // M6  F2
  10: 41, // m7 F2
  11: 41, // M7 F2
};

export function lowIntervalIssues(notes: VoicedNote[], allowLowClusters = false): ValidationIssue[] {
  const sorted = [...notes].sort((a, b) => a.midi - b.midi);
  const out: ValidationIssue[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i].midi;
    const iv = sorted[i + 1].midi - lo;
    const limit = LOW_INTERVAL_LIMITS[iv];
    if (limit === undefined || lo >= limit) continue;
    const isCluster = iv <= 2;
    const deficit = limit - lo;
    const severe = isCluster || deficit >= 4;
    out.push({
      severity: severe && !allowLowClusters ? 'error' : 'warning',
      code: isCluster ? 'low-cluster' : 'low-interval',
      message: `${semitoneIntervalName(iv)} starting on ${midiToName(lo)} is below the low-interval limit (${midiToName(limit)}) and will sound muddy.`,
    });
  }
  return out;
}

export interface ValidateContext {
  options: GenerationOptions;
  requiredPcs: number[];
  slashBassMidi?: number;
}

export function validateVoicing(notes: VoicedNote[], ctx: ValidateContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { options } = ctx;
  const [lo, hi] = options.range;
  const midis = notes.map((n) => n.midi);

  if (midis.some((m) => m < lo || m > hi)) issues.push({ severity: 'error', code: 'range', message: 'Some notes are outside the selected keyboard range.' });
  if (new Set(midis).size !== midis.length) issues.push({ severity: 'error', code: 'duplicate', message: 'Two voices land on the same key.' });

  for (const hand of ['L', 'R'] as const) {
    const hm = notes.filter((n) => n.hand === hand).map((n) => n.midi);
    if (hm.length > 5) issues.push({ severity: 'error', code: 'too-many-notes', message: `${hand === 'L' ? 'Left' : 'Right'} hand has more than five notes.` });
    if (hm.length > 1) {
      const span = Math.max(...hm) - Math.min(...hm);
      if (span > options.maxHandSpan) issues.push({ severity: 'error', code: 'hand-span', message: `${hand === 'L' ? 'Left' : 'Right'}-hand span of ${span} semitones (${semitoneIntervalName(span)}) exceeds your limit of ${options.maxHandSpan}.` });
    }
  }
  // hands must not cross: every LH note at or below every RH note
  const lh = notes.filter((n) => n.hand === 'L').map((n) => n.midi);
  const rh = notes.filter((n) => n.hand === 'R').map((n) => n.midi);
  if (lh.length && rh.length && Math.max(...lh) >= Math.min(...rh)) issues.push({ severity: 'error', code: 'hand-crossing', message: 'Left and right hands overlap.' });

  const pcs = new Set(midis.map((m) => ((m % 12) + 12) % 12));
  for (const pc of ctx.requiredPcs) if (!pcs.has(pc)) issues.push({ severity: 'error', code: 'missing-tone', message: 'A required chord tone is missing.' });

  if (ctx.slashBassMidi !== undefined && Math.min(...midis) !== ctx.slashBassMidi) issues.push({ severity: 'error', code: 'slash-bass', message: 'The slash bass note must be the lowest note.' });

  issues.push(...lowIntervalIssues(notes, options.allowLowClusters));

  // minor-9th between chord tones (except a b9 over the root of a dominant, which is the point of the chord)
  const sorted = [...notes].sort((a, b) => a.midi - b.midi);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[j].midi - sorted[i].midi !== 13) continue;
      const okB9 = (sorted[i].label === '1' || sorted[i].role === 'bass') && sorted[j].label === 'b9';
      const okAlt = sorted[j].role === 'alteration' || sorted[i].role === 'alteration';
      if (!okB9 && !okAlt) {
        issues.push({ severity: 'warning', code: 'minor-ninth', message: `Minor 9th between ${sorted[i].name} and ${sorted[j].name} — usually avoided between chord tones.` });
      }
    }
  }
  return issues;
}

export const hasErrors = (issues: ValidationIssue[]) => issues.some((i) => i.severity === 'error');
