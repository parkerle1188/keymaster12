/**
 * Question generators for the 12-key drills and the daily workout.
 *
 * Every generator takes (rng, level 1–5, key pitch class) and returns a self-contained Question.
 * Spelled answers come from the theory engine (spellInterval / parseChord), so "the 7th of F#maj7"
 * is E#, never F. Keyboard answers are graded by pitch class (a keyboard cannot tell E# from F),
 * and the correct spelling is shown afterwards.
 */
import { parseChord, type ParsedChord } from '../music-theory/chord-parser';
import { spellInterval } from '../music-theory/enharmonic-spelling';
import { diatonicChords, majorScale, tonicFor } from '../music-theory/harmony';
import { labelPitchClass, parseDegreeLabel } from '../music-theory/intervals';
import { formatMidiAs, midiToName } from '../music-theory/midi-notes';
import { LETTERS, formatNote, letterIndex, mod12, pitchClassOf, type Letter, type SpelledNote } from '../music-theory/note-parser';
import { realizeTemplate } from '../voicing-engine/voicing-generator';
import { VOICING_LIBRARY } from '../voicing-engine/voicing-library';
import { FAMILY_LABELS, type VoicingFamily } from '../voicing-engine/voicing-types';
import { quickMovement, splitBass } from '../voice-leading/voice-leading';
import type { Category } from './progress';
import { pick, shuffle, type Rng } from './rng';
import { makeSmoothMoveExercise } from './vl-exercise';

export interface Choice {
  value: string;
  label: string;
  detail?: string;
}

export interface KeyboardTarget {
  chord: ParsedChord;
  /** Pitch classes that must be played. */
  required: number[];
  /** Pitch classes that may be played. */
  allowed: number[];
  /** Exact pitch-class set (voicing questions). */
  exact?: number[];
  /** Pitch class of the lowest note (voicing questions). */
  lowestPc?: number;
}

export interface Question {
  id: string;
  category: Category;
  keyPc: number;
  level: number;
  prompt: string;
  detail?: string;
  /** Notes shown on a keyboard while answering. */
  showMidis?: { midi: number; name: string; label?: string }[];
  /** Notes heard with the "play" button. */
  playMidis?: number[];
  input: 'choice' | 'keyboard';
  choices?: Choice[];
  answer?: string;
  target?: KeyboardTarget;
  /** Revealed after answering. */
  solution: { midi: number; name: string; label?: string }[];
  explanation: string;
  /** Keyboard window for keyboard questions. */
  range?: [number, number];
  /** Rings on the answer keyboard (voice-leading questions). */
  ghosts?: number[];
  /** Spelled-note questions: the root and degree label the answer was derived from. */
  meta?: { root: string; label: string; top?: string };
}

// ----------------------------------------------------------------------------- intervals

export interface IntervalDef { id: string; name: string; label: string; level: number }

export const INTERVALS: IntervalDef[] = [
  { id: 'M2', name: 'major 2nd', label: '2', level: 1 },
  { id: 'M3', name: 'major 3rd', label: '3', level: 1 },
  { id: 'P4', name: 'perfect 4th', label: '4', level: 1 },
  { id: 'P5', name: 'perfect 5th', label: '5', level: 1 },
  { id: 'm2', name: 'minor 2nd', label: 'b2', level: 2 },
  { id: 'm3', name: 'minor 3rd', label: 'b3', level: 2 },
  { id: 'M6', name: 'major 6th', label: '6', level: 2 },
  { id: 'P8', name: 'octave', label: '8', level: 2 },
  { id: 'm6', name: 'minor 6th', label: 'b6', level: 3 },
  { id: 'm7', name: 'minor 7th', label: 'b7', level: 3 },
  { id: 'M7', name: 'major 7th', label: '7', level: 3 },
  { id: 'A4', name: 'augmented 4th', label: '#4', level: 4 },
  { id: 'd5', name: 'diminished 5th', label: 'b5', level: 4 },
  { id: 'A5', name: 'augmented 5th', label: '#5', level: 4 },
  { id: 'm9', name: 'minor 9th', label: 'b9', level: 5 },
  { id: 'M9', name: 'major 9th', label: '9', level: 5 },
  { id: 'A9', name: 'augmented 9th', label: '#9', level: 5 },
  { id: 'P11', name: 'perfect 11th', label: '11', level: 5 },
  { id: 'A11', name: 'augmented 11th', label: '#11', level: 5 },
  { id: 'm13', name: 'minor 13th', label: 'b13', level: 5 },
  { id: 'M13', name: 'major 13th', label: '13', level: 5 },
];

export const intervalsForLevel = (level: number) => INTERVALS.filter((i) => i.level <= level);

const sn = (n: SpelledNote) => formatNote(n);
let counter = 0;
const qid = (c: string) => `${c}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/** MIDI for a spelled note at or above `floor`. */
function midiAbove(n: SpelledNote, floor: number): number {
  const pc = pitchClassOf(n);
  return floor + mod12(pc - floor);
}

/**
 * Three plausible wrong spellings: the enharmonic twin (the classic spelling error), the same letter
 * with another accidental, and neighbouring letters.
 */
export function noteDistractors(answer: SpelledNote, rng: Rng): string[] {
  const ans = sn(answer);
  const pc = pitchClassOf(answer);
  const li = letterIndex(answer.letter);
  const cands: SpelledNote[] = [];
  for (const d of [-1, 1]) {
    const letter = LETTERS[(li + d + 7) % 7] as Letter;
    let acc = pc - pitchClassOf({ letter, acc: 0 });
    if (acc > 6) acc -= 12;
    if (acc < -6) acc += 12;
    if (Math.abs(acc) <= 2) cands.push({ letter, acc }); // enharmonic spelling
  }
  for (const d of [-1, 1]) if (Math.abs(answer.acc + d) <= 2) cands.push({ letter: answer.letter, acc: answer.acc + d });
  for (const d of [-1, 1]) cands.push({ letter: LETTERS[(li + d + 7) % 7] as Letter, acc: answer.acc });
  const out: string[] = [];
  for (const c of cands) {
    const s = sn(c);
    if (s !== ans && !out.includes(s)) out.push(s);
  }
  // Keep the enharmonic twin (most instructive), then random others.
  const [first, ...rest] = out;
  return [first, ...shuffle(rng, rest)].filter(Boolean).slice(0, 3);
}

function noteChoiceQuestion(base: Omit<Question, 'id' | 'input' | 'choices' | 'answer'>, answer: SpelledNote, rng: Rng): Question {
  const a = sn(answer);
  const choices = shuffle(rng, [a, ...noteDistractors(answer, rng)]).map((v) => ({ value: v, label: v }));
  return { ...base, id: qid(base.category), input: 'choice', choices, answer: a };
}

/** A note from the key's major scale (keeps drills focused on the key's own spelling). */
function scaleNote(rng: Rng, keyPc: number): SpelledNote {
  return pick(rng, majorScale(tonicFor(keyPc)));
}

export function intervalQuestion(rng: Rng, level: number, keyPc: number): Question {
  const pool = intervalsForLevel(level);
  for (let t = 0; t < 50; t++) {
    const iv = pick(rng, pool);
    const root = t < 40 ? scaleNote(rng, keyPc) : tonicFor(keyPc);
    const ans = spellInterval(root, iv.label);
    if (Math.abs(ans.acc) > 1 && t < 45) continue; // keep double accidentals out of the quiz
    const r = midiAbove(root, 55);
    const top = r + parseDegreeLabel(iv.label).semitones;
    const show = [{ midi: r, name: formatMidiAs(r, root), label: '1' }, { midi: top, name: formatMidiAs(top, ans), label: iv.label }];
    const explanation = `${iv.name} = ${parseDegreeLabel(iv.label).semitones} semitones and ${parseDegreeLabel(iv.label).degree - 1} letter${parseDegreeLabel(iv.label).degree === 2 ? '' : 's'} up: ${sn(root)} → ${sn(ans)}.`;

    if (rng() < 0.55) {
      return noteChoiceQuestion({
        category: 'interval', keyPc, level, prompt: `${cap(iv.name)} above ${sn(root)}?`,
        detail: 'Spell it by letter: count the letters first, then fix the accidental.',
        playMidis: [r, top], solution: show, explanation, meta: { root: sn(root), label: iv.label },
      }, ans, rng);
    }
    // Name the interval between two spelled notes.
    const others = shuffle(rng, pool.filter((x) => x.id !== iv.id));
    // Enharmonic twin (A4 vs d5) — only from intervals already unlocked at this level.
    const twin = pool.find((x) => x.id !== iv.id && mod12(parseDegreeLabel(x.label).semitones) === mod12(parseDegreeLabel(iv.label).semitones));
    const opts = [iv, ...(twin ? [twin] : []), ...others].filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i).slice(0, 4);
    return {
      id: qid('interval'), category: 'interval', keyPc, level, input: 'choice',
      prompt: `${sn(root)} up to ${sn(ans)} is a…`, detail: 'The letters decide the interval number; the semitones decide its quality.',
      showMidis: show, playMidis: [r, top],
      choices: shuffle(rng, opts).map((x) => ({ value: x.id, label: x.name })), answer: iv.id, solution: show, explanation,
      meta: { root: sn(root), label: iv.label, top: sn(ans) },
    };
  }
  throw new Error('interval question generation failed');
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

// ----------------------------------------------------------------------------- chord tones & extensions

const DEGREE_NAMES: Record<string, string> = {
  '1': 'root', b3: 'minor 3rd', '3': '3rd', '4': '4th (sus)', '2': '2nd (sus)', b5: 'flat 5th', '5': '5th', '#5': 'sharp 5th',
  '6': '6th', bb7: 'diminished 7th', b7: '7th', '7': 'major 7th',
  b9: 'flat 9', '9': '9th', '#9': 'sharp 9', '11': '11th', '#11': 'sharp 11', b13: 'flat 13', '13': '13th',
};

/** A chord root for the key: the tonic at low levels, any diatonic root from level `diatonicFrom`. */
function chordFor(rng: Rng, keyPc: number, qualities: string[], level: number, diatonicFrom = 4): ParsedChord {
  const tonic = tonicFor(keyPc);
  if (level >= diatonicFrom && rng() < 0.6) {
    const d = pick(rng, diatonicChords(tonic, true));
    return parseChord(d.symbol);
  }
  const q = pick(rng, qualities);
  return parseChord(sn(tonic) + (q === 'maj' ? '' : q));
}

const CHORD_TONE_LEVELS: string[][] = [
  ['maj', 'm'],
  ['maj7', 'm7', '7'],
  ['m7b5', 'dim7', 'mmaj7', '6', 'm6', 'aug', 'sus4', '7sus4'],
  ['maj7', 'm7', '7', 'm7b5'],
  ['maj7', 'm7', '7', 'm7b5', 'dim7', 'mmaj7', 'm6'],
];

function spelledToneQuestion(rng: Rng, level: number, keyPc: number, category: 'chord-tone' | 'extension', chord: ParsedChord, labels: string[]): Question | null {
  const choices = labels.filter((l) => chord.tones.some((t) => t.label === l));
  if (!choices.length) return null;
  const label = pick(rng, choices);
  const tone = chord.tones.find((t) => t.label === label)!;
  if (Math.abs(tone.spelled.acc) > 1 && level < 5) return null;
  const voiced = voicedChord(chord);
  return noteChoiceQuestion({
    category, keyPc, level,
    prompt: `The ${DEGREE_NAMES[label] ?? label} of ${chord.symbol}?`,
    detail: `${chord.qualityName}. Degree ${label}: letter ${parseDegreeLabel(label).degree - 1} step${parseDegreeLabel(label).degree === 2 ? '' : 's'} above ${sn(chord.root)}.`,
    playMidis: voiced.map((v) => v.midi),
    solution: voiced.map((v) => ({ ...v, label: v.label === label ? `${v.label} ✓` : v.label })),
    explanation: `${chord.symbol} = ${chord.tones.map((t) => `${sn(t.spelled)} (${t.label})`).join(', ')}. The ${label} is ${sn(tone.spelled)}.`,
    meta: { root: sn(chord.root), label },
  }, tone.spelled, rng);
}

/** Close root-position layout of every chord tone, for display and playback. */
export function voicedChord(chord: ParsedChord): { midi: number; name: string; label: string }[] {
  const root = midiAbove(chord.root, 48);
  return chord.tones.map((t) => {
    const m = root + t.semitones;
    return { midi: m, name: formatMidiAs(m, t.spelled), label: t.label };
  });
}

export function chordToneQuestion(rng: Rng, level: number, keyPc: number): Question {
  const lv = Math.max(1, Math.min(5, level));
  for (let t = 0; t < 60; t++) {
    const chord = chordFor(rng, keyPc, CHORD_TONE_LEVELS[lv - 1], lv);
    const labels = chord.tones.map((x) => x.label).filter((l) => l !== '1');
    const q = spelledToneQuestion(rng, lv, keyPc, 'chord-tone', chord, labels);
    if (q) return q;
  }
  throw new Error('chord-tone question generation failed');
}

const EXTENSION_LEVELS: { qualities: string[]; labels: string[] }[] = [
  { qualities: ['maj9', 'm9', '9'], labels: ['9'] },
  { qualities: ['13', 'maj13', 'm11', 'm9', '69'], labels: ['9', '11', '13', '6'] },
  { qualities: ['7b9', '7#9', '13b9', '7b13'], labels: ['b9', '#9', '13', 'b13'] },
  { qualities: ['maj7#11', '13#11', '9#11', 'maj9#11', '7b9#11'], labels: ['#11', '9', '13', 'b9'] },
  { qualities: ['7alt', '7#9b13', '13b9#11', 'maj13#11', 'm11b5', '7b9b13'], labels: ['b9', '#9', '#11', 'b13', '13', '11', '9'] },
];

export function extensionQuestion(rng: Rng, level: number, keyPc: number): Question {
  const lv = Math.max(1, Math.min(5, level));
  for (let t = 0; t < 60; t++) {
    const spec = EXTENSION_LEVELS[lv - 1];
    const q = pick(rng, spec.qualities);
    // Roots: the tonic, or (level 3+) another note of the key's scale.
    const root = lv >= 3 && rng() < 0.5 ? scaleNote(rng, keyPc) : tonicFor(keyPc);
    if (Math.abs(root.acc) > 1) continue;
    const chord = parseChord(sn(root) + q);
    const res = spelledToneQuestion(rng, lv, keyPc, 'extension', chord, spec.labels);
    if (res) return res;
  }
  throw new Error('extension question generation failed');
}

// ----------------------------------------------------------------------------- chord construction

const CONSTRUCTION_LEVELS: string[][] = [
  ['maj', 'm'],
  ['maj7', 'm7', '7'],
  ['m7b5', 'dim7', '6', 'm6', 'sus4', '7sus4', 'aug'],
  ['maj9', 'm9', '9', '13', 'm11'],
  ['7b9', '7#9', 'maj7#11', '7alt', '13b9', 'mmaj9'],
];

function rangeAround(midis: number[]): [number, number] {
  const lo = Math.max(36, Math.floor((Math.min(...midis) - 4) / 12) * 12);
  return [lo, Math.min(96, Math.max(lo + 23, Math.ceil((Math.max(...midis) + 5) / 12) * 12 - 1))];
}

export function constructionQuestion(rng: Rng, level: number, keyPc: number): Question {
  const lv = Math.max(1, Math.min(5, level));
  const tonic = tonicFor(keyPc);
  let chord: ParsedChord;
  if (lv >= 3 && rng() < 0.4) {
    chord = parseChord(pick(rng, diatonicChords(tonic, lv >= 3)).symbol);
  } else {
    const q = pick(rng, CONSTRUCTION_LEVELS[lv - 1]);
    chord = parseChord(sn(tonic) + (q === 'maj' ? '' : q));
  }
  const voiced = voicedChord(chord);
  const required = chord.tones.filter((t) => t.required).map((t) => t.pitchClass);
  const optional = chord.tones.filter((t) => !t.required).map((t) => t.label);
  return {
    id: qid('construction'), category: 'construction', keyPc, level: lv, input: 'keyboard',
    prompt: `Build ${chord.symbol}`,
    detail: `${cap(chord.qualityName)} — play every essential tone in any octave or inversion.${optional.length ? ` Optional: ${optional.join(', ')}.` : ''}`,
    target: { chord, required, allowed: chord.tones.map((t) => t.pitchClass) },
    solution: voiced, range: [48, 83],
    explanation: `${chord.symbol} = ${chord.tones.map((t) => `${sn(t.spelled)} (${t.label}${t.required ? '' : ', optional'})`).join(' · ')}.`,
  };
}

// ----------------------------------------------------------------------------- voicings

const VOICING_LEVELS: VoicingFamily[][] = [
  ['triad-inversion'],
  ['seventh-inversion'],
  ['shell', 'drop-2', 'open'],
  ['rootless-a', 'rootless-b'],
  ['quartal', 'upper-structure', 'rnb-color'],
];

export function voicingQuestion(rng: Rng, level: number, keyPc: number): Question {
  const lv = Math.max(1, Math.min(5, level));
  const tonic = tonicFor(keyPc);
  const pool = VOICING_LIBRARY.filter((t) => VOICING_LEVELS[lv - 1].includes(t.family) && (lv > 1 || ['maj', 'm'].includes(t.quality)) && (lv !== 2 || ['maj7', 'm7', '7', 'm7b5'].includes(t.quality)));
  for (let t = 0; t < 60; t++) {
    const tpl = pick(rng, pool);
    const chord = parseChord(sn(tonic) + (tpl.quality === 'maj' ? '' : tpl.quality));
    const v = realizeTemplate(tpl, chord, { mode: 'band', style: tpl.styles[0], maxHandSpan: 16 })[0];
    if (!v) continue;
    const notes = [...v.notes].sort((a, b) => a.midi - b.midi);
    const pcs = [...new Set(notes.map((n) => mod12(n.midi)))];
    return {
      id: qid('voicing'), category: 'voicing', keyPc, level: lv, input: 'keyboard',
      prompt: `Play ${chord.symbol}: ${tpl.name.replace(/^.*? — /, '')}`,
      detail: `${FAMILY_LABELS[tpl.family]} · degrees low → high: ${notes.map((n) => n.label).join(' ')}${tpl.oneHand ? '' : ' (two hands)'}. Any octave; the lowest note matters.`,
      target: { chord, required: pcs, allowed: pcs, exact: pcs, lowestPc: mod12(notes[0].midi) },
      solution: notes.map((n) => ({ midi: n.midi, name: n.name, label: n.label })),
      range: rangeAround(notes.map((n) => n.midi)),
      explanation: `${tpl.name}: ${notes.map((n) => `${n.name.replace(/-?\d+$/, '')} (${n.label})`).join(' ')}. ${tpl.explanation}`,
    };
  }
  throw new Error('voicing question generation failed');
}

// ----------------------------------------------------------------------------- voice leading (choice)

export function voiceLeadingQuestion(rng: Rng, level: number, keyPc: number): Question {
  for (let t = 0; t < 20; t++) {
    const ex = makeSmoothMoveExercise(rng, level, keyPc);
    const worse = ex.alternatives.filter((a) => a.movement >= ex.bestMovement + 2);
    if (worse.length < 2) continue;
    const opts = [{ v: ex.best, movement: ex.bestMovement }, ...shuffle(rng, worse).slice(0, 2).map((a) => ({ v: a.voicing, movement: a.movement }))];
    const names = (v: typeof ex.best) => [...v.notes].sort((a, b) => a.midi - b.midi).map((n) => n.name).join(' ');
    return {
      id: qid('voice-leading'), category: 'voice-leading', keyPc: ex.keyPc, level: ex.level, input: 'choice',
      prompt: `${ex.from.chord.symbol} → ${ex.toChord.symbol}: which voicing moves least?`,
      detail: `${ex.progression.name}, ${ex.fromNumeral} → ${ex.toNumeral}. From: ${names(ex.from)}`,
      showMidis: ex.from.notes.map((n) => ({ midi: n.midi, name: n.name, label: n.label })),
      playMidis: ex.fromUpper,
      choices: shuffle(rng, opts).map((o) => ({ value: o.v.id, label: names(o.v), detail: o.v.template.name })),
      answer: ex.best.id,
      solution: ex.best.notes.map((n) => ({ midi: n.midi, name: n.name, label: n.label })),
      ghosts: ex.fromUpper,
      explanation: opts.map((o) => `${names(o.v)}: ${o.movement} st`).join(' · ') + `. The smoothest keeps ${quickCommon(ex.from, ex.best)} common tone(s).`,
    };
  }
  throw new Error('voice-leading question generation failed');
}

function quickCommon(a: Parameters<typeof quickMovement>[0], b: Parameters<typeof quickMovement>[0]): number {
  const pa = new Set(splitBass(a).upper.map((n) => n.midi));
  return splitBass(b).upper.filter((n) => pa.has(n.midi)).length;
}

// ----------------------------------------------------------------------------- dispatch & grading

export const GENERATORS: Record<Category, (rng: Rng, level: number, keyPc: number) => Question> = {
  interval: intervalQuestion,
  'chord-tone': chordToneQuestion,
  extension: extensionQuestion,
  construction: constructionQuestion,
  voicing: voicingQuestion,
  'voice-leading': voiceLeadingQuestion,
};

export function makeQuestion(category: Category, rng: Rng, level: number, keyPc: number): Question {
  return GENERATORS[category](rng, level, keyPc);
}

export interface Grade { correct: boolean; message: string }

export function gradeChoice(q: Question, value: string): Grade {
  const correct = value === q.answer;
  const right = q.choices?.find((c) => c.value === q.answer)?.label ?? q.answer;
  if (correct) return { correct, message: 'Correct.' };
  // Same pitch, wrong spelling: say so explicitly.
  const a = parsePc(value), b = parsePc(q.answer ?? '');
  if (a !== null && a === b) return { correct, message: `Right pitch, wrong spelling: the answer is ${right}. The letter comes from the degree number.` };
  return { correct, message: `The answer is ${right}.` };
}

function parsePc(s: string): number | null {
  const m = /^([A-G])(bb|##|b|#)?$/.exec(s);
  if (!m) return null;
  const acc = { '': 0, b: -1, bb: -2, '#': 1, '##': 2 }[m[2] ?? '']!;
  return pitchClassOf({ letter: m[1] as Letter, acc });
}

export function gradeKeyboard(q: Question, midis: number[]): Grade {
  const t = q.target!;
  if (midis.length === 0) return { correct: false, message: 'No notes played.' };
  const pcs = new Set(midis.map((m) => mod12(m)));
  const name = (pc: number) => {
    const tone = t.chord.tones.find((x) => x.pitchClass === pc);
    return tone ? sn(tone.spelled) : midiToName(pc + 60).replace(/\d+$/, '');
  };
  const extra = [...pcs].filter((pc) => !t.allowed.includes(pc));
  const missing = t.required.filter((pc) => !pcs.has(pc));
  if (extra.length || missing.length) {
    const parts: string[] = [];
    if (missing.length) parts.push(`missing ${missing.map(name).join(', ')}`);
    if (extra.length) parts.push(`${extra.map(name).join(', ')} ${extra.length > 1 ? "aren't" : "isn't"} in ${t.chord.symbol}`);
    return { correct: false, message: cap(parts.join('; ')) + '.' };
  }
  if (t.lowestPc !== undefined) {
    const low = mod12(Math.min(...midis));
    if (low !== t.lowestPc) return { correct: false, message: `Right notes, wrong voicing: the lowest note should be ${name(t.lowestPc)}, not ${name(low)}.` };
  }
  return { correct: true, message: 'Correct.' };
}

/** Pitch class of a degree label above a key's tonic (used by tests and the key panel). */
export function pcAbove(keyPc: number, label: string): number {
  return mod12(keyPc + labelPitchClass(label));
}
