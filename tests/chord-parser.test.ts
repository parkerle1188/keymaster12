import { describe, expect, it } from 'vitest';
import { parseChord, tryParseChord } from '../src/music-theory';

const notes = (s: string) => parseChord(s).notes.join(' ');
const q = (s: string) => parseChord(s).quality;

describe('chord parsing — qualities', () => {
  it.each([
    ['C', 'maj'], ['Cm', 'm'], ['Cmin', 'm'], ['C-', 'm'], ['Cdim', 'dim'], ['C°', 'dim'], ['Caug', 'aug'], ['C+', 'aug'],
    ['Csus2', 'sus2'], ['Csus4', 'sus4'], ['Csus', 'sus4'], ['Cadd9', 'add9'], ['Cadd2', 'add2'], ['Cmadd9', 'madd9'],
    ['C6', '6'], ['Cm6', 'm6'], ['C6/9', '69'], ['C69', '69'], ['Cm6/9', 'm69'],
    ['Cmaj7', 'maj7'], ['CM7', 'maj7'], ['CΔ7', 'maj7'], ['Cm7', 'm7'], ['C-7', 'm7'], ['C7', '7'],
    ['Cmaj9', 'maj9'], ['Cm9', 'm9'], ['C9', '9'], ['C11', '11'], ['Cm11', 'm11'], ['C13', '13'], ['Cm13', 'm13'],
    ['Cm7b5', 'm7b5'], ['Cø', 'm7b5'], ['Cø7', 'm7b5'], ['Cdim7', 'dim7'], ['C°7', 'dim7'],
    ['C7b9', '7b9'], ['C7#9', '7#9'], ['C7#11', '7#11'], ['C7b13', '7b13'], ['C7alt', '7alt'],
    ['C7sus4', '7sus4'], ['C9sus4', '9sus4'], ['C13sus', '13sus4'], ['Cmaj7#11', 'maj7#11'], ['Cm(maj7)', 'mmaj7'], ['CmM7', 'mmaj7'],
    ['C7(b9,#11)', '7b9#11'], ['C13b9', '13b9'], ['Caug7', '7#5'], ['C7+5', '7#5'], ['C7-9', '7b9'],
  ])('%s → %s', (sym, key) => {
    expect(q(sym)).toBe(key);
  });

  it('rejects nonsense', () => {
    expect(tryParseChord('H7').error).toBeTruthy();
    expect(tryParseChord('Cfoo').error).toBeTruthy();
    expect(tryParseChord('').error).toBeTruthy();
    expect(tryParseChord('Cmsus4').error).toBeTruthy();
  });
});

describe('chord tones and spelling (regression)', () => {
  it('Dm9 = D F A C E', () => expect(notes('Dm9')).toBe('D F A C E'));
  it('G13 = G B D F A E (A optional)', () => {
    const c = parseChord('G13');
    expect(c.notes.join(' ')).toBe('G B D F A E');
    expect(c.tones.find((t) => t.label === '9')!.required).toBe(false);
    expect(c.tones.find((t) => t.label === '13')!.required).toBe(true);
    expect(c.omissions).toContain('11');
  });
  it('Cmaj9 = C E G B D', () => expect(notes('Cmaj9')).toBe('C E G B D'));
  it('F#maj7 = F# A# C# E# (never F)', () => expect(notes('F#maj7')).toBe('F# A# C# E#'));
  it('C7b9 = C E G Bb Db (never C#)', () => expect(notes('C7b9')).toBe('C E G Bb Db'));
  it('spells diminished sevenths with a double flat', () => expect(notes('Cdim7')).toBe('C Eb Gb Bbb'));
  it('spells #9 and b5/#11 by function', () => {
    expect(notes('C7#9')).toBe('C E G Bb D#');
    expect(notes('C7#11')).toBe('C E G Bb F#');
    expect(notes('Cm7b5')).toBe('C Eb Gb Bb');
  });
  it('7alt has no natural 5th and requires an altered tension', () => {
    const c = parseChord('C7alt');
    expect(c.tones.map((t) => t.label)).not.toContain('5');
    expect(c.requireAnyOf[0]).toEqual(['b9', '#9', '#11', 'b13']);
  });
  it('dominant 11 omits the 3rd by convention', () => {
    const c = parseChord('C11');
    expect(c.tones.map((t) => t.label)).not.toContain('3');
    expect(c.omissions).toContain('3');
  });
  it('sus chords have no 3rd', () => {
    expect(notes('Csus4')).toBe('C F G');
    expect(notes('Csus2')).toBe('C D G');
    expect(notes('C9sus4')).toBe('C F G Bb D');
  });
  it('separates implied tones, required tones and available tensions', () => {
    const c = parseChord('Cmaj7');
    expect(c.tones.filter((t) => t.required).map((t) => t.label)).toEqual(['1', '3', '7']);
    expect(c.availableTensions).toEqual(['9', '#11', '13']);
  });
  it('keeps omissions', () => {
    const c = parseChord('C7no5');
    expect(c.tones.map((t) => t.label)).toEqual(['1', '3', 'b7']);
  });
});

describe('slash chords', () => {
  it('parses inversions with the bass as a chord tone', () => {
    const c = parseChord('Am7/G');
    expect(c.bass).toEqual({ letter: 'G', acc: 0 });
    expect(c.bassIsChordTone).toBe(true);
    expect(c.bassLabel).toBe('b7');
    expect(c.symbol).toBe('Am7/G');
  });
  it('parses non-chord-tone bass', () => {
    const c = parseChord('Bb/C');
    expect(c.bassPc).toBe(0);
    expect(c.bassIsChordTone).toBe(false);
  });
  it('does not treat 6/9 as a slash chord', () => {
    expect(parseChord('F6/9').bass).toBeUndefined();
  });
  it('keeps flat bass spelling', () => {
    expect(parseChord('Ab/Eb').bass).toEqual({ letter: 'E', acc: -1 });
  });
});
