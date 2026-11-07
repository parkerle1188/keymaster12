import { describe, expect, it } from 'vitest';
import { VOICING_LIBRARY, templateFitsChord, parseTemplateDsl, templateInAllKeys, type VoicingFamily } from '../src/voicing-engine';
import { parseChord, maxAccidental } from '../src/music-theory';

describe('curated voicing library', () => {
  it('contains at least 120 distinct templates (transpositions not counted)', () => {
    expect(VOICING_LIBRARY.length).toBeGreaterThanOrEqual(120);
    const keys = new Set(VOICING_LIBRARY.map((t) => t.voices.map((v) => `${v.label}@${v.semis}${v.hand}`).join(',') + (t.oneHand ? '/1' : '/2')));
    expect(keys.size).toBe(VOICING_LIBRARY.length);
    expect(new Set(VOICING_LIBRARY.map((t) => t.id)).size).toBe(VOICING_LIBRARY.length);
  });

  it('covers all ten voicing families', () => {
    const fams: VoicingFamily[] = ['triad-inversion', 'seventh-inversion', 'shell', 'rootless-a', 'rootless-b', 'open', 'drop-2', 'quartal', 'upper-structure', 'rnb-color'];
    for (const f of fams) expect(VOICING_LIBRARY.some((t) => t.family === f)).toBe(true);
  });

  it('every template fits its own declared chord quality', () => {
    for (const t of VOICING_LIBRARY) {
      const chord = parseChord('C' + (t.quality === 'maj' ? '' : t.quality));
      const fit = templateFitsChord(t, chord);
      expect(fit.ok, `${t.id}: ${fit.reason}`).toBe(true);
      expect(fit.matchType, `${t.id} should be an exact match for ${t.quality}`).toBe('exact');
    }
  });

  it('every template defines all required metadata honestly', () => {
    for (const t of VOICING_LIBRARY) {
      expect(t.voices.length).toBeGreaterThanOrEqual(2);
      expect(t.labels.length).toBe(t.voices.length);
      expect(t.styles.length).toBeGreaterThan(0);
      expect(t.explanation.length).toBeGreaterThan(20);
      expect(t.register.bottomMin).toBeLessThan(t.register.bottomMax);
      expect(t.difficulty).toBeGreaterThanOrEqual(1);
      expect(t.difficulty).toBeLessThanOrEqual(5);
      expect(t.review.status).toBe('curated-unreviewed');
      expect(t.requiredTones.length).toBeGreaterThan(0);
      // ordered low → high
      for (let i = 1; i < t.voices.length; i++) expect(t.voices[i].semis).toBeGreaterThan(t.voices[i - 1].semis);
      // left hand entirely below right hand
      const lh = t.voices.filter((v) => v.hand === 'L').map((v) => v.semis);
      const rh = t.voices.filter((v) => v.hand === 'R').map((v) => v.semis);
      if (lh.length && rh.length) expect(Math.max(...lh)).toBeLessThan(Math.min(...rh));
    }
  });

  it('classifies rootless voicings correctly', () => {
    for (const t of VOICING_LIBRARY.filter((t) => t.family === 'rootless-a' || t.family === 'rootless-b')) {
      expect(t.labels).not.toContain('1');
      expect(t.bassRequirement).toBe('external-bass');
      expect(t.omittedTones).toContain('1');
    }
    expect(VOICING_LIBRARY.find((t) => t.id === 'us-II-band')!.bassRequirement).toBe('bassist-required');
    expect(VOICING_LIBRARY.find((t) => t.id === 'shell-7-r37')!.bassRequirement).toBe('root-included');
  });

  it('Type A rootless starts on the 3rd, Type B on the 7th (or 6th)', () => {
    for (const t of VOICING_LIBRARY.filter((t) => t.family === 'rootless-a')) expect(['3', 'b3', '4']).toContain(t.labels[0]);
    for (const t of VOICING_LIBRARY.filter((t) => t.family === 'rootless-b')) expect(['7', 'b7', '6']).toContain(t.labels[0]);
  });
});

describe('template DSL / octave placement', () => {
  it('stacks voices upward', () => {
    const { voices, oneHand } = parseTemplateDsl('3 13 b7 9');
    expect(oneHand).toBe(true);
    expect(voices.map((v) => v.semis)).toEqual([4, 9, 10, 14]);
  });
  it('splits hands and honours octave skips', () => {
    const { voices } = parseTemplateDsl('1 5 | ^1 3 5');
    expect(voices.map((v) => v.hand).join('')).toBe('LLRRR');
    expect(voices.map((v) => v.semis)).toEqual([0, 7, 24, 28, 31]);
  });
});

describe('transposition into all 12 keys', () => {
  it('every template realises with readable spelling in all 12 keys', () => {
    for (const t of VOICING_LIBRARY) {
      const keys = templateInAllKeys(t, { mode: t.bassRequirement === 'bassist-required' ? 'band' : 'solo', maxHandSpan: 16, allowLowClusters: true });
      expect(keys.length).toBe(12);
      for (const k of keys) {
        expect(k.voicing, `${t.id} in ${k.symbol}: ${k.reason}`).toBeDefined();
        const spelled = k.voicing!.notes.map((n) => n.spelled);
        expect(maxAccidental(spelled), `${t.id} in ${k.symbol}`).toBeLessThanOrEqual(2);
        // transposition preserves interval structure
        const base = t.voices.map((v) => v.semis - t.voices[0].semis);
        const upper = k.voicing!.notes.filter((n) => !n.isAddedBass).map((n) => n.midi);
        expect(upper.map((m) => m - upper[0])).toEqual(base);
      }
    }
  });
});
