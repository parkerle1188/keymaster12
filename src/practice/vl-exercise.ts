/**
 * "Smooth move" voice-leading exercises: a voicing of chord A is shown, the student voices chord B
 * with as little motion as possible. Built from the reference progressions in any key.
 */
import { parseChord, type ParsedChord } from '../music-theory/chord-parser';
import { tonicFor } from '../music-theory/harmony';
import { PROGRESSIONS, realizeProgression, type Progression } from '../voice-leading/progressions';
import { candidateVoicings, checkPlayedVoicing, quickMovement, splitBass, type PlayedVoicingCheck } from '../voice-leading/voice-leading';
import type { GeneratedVoicing, VoicingFamily } from '../voicing-engine/voicing-types';
import { pick, type Rng } from './rng';

export interface VlLevel {
  level: number;
  name: string;
  progressions: string[];
  families: VoicingFamily[];
}

export const VL_LEVELS: VlLevel[] = [
  { level: 1, name: 'Triads & inversions', progressions: ['I-V-vi-IV', 'vi-IV-I-V', 'I-vi-IV-V', 'I-vi-ii-V-pop', 'minor-pop'], families: ['triad-inversion'] },
  { level: 2, name: 'Seventh chords', progressions: ['ii-V-I', 'I-vi-ii-V', 'IV-V-iii-vi', 'ballad-iv'], families: ['seventh-inversion'] },
  { level: 3, name: 'Rootless jazz voicings', progressions: ['ii-V-I-ext', 'neo-ii-V-I', 'gospel-sus', 'minor-ii-V-i'], families: ['rootless-a', 'rootless-b'] },
  { level: 4, name: 'Turnarounds & substitutions', progressions: ['iii-vi-ii-V-I', 'I-VI7-ii-V', 'tritone-sub', 'backdoor', 'rnb-descending'], families: ['rootless-a', 'rootless-b', 'seventh-inversion', 'drop-2'] },
  { level: 5, name: 'Colour voicings', progressions: ['neo-ii-V-I', 'rnb-backdoor', 'dorian-vamp', 'gospel-sus', 'rnb-descending'], families: ['rootless-a', 'rootless-b', 'quartal', 'rnb-color'] },
];

export interface SmoothMoveExercise {
  level: number;
  keyPc: number;
  progression: Progression;
  stepIndex: number;
  from: GeneratedVoicing;
  fromUpper: number[];
  toChord: ParsedChord;
  fromNumeral: string;
  toNumeral: string;
  best: GeneratedVoicing;
  bestMovement: number;
  /** Other candidate voicings of the target with their movement, smoothest first. */
  alternatives: { voicing: GeneratedVoicing; movement: number }[];
}

export const VL_TOLERANCE = 2;

export function makeSmoothMoveExercise(rng: Rng, level: number, keyPc?: number): SmoothMoveExercise {
  const lv = VL_LEVELS[Math.max(1, Math.min(VL_LEVELS.length, level)) - 1];
  for (let attempt = 0; attempt < 30; attempt++) {
    const progId = pick(rng, lv.progressions);
    const progression = PROGRESSIONS.find((p) => p.id === progId);
    if (!progression) throw new Error(`Unknown progression ${progId}`);
    const pc = keyPc ?? Math.floor(rng() * 12);
    const steps = realizeProgression(progression, tonicFor(pc, progression.mode));
    const i = Math.floor(rng() * (steps.length - 1));
    const opts = { style: progression.style, mode: 'band' as const, families: lv.families, candidatesPerChord: 24, allowEnriched: level >= 3 };
    const fromCands = candidateVoicings(steps[i].symbol, opts).filter((v) => !splitBass(v).bass);
    const toChord = parseChord(steps[i + 1].symbol);
    const toCands = candidateVoicings(toChord, opts).filter((v) => !splitBass(v).bass);
    if (!fromCands.length || !toCands.length) continue;
    const from = pick(rng, fromCands.slice(0, 6));
    const ranked = toCands.map((v) => ({ voicing: v, movement: quickMovement(from, v).upper })).sort((a, b) => a.movement - b.movement || b.voicing.score.total - a.voicing.score.total);
    return {
      level: lv.level, keyPc: pc, progression, stepIndex: i, from, fromUpper: from.notes.map((n) => n.midi).sort((a, b) => a - b),
      toChord, fromNumeral: steps[i].numeral, toNumeral: steps[i + 1].numeral,
      best: ranked[0].voicing, bestMovement: ranked[0].movement, alternatives: ranked.slice(1, 6),
    };
  }
  throw new Error('Could not build a voice-leading exercise');
}

export interface SmoothMoveGrade extends PlayedVoicingCheck {
  correct: boolean;
  perfect: boolean;
  message: string;
}

export function gradeSmoothMove(ex: SmoothMoveExercise, played: number[]): SmoothMoveGrade {
  const chk = checkPlayedVoicing(ex.toChord, played, ex.fromUpper);
  const sym = ex.toChord.symbol;
  if (played.length < 3) return { ...chk, correct: false, perfect: false, message: 'Play at least three notes.' };
  if (!chk.valid) {
    const parts: string[] = [];
    if (chk.missing.length) parts.push(`missing ${chk.missing.join(', ')}`);
    if (chk.wrongNotes.length) parts.push(`${chk.wrongNotes.length} note${chk.wrongNotes.length > 1 ? 's' : ''} not in ${sym}`);
    return { ...chk, correct: false, perfect: false, message: `Not a complete ${sym}: ${parts.join('; ')}.` };
  }
  const perfect = chk.movement <= ex.bestMovement;
  const correct = chk.movement <= ex.bestMovement + VL_TOLERANCE;
  const message = perfect
    ? `Excellent — ${chk.movement} semitone${chk.movement === 1 ? '' : 's'} of movement${chk.movement < ex.bestMovement ? ', even smoother than the library voicing' : ', as smooth as the best library voicing'}.`
    : correct
      ? `Good — ${chk.movement} semitones. The smoothest library voicing moves ${ex.bestMovement}.`
      : `Correct chord, but it moves ${chk.movement} semitones; the smoothest option moves only ${ex.bestMovement}. Keep common tones and move the rest by step.`;
  return { ...chk, correct, perfect, message };
}
