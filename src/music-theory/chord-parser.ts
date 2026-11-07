/**
 * Chord-symbol parser.
 *
 * Produces a structured ParsedChord that keeps three things separate:
 *  - pitch information (semitone offsets),
 *  - theoretical function (degree labels: "b3", "#11", "bb7"),
 *  - spelling (letter names derived from the root's spelling + the degree number).
 *
 * The chord's *implied* tones (what the symbol means) are distinct from the
 * subset a voicing actually plays; see voicing-engine for the selection step.
 */
import { parseNotePrefix, pitchClassOf, mod12, type SpelledNote, formatNote } from './note-parser';
import { parseDegreeLabel, roleOfLabel, type DegreeLabel, type ToneRole } from './intervals';
import { spellInterval } from './enharmonic-spelling';
import {
  sortLabels, type ChordFamily, type SeventhType, type ToneKind, type ToneSpec, type TriadType, QUALITY_NAMES,
} from './chord-formulas';

export interface ChordTone {
  label: DegreeLabel;
  degree: number;
  semitones: number;
  pitchClass: number;
  spelled: SpelledNote;
  required: boolean;
  kind: ToneKind;
  role: ToneRole;
  note?: string;
}

export interface ParsedChord {
  input: string;
  /** Normalised symbol, e.g. "F#maj7", "C7b9", "Am7/G". */
  symbol: string;
  root: SpelledNote;
  rootPc: number;
  /** Canonical quality key, e.g. "maj7", "m9", "7alt", "13b9", "7sus4". */
  quality: string;
  qualityName: string;
  family: ChordFamily;
  triad: TriadType;
  seventh: SeventhType;
  hasSixth: boolean;
  /** Natural extensions named by the symbol (9, 11, 13). */
  extensions: DegreeLabel[];
  /** Chromatic alterations (b5, #5, b9, #9, #11, b13). */
  alterations: DegreeLabel[];
  /** "add" tones on chords without a seventh. */
  additions: DegreeLabel[];
  /** Tones omitted by the symbol ("no3", "no5") or by convention (3rd of an 11 chord). */
  omissions: DegreeLabel[];
  isAltered: boolean;
  /** Every tone the symbol implies, ordered by degree. */
  tones: ChordTone[];
  /** Extra tensions a voicing may add without contradicting the symbol. */
  availableTensions: DegreeLabel[];
  /** For 7alt: at least one tone from each group must be present in a voicing. */
  requireAnyOf: DegreeLabel[][];
  bass?: SpelledNote;
  bassPc?: number;
  /** Bass is one of the chord's own tones (an inversion) vs an added non-chord bass. */
  bassIsChordTone?: boolean;
  /** Label of the bass relative to the chord root when it is a chord tone. */
  bassLabel?: DegreeLabel;
  spellingContext: {
    rootSpelling: string;
    /** label → spelled note string, e.g. { "3": "A#", "7": "E#" } */
    byLabel: Record<string, string>;
  };
  notes: string[];
}

export class ChordParseError extends Error {
  constructor(message: string, public readonly input: string) {
    super(message);
    this.name = 'ChordParseError';
  }
}

function normalise(raw: string): string {
  let s = raw.trim()
    .replace(/\s+/g, '')
    .replace(/[−–]/g, '-')
    .replace(/♭/g, 'b')
    .replace(/♯/g, '#')
    .replace(/Δ|∆|△/g, 'maj')
    .replace(/°/g, 'dim')
    .replace(/ø7?/g, 'm7b5');
  return s;
}

interface Builder {
  triad: TriadType;
  seventh: SeventhType;
  sixth: boolean;
  topExtension: 0 | 9 | 11 | 13;
  alterations: Set<string>;
  additions: Set<string>;
  omissions: Set<string>;
  alt: boolean;
  majorSeventh: boolean;
}

/** Parse the quality suffix (everything after the root, before an optional /bass). */
function parseSuffix(suffixIn: string, input: string): Builder {
  const b: Builder = {
    triad: 'maj', seventh: 'none', sixth: false, topExtension: 0, alterations: new Set(),
    additions: new Set(), omissions: new Set(), alt: false, majorSeventh: false,
  };
  let s = suffixIn;
  const eat = (re: RegExp): RegExpExecArray | null => {
    const m = re.exec(s);
    if (m && m.index === 0) { s = s.slice(m[0].length); return m; }
    return null;
  };

  // --- triad / quality prefix
  if (eat(/^(mmaj|mMaj|mM|minmaj|m\(maj|-maj|-\(maj|m\/maj|-Δ|mΔ)/)) {
    b.triad = 'min'; b.majorSeventh = true; eat(/^\)/);
    // m(maj7) / mMaj7 / mM9
    const n = eat(/^(13|11|9|7)\)?/);
    b.seventh = '7';
    if (n) setExtension(b, parseInt(n[1], 10));
  } else if (eat(/^(dim|o)/)) {
    b.triad = 'dim';
    if (eat(/^7/)) b.seventh = 'bb7';
  } else if (eat(/^(aug|\+(?![0-9]))/)) {
    b.triad = 'aug';
  } else if (eat(/^(maj|Maj|ma|M)(?=\d|$|\(|add|sus|#|b|\/)/)) {
    b.majorSeventh = true;
    const n = eat(/^(13|11|9|7)/);
    if (n) { b.seventh = '7'; setExtension(b, parseInt(n[1], 10)); }
    else if (s.length === 0 || /^(add|sus|\/)/.test(s)) { b.majorSeventh = false; } // "Cmaj" = major triad
    else { b.seventh = '7'; } // "Cmaj#11" → maj7#11
  } else if (eat(/^(min|mi|m|-)(?!aj)/)) {
    b.triad = 'min';
  }

  // --- numeric part (6, 6/9, 69, 7, 9, 11, 13) unless already consumed
  if (b.seventh === 'none' && !b.majorSeventh) {
    if (eat(/^(6\/9|69|6add9)/)) { b.sixth = true; b.additions.add('9'); }
    else if (eat(/^6/)) { b.sixth = true; if (eat(/^\/?9/)) b.additions.add('9'); }
    else {
      const n = eat(/^(13|11|9|7)/);
      if (n) {
        if (b.triad === 'aug') { b.seventh = 'b7'; }
        else if (b.triad === 'dim') {
          // "Cdim7" handled above; "Co9" unusual
          b.seventh = 'bb7';
        } else b.seventh = 'b7';
        setExtension(b, parseInt(n[1], 10));
      }
    }
  }

  // --- loop over remaining modifiers in any order
  let guard = 0;
  while (s.length > 0 && guard++ < 30) {
    if (eat(/^[(),]/)) continue;
    if (eat(/^alt/)) { b.alt = true; if (b.seventh === 'none') b.seventh = 'b7'; continue; }
    let m = eat(/^sus(2|4)?/);
    if (m) {
      const kind = m[1] ?? '4';
      if (b.triad === 'min' || b.triad === 'dim' || b.triad === 'aug') throw new ChordParseError('A suspended chord cannot also be minor/diminished/augmented', input);
      b.triad = kind === '2' ? 'sus2' : 'sus4';
      // "C9sus" / "C13sus": ensure 7th
      continue;
    }
    m = eat(/^add(b|#)?(2|4|6|9|11|13)/);
    if (m) {
      const label = (m[1] ?? '') + m[2];
      if (m[1]) b.alterations.add(label); else b.additions.add(label);
      continue;
    }
    m = eat(/^(no|omit)(1|3|5|root)/);
    if (m) { b.omissions.add(m[2] === 'root' ? '1' : m[2]); continue; }
    m = eat(/^(b|#|-|\+)(5|9|11|13)/);
    if (m) {
      const acc = m[1] === '-' ? 'b' : m[1] === '+' ? '#' : m[1];
      const label = acc + m[2];
      if (!['b5', '#5', 'b9', '#9', '#11', 'b13'].includes(label)) throw new ChordParseError(`Unsupported alteration "${label}"`, input);
      b.alterations.add(label);
      // alterations imply a 7th when attached to a bare triad with 9/11/13 (e.g. "C7b9"). "C#5" on a triad = augmented.
      continue;
    }
    // trailing extension after sus, e.g. "Csus4/7" is unusual — anything else is an error.
    throw new ChordParseError(`Could not understand "${s}" in chord symbol`, input);
  }

  // m7b5 / m9b5 → half-diminished (diminished triad + minor 7th)
  if (b.triad === 'min' && b.alterations.has('b5') && b.seventh === 'b7' && !b.majorSeventh) {
    b.alterations.delete('b5'); b.triad = 'dim';
  }
  // Bare triad with #5 and no 7th → augmented triad
  if (b.seventh === 'none' && b.alterations.has('#5') && b.triad === 'maj' && !b.sixth) {
    b.alterations.delete('#5'); b.triad = 'aug';
  }
  if (b.seventh === 'none' && (b.alterations.has('b9') || b.alterations.has('#9') || b.alterations.has('b13'))) {
    // "Cb9" is not a standard symbol; treat altered tensions as implying a dominant 7th.
    b.seventh = 'b7';
  }
  return b;
}

function setExtension(b: Builder, n: number): void {
  if (n === 7) return;
  b.topExtension = n as 9 | 11 | 13;
}

function computeQualityKey(b: Builder): string {
  if (b.alt) return '7alt';
  let key = '';
  const alts = sortLabels([...b.alterations]);
  const ext = b.topExtension === 0 ? '7' : String(b.topExtension);
  if (b.triad === 'dim' && b.seventh === 'bb7') key = 'dim7';
  else if (b.triad === 'dim' && b.seventh === 'none') key = 'dim';
  else if (b.triad === 'aug' && b.seventh === 'none') key = 'aug';
  else if (b.seventh === 'none') {
    key = b.triad === 'min' ? 'm' : '';
    if (b.sixth) key += b.additions.has('9') ? '69' : '6';
    if (b.triad === 'sus2') key += 'sus2';
    if (b.triad === 'sus4') key += 'sus4';
    const adds = sortLabels([...b.additions].filter((a) => !(b.sixth && a === '9')));
    for (const a of adds) key += 'add' + a;
    if (key === '') key = 'maj';
  } else {
    if (b.triad === 'min' && b.majorSeventh) key = 'mmaj' + ext;
    else if (b.majorSeventh) key = 'maj' + ext;
    else if (b.triad === 'min') key = 'm' + ext;
    else if (b.triad === 'dim') key = 'm' + ext + 'b5'; // dim triad + b7 = half-diminished
    else key = ext;
    if (b.triad === 'aug') alts.unshift('#5');
    if (b.triad === 'sus4') key += 'sus4';
    if (b.triad === 'sus2') key += 'sus2';
  }
  for (const a of alts) if (!(b.triad === 'dim' && b.seventh === 'b7' && a === 'b5')) key += a;
  for (const o of sortLabels([...b.omissions])) key += 'no' + o;
  return key;
}

function buildTones(b: Builder): { specs: ToneSpec[]; omitted: string[]; requireAnyOf: string[][] } {
  const specs: ToneSpec[] = [];
  const omitted: string[] = [...b.omissions];
  const add = (label: string, required: boolean, kind: ToneKind, note?: string) => {
    if (b.omissions.has(label.replace(/[b#]/g, '')) && (label === '3' || label === 'b3' || label === '5' || label === '1')) return;
    if (!specs.some((t) => t.label === label)) specs.push({ label, required, kind, note });
  };
  const hasSeventh = b.seventh !== 'none';
  const isDominantLike = hasSeventh && b.seventh === 'b7' && b.triad !== 'min' && b.triad !== 'dim';

  add('1', true, 'root', 'May be omitted in rootless voicings when a bassist or the left hand supplies it.');

  // third / suspension
  let thirdOmitted = false;
  if (b.topExtension === 11 && isDominantLike && b.triad === 'maj' && !b.alterations.has('#11')) {
    // Dominant 11: the natural 11 clashes with the major 3rd, so the 3rd is conventionally omitted (sounds like 9sus4).
    thirdOmitted = true; omitted.push('3');
  }
  if (b.triad === 'min' || b.triad === 'dim') add('b3', true, 'chord');
  else if (b.triad === 'sus2') add('2', true, 'chord');
  else if (b.triad === 'sus4') add('4', true, 'chord');
  else if (!thirdOmitted) add('3', true, 'chord');

  // fifth
  const isTriadOnly = !hasSeventh && !b.sixth && b.additions.size === 0;
  if (b.triad === 'dim' || b.alterations.has('b5')) add('b5', true, 'chord');
  else if (b.triad === 'aug' || b.alterations.has('#5')) add('#5', true, b.triad === 'aug' ? 'chord' : 'alteration');
  else if (b.alt) { omitted.push('5'); }
  else add('5', isTriadOnly || b.triad === 'sus2' && !hasSeventh, 'chord', isTriadOnly ? undefined : 'The perfect 5th is usually optional in 7th/extended voicings.');

  if (b.sixth) add('6', true, 'chord');
  if (b.seventh === 'b7') add('b7', true, 'chord');
  if (b.seventh === '7') add('7', true, 'chord');
  if (b.seventh === 'bb7') add('bb7', true, 'chord');

  // extensions implied by 9/11/13
  const alt9 = b.alterations.has('b9') || b.alterations.has('#9');
  if (b.topExtension >= 9 && !alt9) add('9', b.topExtension === 9, 'extension', b.topExtension > 9 ? 'Implied by the symbol, optional in practice.' : undefined);
  if (b.topExtension >= 11 && !b.alterations.has('#11')) {
    if (b.topExtension === 11) add('11', true, 'extension');
    else if (b.triad === 'min') add('11', false, 'extension', 'Optional colour on minor 13 chords.');
    else omitted.push('11');
  }
  if (b.topExtension === 13 && !b.alterations.has('b13')) add('13', true, 'extension');

  for (const a of sortLabels([...b.additions])) {
    if (b.sixth && a === '9') add('9', true, 'added');
    else add(a, true, 'added');
  }
  for (const a of sortLabels([...b.alterations])) {
    if (a === 'b5' || a === '#5') continue;
    add(a, true, 'alteration');
  }

  const requireAnyOf: string[][] = [];
  if (b.alt) {
    for (const a of ['b9', '#9', '#11', 'b13']) add(a, false, 'alteration', 'Altered tension — use one or more.');
    requireAnyOf.push(['b9', '#9', '#11', 'b13']);
  }
  return { specs, omitted, requireAnyOf };
}

function classify(b: Builder): ChordFamily {
  if (b.triad === 'dim') return b.seventh === 'b7' ? 'half-diminished' : 'diminished';
  if (b.triad === 'min') return 'minor';
  if (b.seventh === 'b7' || b.alt) return 'dominant';
  if (b.triad === 'aug') return 'augmented';
  if (b.triad === 'sus2' || b.triad === 'sus4') return 'suspended';
  return 'major';
}

function computeAvailableTensions(b: Builder, family: ChordFamily, present: Set<string>): string[] {
  let t: string[] = [];
  const altered = b.alt || ['b9', '#9', 'b13', '#5'].some((a) => b.alterations.has(a));
  switch (family) {
    case 'major':
      if (b.seventh === '7') t = b.alterations.has('#5') ? ['9', '#11'] : ['9', '#11', '13'];
      else t = ['9', '6'];
      break;
    case 'minor':
      if (b.seventh === 'none') t = ['9', '11'];
      else t = ['9', '11', '13'];
      break;
    case 'dominant':
      if (b.alt) t = [];
      else if (b.triad === 'sus4' || b.topExtension === 11) t = ['9', '13'];
      else if (altered) t = ['b9', '#9', '#11', 'b13'].concat(b.alterations.has('b13') || b.alterations.has('#5') ? [] : ['13']);
      else t = ['9', '13'];
      break;
    case 'half-diminished': t = ['9', '11', 'b13']; break;
    case 'diminished': t = b.seventh === 'bb7' ? ['9', '11', 'b13', '7'] : []; break;
    case 'augmented': t = ['9']; break;
    case 'suspended': t = b.triad === 'sus4' ? ['9'] : ['4']; break;
  }
  const presentPcs = new Set([...present].map((l) => mod12(parseDegreeLabel(l).semitones)));
  return t.filter((l) => !present.has(l) && !presentPcs.has(mod12(parseDegreeLabel(l).semitones)));
}

/** Split "Am7/G" into ["Am7", "G"], leaving "C6/9" intact. */
function splitSlash(s: string): { main: string; bass?: string } {
  const m = /^(.*)\/([A-Ga-g](?:bb|##|b|#)?)$/.exec(s);
  if (m && m[1].length > 0) return { main: m[1], bass: m[2] };
  return { main: s };
}

export function parseChord(input: string): ParsedChord {
  if (!input || !input.trim()) throw new ChordParseError('Empty chord symbol', input);
  const s = normalise(input);
  const { main, bass } = splitSlash(s);
  const rootPart = parseNotePrefix(main);
  if (!rootPart) throw new ChordParseError(`Chord must start with a note name A–G: "${input}"`, input);
  const root = rootPart.note;
  if (root.letter !== root.letter.toUpperCase()) throw new ChordParseError('Invalid root', input);
  const b = parseSuffix(rootPart.rest, input);
  const family = classify(b);
  const quality = computeQualityKey(b);
  const { specs, omitted, requireAnyOf } = buildTones(b);
  const rootPc = pitchClassOf(root);

  const tones: ChordTone[] = specs.map((t) => {
    const iv = parseDegreeLabel(t.label);
    return {
      label: iv.label, degree: iv.degree, semitones: iv.semitones, pitchClass: mod12(rootPc + iv.semitones),
      spelled: spellInterval(root, iv), required: t.required, kind: t.kind, role: roleOfLabel(iv.label), note: t.note,
    };
  });

  const present = new Set(tones.map((t) => t.label));
  const availableTensions = computeAvailableTensions(b, family, present);

  let bassNote: SpelledNote | undefined;
  let bassPc: number | undefined;
  let bassIsChordTone: boolean | undefined;
  let bassLabel: string | undefined;
  if (bass) {
    const bp = parseNotePrefix(bass);
    if (!bp || bp.rest) throw new ChordParseError(`Invalid bass note "${bass}"`, input);
    bassNote = bp.note;
    bassPc = pitchClassOf(bassNote);
    const match = tones.find((t) => t.pitchClass === bassPc);
    bassIsChordTone = !!match;
    bassLabel = match?.label;
  }

  const extensions = tones.filter((t) => t.kind === 'extension').map((t) => t.label);
  const byLabel: Record<string, string> = {};
  for (const t of tones) byLabel[t.label] = formatNote(t.spelled);
  for (const t of availableTensions) byLabel[t] = formatNote(spellInterval(root, t));

  const qualitySymbol = quality === 'maj' ? '' : quality;
  const symbol = formatNote(root) + qualitySymbol + (bassNote ? '/' + formatNote(bassNote) : '');

  return {
    input, symbol, root, rootPc, quality, qualityName: QUALITY_NAMES[quality] ?? quality,
    family, triad: b.triad, seventh: b.seventh, hasSixth: b.sixth,
    extensions, alterations: sortLabels([...b.alterations, ...(b.triad === 'aug' && b.seventh !== 'none' ? ['#5'] : [])]),
    additions: sortLabels([...b.additions]), omissions: sortLabels([...new Set(omitted)]), isAltered: b.alt,
    tones, availableTensions, requireAnyOf,
    bass: bassNote, bassPc, bassIsChordTone, bassLabel,
    spellingContext: { rootSpelling: formatNote(root), byLabel },
    notes: tones.map((t) => formatNote(t.spelled)),
  };
}

export function tryParseChord(input: string): { chord?: ParsedChord; error?: string } {
  try { return { chord: parseChord(input) }; } catch (e) { return { error: (e as Error).message }; }
}

/** Build a chord symbol string from a root spelling and canonical quality key. */
export function chordSymbol(root: SpelledNote, quality: string, bass?: SpelledNote): string {
  return formatNote(root) + (quality === 'maj' ? '' : quality) + (bass ? '/' + formatNote(bass) : '');
}
