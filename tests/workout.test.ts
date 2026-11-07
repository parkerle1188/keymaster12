import { describe, expect, it } from 'vitest';
import { buildWorkout, pickBlockKey, summarizeAttempts, categoryWeakness, dayNumber, WORKOUT_LENGTHS } from '../src/practice/workout';
import { emptyProgress, recordAttempt, type Category, type ProgressData } from '../src/practice/progress';
import { makeRng } from '../src/practice/rng';
import { CIRCLE_OF_FIFTHS } from '../src/music-theory';

const REQUIRED: Category[] = ['interval', 'construction', 'voicing', 'voice-leading'];

function practised(entries: [Category, number, boolean][], times = 1): ProgressData {
  let d = emptyProgress();
  for (let i = 0; i < times; i++) for (const [category, keyPc, correct] of entries) d = recordAttempt(d, { category, keyPc, correct, ms: 3000 }, new Date(), false).data;
  return d;
}

describe('workout planning', () => {
  it('fills exactly 10, 20 and 30 minutes and always combines the four core skills', () => {
    for (const m of WORKOUT_LENGTHS) {
      const p = buildWorkout(m, emptyProgress());
      expect(p.blocks.reduce((s, b) => s + b.seconds, 0)).toBe(m * 60);
      for (const c of REQUIRED) expect(p.blocks.map((b) => b.category)).toContain(c);
      for (const b of p.blocks) { expect(b.seconds).toBeGreaterThanOrEqual(60); expect(b.keys.length).toBeGreaterThan(0); }
    }
    expect(buildWorkout(30, emptyProgress()).blocks.map((b) => b.category)).toContain('extension');
  });

  it('gives the weakest category extra time, taken from the strongest, without changing the total', () => {
    const d = practised([['voice-leading', 0, false], ['interval', 0, true], ['construction', 0, true], ['voicing', 0, true], ['chord-tone', 0, true]], 10);
    const p = buildWorkout(20, d);
    const vl = p.blocks.find((b) => b.category === 'voice-leading')!;
    expect(vl.seconds).toBe(6 * 60);
    expect(vl.why).toMatch(/extra time/);
    expect(p.blocks.reduce((s, b) => s + b.seconds, 0)).toBe(20 * 60);
    expect(p.blocks.some((b) => /shorter/.test(b.why))).toBe(true);
  });

  it('keeps the base allocation when categories are equally strong', () => {
    const p = buildWorkout(10, emptyProgress());
    expect(p.blocks.map((b) => b.seconds / 60)).toEqual([2, 3, 3, 2]);
  });

  it('targets weak keys and rotates a key of the day around the circle', () => {
    const d = practised([['construction', 6, false], ['construction', 0, true], ['interval', 6, false]], 6);
    const p = buildWorkout(10, d, new Date(2026, 10, 6));
    expect(p.focusKeys[0]).toBe(6);
    expect(p.blocks.find((b) => b.category === 'construction')!.keys[0]).toBe(6);
    const k1 = buildWorkout(10, d, new Date(2026, 10, 6)).keyOfTheDay, k2 = buildWorkout(10, d, new Date(2026, 10, 7)).keyOfTheDay;
    const idx = (pc: number) => CIRCLE_OF_FIFTHS.findIndex((k) => k.pc === pc);
    expect((idx(k1) + 1) % 12).toBe(idx(k2));
    expect(dayNumber(new Date(2000, 0, 2))).toBe(1);
  });

  it('uses the stored adaptive level per category', () => {
    const d = emptyProgress();
    d.levels.voicing = { level: 4, recent: [] };
    expect(buildWorkout(20, d).blocks.find((b) => b.category === 'voicing')!.level).toBe(4);
  });

  it('picks weak keys more often inside a block', () => {
    const d = practised([['interval', 6, false], ['interval', 0, true]], 10);
    const block = { category: 'interval' as Category, title: '', seconds: 60, keys: [0, 6], level: 1, why: '' };
    const rng = makeRng(4);
    const counts: Record<number, number> = { 0: 0, 6: 0 };
    for (let i = 0; i < 2000; i++) counts[pickBlockKey(rng, block, d)]++;
    expect(counts[6]).toBeGreaterThan(counts[0] * 2);
    expect(counts[0]).toBeGreaterThan(0); // strong keys still appear
  });

  it('category weakness is 0.5 when unpractised and falls with accuracy', () => {
    expect(categoryWeakness(emptyProgress(), 'voicing')).toBe(0.5);
    expect(categoryWeakness(practised([['voicing', 0, true]], 8), 'voicing')).toBeLessThan(0.2);
  });
});

describe('session summary', () => {
  it('aggregates accuracy, speed, categories and keys', () => {
    const s = summarizeAttempts([
      { category: 'interval', keyPc: 0, correct: true, ms: 2000 },
      { category: 'interval', keyPc: 6, correct: false, ms: 4000 },
      { category: 'voicing', keyPc: 6, correct: true, ms: 9000 },
    ]);
    expect(s.tally.n).toBe(3);
    expect(s.accuracy).toBeCloseTo(2 / 3);
    expect(s.avgSeconds).toBe(5);
    expect(s.byCategory.interval).toMatchObject({ n: 2, correct: 1 });
    expect(s.byKey[6]).toMatchObject({ n: 2, correct: 1, ms: 13000 });
    expect(summarizeAttempts([]).accuracy).toBeNull();
  });
});
