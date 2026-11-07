/**
 * Voice-leading engine.
 *
 * Voice matching
 *  - Equal voice counts: notes are paired in pitch order. For |a − b| costs on a line, pairing
 *    sorted lists is a minimum-cost perfect matching (any crossing pair can be uncrossed without
 *    increasing the total), so this equals the Hungarian-algorithm optimum; tests check it against
 *    brute force over every permutation.
 *  - Different voice counts: a monotone alignment in which every note is used at least once, so
 *    one voice may split into two (or two merge into one). Solved by dynamic programming.
 *
 * Bass vs. upper voices
 *  The bass (a solo-mode added bass, or the left-hand root of a two-hand voicing) follows the root
 *  motion, which leaps by design in a ii–V–I. Smoothness is therefore measured on the upper voices
 *  and the bass is reported separately.
 *
 * Progression optimiser
 *  Candidate voicings per chord come from the curated library (several octave placements per
 *  template). A Viterbi pass minimises Σ node cost (1 − score) + Σ transition cost (movement).
 */
import { parseChord, type ParsedChord } from '../music-theory/chord-parser';
import { labelPitchClass } from '../music-theory/intervals';
import { midiToName } from '../music-theory/midi-notes';
import { mod12 } from '../music-theory/note-parser';
import { DEFAULT_OPTIONS, realizeTemplate } from '../voicing-engine/voicing-generator';
import { VOICING_LIBRARY } from '../voicing-engine/voicing-library';
import type { GeneratedVoicing, GenerationOptions, VoicedNote, VoicingFamily } from '../voicing-engine/voicing-types';
import { STYLE_PROFILES } from './style-profiles';

// ----------------------------------------------------------------------------- matching

export type MotionKind = 'common' | 'step' | 'skip' | 'leap';

export function classifyMotion(delta: number): MotionKind {
  const d = Math.abs(delta);
  if (d === 0) return 'common';
  if (d <= 2) return 'step';
  if (d <= 4) return 'skip';
  return 'leap';
}

/**
 * Minimum-cost voice matching between two pitch collections.
 * Returns index pairs into the *sorted* arrays and the total semitone movement.
 */
export function matchVoices(aIn: number[], bIn: number[]): { a: number[]; b: number[]; pairs: [number, number][]; cost: number } {
  const a = [...aIn].sort((x, y) => x - y);
  const b = [...bIn].sort((x, y) => x - y);
  if (a.length === 0 || b.length === 0) return { a, b, pairs: [], cost: 0 };
  if (a.length === b.length) {
    const pairs = a.map((_, i) => [i, i] as [number, number]);
    return { a, b, pairs, cost: pairs.reduce((s, [i, j]) => s + Math.abs(a[i] - b[j]), 0) };
  }
  // Monotone edge cover (dynamic time warping): every note in both chords is matched at least once.
  const n = a.length, m = b.length;
  const INF = Number.POSITIVE_INFINITY;
  const D: number[][] = Array.from({ length: n }, () => new Array(m).fill(INF));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      const c = Math.abs(a[i] - b[j]);
      if (i === 0 && j === 0) { D[i][j] = c; continue; }
      const prev = Math.min(i > 0 ? D[i - 1][j] : INF, j > 0 ? D[i][j - 1] : INF, i > 0 && j > 0 ? D[i - 1][j - 1] : INF);
      D[i][j] = c + prev;
    }
  }
  const pairs: [number, number][] = [];
  let i = n - 1, j = m - 1;
  pairs.push([i, j]);
  while (i > 0 || j > 0) {
    const opts: [number, number, number][] = [];
    if (i > 0 && j > 0) opts.push([D[i - 1][j - 1], i - 1, j - 1]);
    if (i > 0) opts.push([D[i - 1][j], i - 1, j]);
    if (j > 0) opts.push([D[i][j - 1], i, j - 1]);
    opts.sort((x, y) => x[0] - y[0]);
    [, i, j] = opts[0];
    pairs.push([i, j]);
  }
  pairs.reverse();
  return { a, b, pairs, cost: D[n - 1][m - 1] };
}

/** Total semitone movement under the optimal voice matching. */
export function voiceLeadingCost(a: number[], b: number[]): number {
  return matchVoices(a, b).cost;
}

// ----------------------------------------------------------------------------- bass / upper split

export interface VoicingParts {
  bass?: VoicedNote;
  upper: VoicedNote[];
}

/** Separate the bass voice (added bass, or the left-hand root of a two-hand shape) from the upper voices. */
export function splitBass(v: Pick<GeneratedVoicing, 'notes' | 'template'>): VoicingParts {
  const sorted = [...v.notes].sort((x, y) => x.midi - y.midi);
  const low = sorted[0];
  const isBass = !!low && (low.isAddedBass || (!v.template.oneHand && low.hand === 'L' && low.label === '1'));
  return isBass ? { bass: low, upper: sorted.slice(1) } : { upper: sorted };
}

// ----------------------------------------------------------------------------- transition analysis

export interface VoiceMove {
  from: VoicedNote;
  to: VoicedNote;
  delta: number;
  kind: MotionKind;
  /** 'split' / 'merge' when the voice counts differ and one note feeds two. */
  type: 'move' | 'split' | 'merge';
  isBass: boolean;
}

export interface TransitionAnalysis {
  fromSymbol: string;
  toSymbol: string;
  moves: VoiceMove[];
  /** Upper-voice movement in semitones (the smoothness measure). */
  upperMovement: number;
  /** Bass movement in semitones (0 when either voicing has no separate bass). */
  bassMovement: number;
  /** Upper + bass. */
  totalMovement: number;
  commonTones: number;
  maxLeap: number;
  topVoice?: { from: VoicedNote; to: VoicedNote; delta: number };
  rating: 'very smooth' | 'smooth' | 'moderate' | 'jumpy';
  explanation: string[];
}

const signed = (d: number) => (d > 0 ? `+${d}` : `${d}`);

export function analyzeTransition(a: GeneratedVoicing, b: GeneratedVoicing): TransitionAnalysis {
  let pa = splitBass(a);
  let pb = splitBass(b);
  // Bass is only treated separately when both voicings have one.
  if (!pa.bass || !pb.bass) {
    pa = { upper: [...a.notes].sort((x, y) => x.midi - y.midi) };
    pb = { upper: [...b.notes].sort((x, y) => x.midi - y.midi) };
  }
  const m = matchVoices(pa.upper.map((n) => n.midi), pb.upper.map((n) => n.midi));
  const useA = new Map<number, number>(), useB = new Map<number, number>();
  for (const [i, j] of m.pairs) { useA.set(i, (useA.get(i) ?? 0) + 1); useB.set(j, (useB.get(j) ?? 0) + 1); }
  const moves: VoiceMove[] = m.pairs.map(([i, j]) => {
    const from = pa.upper[i], to = pb.upper[j];
    const delta = to.midi - from.midi;
    const type = (useA.get(i) ?? 0) > 1 ? 'split' : (useB.get(j) ?? 0) > 1 ? 'merge' : 'move';
    return { from, to, delta, kind: classifyMotion(delta), type, isBass: false };
  });
  let bassMovement = 0;
  if (pa.bass && pb.bass) {
    const delta = pb.bass.midi - pa.bass.midi;
    bassMovement = Math.abs(delta);
    moves.unshift({ from: pa.bass, to: pb.bass, delta, kind: classifyMotion(delta), type: 'move', isBass: true });
  }
  const upperMoves = moves.filter((mv) => !mv.isBass);
  const upperMovement = m.cost;
  const commonTones = upperMoves.filter((mv) => mv.delta === 0).length;
  const maxLeap = upperMoves.reduce((x, mv) => Math.max(x, Math.abs(mv.delta)), 0);
  const top = upperMoves[upperMoves.length - 1];
  const perVoice = upperMovement / Math.max(1, upperMoves.length);
  const rating = perVoice <= 1 ? 'very smooth' : perVoice <= 2 ? 'smooth' : perVoice <= 3.5 ? 'moderate' : 'jumpy';

  const explanation: string[] = [];
  for (const mv of upperMoves) {
    const what = `${mv.from.label} of ${a.chord.symbol} → ${mv.to.label} of ${b.chord.symbol}`;
    if (mv.delta === 0) explanation.push(`${mv.from.name} is held as a common tone (${what}).`);
    else if (mv.from.role === 'seventh' && mv.to.role === 'third' && Math.abs(mv.delta) <= 2) {
      explanation.push(`${mv.from.name} → ${mv.to.name} (${signed(mv.delta)}): the 7th resolves by step to the 3rd — the guide-tone line that defines the progression.`);
    } else if (mv.from.role === 'third' && mv.to.role === 'seventh' && Math.abs(mv.delta) <= 2) {
      explanation.push(`${mv.from.name} → ${mv.to.name} (${signed(mv.delta)}): the 3rd moves by step to the new 7th (guide tones).`);
    } else if (mv.kind === 'leap') {
      explanation.push(`${mv.from.name} → ${mv.to.name} leaps ${Math.abs(mv.delta)} semitones (${what}) — the least smooth voice.`);
    }
  }
  if (pa.bass && pb.bass) explanation.push(`Bass ${pa.bass.name} → ${pb.bass.name} follows the root motion (${signed(pb.bass.midi - pa.bass.midi)}); it is not counted in the smoothness score.`);
  if (top) explanation.push(`Top voice: ${top.from.name} → ${top.to.name} (${top.delta === 0 ? 'held' : signed(top.delta)}).`);
  explanation.push(`Upper voices move ${upperMovement} semitone${upperMovement === 1 ? '' : 's'} in total with ${commonTones} common tone${commonTones === 1 ? '' : 's'}: ${rating}.`);

  return {
    fromSymbol: a.chord.symbol, toSymbol: b.chord.symbol, moves, upperMovement, bassMovement,
    totalMovement: upperMovement + bassMovement, commonTones, maxLeap,
    topVoice: top ? { from: top.from, to: top.to, delta: top.delta } : undefined, rating, explanation,
  };
}

// ----------------------------------------------------------------------------- candidates

export interface VoiceLeadingOptions extends Partial<GenerationOptions> {
  /** Candidate voicings kept per chord (best by individual score). */
  candidatesPerChord?: number;
  /** Octave placements considered per template. */
  placementsPerTemplate?: number;
  /** Weight of upper-voice semitone movement in the path cost. */
  movementWeight?: number;
  /** Weight of bass movement (small: keeps the bass in a sensible register). */
  bassWeight?: number;
  /** Weight of (1 − score/100) per chord. */
  qualityWeight?: number;
  /** Chord index → voicing id, fixed by the user. */
  locked?: Record<number, string>;
}

export const VOICING_APPROACHES: { id: string; label: string; families?: VoicingFamily[]; description: string }[] = [
  { id: 'smoothest', label: 'Smoothest (any family)', description: 'Every library family is allowed; the optimiser picks the smoothest path.' },
  { id: 'inversions', label: 'Triads & inversions', families: ['triad-inversion', 'seventh-inversion', 'open'], description: 'Close-position chords and their inversions, plus pop/ballad spreads.' },
  { id: 'shells', label: 'Shells (R-3-7)', families: ['shell'], description: 'Root plus guide tones in the left hand: the first jazz voicing to learn.' },
  { id: 'rootless', label: 'Rootless A/B', families: ['rootless-a', 'rootless-b'], description: 'Rootless four-note voicings; the optimiser alternates A and B to keep the hand in place.' },
  { id: 'drop2', label: 'Drop 2', families: ['drop-2'], description: 'Drop-2 voicings split between the hands.' },
  { id: 'colour', label: 'Quartal & colour', families: ['quartal', 'upper-structure', 'rnb-color'], description: 'Fourths, upper structures and R&B clusters.' },
];

/** Several placements per compatible template, best by individual score. */
export function candidateVoicings(chordIn: string | ParsedChord, opts: VoiceLeadingOptions = {}): GeneratedVoicing[] {
  const chord = typeof chordIn === 'string' ? parseChord(chordIn) : chordIn;
  const options: GenerationOptions = { ...DEFAULT_OPTIONS, ...opts };
  const per = opts.placementsPerTemplate ?? 2;
  const k = opts.candidatesPerChord ?? 40;
  const out: GeneratedVoicing[] = [];
  for (const t of VOICING_LIBRARY) {
    if (t.difficulty > options.maxDifficulty) continue;
    if (options.families && options.families.length && !options.families.includes(t.family)) continue;
    out.push(...realizeTemplate(t, chord, options).slice(0, per));
  }
  out.sort((x, y) => y.score.total - x.score.total);
  const seen = new Set<string>();
  const uniq: GeneratedVoicing[] = [];
  for (const v of out) {
    const key = v.notes.map((n) => n.midi).sort((x, y) => x - y).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(v);
    if (uniq.length >= k) break;
  }
  return uniq;
}

function transitionCost(a: GeneratedVoicing, b: GeneratedVoicing, w: { movement: number; bass: number }): number {
  const t = quickMovement(a, b);
  return w.movement * t.upper + w.bass * t.bass;
}

/** Fast movement-only measure (no explanation objects) used inside the optimiser. */
export function quickMovement(a: GeneratedVoicing, b: GeneratedVoicing): { upper: number; bass: number } {
  const pa = splitBass(a), pb = splitBass(b);
  if (pa.bass && pb.bass) {
    return { upper: voiceLeadingCost(pa.upper.map((n) => n.midi), pb.upper.map((n) => n.midi)), bass: Math.abs(pa.bass.midi - pb.bass.midi) };
  }
  return { upper: voiceLeadingCost(a.notes.map((n) => n.midi), b.notes.map((n) => n.midi)), bass: 0 };
}

export interface ProgressionResult {
  chords: ParsedChord[];
  candidates: GeneratedVoicing[][];
  voicings: GeneratedVoicing[];
  transitions: TransitionAnalysis[];
  upperMovement: number;
  bassMovement: number;
  cost: number;
  /** Chord indices that have no playable voicing under the options. */
  missing: number[];
}

function weights(opts: VoiceLeadingOptions) {
  const style = STYLE_PROFILES[opts.style ?? DEFAULT_OPTIONS.style];
  return {
    movement: opts.movementWeight ?? style.voiceLeading.movementWeight,
    bass: opts.bassWeight ?? 0.08,
    quality: opts.qualityWeight ?? style.voiceLeading.qualityWeight,
  };
}

/** Choose one voicing per chord so the whole progression moves as smoothly as possible. */
export function optimizeProgression(chordsIn: (string | ParsedChord)[], opts: VoiceLeadingOptions = {}): ProgressionResult {
  const chords = chordsIn.map((c) => (typeof c === 'string' ? parseChord(c) : c));
  const w = weights(opts);
  const candidates = chords.map((c) => candidateVoicings(c, opts));
  const missing = candidates.map((c, i) => (c.length === 0 ? i : -1)).filter((i) => i >= 0);
  if (missing.length) {
    return { chords, candidates, voicings: [], transitions: [], upperMovement: 0, bassMovement: 0, cost: Infinity, missing };
  }
  // Locked chords are restricted to the chosen voicing for the search; `candidates` keeps the full list.
  const search = candidates.map((all, i) => {
    const lockId = opts.locked?.[i];
    const locked = lockId ? all.filter((v) => v.id === lockId) : [];
    return locked.length ? locked : all;
  });
  const node = (v: GeneratedVoicing) => w.quality * (1 - v.score.total / 100) * 10;
  let best = search[0].map((v) => node(v));
  const back: number[][] = [search[0].map(() => -1)];
  for (let i = 1; i < chords.length; i++) {
    const cur: number[] = [], bp: number[] = [];
    for (const v of search[i]) {
      let bc = Infinity, bi = -1;
      search[i - 1].forEach((u, j) => {
        const c = best[j] + transitionCost(u, v, w);
        if (c < bc) { bc = c; bi = j; }
      });
      cur.push(bc + node(v));
      bp.push(bi);
    }
    best = cur;
    back.push(bp);
  }
  let idx = best.indexOf(Math.min(...best));
  const cost = best[idx];
  const path: GeneratedVoicing[] = [];
  for (let i = chords.length - 1; i >= 0; i--) {
    path.unshift(search[i][idx]);
    idx = back[i][idx];
  }
  return summarise(chords, candidates, path, cost);
}

function summarise(chords: ParsedChord[], candidates: GeneratedVoicing[][], voicings: GeneratedVoicing[], cost: number): ProgressionResult {
  const transitions = voicings.slice(1).map((v, i) => analyzeTransition(voicings[i], v));
  return {
    chords, candidates, voicings, transitions, cost, missing: [],
    upperMovement: transitions.reduce((s, t) => s + t.upperMovement, 0),
    bassMovement: transitions.reduce((s, t) => s + t.bassMovement, 0),
  };
}

/** Baseline for comparison: each chord's individually best-scoring voicing, ignoring transitions. */
export function independentVoicings(chordsIn: (string | ParsedChord)[], opts: VoiceLeadingOptions = {}): ProgressionResult {
  const chords = chordsIn.map((c) => (typeof c === 'string' ? parseChord(c) : c));
  const candidates = chords.map((c) => candidateVoicings(c, opts));
  const missing = candidates.map((c, i) => (c.length === 0 ? i : -1)).filter((i) => i >= 0);
  if (missing.length) return { chords, candidates, voicings: [], transitions: [], upperMovement: 0, bassMovement: 0, cost: Infinity, missing };
  return summarise(chords, candidates, candidates.map((c) => c[0]), NaN);
}

export interface Suggestion {
  voicing: GeneratedVoicing;
  movement: number;
  saving: number;
}

/**
 * Voicings of `next` that move more smoothly from `from` than `current` does (fewest semitones first).
 */
export function suggestSmoother(from: GeneratedVoicing, next: string | ParsedChord, current: GeneratedVoicing | undefined, opts: VoiceLeadingOptions = {}, limit = 5): Suggestion[] {
  const base = current ? quickMovement(from, current).upper : Infinity;
  return candidateVoicings(next, opts)
    .map((v) => ({ voicing: v, movement: quickMovement(from, v).upper }))
    .filter((s) => s.movement < base && s.voicing.id !== current?.id)
    .sort((x, y) => x.movement - y.movement || y.voicing.score.total - x.voicing.score.total)
    .slice(0, limit)
    .map((s) => ({ ...s, saving: Number.isFinite(base) ? base - s.movement : 0 }));
}

// ----------------------------------------------------------------------------- answer checking

export interface PlayedVoicingCheck {
  valid: boolean;
  /** Pitch classes that are not chord tones or available tensions. */
  wrongNotes: number[];
  /** Required degree labels not played. */
  missing: string[];
  movement: number;
}

/**
 * Check a freely played voicing of `chord` that should follow `prevUpper` smoothly.
 * The root may be omitted on seventh chords (rootless playing); triads need all three tones.
 */
export function checkPlayedVoicing(chord: ParsedChord, played: number[], prevUpper: number[]): PlayedVoicingCheck {
  const allowed = new Set<number>([...chord.tones.map((t) => t.pitchClass), ...chord.availableTensions.map((l) => mod12(chord.rootPc + labelPitchClass(l)))]);
  const pcs = new Set(played.map((m) => mod12(m)));
  const wrongNotes = [...pcs].filter((pc) => !allowed.has(pc));
  const rootOptional = chord.seventh !== 'none' || chord.hasSixth;
  const missing = chord.tones
    .filter((t) => t.required && !(t.label === '1' && rootOptional))
    .filter((t) => !pcs.has(t.pitchClass))
    .map((t) => t.label);
  for (const group of chord.requireAnyOf) {
    if (!group.some((l) => pcs.has(mod12(chord.rootPc + labelPitchClass(l))))) missing.push(group.join('/'));
  }
  return { valid: played.length >= 3 && wrongNotes.length === 0 && missing.length === 0, wrongNotes, missing, movement: voiceLeadingCost(prevUpper, played) };
}

export function midiNames(midis: number[]): string {
  return [...midis].sort((a, b) => a - b).map((m) => midiToName(m)).join(' ');
}
