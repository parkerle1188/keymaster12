import { describe, expect, it } from 'vitest';
import { generateVoicings, realizeTemplate, getTemplate, validateVoicing, lowIntervalIssues, DEFAULT_OPTIONS, type VoicedNote } from '../src/voicing-engine';
import { parseChord, noteNameToMidi } from '../src/music-theory';

const names = (v: { notes: VoicedNote[] }, skipBass = true) => v.notes.filter((n) => !(skipBass && n.isAddedBass)).map((n) => n.name).join(' ');

describe('voicing generation', () => {
  it('returns between 5 and 10 voicings for common chords in every style', () => {
    for (const style of ['pop', 'ballad', 'jazz', 'rnb', 'neosoul'] as const) {
      for (const c of ['C', 'Am', 'Cmaj7', 'Dm7', 'G7', 'Dm9', 'G13', 'Cmaj9', 'F#maj7', 'C7b9', 'Bb13', 'Ebm11']) {
        const vs = generateVoicings(c, { style, mode: 'solo' });
        expect(vs.length, `${c} ${style}`).toBeGreaterThanOrEqual(5);
        expect(vs.length).toBeLessThanOrEqual(10);
      }
    }
  });

  it('regression: Dm9 rootless A = F3 A3 C4 E4', () => {
    const vs = generateVoicings('Dm9', { style: 'jazz', mode: 'band' });
    const a = vs.find((v) => v.template.id === 'rl-a-m9')!;
    expect(a).toBeDefined();
    expect(names(a)).toBe('F3 A3 C4 E4');
    expect(a.bassNote).toEqual({ name: 'D', label: '1', playedBy: 'bassist' });
  });

  it('regression: G13 rootless B = F3 A3 B3 E4 (B E F A as pitch classes)', () => {
    const vs = generateVoicings('G13', { style: 'jazz', mode: 'band' });
    const b = vs.find((v) => v.template.id === 'rl-b-13')!;
    expect(names(b)).toBe('F3 A3 B3 E4');
    expect(new Set(b.notes.map((n) => n.spelled.letter))).toEqual(new Set(['B', 'E', 'F', 'A']));
  });

  it('regression: Cmaj9 rootless A spells E G B D', () => {
    const v = realizeTemplate(getTemplate('rl-a-maj9')!, parseChord('Cmaj9'), { mode: 'band' })[0];
    expect(v.notes.map((n) => n.name.replace(/\d/, '')).join(' ')).toBe('E G B D');
  });

  it('regression: F#maj7 voicings spell E#, never F', () => {
    for (const v of generateVoicings('F#maj7', { style: 'ballad' })) {
      for (const n of v.notes) expect(n.name.startsWith('F') && !n.name.startsWith('F#')).toBe(false);
    }
  });

  it('regression: C7b9 voicings spell Db, never C#', () => {
    for (const v of generateVoicings('C7b9', { style: 'jazz' })) {
      for (const n of v.notes) expect(n.name.startsWith('C#')).toBe(false);
    }
  });

  it('every generated voicing satisfies all hard constraints', () => {
    for (const c of ['C', 'Cm', 'Cmaj7', 'C7', 'Cm7b5', 'Cdim7', 'C7alt', 'Csus4', 'C9sus4', 'C6/9', 'Am7/G', 'Bb/C', 'Gm11', 'E7#9']) {
      for (const mode of ['solo', 'band'] as const) {
        const chord = parseChord(c);
        const opts = { ...DEFAULT_OPTIONS, mode };
        for (const v of generateVoicings(chord, opts)) {
          const requiredPcs = chord.tones.filter((t) => t.required && t.label !== '1').map((t) => t.pitchClass);
          const pcs = new Set(v.notes.map((n) => n.midi % 12));
          for (const pc of requiredPcs) expect(pcs.has(pc), `${c} ${v.template.id}`).toBe(true);
          expect(v.issues.filter((i) => i.severity === 'error')).toEqual([]);
        }
      }
    }
  });

  it('7alt voicings never contain a natural 5th, 9th or 13th', () => {
    for (const v of generateVoicings('C7alt', { style: 'jazz', limit: 10 })) {
      expect(v.notes.map((n) => n.label)).not.toContain('5');
      expect(v.notes.map((n) => n.label)).not.toContain('9');
      expect(v.notes.map((n) => n.label)).not.toContain('13');
    }
  });

  it('suspended chords never include a 3rd', () => {
    for (const c of ['Csus4', 'C7sus4', 'C9sus4']) for (const v of generateVoicings(c, { style: 'rnb' })) expect(v.notes.map((n) => n.label)).not.toContain('3');
  });
});

describe('rootless voicings and bass', () => {
  it('solo mode adds a left-hand root below rootless voicings', () => {
    const v = realizeTemplate(getTemplate('rl-a-m9')!, parseChord('Dm9'), { mode: 'solo' })[0];
    const bass = v.notes.find((n) => n.isAddedBass)!;
    expect(bass.hand).toBe('L');
    expect(bass.label).toBe('1');
    expect(bass.midi % 12).toBe(2);
    expect(bass.midi).toBeLessThan(Math.min(...v.notes.filter((n) => !n.isAddedBass).map((n) => n.midi)));
    expect(v.bassNote?.playedBy).toBe('left-hand');
  });
  it('band mode leaves the root to the bassist', () => {
    const v = realizeTemplate(getTemplate('rl-a-m9')!, parseChord('Dm9'), { mode: 'band' })[0];
    expect(v.notes.some((n) => n.isAddedBass)).toBe(false);
    expect(v.omittedChordTones).toContain('1');
  });
  it('bassist-only upper structures are excluded in solo mode', () => {
    expect(realizeTemplate(getTemplate('us-II-band')!, parseChord('C13#11'), { mode: 'solo' })).toEqual([]);
    expect(realizeTemplate(getTemplate('us-II-band')!, parseChord('C13#11'), { mode: 'band' }).length).toBeGreaterThan(0);
  });
});

describe('slash bass correctness', () => {
  it('puts the slash bass lowest in solo mode', () => {
    for (const c of ['Am7/G', 'C/E', 'Bb/C', 'F/A', 'Ab/Eb']) {
      const chord = parseChord(c);
      const vs = generateVoicings(chord, { mode: 'solo', style: 'pop' });
      expect(vs.length, c).toBeGreaterThan(0);
      for (const v of vs) {
        const lowest = [...v.notes].sort((a, b) => a.midi - b.midi)[0];
        expect(lowest.midi % 12, c).toBe(chord.bassPc);
        expect(lowest.isAddedBass).toBe(true);
        expect(lowest.spelled).toEqual(chord.bass);
      }
    }
  });
  it('band mode tells the bassist which note to play', () => {
    const v = generateVoicings('Am7/G', { mode: 'band', style: 'pop' })[0];
    expect(v.bassNote).toMatchObject({ name: 'G', playedBy: 'bassist' });
  });
});

describe('hand-span validation', () => {
  it('rejects voicings whose hand span exceeds the limit', () => {
    const t = getTemplate('open-maj-tenth')!;
    expect(realizeTemplate(t, parseChord('C'), { maxHandSpan: 12 })).toEqual([]);
    expect(realizeTemplate(t, parseChord('C'), { maxHandSpan: 16 }).length).toBeGreaterThan(0);
  });
  it('limits every generated hand to the requested span', () => {
    for (const span of [12, 14]) {
      for (const v of generateVoicings('Cmaj9', { maxHandSpan: span, style: 'jazz' })) {
        for (const h of ['L', 'R'] as const) {
          const m = v.notes.filter((n) => n.hand === h).map((n) => n.midi);
          if (m.length > 1) expect(Math.max(...m) - Math.min(...m)).toBeLessThanOrEqual(span);
        }
      }
    }
  });
  it('respects keyboard range', () => {
    for (const v of generateVoicings('C13', { range: [48, 84], style: 'jazz', mode: 'band' })) for (const n of v.notes) {
      expect(n.midi).toBeGreaterThanOrEqual(48); expect(n.midi).toBeLessThanOrEqual(84);
    }
  });
});

describe('low-interval limits', () => {
  const n = (name: string): VoicedNote => ({ midi: noteNameToMidi(name), label: '1', role: 'root', spelled: { letter: 'C', acc: 0 }, name, hand: 'L' });
  it('flags low clusters as errors and allows them on request', () => {
    expect(lowIntervalIssues([n('C2'), n('D2')]).some((i) => i.severity === 'error')).toBe(true);
    expect(lowIntervalIssues([n('C2'), n('D2')], true).every((i) => i.severity === 'warning')).toBe(true);
    expect(lowIntervalIssues([n('C4'), n('D4')])).toEqual([]);
    expect(lowIntervalIssues([n('C2'), n('G2')])).toEqual([]);
  });
  it('validator reports hand crossing', () => {
    const notes: VoicedNote[] = [{ ...n('C4'), hand: 'L' }, { ...n('E3'), hand: 'R' }];
    expect(validateVoicing(notes, { options: DEFAULT_OPTIONS, requiredPcs: [] }).some((i) => i.code === 'hand-crossing')).toBe(true);
  });
});
