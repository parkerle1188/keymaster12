import { describe, expect, it } from 'vitest';
import {
  GENERATORS, INTERVALS, gradeChoice, gradeKeyboard, noteDistractors, makeQuestion, type Question,
} from '../src/practice/questions';
import {
  emptyProgress, recordAttempt, updateLevel, weakKeys, keyStats, streak, addSession, normaliseProgress, CATEGORIES,
  MAX_SESSIONS, type Category, type SessionRecord,
} from '../src/practice/progress';
import { makeRng, weightedIndex } from '../src/practice/rng';
import {
  parseNote, pitchClassOf, letterIndex, parseDegreeLabel, mod12, LETTERS, keySignature, majorScale, CIRCLE_OF_FIFTHS,
  diatonicChords, romanNumeral, functionOfDegree, tonicFor, chordInKey, circleDistance, formatNote,
} from '../src/music-theory';

/** Independent check: letter = root letter + (degree − 1); pitch = root pc + semitones. */
function expectSpelling(root: string, label: string, answer: string) {
  const r = parseNote(root), a = parseNote(answer), iv = parseDegreeLabel(label);
  expect(letterIndex(a.letter), `${label} above ${root} = ${answer} (letter)`).toBe((letterIndex(r.letter) + iv.degree - 1) % 7);
  expect(pitchClassOf(a), `${label} above ${root} = ${answer} (pitch)`).toBe(mod12(pitchClassOf(r) + iv.semitones));
}

describe('keys and harmony', () => {
  it('key signatures around the circle of fifths', () => {
    expect(CIRCLE_OF_FIFTHS.map((k) => `${k.name}:${k.signature}`).join(' ')).toBe('C:0 G:1 D:2 A:3 E:4 B:5 F#:6 Db:-5 Ab:-4 Eb:-3 Bb:-2 F:-1');
    expect(CIRCLE_OF_FIFTHS.map((k) => formatNote(k.relativeMinor)).join(' ')).toBe('A E B F# C# G# D# Bb F C G D');
    expect(keySignature(parseNote('Gb'))).toBe(-6);
    expect(keySignature(parseNote('C#'))).toBe(7);
  });
  it('major scales spell each letter once', () => {
    for (const k of CIRCLE_OF_FIFTHS) {
      const sc = majorScale(k.tonic);
      expect(new Set(sc.map((n) => n.letter)).size).toBe(7);
      const steps = sc.map((n, i) => mod12(pitchClassOf(sc[(i + 1) % 7]) - pitchClassOf(n)));
      expect(steps).toEqual([2, 2, 1, 2, 2, 2, 1]);
    }
    expect(majorScale(parseNote('F#')).map((n) => formatNote(n)).join(' ')).toBe('F# G# A# B C# D# E#');
  });
  it('diatonic seventh chords, numerals and functions', () => {
    expect(diatonicChords(parseNote('Eb')).map((c) => c.symbol).join(' ')).toBe('Ebmaj7 Fm7 Gm7 Abmaj7 Bb7 Cm7 Dm7b5');
    expect(diatonicChords(parseNote('C')).map((c) => c.numeral).join(' ')).toBe('Imaj7 ii7 iii7 IVmaj7 V7 vi7 viiø7');
    expect(diatonicChords(parseNote('C'), false).map((c) => c.numeral).join(' ')).toBe('I ii iii IV V vi vii°');
    expect([1, 2, 3, 4, 5, 6, 7].map(functionOfDegree)).toEqual(['tonic', 'predominant', 'tonic', 'predominant', 'dominant', 'tonic', 'dominant']);
    expect(romanNumeral('5', '13')).toBe('V13');
    expect(romanNumeral('b6', 'maj')).toBe('♭VI');
    expect(romanNumeral('1', 'mmaj7')).toBe('imaj7');
    expect(romanNumeral('7', 'dim7')).toBe('vii°7');
  });
  it('minor tonic spellings and chords in key', () => {
    expect(Array.from({ length: 12 }, (_, pc) => formatNote(tonicFor(pc, 'minor'))).join(' ')).toBe('C C# D Eb E F F# G G# A Bb B');
    expect(chordInKey(parseNote('A'), '5', 'maj', '7')).toBe('E/G#');
    expect(circleDistance(0, 7)).toBe(1);
    expect(circleDistance(0, 6)).toBe(6);
    expect(circleDistance(0, 5)).toBe(1);
  });
});

describe('question generators', () => {
  const levels = [1, 2, 3, 4, 5];
  const all: Question[] = [];
  for (const cat of CATEGORIES) for (const lv of levels) for (let pc = 0; pc < 12; pc++) {
    const rng = makeRng(1000 * lv + 37 * pc + cat.length);
    for (let i = 0; i < (cat === 'voice-leading' ? 1 : 4); i++) all.push(GENERATORS[cat](rng, lv, pc));
  }

  it('generates every category at every level in every key', () => {
    for (const cat of CATEGORIES) expect(all.filter((q) => q.category === cat).length).toBeGreaterThan(50);
  });

  it('choice questions: the answer is one of 3–4 unique choices', () => {
    for (const q of all.filter((x) => x.input === 'choice')) {
      const vals = q.choices!.map((c) => c.value);
      expect(new Set(vals).size, q.prompt).toBe(vals.length);
      expect(vals, q.prompt).toContain(q.answer);
      expect(vals.length).toBeGreaterThanOrEqual(3);
      expect(gradeChoice(q, q.answer!).correct).toBe(true);
      expect(gradeChoice(q, vals.find((v) => v !== q.answer)!).correct).toBe(false);
    }
  });

  it('spelled answers are correct by letter and pitch (intervals, chord tones, extensions)', () => {
    let n = 0;
    for (const q of all.filter((x) => x.meta)) {
      const answer = q.meta!.top ?? q.answer!;
      expectSpelling(q.meta!.root, q.meta!.label, answer);
      n++;
    }
    expect(n).toBeGreaterThan(400);
  });

  it('interval-identification answers match the shown notes', () => {
    for (const q of all.filter((x) => x.meta?.top)) {
      const def = INTERVALS.find((i) => i.id === q.answer)!;
      expect(def.label).toBe(q.meta!.label);
      const [a, b] = q.showMidis!;
      expect(b.midi - a.midi).toBe(parseDegreeLabel(def.label).semitones);
    }
  });

  it('keyboard questions accept their own solution and reject wrong notes', () => {
    for (const q of all.filter((x) => x.input === 'keyboard')) {
      const sol = q.solution.map((s) => s.midi);
      expect(gradeKeyboard(q, sol).correct, `${q.prompt}: ${q.solution.map((s) => s.name).join(' ')}`).toBe(true);
      // drop an essential tone
      const req = q.target!.required[0];
      expect(gradeKeyboard(q, sol.filter((m) => mod12(m) !== req)).correct).toBe(false);
      // add a foreign note
      const foreign = Array.from({ length: 12 }, (_, i) => i).find((pc) => !q.target!.allowed.includes(pc));
      if (foreign !== undefined) expect(gradeKeyboard(q, [...sol, 72 + foreign]).correct).toBe(false);
    }
  });

  it('construction accepts any inversion/octave; voicing questions demand the right bass note', () => {
    const rng = makeRng(3);
    const c = makeQuestion('construction', rng, 2, 0); // C-rooted seventh chord
    const sol = c.solution.map((s) => s.midi);
    const inverted = [...sol.slice(1), sol[0] + 12].map((m) => m + 12);
    expect(gradeKeyboard(c, inverted).correct).toBe(true);
    const v = makeQuestion('voicing', makeRng(9), 1, 7);
    const vs = v.solution.map((s) => s.midi);
    expect(gradeKeyboard(v, vs.map((m) => m + 12)).correct).toBe(true); // octave doesn't matter
    const rotated = [...vs.slice(1), vs[0] + 12];
    const g = gradeKeyboard(v, rotated);
    expect(g.correct).toBe(false);
    expect(g.message).toMatch(/lowest note/);
  });

  it('flags right-pitch wrong-spelling answers', () => {
    const q: Question = { id: 'x', category: 'chord-tone', keyPc: 6, level: 2, prompt: 'The major 7th of F#maj7?', input: 'choice', answer: 'E#', choices: [{ value: 'E#', label: 'E#' }, { value: 'F', label: 'F' }], solution: [], explanation: '' };
    expect(gradeChoice(q, 'F').message).toMatch(/Right pitch, wrong spelling/);
  });

  it('distractors include the enharmonic twin and never the answer', () => {
    const d = noteDistractors(parseNote('E#'), makeRng(1));
    expect(d[0]).toBe('F');
    expect(d).not.toContain('E#');
    expect(noteDistractors(parseNote('Db'), makeRng(2))[0]).toBe('C#');
  });

  it('levels gate difficulty: level-1 intervals use only M2 M3 P4 P5, in questions and in answer choices', () => {
    for (const q of all.filter((x) => x.category === 'interval' && x.level === 1)) {
      expect(['2', '3', '4', '5']).toContain(q.meta!.label);
      if (q.meta!.top) for (const c of q.choices!) expect(['M2', 'M3', 'P4', 'P5'], q.prompt).toContain(c.value);
    }
    // choices never exceed the level for any interval-identification question
    for (const q of all.filter((x) => x.category === 'interval' && x.meta?.top)) {
      for (const c of q.choices!) expect(INTERVALS.find((i) => i.id === c.value)!.level).toBeLessThanOrEqual(q.level);
    }
  });

  it('level-1 voicing questions only use major/minor triads', () => {
    for (const q of all.filter((x) => x.category === 'voicing' && x.level === 1)) {
      expect(['major', 'minor']).toContain(q.target!.chord.family);
      expect(q.solution.length).toBe(3);
    }
  });

  it('chord spellings in the drills never use triple accidentals', () => {
    for (const q of all) for (const s of q.solution) expect(s.name).not.toMatch(/(bbb|###)/);
    expect(LETTERS.length).toBe(7);
  });
});

describe('progress tracking', () => {
  const att = (category: Category, keyPc: number, correct: boolean, ms = 3000) => ({ category, keyPc, correct, ms });

  it('records attempts per key, category and day', () => {
    let d = emptyProgress();
    const day = new Date(2026, 10, 6, 12);
    d = recordAttempt(d, att('interval', 1, true), day).data;
    d = recordAttempt(d, att('interval', 1, false, 5000), day).data;
    d = recordAttempt(d, att('construction', 6, true), day).data;
    expect(d.byKey[1]).toMatchObject({ n: 2, correct: 1, ms: 8000 });
    expect(d.byCategory.interval.n).toBe(2);
    expect(d.byKeyCategory['construction:6'].correct).toBe(1);
    expect(d.daily['2026-11-06'].n).toBe(3);
  });

  it('adapts the level: up after 8/10 at target speed, down below 50 %', () => {
    let s = { level: 1, recent: [] as { c: boolean; ms: number }[] };
    let change = 0;
    for (let i = 0; i < 10; i++) ({ state: s, change } = updateLevel(s, 'interval', i !== 3, 2000) as { state: typeof s; change: number });
    expect(change).toBe(1);
    expect(s.level).toBe(2);
    // slow answers do not level up even when correct
    for (let i = 0; i < 10; i++) ({ state: s, change } = updateLevel(s, 'interval', true, 20000) as { state: typeof s; change: number });
    expect(s.level).toBe(2);
    s = { level: 2, recent: [] };
    for (let i = 0; i < 6; i++) ({ state: s, change } = updateLevel(s, 'interval', i === 0, 2000) as { state: typeof s; change: number });
    expect(s.level).toBe(1);
    expect(change).toBe(-1);
  });

  it('ranks weak keys: poor accuracy first, then slow, unpractised keys in the middle', () => {
    let d = emptyProgress();
    const now = new Date();
    for (let i = 0; i < 10; i++) d = recordAttempt(d, att('interval', 0, true, 2000), now, false).data;   // C strong
    for (let i = 0; i < 10; i++) d = recordAttempt(d, att('interval', 6, i < 3, 4000), now, false).data;  // F# weak
    for (let i = 0; i < 10; i++) d = recordAttempt(d, att('interval', 1, true, 14000), now, false).data;  // Db slow but right
    const w = weakKeys(d, 12);
    expect(w[0]).toBe(6);
    expect(w[w.length - 1]).toBe(0);
    const stats = keyStats(d);
    expect(stats[6].accuracy).toBeCloseTo(0.3);
    expect(stats[1].weakness).toBeGreaterThan(stats[0].weakness);
    expect(stats[5].weakness).toBeGreaterThan(stats[0].weakness); // unpractised F sits above a strong key
  });

  it('counts the practice streak', () => {
    let d = emptyProgress();
    const day = (n: number) => new Date(2026, 10, n, 10);
    for (const n of [2, 3, 4, 5, 6]) d = recordAttempt(d, att('interval', 0, true), day(n)).data;
    expect(streak(d, day(6))).toBe(5);
    expect(streak(d, day(7))).toBe(5); // today not practised yet: streak still alive
    expect(streak(d, day(8))).toBe(0);
  });

  it('caps stored sessions and repairs partial data', () => {
    let d = emptyProgress();
    const s: SessionRecord = { id: 's', date: new Date().toISOString(), kind: 'workout', title: 't', seconds: 60, tally: { n: 1, correct: 1, ms: 1, rel: 1 }, byCategory: {}, byKey: {} };
    for (let i = 0; i < MAX_SESSIONS + 5; i++) d = addSession(d, { ...s, id: String(i) });
    expect(d.sessions.length).toBe(MAX_SESSIONS);
    expect(d.sessions[0].id).toBe(String(MAX_SESSIONS + 4));
    const repaired = normaliseProgress({ sessions: [] } as never);
    expect(repaired.levels.voicing.level).toBe(1);
    expect(normaliseProgress(null).version).toBe(1);
  });

  it('weighted random picks follow the weights', () => {
    const rng = makeRng(11);
    const counts = [0, 0, 0];
    for (let i = 0; i < 3000; i++) counts[weightedIndex(rng, [1, 0, 3])]++;
    expect(counts[1]).toBe(0);
    expect(counts[2] / counts[0]).toBeGreaterThan(2.4);
    expect(counts[2] / counts[0]).toBeLessThan(3.8);
  });
});
