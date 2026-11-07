import { describe, expect, it } from 'vitest';
import {
  matchVoices, voiceLeadingCost, classifyMotion, analyzeTransition, optimizeProgression, independentVoicings,
  candidateVoicings, suggestSmoother, splitBass, checkPlayedVoicing, quickMovement, VOICING_APPROACHES,
} from '../src/voice-leading/voice-leading';
import { PROGRESSIONS, realizeProgression, getProgression } from '../src/voice-leading/progressions';
import { realizeTemplate, getTemplate } from '../src/voicing-engine';
import { parseChord, noteNameToMidi, tonicFor, functionOfDegree, diatonicChords, mod12 } from '../src/music-theory';

const midis = (s: string) => s.split(' ').map(noteNameToMidi);

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
}

describe('voice matching', () => {
  it('computes semitone movement for a textbook ii–V–I (Dm7 → G7 → Cmaj7 close position)', () => {
    // D F A C → D F G B : C→B (−1), A→G (−2), common D and F
    expect(voiceLeadingCost(midis('D4 F4 A4 C5'), midis('D4 F4 G4 B4'))).toBe(3);
    // G7 (B3 D4 F4 G4) → Cmaj7 (B3 C4 E4 G4): D→C 2, F→E 1
    expect(voiceLeadingCost(midis('B3 D4 F4 G4'), midis('B3 C4 E4 G4'))).toBe(3);
  });

  it('sorted pairing equals the brute-force optimum over all permutations', () => {
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed; };
    for (let trial = 0; trial < 200; trial++) {
      const n = 2 + (rnd() % 4);
      const a = Array.from({ length: n }, () => 48 + (rnd() % 30));
      const b = Array.from({ length: n }, () => 48 + (rnd() % 30));
      const brute = Math.min(...permutations(b).map((p) => p.reduce((s, x, i) => s + Math.abs(x - a[i]), 0)));
      expect(voiceLeadingCost(a, b)).toBe(brute);
    }
  });

  it('handles different voice counts by splitting/merging voices, using every note', () => {
    const m = matchVoices(midis('C4 E4 G4'), midis('C4 E4 G4 Bb4'));
    expect(m.cost).toBe(3); // G4 splits into G4 and Bb4
    const usedA = new Set(m.pairs.map(([i]) => i)), usedB = new Set(m.pairs.map(([, j]) => j));
    expect(usedA.size).toBe(3);
    expect(usedB.size).toBe(4);
    expect(voiceLeadingCost(midis('C4 E4 G4 Bb4'), midis('C4 E4 G4'))).toBe(3); // symmetric
  });

  it('is symmetric, zero for identical chords and invariant under transposition', () => {
    const a = midis('E3 G3 B3 D4'), b = midis('F3 A3 C4 E4');
    expect(voiceLeadingCost(a, b)).toBe(voiceLeadingCost(b, a));
    expect(voiceLeadingCost(a, a)).toBe(0);
    expect(voiceLeadingCost(a.map((x) => x + 5), b.map((x) => x + 5))).toBe(voiceLeadingCost(a, b));
  });

  it('classifies motion', () => {
    expect(classifyMotion(0)).toBe('common');
    expect(classifyMotion(-1)).toBe('step');
    expect(classifyMotion(2)).toBe('step');
    expect(classifyMotion(-4)).toBe('skip');
    expect(classifyMotion(5)).toBe('leap');
  });
});

describe('transition analysis', () => {
  const dm9 = realizeTemplate(getTemplate('rl-a-m9')!, parseChord('Dm9'), { mode: 'band' })[0];
  const g13 = realizeTemplate(getTemplate('rl-b-13')!, parseChord('G13'), { mode: 'band' })[0];

  it('Dm9 (rootless A, F A C E) → G13 (rootless B, F A B E): two common tones, C→B a half step', () => {
    const t = analyzeTransition(dm9, g13);
    expect(t.upperMovement).toBe(1);
    expect(t.commonTones).toBe(3);
    const cMove = t.moves.find((m) => m.from.name === 'C4')!;
    expect(cMove.to.name).toBe('B3');
    expect(cMove.from.label).toBe('b7');
    expect(cMove.to.label).toBe('3');
    expect(t.explanation.some((l) => l.includes('7th resolves by step to the 3rd'))).toBe(true);
    // the 3rd of Dm9 (F) is held as the 7th of G13
    const fMove = t.moves.find((m) => m.from.name === 'F3')!;
    expect(fMove.delta).toBe(0);
    expect(fMove.to.label).toBe('b7');
    expect(t.rating).toBe('very smooth');
  });

  it('separates the bass in solo voicings and reports it apart from the upper voices', () => {
    const a = realizeTemplate(getTemplate('rl-a-m9')!, parseChord('Dm9'), { mode: 'solo' })[0];
    const b = realizeTemplate(getTemplate('rl-b-13')!, parseChord('G13'), { mode: 'solo' })[0];
    expect(splitBass(a).bass?.label).toBe('1');
    const t = analyzeTransition(a, b);
    expect(t.upperMovement).toBe(1);
    expect(t.bassMovement).toBe(Math.abs(splitBass(b).bass!.midi - splitBass(a).bass!.midi));
    expect(t.moves[0].isBass).toBe(true);
  });
});

describe('progression optimiser', () => {
  it('voices a jazz ii–V–I more smoothly than independently chosen voicings', () => {
    const chords = ['Dm9', 'G13', 'Cmaj9'];
    const opt = optimizeProgression(chords, { style: 'jazz', mode: 'band' });
    const ind = independentVoicings(chords, { style: 'jazz', mode: 'band' });
    expect(opt.voicings).toHaveLength(3);
    expect(opt.upperMovement).toBeLessThanOrEqual(ind.upperMovement);
    expect(opt.upperMovement).toBeLessThanOrEqual(6);
    // every chosen voicing really voices its own chord
    opt.voicings.forEach((v, i) => expect(v.chord.symbol).toBe(chords[i]));
  });

  it('finds the true minimum path (matches brute force over all candidate combinations)', () => {
    const chords = ['Am', 'F', 'C', 'G'];
    const opts = { style: 'pop' as const, mode: 'solo' as const, candidatesPerChord: 6, movementWeight: 1, qualityWeight: 0, bassWeight: 0 };
    const opt = optimizeProgression(chords, opts);
    const cands = chords.map((c) => candidateVoicings(c, opts));
    let best = Infinity;
    for (const a of cands[0]) for (const b of cands[1]) for (const c of cands[2]) for (const d of cands[3]) {
      const cost = quickMovement(a, b).upper + quickMovement(b, c).upper + quickMovement(c, d).upper;
      best = Math.min(best, cost);
    }
    expect(opt.upperMovement).toBe(best);
  });

  it('respects locked voicings', () => {
    const cands = candidateVoicings('Cmaj7', { style: 'jazz' });
    const lock = cands[cands.length - 1];
    const r = optimizeProgression(['Dm7', 'G7', 'Cmaj7'], { style: 'jazz', locked: { 2: lock.id } });
    expect(r.voicings[2].id).toBe(lock.id);
    // the full candidate list is still returned so the UI can offer alternatives
    expect(r.candidates[2].length).toBe(cands.length);
  });

  it('suggests only voicings that move less than the current one', () => {
    const from = candidateVoicings('Dm7', { style: 'jazz' })[0];
    const current = candidateVoicings('G7', { style: 'jazz' }).sort((a, b) => quickMovement(from, b).upper - quickMovement(from, a).upper)[0];
    const sugg = suggestSmoother(from, 'G7', current, { style: 'jazz' });
    const base = quickMovement(from, current).upper;
    expect(sugg.length).toBeGreaterThan(0);
    for (const s of sugg) {
      expect(s.movement).toBeLessThan(base);
      expect(s.saving).toBe(base - s.movement);
      expect(s.voicing.chord.symbol).toBe('G7');
    }
  });

  it('every reference progression is playable in all 12 keys with the smoothest approach', () => {
    for (const p of PROGRESSIONS) {
      for (let pc = 0; pc < 12; pc++) {
        const steps = realizeProgression(p, tonicFor(pc, p.mode));
        const r = optimizeProgression(steps.map((s) => s.symbol), { style: p.style, mode: 'solo', candidatesPerChord: 12 });
        expect(r.missing, `${p.id} in ${steps.map((s) => s.symbol).join(' ')}`).toEqual([]);
      }
    }
  });

  it('each voicing approach works for ii–V–I in C', () => {
    for (const a of VOICING_APPROACHES) {
      const mode = a.id === 'colour' || a.id === 'rootless' ? 'band' : 'solo';
      const r = optimizeProgression(['Dm7', 'G7', 'Cmaj7'], { style: 'jazz', mode, families: a.families });
      expect(r.missing, a.id).toEqual([]);
    }
  });
});

describe('progression spelling and harmonic function', () => {
  const syms = (id: string, pc: number) => realizeProgression(getProgression(id)!, tonicFor(pc, getProgression(id)!.mode)).map((s) => s.symbol).join(' ');

  it('spells chords by function in every key', () => {
    expect(syms('ii-V-I', 0)).toBe('Dm7 G7 Cmaj7');
    expect(syms('ii-V-I', 1)).toBe('Ebm7 Ab7 Dbmaj7');
    expect(syms('ii-V-I', 6)).toBe('G#m7 C#7 F#maj7');
    expect(syms('minor-ii-V-i', 0)).toBe('Dm7b5 G7b9 Cm6');
    expect(syms('minor-ii-V-i', 1)).toBe('D#m7b5 G#7b9 C#m6');
    expect(syms('I-VI7-ii-V', 0)).toBe('Cmaj7 A7 Dm7 G7');
    expect(syms('backdoor', 0)).toBe('Fm7 Bb7 Cmaj7');
    expect(syms('descending-bass', 0)).toBe('C G/B Am Am/G F');
    expect(syms('minor-pop', 9)).toBe('Am F C G');
  });

  it('respells double-flat roots enharmonically (bII7 in Db is D7, not Ebb7)', () => {
    expect(syms('tritone-sub', 1)).toBe('Ebm7 D7 Dbmaj7');
    expect(syms('tritone-sub', 0)).toBe('Dm7 Db7 Cmaj7');
  });

  it('chord roots sit on the right pitch classes in all keys', () => {
    for (const p of PROGRESSIONS) {
      for (let pc = 0; pc < 12; pc++) {
        const steps = realizeProgression(p, tonicFor(pc, p.mode));
        steps.forEach((st, i) => {
          const c = parseChord(st.symbol);
          const expected = mod12(pc + degreeSemis(p.steps[i].degree));
          expect(c.rootPc, `${p.id} ${st.symbol}`).toBe(expected);
          expect(c.quality).toBe(p.steps[i].quality);
        });
      }
    }
  });

  it('declared functions of diatonic chords agree with the scale-degree function', () => {
    for (const p of PROGRESSIONS.filter((x) => x.mode === 'major')) {
      for (const st of p.steps) {
        if (st.analysis || !/^\d$/.test(st.degree)) continue; // secondary / borrowed chords carry their own analysis
        const isTriad = ['maj', 'm', 'dim'].includes(st.quality);
        const dia = diatonicChords({ letter: 'C', acc: 0 }, !isTriad)[Number(st.degree) - 1];
        if (dia.quality !== st.quality) continue; // non-diatonic quality on this degree
        expect(st.function, `${p.id} ${st.degree}${st.quality}`).toBe(functionOfDegree(Number(st.degree)));
      }
    }
  });

  it('roman numerals', () => {
    const r = realizeProgression(getProgression('minor-ii-V-i')!, tonicFor(0, 'minor')).map((s) => s.numeral);
    expect(r).toEqual(['iiø7', 'V7b9', 'i6']);
    expect(realizeProgression(getProgression('backdoor')!, tonicFor(0)).map((s) => s.numeral)).toEqual(['iv7', '♭VII7', 'Imaj7']);
    expect(realizeProgression(getProgression('descending-bass')!, tonicFor(0))[1].numeral).toBe('V/7');
  });
});

describe('free-play voicing check', () => {
  it('accepts a rootless G7 that keeps common tones, rejects wrong notes and missing guide tones', () => {
    const prev = midis('F3 A3 C4 E4'); // Dm9 rootless
    const ok = checkPlayedVoicing(parseChord('G7'), midis('F3 A3 B3 E4'), prev);
    expect(ok.valid).toBe(true); // A and E are available 9 and 13
    expect(ok.movement).toBe(1);
    const wrong = checkPlayedVoicing(parseChord('G7'), midis('F3 A3 C4 E4'), prev);
    expect(wrong.valid).toBe(false);
    expect(wrong.missing).toContain('3');
    expect(wrong.wrongNotes).toContain(0); // C is the avoid-note 11 on G7
  });
  it('requires the root on triads', () => {
    expect(checkPlayedVoicing(parseChord('C'), midis('E4 G4 B4'), []).valid).toBe(false);
    expect(checkPlayedVoicing(parseChord('C'), midis('E4 G4 C5'), []).valid).toBe(true);
  });
});

function degreeSemis(label: string): number {
  const acc = (label.match(/b/g)?.length ?? 0) * -1 + (label.match(/#/g)?.length ?? 0);
  const d = Number(label.replace(/[b#]/g, ''));
  return [0, 2, 4, 5, 7, 9, 11][(d - 1) % 7] + acc;
}
