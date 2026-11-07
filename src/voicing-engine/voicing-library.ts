/**
 * Curated seed library of voicing templates.
 *
 * Every template is root-relative and is transposed to all 12 keys by the generator.
 * Transpositions are NOT counted as separate templates.
 *
 * Review status: these templates were written from standard, widely taught keyboard
 * practice (triad/seventh inversions, shells, rootless A/B, drop 2, quartal "So What"-type
 * stacks, triad-over-guide-tone upper structures, R&B clusters). They have been checked
 * programmatically (see tests/voicing-library.test.ts) but have NOT been reviewed by an
 * external, credentialed musician, so each is marked "curated-unreviewed". No source
 * attributions are invented.
 */
import { parseChord } from '../music-theory/chord-parser';
import { labelPitchClass } from '../music-theory/intervals';
import { mod12 } from '../music-theory/note-parser';
import { parseTemplateDsl } from './template-dsl';
import type { BassRequirement, Style, VoicingFamily, VoicingTemplate } from './voicing-types';

type RegisterPreset = 'triad' | 'close7' | 'shell' | 'rootless' | 'drop2' | 'open' | 'quartal' | 'quartalRooted' | 'upper' | 'upperBand' | 'rnb';

const REGISTERS: Record<RegisterPreset, { bottomMin: number; bottomMax: number; description: string }> = {
  triad: { bottomMin: 55, bottomMax: 69, description: 'Right hand around middle C to A4 (lowest note G3–A4)' },
  close7: { bottomMin: 52, bottomMax: 67, description: 'Lowest note E3–G4' },
  shell: { bottomMin: 41, bottomMax: 53, description: 'Left-hand root between F2 and F3' },
  rootless: { bottomMin: 50, bottomMax: 62, description: 'Lowest note D3–D4 (classic comping register)' },
  drop2: { bottomMin: 48, bottomMax: 60, description: 'Lowest note C3–C4' },
  open: { bottomMin: 36, bottomMax: 50, description: 'Left-hand root C2–D3, right hand above middle C' },
  quartal: { bottomMin: 50, bottomMax: 64, description: 'Lowest note D3–E4' },
  quartalRooted: { bottomMin: 40, bottomMax: 55, description: 'Left-hand root E2–G3' },
  upper: { bottomMin: 41, bottomMax: 52, description: 'Left-hand root F2–E3, triad above middle C' },
  upperBand: { bottomMin: 50, bottomMax: 58, description: 'Left-hand guide tones D3–Bb3, bassist plays the root' },
  rnb: { bottomMin: 36, bottomMax: 50, description: 'Left-hand root C2–D3, right-hand cluster around middle C' },
};

const FAMILY_TEXT: Record<VoicingFamily, string> = {
  'triad-inversion': 'Close-position triad. Inversions let the hand stay in one place while chords change — the foundation of pop and ballad accompaniment.',
  'seventh-inversion': 'Close-position four-note seventh chord. Practising all inversions builds the hand shapes behind every richer voicing.',
  shell: 'Shell: root plus guide tones (3rd and 7th, or 6th). Defines the chord with three notes and leaves the right hand mostly free for melody.',
  'rootless-a': 'Rootless Type A: built up from the 3rd. The bassist (or your left hand) supplies the root; the voicing carries the guide tones plus colour tones.',
  'rootless-b': 'Rootless Type B: built up from the 7th. Alternating Type A and B through ii–V–I keeps voices moving by step.',
  open: 'Open / spread voicing: root (and often 5th) low in the left hand, chord tones higher in the right — a full, resonant sound for solo piano.',
  'drop-2': 'Drop 2: the second voice from the top of a close voicing is dropped an octave, opening the sound while keeping four distinct chord tones.',
  quartal: 'Quartal: stacked perfect 4ths (sometimes with a 3rd or tritone on top). Ambiguous, modern and open — central to modal jazz and neo-soul.',
  'upper-structure': 'Upper structure: a simple triad in the right hand over guide tones in the left. The triad supplies extensions/alterations in an easy-to-grab shape.',
  'rnb-color': 'R&B / Neo-Soul colour: seconds, added 9ths and 11ths clustered in the middle register for a warm, lush sound.',
};

interface Def {
  id: string;
  name: string;
  quality: string;
  family: VoicingFamily;
  dsl: string;
  styles: Style[];
  reg: RegisterPreset;
  diff: 1 | 2 | 3 | 4 | 5;
  note: string;
}

const P: Style = 'pop', B: Style = 'ballad', J: Style = 'jazz', R: Style = 'rnb', N: Style = 'neosoul';

const DEFS: Def[] = [];
const def = (id: string, name: string, quality: string, family: VoicingFamily, dsl: string, styles: Style[], reg: RegisterPreset, diff: Def['diff'], note: string) =>
  DEFS.push({ id, name, quality, family, dsl, styles, reg, diff, note });

// ---------------------------------------------------------------- 1. Triad inversions (18)
const TRIADS: [string, string, string, string, Def['diff'], Style[]][] = [
  ['maj', 'Major', '3', '5', 1, [P, B, R]],
  ['m', 'Minor', 'b3', '5', 1, [P, B, R]],
  ['dim', 'Diminished', 'b3', 'b5', 2, [P, B, J]],
  ['aug', 'Augmented', '3', '#5', 2, [P, B, J]],
  ['sus2', 'Sus2', '2', '5', 2, [P, B, R, N]],
  ['sus4', 'Sus4', '4', '5', 2, [P, B, R]],
];
for (const [q, nm, x, y, d, st] of TRIADS) {
  def(`tri-${q}-root`, `${nm} triad — root position`, q, 'triad-inversion', `1 ${x} ${y}`, st, 'triad', d, 'Root on the bottom: the most stable sound, but jumping between root positions causes large leaps.');
  def(`tri-${q}-inv1`, `${nm} triad — 1st inversion`, q, 'triad-inversion', `${x} ${y} 1`, st, 'triad', d, `The ${x === '3' || x === 'b3' ? '3rd' : 'suspended tone'} is on the bottom; the root on top gives a settled melody note.`);
  def(`tri-${q}-inv2`, `${nm} triad — 2nd inversion`, q, 'triad-inversion', `${y} 1 ${x}`, st, 'triad', d, `The 5th is on the bottom and the ${x === '3' || x === 'b3' ? '3rd' : 'suspended tone'} on top — a bright, singing top voice.`);
}

// ---------------------------------------------------------------- 2. Seventh / sixth chord inversions (32)
const SEVENTHS: [string, string, string[], Def['diff'], Style[]][] = [
  ['maj7', 'Major 7', ['1', '3', '5', '7'], 2, [P, B, J, R]],
  ['m7', 'Minor 7', ['1', 'b3', '5', 'b7'], 2, [P, B, J, R]],
  ['7', 'Dominant 7', ['1', '3', '5', 'b7'], 2, [P, B, J, R]],
  ['m7b5', 'Half-diminished', ['1', 'b3', 'b5', 'b7'], 3, [B, J]],
  ['dim7', 'Diminished 7', ['1', 'b3', 'b5', 'bb7'], 3, [B, J, P]],
  ['mmaj7', 'Minor-major 7', ['1', 'b3', '5', '7'], 3, [J, B]],
  ['6', 'Major 6', ['1', '3', '5', '6'], 2, [P, B, J]],
  ['m6', 'Minor 6', ['1', 'b3', '5', '6'], 2, [B, J]],
];
const INV_NAMES = ['root position', '1st inversion', '2nd inversion', '3rd inversion'];
for (const [q, nm, tones, d, st] of SEVENTHS) {
  for (let i = 0; i < 4; i++) {
    const rot = [...tones.slice(i), ...tones.slice(0, i)];
    const top = rot[3];
    const lowNote = i === 0 ? 'Root on the bottom.' : `The ${rot[0]} is the lowest note.`;
    const rub = rot.indexOf('7') >= 0 && rot[rot.indexOf('7') + 1] === '1' ? ' The 7th sits a half step under the root — a gentle rub that colours the sound.' : '';
    def(`sev-${q}-inv${i}`, `${nm} — ${INV_NAMES[i]}`, q, 'seventh-inversion', rot.join(' '), st, 'close7', (i === 3 ? Math.min(5, d + 1) : d) as Def['diff'],
      `${lowNote} Top voice: ${top}.${rub}`);
  }
}

// ---------------------------------------------------------------- 3. Shell voicings (14, left hand, root included)
const SHELLS: [string, string, string, string, Style[]][] = [
  ['maj7', 'Major 7', '3', '7', [J, B]],
  ['m7', 'Minor 7', 'b3', 'b7', [J, B]],
  ['7', 'Dominant 7', '3', 'b7', [J, B]],
  ['6', 'Major 6', '3', '6', [J, B]],
  ['m6', 'Minor 6', 'b3', '6', [J, B]],
  ['mmaj7', 'Minor-major 7', 'b3', '7', [J]],
  ['7sus4', '7sus4', '4', 'b7', [J, B, N]],
];
for (const [q, nm, third, sev, st] of SHELLS) {
  def(`shell-${q}-r37`, `${nm} shell — R-3-7`, q, 'shell', `1 ${third} ${sev} |`, st, 'shell', 2,
    'Root, 3rd, 7th close together. Keep the root at or above roughly Bb2 so the low 3rd does not get muddy.');
  def(`shell-${q}-r73`, `${nm} shell — R-7 + 3 on top`, q, 'shell', `1 ${sev} | ${third}`, st, 'shell', 2,
    'Left hand plays root and 7th; the right hand (thumb) adds the 3rd a 10th above the root. The wide spacing stays clear even in a low register.');
}

// ---------------------------------------------------------------- 4/5. Rootless Type A & B (34)
const ROOTLESS: [string, string, string, string, Style[], Def['diff'], string][] = [
  ['maj9', 'Major 9', '3 5 7 9', '7 9 3 5', [J, B, N, R], 3, 'Major 9th colour without the root; the 9th replaces the root.'],
  ['69', 'Major 6/9', '3 5 6 9', '6 9 3 5', [J, B, N], 3, 'The 6th and 9th give a bright, stable tonic sound that avoids the major 7th.'],
  ['maj13', 'Major 13', '3 6 7 9', '7 9 3 6', [J, N], 4, 'The 13th (6th) replaces the 5th for a richer major colour.'],
  ['m9', 'Minor 9', 'b3 5 b7 9', 'b7 9 b3 5', [J, B, N, R], 3, 'The classic minor 9th comping voicing. Guide tones b3 and b7 are both present.'],
  ['m69', 'Minor 6/9', 'b3 5 6 9', '6 9 b3 5', [J, N], 3, 'Dorian minor tonic colour; the natural 6th gives a bittersweet sound.'],
  ['m11', 'Minor 11', 'b3 11 b7 9', 'b7 9 b3 11', [J, N, R], 3, 'The 11th sits a whole step above the b3 — a soft cluster typical of modern minor chords.'],
  ['9', 'Dominant 9', '3 5 b7 9', 'b7 9 3 5', [J, R, B], 3, 'Guide tones 3 and b7 a tritone apart, plus the 9th.'],
  ['13', 'Dominant 13', '3 13 b7 9', 'b7 9 3 13', [J, R, N, B], 3, 'The standard dominant comping shape: 3, 7, 9 and 13 — no root, no 5th.'],
  ['13b9', 'Dominant 13(b9)', '3 13 b7 b9', 'b7 b9 3 13', [J], 4, 'Half-whole diminished colour: the b9 adds tension while the 13 keeps it bright.'],
  ['7b9', 'Dominant 7(b9)', '3 5 b7 b9', 'b7 b9 3 5', [J, B], 3, 'The upper four notes form a diminished 7th chord — a classic dominant-function sound.'],
  ['7#9', 'Dominant 7(#9)', '3 5 b7 #9', 'b7 #9 3 5', [J, R], 4, 'The #9 against the major 3rd creates the bluesy "major-minor" clash.'],
  ['9sus4', 'Dominant 9sus4', '4 5 b7 9', 'b7 9 4 5', [J, N, R], 3, 'Suspended dominant: the 4th replaces the 3rd, so it can sit over the V without resolving.'],
  ['13sus4', 'Dominant 13sus4', '4 13 b7 9', 'b7 9 4 13', [J, N, R], 4, 'Suspended dominant with the 13th — open and modern.'],
  ['m9b5', 'Half-diminished 9', 'b3 b5 b7 9', 'b7 9 b3 b5', [J], 4, 'Half-diminished with the natural 9th (Locrian ♮2) — smoother than the b9.'],
  ['9#11', 'Dominant 9(#11)', '3 #11 b7 9', 'b7 9 3 #11', [J, N], 4, 'Lydian-dominant colour: the #11 replaces the 5th.'],
];
for (const [q, nm, a, bb, st, d, note] of ROOTLESS) {
  def(`rl-a-${q}`, `${nm} — rootless A`, q, 'rootless-a', a, st, 'rootless', d, note);
  def(`rl-b-${q}`, `${nm} — rootless B`, q, 'rootless-b', bb, st, 'rootless', d, note);
}
def('rl-a-alt-b9b13', 'Altered (b9 b13) — rootless A', '7alt', 'rootless-a', '3 b13 b7 b9', [J], 'rootless', 4, 'Altered dominant using b9 and b13; resolves strongly to a minor or major tonic.');
def('rl-b-alt-b9b13', 'Altered (b9 b13) — rootless B', '7alt', 'rootless-b', 'b7 b9 3 b13', [J], 'rootless', 4, 'Altered dominant using b9 and b13; resolves strongly to a minor or major tonic.');
def('rl-a-alt-s9b13', 'Altered (#9 b13) — rootless A', '7alt', 'rootless-a', '3 b13 b7 #9', [J, N], 'rootless', 4, 'Altered dominant using #9 and b13 — darker and more biting than b9.');
def('rl-b-alt-s9b13', 'Altered (#9 b13) — rootless B', '7alt', 'rootless-b', 'b7 #9 3 b13', [J, N], 'rootless', 4, 'Altered dominant using #9 and b13 — darker and more biting than b9.');

// ---------------------------------------------------------------- 6. Drop 2 (28)
const DROP2: [string, string, string[], Style[]][] = [
  ['maj7', 'Major 7', ['5 | 1 3 7', '7 | 3 5 1', '1 | 5 7 3', '3 | 7 1 5'], [J, B, P]],
  ['m7', 'Minor 7', ['5 | 1 b3 b7', 'b7 | b3 5 1', '1 | 5 b7 b3', 'b3 | b7 1 5'], [J, B, P]],
  ['7', 'Dominant 7', ['5 | 1 3 b7', 'b7 | 3 5 1', '1 | 5 b7 3', '3 | b7 1 5'], [J, B]],
  ['m7b5', 'Half-diminished', ['b5 | 1 b3 b7', 'b7 | b3 b5 1', '1 | b5 b7 b3', 'b3 | b7 1 b5'], [J, B]],
  ['maj9', 'Major 9', ['7 | 3 5 9', '9 | 5 7 3', '3 | 7 9 5', '5 | 9 3 7'], [J, B, N]],
  ['m9', 'Minor 9', ['b7 | b3 5 9', '9 | 5 b7 b3', 'b3 | b7 9 5', '5 | 9 b3 b7'], [J, B, N]],
  ['9', 'Dominant 9', ['b7 | 3 5 9', '9 | 5 b7 3', '3 | b7 9 5', '5 | 9 3 b7'], [J, B]],
];
for (const [q, nm, shapes, st] of DROP2) {
  shapes.forEach((dsl, i) => {
    const top = dsl.trim().split(/\s+/).pop();
    def(`d2-${q}-${i}`, `${nm} — drop 2 (${dsl.split('|')[0].trim()} in bass)`, q, 'drop-2', dsl, st, 'drop2', 3,
      `Left hand takes the dropped voice; right hand plays the remaining three. Top voice: ${top}.`);
  });
}

// ---------------------------------------------------------------- 7. Open / spread (19)
def('open-maj-a', 'Major — spread (R5 + 1st inv)', 'maj', 'open', '1 5 | 3 5 1', [P, B], 'open', 1, 'Left-hand root and 5th, right-hand 1st-inversion triad: the go-to pop/ballad sound.');
def('open-maj-b', 'Major — spread (R5 + root pos.)', 'maj', 'open', '1 5 | ^1 3 5', [P, B], 'open', 1, 'Wide gap between hands for an airy, orchestral sound.');
def('open-maj-c', 'Major — spread (R5 + 2nd inv)', 'maj', 'open', '1 5 | 5 1 3', [P, B], 'open', 1, 'The 3rd on top sings — good for sustained ballad chords.');
def('open-m-a', 'Minor — spread (R5 + 1st inv)', 'm', 'open', '1 5 | b3 5 1', [P, B], 'open', 1, 'Minor version of the pop spread voicing.');
def('open-m-b', 'Minor — spread (R5 + 2nd inv)', 'm', 'open', '1 5 | 5 1 b3', [P, B], 'open', 1, 'The minor 3rd on top gives a plaintive melody note.');
def('open-add9', 'Add9 — spread', 'add9', 'open', '1 5 | 9 3 5', [P, B, R], 'open', 2, 'The 9th rubs against the 3rd for shimmer without changing the chord function.');
def('open-madd9', 'Minor add9 — spread', 'madd9', 'open', '1 5 | b3 5 9', [P, B, R], 'open', 2, 'The 9th on top softens the minor chord — common in ballads.');
def('open-sus4', 'Sus4 — spread', 'sus4', 'open', '1 5 | 4 5 1', [P, B], 'open', 1, 'Suspended 4th over open 5th; resolve the 4th down to the 3rd for a classic cadence.');
def('open-sus2', 'Sus2 — spread', 'sus2', 'open', '1 5 | 9 5 1', [P, B, N], 'open', 2, 'Open, ambiguous sound with no 3rd — major or minor is left to the melody.');
def('open-maj7', 'Major 7 — spread', 'maj7', 'open', '1 5 | 7 3 5', [P, B], 'open', 2, 'The 7th low in the right hand with 3 and 5 above — warm and full.');
def('open-maj9-a', 'Major 9 — spread', 'maj9', 'open', '1 5 | 7 9 3', [B, J, R], 'open', 2, 'Right hand 7-9-3 over an open fifth: a lush ballad tonic.');
def('open-maj9-b', 'Major 9 — R7 + 3-5-9', 'maj9', 'open', '1 7 | 3 5 9', [B, J], 'open', 3, 'Left hand root-7th, right hand 3-5-9: clear guide tones in both hands.');
def('open-m9', 'Minor 9 — R-b7 + b3-5-9', 'm9', 'open', '1 b7 | b3 5 9', [B, J, R, N], 'open', 3, 'Root and 7th below, minor triad-plus-9 above.');
def('open-m7', 'Minor 7 — spread', 'm7', 'open', '1 5 | b7 b3 5', [P, B], 'open', 2, 'b7 at the bottom of the right hand keeps the 7th audible and voices smooth.');
def('open-7', 'Dominant 7 — R-b7 + triad', '7', 'open', '1 b7 | 3 5 1', [P, B], 'open', 2, 'Left-hand root-7th with a right-hand triad: a pop dominant that clearly wants to resolve.');
def('open-69', '6/9 — spread', '69', 'open', '1 5 | 6 9 3', [B, J, R], 'open', 3, 'The 6/9 colour placed in fourths above an open fifth.');
def('open-9sus4', '9sus4 — spread', '9sus4', 'open', '1 5 | b7 9 4', [P, B, R, N], 'open', 2, 'A major triad on the b7 over the root and 5th: the classic gospel/pop "IV over V" sound.');
def('open-maj-tenth', 'Major — tenth in left hand', 'maj', 'open', '1 ^3 | 5 1 3', [B, P], 'open', 4, 'Left-hand 10th (root + 3rd an octave up) — needs a large hand (span ≥ 16 semitones) or a roll.');
def('open-m-tenth', 'Minor — tenth in left hand', 'm', 'open', '1 ^b3 | 5 1 b3', [B], 'open', 4, 'Minor 10th in the left hand (15 semitones) — a stride/ballad sound for larger hands.');

// ---------------------------------------------------------------- 8. Quartal (16)
def('q-m11-sowhat', 'Minor 11 — "So What" (rooted)', 'm11', 'quartal', '1 4 b7 | b3 5', [J, N], 'quartalRooted', 3, 'Three perfect 4ths topped by a major 3rd. The famous modal-jazz minor sound.');
def('q-m11-3', 'Minor 11 — three 4ths', 'm11', 'quartal', '4 b7 b3', [J, N], 'quartal', 3, 'Rootless stack of two perfect 4ths: 11, b7, b3. Compact and modal.');
def('q-m11-4', 'Minor 11 — "So What" upper four', 'm11', 'quartal', '4 b7 b3 5', [J, N], 'quartal', 3, 'The upper four notes of the So What voicing — works with a bassist on the root.');
def('q-m11-lh', 'Minor 11 — root + quartal stack', 'm11', 'quartal', '1 | ^4 b7 b3 5', [N, J, R], 'open', 3, 'Low root in the left hand with the quartal stack in the right — a neo-soul staple.');
def('q-13-tt4', 'Dominant 13 — tritone + 4th', '13', 'quartal', 'b7 3 13', [J, N], 'quartal', 3, 'b7–3 tritone with a 4th on top: the most compact dominant 13 shape.');
def('q-13-4', 'Dominant 13 — tritone + two 4ths', '13', 'quartal', 'b7 3 13 9', [J, N, R], 'quartal', 3, 'Tritone then stacked 4ths (3–13–9).');
def('q-13-lh', 'Dominant 13 — root + 4th stack', '13', 'quartal', '1 | ^b7 3 13', [J, N, R], 'open', 3, 'Root low, b7–3–13 in the right hand.');
def('q-13-r7', 'Dominant 13 — R-b7 + 3-13-9 fourths', '13', 'quartal', '1 b7 | 3 13 9', [J, R, N, B], 'open', 3, 'Right hand stacks 3–13–9 in perfect 4ths over the left-hand root and 7th.');
def('q-69-3', '6/9 — three 4ths', '69', 'quartal', '3 6 9', [J, N, P], 'quartal', 2, 'Perfect 4ths from the 3rd: 3–6–9. Floating, unresolved tonic.');
def('q-69-4', '6/9 — four-note quartal', '69', 'quartal', '3 6 9 5', [J, N], 'quartal', 3, 'Four stacked 4ths built from the 3rd.');
def('q-maj13-3', 'Major 13 — 7-3-13', 'maj13', 'quartal', '7 3 6', [J, N], 'quartal', 3, 'Perfect 4ths from the major 7th.');
def('q-maj13-4', 'Major 13 — 7-3-13-9', 'maj13', 'quartal', '7 3 6 9', [J, N], 'quartal', 4, 'Four-note 4ths stack from the 7th; very open major colour.');
def('q-lyd-3', 'Maj7#11 — Lydian 4ths', 'maj7#11', 'quartal', '#11 7 3', [J, N], 'quartal', 3, 'Perfect 4ths from the #11 — instantly Lydian.');
def('q-lyd-4', 'Maj13#11 — Lydian 4ths', 'maj13#11', 'quartal', '#11 7 3 6', [J, N], 'quartal', 4, 'Four-note Lydian stack: #11–7–3–13.');
def('q-7sus-3', '7sus4 — R-4-b7', '7sus4', 'quartal', '1 4 b7', [J, N, R], 'quartal', 2, 'Root, 4th, 7th — two perfect 4ths. The basic sus sound.');
def('q-7sus-4', '7sus4 — 5-1-4-b7', '7sus4', 'quartal', '5 1 4 b7', [J, N], 'quartal', 3, 'Three perfect 4ths starting from the 5th.');
def('q-sus2-quintal', 'Sus2 — stacked 5ths', 'sus2', 'quartal', '1 5 9', [P, N, B], 'quartal', 2, 'Perfect 5ths (inverted 4ths): root, 5th, 9th. Open and modern.');

// ---------------------------------------------------------------- 9. Upper structures (19)
const US_DOM: [string, string, string, string, string][] = [
  ['us-II', 'II major triad (13#11)', '13#11', '9 #11 13', 'Major triad a whole step above the root: 9, #11, 13 — Lydian-dominant brightness.'],
  ['us-bVI', 'bVI major triad (alt #9 b13)', '7alt', 'b13 1 #9', 'Major triad on the b6: b13, root, #9 — a dark altered sound.'],
  ['us-bIII', 'bIII major triad (7#9)', '7#9', '#9 5 b7', 'Major triad on the b3: #9, 5, b7 — bluesy #9 colour with a stable triad shape.'],
  ['us-bV', 'bV major triad (7b9#11)', '7b9#11', '#11 b7 b9', 'Major triad on the b5 (tritone substitute triad): #11, b7, b9.'],
  ['us-VI', 'VI major triad (13b9)', '13b9', '13 b9 3', 'Major triad on the 6th: 13, b9, 3 — the half-whole diminished sound.'],
  ['us-sIVm', '#IV minor triad (13b9#11)', '13b9#11', '#11 13 b9', 'Minor triad on the #4: #11, 13, b9.'],
];
for (const [id, nm, q, triad, note] of US_DOM) {
  def(`${id}-solo`, `${nm} — over R-3-b7`, q, 'upper-structure', `1 3 b7 | ${triad}`, [J, N], 'upper', 5, `${note} Left hand: root–3–b7 shell (solo piano).`);
  def(`${id}-band`, `${nm} — over 3-b7 tritone`, q, 'upper-structure', `3 b7 | ${triad}`, [J, N], 'upperBand', 4, `${note} Left hand: 3–b7 tritone only; the bassist plays the root.`);
}
def('us-bVII-sus', 'bVII triad over root (11 / "IV of V")', '11', 'upper-structure', '1 | ^b7 9 11', [R, N, P, J, B], 'open', 2, 'Major triad on the b7 over the root (e.g. Bb/C): the gospel/R&B sus dominant.');
def('us-maj-II', 'II triad over maj7 (Lydian)', 'maj13#11', 'upper-structure', '1 3 7 | 9 #11 13', [J, N], 'upper', 4, 'Major triad a whole step up over a major-7 shell: 9, #11, 13.');
def('us-maj-V', 'V triad over root–3 (maj9)', 'maj9', 'upper-structure', '1 3 | 5 7 9', [B, J, R, P], 'upper', 3, 'Major triad on the 5th over root and 3rd — a simple way to play a major 9th.');
def('us-maj-VIIm', 'VII minor triad (maj9#11)', 'maj9#11', 'upper-structure', '1 3 | 7 9 #11', [J, N], 'upper', 4, 'Minor triad on the 7th over root–3: 7, 9, #11.');
def('us-min-IIm', 'ii minor triad over m7 (m13)', 'm13', 'upper-structure', '1 b3 b7 | 9 11 13', [J, N, R], 'upper', 4, 'Minor triad a whole step up over a minor-7 shell: 9, 11, 13 (Dorian).');
def('us-min-bVII', 'bVII major triad over m (m11)', 'm11', 'upper-structure', '1 b3 | b7 9 11', [R, N, J], 'upper', 3, 'Major triad on the b7 over root–b3: b7, 9, 11.');
def('us-min-vm', 'v minor triad over m (m9)', 'm9', 'upper-structure', '1 b3 | 5 b7 9', [B, J, R, N], 'upper', 3, 'Minor triad on the 5th over root–b3: 5, b7, 9.');

// ---------------------------------------------------------------- 10. R&B / Neo-Soul colour (16)
def('rnb-mu', '"Mu" major (add9 cluster)', 'add9', 'rnb-color', '1 | ^9 3 5', [R, N, P], 'rnb', 2, 'The 9th directly under the 3rd forms a whole-step cluster — bright and modern.');
def('rnb-mu-rootless', '"Mu" major — rootless', 'add9', 'rnb-color', '9 3 5', [R, N, P], 'rootless', 2, 'Right-hand 9–3–5 cluster; bass (or left hand) plays the root.');
def('rnb-maj9-cluster', 'Major 9 — 7-9-3-5 over root', 'maj9', 'rnb-color', '1 5 | 7 9 3 5', [R, N], 'rnb', 3, 'Rootless Type B shape placed over an open fifth for a lush R&B tonic.');
def('rnb-maj7-rub', 'Major 7 — 7/root rub', 'maj7', 'rnb-color', '1 | ^7 1 3 5', [R, N], 'rnb', 3, 'The major 7th a half step below the doubled root — a soft, deliberate rub.');
def('rnb-m11-cluster', 'Minor 11 — b3-11-5 cluster', 'm11', 'rnb-color', '1 b7 | b3 11 5', [R, N], 'rnb', 3, 'Whole-step cluster b3–11–5 over root–7th. Signature neo-soul minor.');
def('rnb-m11-stack', 'Minor 11 — b7-9-b3-11', 'm11', 'rnb-color', '1 5 | b7 9 b3 11', [R, N], 'rnb', 3, 'b7–9 then the b3–11 whole step: smooth, dark R&B minor.');
def('rnb-madd9-cluster', 'Minor add9 — 9/b3 cluster', 'madd9', 'rnb-color', '1 5 | 9 b3 5', [R, N, P], 'rnb', 2, 'The 9th a half step under the b3: tender, intimate minor colour.');
def('rnb-m9-spread', 'Minor 9 — rootless A over fifth', 'm9', 'rnb-color', '1 5 | b3 5 b7 9', [R, N, B], 'rnb', 3, 'Rootless minor 9 shape above an open fifth.');
def('rnb-13-cluster', 'Dominant 13 — 9/3 cluster', '13', 'rnb-color', '1 b7 | 9 3 13', [R, N], 'rnb', 3, '9th and 3rd a whole step apart with the 13th on top — gospel dominant.');
def('rnb-13sus', 'Gospel 13sus', '13sus4', 'rnb-color', '1 | ^b7 9 4 13', [R, N, B], 'rnb', 3, 'b7–9–4–13 over the root: open sus dominant used constantly in gospel and R&B.');
def('rnb-7s9', 'Dominant 7#9 — "blues" shape', '7#9', 'rnb-color', '1 b7 | 3 b7 #9', [R, N], 'rnb', 3, 'Right hand 3–b7–#9: the gritty major/minor clash heard in funk and blues.');
def('rnb-69', '6/9 — 9-3-6', '69', 'rnb-color', '1 5 | 9 3 6', [R, N, P], 'rnb', 2, 'Whole-step 9–3 cluster plus the 6th: a sweet, open tonic.');
def('rnb-maj9s11', 'Major 9#11 — 9-3-#11-7', 'maj9#11', 'rnb-color', '1 5 | 9 3 #11 7', [N, R], 'rnb', 4, 'Stepwise 9–3–#11 cluster with the 7th on top — dreamy Lydian neo-soul colour.');
def('rnb-m69', 'Minor 6/9 — b3-6-9', 'm69', 'rnb-color', '1 5 | b3 6 9', [N, R, J], 'rnb', 3, 'Tritone b3–6 with the 9th on top: Dorian minor colour.');
def('rnb-9-cluster', 'Dominant 9 — b7-9-3', '9', 'rnb-color', '1 | ^b7 9 3', [R, N], 'rnb', 2, 'Compact b7–9–3 over the root: a funky, crisp dominant.');
def('rnb-m7-rub', 'Minor 7 — b7/root rub', 'm7', 'rnb-color', '1 | ^b7 1 b3 5', [R, N], 'rnb', 2, 'Whole step between b7 and root at the bottom of the right hand — warm R&B minor.');

// ---------------------------------------------------------------- build
function buildTemplate(d: Def): VoicingTemplate {
  const { voices, oneHand } = parseTemplateDsl(d.dsl);
  const chord = parseChord('C' + (d.quality === 'maj' ? '' : d.quality));
  const tplPcs = new Set(voices.map((v) => mod12(v.semis)));
  const labels = voices.map((v) => v.label);
  const hasRoot = voices.some((v) => v.label === '1');
  const lhVoices = voices.filter((v) => v.hand === 'L');
  let bassRequirement: BassRequirement = 'root-included';
  if (!hasRoot) bassRequirement = oneHand ? 'external-bass' : lhVoices.length > 0 && !lhVoices.some((v) => v.label === '1') ? (d.family === 'drop-2' ? 'external-bass' : 'bassist-required') : 'external-bass';
  if (!hasRoot && d.family === 'drop-2') bassRequirement = 'bassist-required';

  const requiredTones = chord.tones.filter((t) => t.required && tplPcs.has(t.pitchClass)).map((t) => t.label);
  const optionalTones = [...new Set(labels.filter((l) => !requiredTones.some((r) => labelPitchClass(r) === labelPitchClass(l))))];
  const omittedTones = chord.tones.filter((t) => !tplPcs.has(t.pitchClass)).map((t) => t.label);

  const span = (hand: 'L' | 'R') => {
    const vs = voices.filter((v) => v.hand === hand);
    return vs.length ? vs[vs.length - 1].semis - vs[0].semis : 0;
  };
  return {
    id: d.id, name: d.name, quality: d.quality, family: d.family, voices, oneHand, labels,
    styles: d.styles, register: REGISTERS[d.reg], difficulty: d.diff,
    requiredTones, optionalTones, omittedTones, bassRequirement,
    maxHandSpan: Math.max(span('L'), span('R')),
    explanation: `${d.note} ${FAMILY_TEXT[d.family]}`,
    review: { status: 'curated-unreviewed', note: 'Written from standard keyboard pedagogy and checked by automated tests; not yet reviewed by an external musician.' },
    dsl: d.dsl,
  };
}

export const VOICING_LIBRARY: readonly VoicingTemplate[] = DEFS.map(buildTemplate);

export const FAMILY_DESCRIPTIONS = FAMILY_TEXT;

export function getTemplate(id: string): VoicingTemplate | undefined {
  return VOICING_LIBRARY.find((t) => t.id === id);
}
