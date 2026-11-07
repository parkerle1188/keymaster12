/**
 * Voicing generation pipeline:
 *  1. retrieve curated templates compatible with the chord,
 *  2. transpose to the requested root,
 *  3. generate octave placements,
 *  4. add bass where required (solo rootless / slash chords),
 *  5. validate hard constraints (range, span, hands, low-interval limits, required tones),
 *  6. score musical quality,
 *  7. return the best N (default 8) distinct voicings.
 */
import { parseChord, type ParsedChord } from '../music-theory/chord-parser';
import { spellInterval } from '../music-theory/enharmonic-spelling';
import { labelPitchClass, roleOfLabel, type DegreeLabel } from '../music-theory/intervals';
import { formatMidiAs } from '../music-theory/midi-notes';
import { formatNote, mod12 } from '../music-theory/note-parser';
import { VOICING_LIBRARY } from './voicing-library';
import { assignHands } from './hand-assignment';
import { placeBass, placeTemplate } from './register-optimizer';
import { hasErrors, validateVoicing } from './voicing-validator';
import { scoreVoicing } from './voicing-scorer';
import type { GeneratedVoicing, GenerationOptions, VoicedNote, VoicingTemplate } from './voicing-types';

export const DEFAULT_OPTIONS: GenerationOptions = {
  style: 'jazz', mode: 'solo', range: [21, 108], maxHandSpan: 14, maxDifficulty: 5, allowLowClusters: false, limit: 8, allowEnriched: true,
};

export interface Compatibility {
  ok: boolean;
  matchType: 'exact' | 'enriched';
  addedTensions: DegreeLabel[];
  reason?: string;
}

/** Can this template voice this chord without contradicting the symbol? */
export function templateFitsChord(template: VoicingTemplate, chord: ParsedChord): Compatibility {
  const chordPcs = new Map<number, DegreeLabel>();
  for (const t of chord.tones) chordPcs.set(mod12(t.semitones), t.label);
  const tensionPcs = new Map<number, DegreeLabel>();
  for (const l of chord.availableTensions) tensionPcs.set(labelPitchClass(l), l);

  const tplPcs = new Set(template.voices.map((v) => mod12(v.semis)));
  const added: DegreeLabel[] = [];
  for (const v of template.voices) {
    const pc = mod12(v.semis);
    if (chordPcs.has(pc)) continue;
    if (tensionPcs.has(pc)) { if (!added.includes(tensionPcs.get(pc)!)) added.push(tensionPcs.get(pc)!); continue; }
    return { ok: false, matchType: 'exact', addedTensions: [], reason: `${v.label} is not part of ${chord.symbol}` };
  }
  for (const t of chord.tones) {
    if (!t.required || t.label === '1') continue;
    if (!tplPcs.has(mod12(t.semitones))) return { ok: false, matchType: 'exact', addedTensions: [], reason: `missing required ${t.label}` };
  }
  for (const group of chord.requireAnyOf) {
    if (!group.some((l) => tplPcs.has(labelPitchClass(l)))) return { ok: false, matchType: 'exact', addedTensions: [], reason: 'needs an altered tension' };
  }
  return { ok: true, matchType: added.length ? 'enriched' : 'exact', addedTensions: added };
}

function makeNote(chord: ParsedChord, midi: number, templateLabel: DegreeLabel, hand: 'L' | 'R'): VoicedNote {
  const pc = mod12(midi - chord.rootPc);
  const ct = chord.tones.find((t) => mod12(t.semitones) === pc);
  const label = ct ? ct.label : chord.availableTensions.find((l) => labelPitchClass(l) === pc) ?? templateLabel;
  const spelled = ct ? ct.spelled : spellInterval(chord.root, label);
  return { midi, label, role: roleOfLabel(label), spelled, name: formatMidiAs(midi, spelled), hand };
}

function bassNoteFor(chord: ParsedChord, midi: number): VoicedNote {
  const spelled = chord.bass ?? chord.root;
  const label = chord.bass ? chord.bassLabel ?? 'bass' : '1';
  return { midi, label, role: label === '1' ? 'root' : chord.bassIsChordTone ? roleOfLabel(label) : 'bass', spelled, name: formatMidiAs(midi, spelled), hand: 'L', isAddedBass: true };
}

/** Realise one template on one chord: all valid placements, scored, best first. */
export function realizeTemplate(template: VoicingTemplate, chord: ParsedChord, opts: Partial<GenerationOptions> = {}): GeneratedVoicing[] {
  const options: GenerationOptions = { ...DEFAULT_OPTIONS, ...opts };
  const compat = templateFitsChord(template, chord);
  if (!compat.ok) return [];
  if (compat.matchType === 'enriched' && options.allowEnriched === false) return [];

  const isSlash = chord.bassPc !== undefined && chord.bassPc !== chord.rootPc;
  const hasRoot = template.voices.some((v) => v.label === '1');
  if (isSlash && !template.oneHand) return [];
  if (options.mode === 'solo' && template.bassRequirement === 'bassist-required') return [];

  const hands = assignHands(template, options.mode, options.style);
  let placements = placeTemplate(template, chord.rootPc, options.range, 0);
  if (placements.length === 0) placements = placeTemplate(template, chord.rootPc, options.range, 5);

  const requiredPcs = chord.tones.filter((t) => t.required && t.label !== '1').map((t) => t.pitchClass);
  const results: GeneratedVoicing[] = [];
  for (const p of placements) {
    const notes: VoicedNote[] = p.midis.map((m, i) => makeNote(chord, m, template.voices[i].label, hands[i]));
    let bassInfo: GeneratedVoicing['bassNote'];
    let slashBassMidi: number | undefined;
    const needsBass = isSlash || (!hasRoot && template.oneHand);
    if (options.mode === 'solo' && needsBass) {
      const pc = isSlash ? chord.bassPc! : chord.rootPc;
      const bm = placeBass(pc, p.midis[0], options.range);
      if (bm === undefined) continue;
      // a one-hand template in solo mode is played by the right hand; the left hand takes the bass
      const bass = bassNoteFor(chord, bm);
      notes.unshift(bass);
      bassInfo = { name: bass.name, label: bass.label, playedBy: 'left-hand' };
      if (isSlash) slashBassMidi = bm;
    } else if (options.mode === 'band') {
      const bassSp = isSlash ? chord.bass! : chord.root;
      bassInfo = { name: formatNote(bassSp), label: isSlash ? chord.bassLabel ?? 'bass' : '1', playedBy: 'bassist' };
    }
    const issues = validateVoicing(notes, { options, requiredPcs, slashBassMidi });
    if (hasErrors(issues)) continue;
    const score = scoreVoicing({ template, notes, matchType: compat.matchType, issues, options, addedCount: compat.addedTensions.length });
    const omittedChordTones = chord.tones.filter((t) => !notes.some((n) => mod12(n.midi - chord.rootPc) === mod12(t.semitones))).map((t) => t.label);
    results.push({
      id: `${template.id}@${p.rootMidi}`,
      template, chord, notes, matchType: compat.matchType, addedTensions: compat.addedTensions,
      omittedChordTones, bassNote: bassInfo, issues, score,
      explanation: explainVoicing(template, chord, notes, compat.addedTensions, omittedChordTones, bassInfo),
    });
  }
  return results.sort((a, b) => b.score.total - a.score.total);
}

function explainVoicing(template: VoicingTemplate, chord: ParsedChord, notes: VoicedNote[], added: DegreeLabel[], omitted: DegreeLabel[], bass: GeneratedVoicing['bassNote']): string[] {
  const lines: string[] = [];
  const upper = notes.filter((n) => !n.isAddedBass);
  lines.push(`Plays ${upper.map((n) => n.name).join(' ')} (${upper.map((n) => n.label).join(', ')}).`);
  if (bass?.playedBy === 'left-hand') lines.push(`Left hand adds ${bass.name} in the bass${bass.label === '1' ? ' (the root)' : ''}.`);
  if (bass?.playedBy === 'bassist') lines.push(`Band mode: the bassist plays ${bass.name}; the piano does not need to.`);
  const omittedNoRoot = omitted.filter((l) => l !== '1');
  if (omitted.includes('1') && bass?.playedBy !== 'left-hand') lines.push('Rootless: the root is supplied by the bass.');
  if (omittedNoRoot.length) lines.push(`Omits ${omittedNoRoot.join(', ')} — ${omittedNoRoot.every((l) => l === '5' || l === '9' || l === '11') ? 'non-essential tones that would thicken the sound' : 'see the chord breakdown for why this is acceptable'}.`);
  if (added.length) lines.push(`Adds ${added.join(', ')} — available tension${added.length > 1 ? 's' : ''} not written in "${chord.symbol}". Use when the style welcomes colour.`);
  if (chord.omissions.length) lines.push(`By convention, ${chord.symbol} leaves out ${chord.omissions.join(', ')}.`);
  lines.push(template.explanation);
  return lines;
}

export function generateVoicings(chordInput: string | ParsedChord, opts: Partial<GenerationOptions> = {}): GeneratedVoicing[] {
  const chord = typeof chordInput === 'string' ? parseChord(chordInput) : chordInput;
  const options: GenerationOptions = { ...DEFAULT_OPTIONS, ...opts };
  const limit = Math.max(1, options.limit ?? 8);
  const all: GeneratedVoicing[] = [];
  for (const t of VOICING_LIBRARY) {
    if (t.difficulty > options.maxDifficulty) continue;
    if (options.families && options.families.length && !options.families.includes(t.family)) continue;
    const best = realizeTemplate(t, chord, options)[0];
    if (best) all.push(best);
  }
  all.sort((a, b) => b.score.total - a.score.total || a.template.difficulty - b.template.difficulty);
  const seen = new Set<string>();
  const out: GeneratedVoicing[] = [];
  for (const v of all) {
    const key = v.notes.map((n) => n.midi).sort((a, b) => a - b).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= limit) break;
  }
  return out;
}

/** Every compatible template (unplaced), for browsing the library by chord. */
export function compatibleTemplates(chord: ParsedChord): { template: VoicingTemplate; compat: Compatibility }[] {
  return VOICING_LIBRARY.map((template) => ({ template, compat: templateFitsChord(template, chord) })).filter((x) => x.compat.ok);
}
