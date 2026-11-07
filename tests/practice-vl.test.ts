import { describe, expect, it } from 'vitest';
import { makeSmoothMoveExercise, gradeSmoothMove, VL_LEVELS } from '../src/practice/vl-exercise';
import { makeRng } from '../src/practice/rng';
import { PROGRESSIONS } from '../src/voice-leading/progressions';
import { voiceLeadingCost } from '../src/voice-leading/voice-leading';

describe('smooth-move exercises', () => {
  it('every level references existing progressions', () => {
    for (const l of VL_LEVELS) for (const id of l.progressions) expect(PROGRESSIONS.some((p) => p.id === id), id).toBe(true);
  });

  it('builds valid exercises for every level across many seeds and keys', () => {
    for (const l of VL_LEVELS) {
      for (let seed = 1; seed <= 25; seed++) {
        const ex = makeSmoothMoveExercise(makeRng(seed * 977 + l.level), l.level);
        expect(ex.progression).toBeDefined();
        expect(ex.fromUpper.length).toBeGreaterThanOrEqual(3);
        // the step pair is consecutive chords of the progression
        expect(ex.stepIndex).toBeLessThan(ex.progression.steps.length - 1);
        // best really is the minimum among the offered alternatives
        for (const alt of ex.alternatives) expect(alt.movement).toBeGreaterThanOrEqual(ex.bestMovement);
        expect(voiceLeadingCost(ex.fromUpper, ex.best.notes.map((n) => n.midi))).toBe(ex.bestMovement);
        // playing the library's best answer is graded optimal
        const g = gradeSmoothMove(ex, ex.best.notes.map((n) => n.midi));
        expect(g.valid, `${ex.from.chord.symbol}→${ex.toChord.symbol} ${ex.best.notes.map((n) => n.name).join(' ')} ${g.message}`).toBe(true);
        expect(g.perfect).toBe(true);
      }
    }
  });

  it('is reproducible for a given seed', () => {
    const a = makeSmoothMoveExercise(makeRng(42), 3), b = makeSmoothMoveExercise(makeRng(42), 3);
    expect(a.from.id).toBe(b.from.id);
    expect(a.toChord.symbol).toBe(b.toChord.symbol);
  });

  it('rejects incomplete chords and over-large movement', () => {
    const ex = makeSmoothMoveExercise(makeRng(5), 1);
    expect(gradeSmoothMove(ex, [60, 61]).correct).toBe(false);
    const far = ex.best.notes.map((n) => n.midi + 24);
    const g = gradeSmoothMove(ex, far);
    expect(g.valid).toBe(true); // right notes …
    expect(g.correct).toBe(false); // … but two octaves away
  });
});
