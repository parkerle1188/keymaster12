import { describe, expect, it } from 'vitest';
import {
  parseNote, formatNote, noteNameToMidi, midiToName, octaveForSpelling, spelledToMidi, isBlackKey,
  parseDegreeLabel, labelPitchClass, spellInterval, chooseRootSpelling, cycleOfFourths, cycleOfFifths, twelveRoots,
  transposeSpelled, semitoneIntervalName,
} from '../src/music-theory';

describe('note parsing', () => {
  it('parses letters, accidentals and octaves', () => {
    expect(parseNote('F#')).toEqual({ letter: 'F', acc: 1 });
    expect(parseNote('Bb3')).toEqual({ letter: 'B', acc: -1, octave: 3 });
    expect(parseNote('Ebb')).toEqual({ letter: 'E', acc: -2 });
    expect(parseNote('Cx')).toEqual({ letter: 'C', acc: 2 });
    expect(parseNote('g♯4')).toEqual({ letter: 'G', acc: 1, octave: 4 });
    expect(() => parseNote('H')).toThrow();
    expect(() => parseNote('C#b')).toThrow();
  });
  it('formats notes', () => {
    expect(formatNote({ letter: 'E', acc: 1 })).toBe('E#');
    expect(formatNote({ letter: 'B', acc: -2 })).toBe('Bbb');
    expect(formatNote({ letter: 'B', acc: -1 }, { unicode: true })).toBe('B♭');
  });
});

describe('MIDI note parsing', () => {
  it('uses scientific pitch notation (C4 = 60)', () => {
    expect(noteNameToMidi('C4')).toBe(60);
    expect(noteNameToMidi('A4')).toBe(69);
    expect(noteNameToMidi('A0')).toBe(21);
    expect(noteNameToMidi('C8')).toBe(108);
    expect(noteNameToMidi('C-1')).toBe(0);
  });
  it('keeps octave numbers attached to the letter', () => {
    expect(noteNameToMidi('B#3')).toBe(60);
    expect(noteNameToMidi('Cb4')).toBe(59);
    expect(octaveForSpelling(60, { letter: 'B', acc: 1 })).toBe(3);
    expect(octaveForSpelling(59, { letter: 'C', acc: -1 })).toBe(4);
    expect(spelledToMidi({ letter: 'E', acc: 1 }, 4)).toBe(65);
  });
  it('round-trips names and identifies black keys', () => {
    for (let m = 21; m <= 108; m++) expect(noteNameToMidi(midiToName(m))).toBe(m);
    expect(isBlackKey(61)).toBe(true);
    expect(isBlackKey(64)).toBe(false);
  });
  it('rejects names without an octave', () => {
    expect(() => noteNameToMidi('C')).toThrow();
  });
});

describe('chord intervals', () => {
  it('maps degree labels to semitones', () => {
    expect(parseDegreeLabel('b9').semitones).toBe(13);
    expect(parseDegreeLabel('#11').semitones).toBe(18);
    expect(parseDegreeLabel('b13').semitones).toBe(20);
    expect(parseDegreeLabel('13').semitones).toBe(21);
    expect(parseDegreeLabel('bb7').semitones).toBe(9);
    expect(labelPitchClass('#9')).toBe(3);
  });
  it('names intervals', () => {
    expect(semitoneIntervalName(6)).toBe('tritone');
    expect(semitoneIntervalName(14)).toBe('major 9th');
  });
});

describe('enharmonic spelling', () => {
  const sp = (root: string, label: string) => formatNote(spellInterval(parseNote(root), label));
  it('derives the letter from the degree number', () => {
    expect(sp('F#', '7')).toBe('E#');
    expect(sp('F#', '3')).toBe('A#');
    expect(sp('C', 'b9')).toBe('Db');
    expect(sp('C', '#9')).toBe('D#');
    expect(sp('C', '#11')).toBe('F#');
    expect(sp('C', 'b5')).toBe('Gb');
    expect(sp('C', 'bb7')).toBe('Bbb');
    expect(sp('Gb', 'b7')).toBe('Fb');
    expect(sp('B', '#9')).toBe('C##');
  });
  it('prefers a sharp root when a flat root would need double flats', () => {
    // Db7alt needs Ebb (b9) and Bbb (b13); C#7alt spells D and A.
    expect(formatNote(chooseRootSpelling(1, ['1', '3', 'b7', 'b9', 'b13']))).toBe('C#');
    // Db major 7 is perfectly readable with flats
    expect(formatNote(chooseRootSpelling(1, ['1', '3', '5', '7']))).toBe('Db');
  });
});

describe('transposition', () => {
  it('produces 12 distinct roots in each order', () => {
    expect(twelveRoots().map((r) => formatNote(r)).join(' ')).toBe('C Db D Eb E F F# G Ab A Bb B');
    expect(cycleOfFourths().map((r) => formatNote(r)).join(' ')).toBe('C F Bb Eb Ab Db F# B E A D G');
    expect(cycleOfFifths().map((r) => formatNote(r)).join(' ')).toBe('C G D A E B F# Db Ab Eb Bb F');
  });
  it('transposes spelled notes diatonically', () => {
    expect(formatNote(transposeSpelled(parseNote('F#'), 3, 4))).toBe('A#');
    expect(formatNote(transposeSpelled(parseNote('Eb'), 6, 8))).toBe('Cb');
  });
});

import { parseChord, transposeChordSymbol } from '../src/music-theory';
describe('chord symbol transposition', () => {
  it('re-roots chords and slash basses with readable spelling', () => {
    expect(transposeChordSymbol(parseChord('Am7/G'), 2)).toBe('Dm7/C');
    expect(transposeChordSymbol(parseChord('C7b9b13'), 1)).toBe('C#7b9b13');
    expect(transposeChordSymbol(parseChord('Cmaj7'), 6)).toBe('F#maj7');
    expect(transposeChordSymbol(parseChord('Bb/C'), 5)).toBe('F/G');
  });
});
