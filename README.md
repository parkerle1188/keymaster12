# KEYMASTER 12

Learn piano voicings, voice leading and fluency in all 12 keys: Pop, Ballad, Jazz, R&B and Neo-Soul, from beginner to advanced.

**Status: Phases 1–4 complete.** All six tabs work:

| Tab | Phase | What it does |
|---|---|---|
| Learn | 1 | How chords, tones and voicings relate; free play; one lesson per voicing family |
| Voicing Explorer | 1 | Any chord symbol → best voicings for a style, solo or with a bassist |
| Voice Leading | 2 | Transition lab (note-by-note movement, total semitones, smoother alternatives) and the smooth-move exercise |
| Progressions | 2 | 21 reference progressions in any key, voiced with the smoothest path; numerals, functions, alternatives, playback |
| 12 Keys | 3 | Circle of fifths with per-key accuracy, timed recognition drills, transposition through all 12 keys |
| Daily Workout | 4 | Personalised 10/20/30-minute sessions, summary, history and analytics saved on this device |

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest (164 tests)
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/
```

Requires Node 18+ (Netlify builds with Node 20).

## Deploying to Netlify

`netlify.toml` is included: build command `npm run build`, publish directory `dist`, plus an SPA fallback redirect. Connect the repository in Netlify, or run `netlify deploy --prod` after a build.

## Architecture

```
src/
  music-theory/        pure TS, no DOM
    note-parser.ts         letter + accidental spelling (E# ≠ F)
    midi-notes.ts          MIDI numbers for pitch/register (C4 = 60; B#3 = 60, Cb4 = 59)
    intervals.ts           degree labels ("b9", "#11", "bb7") → degree number + semitones; tone roles
    enharmonic-spelling.ts letter = root letter + (degree − 1); readable root choice for 12 keys
    chord-formulas.ts      quality names, degree ordering
    chord-parser.ts        symbol → ParsedChord
    transposition.ts       12-key orders, diatonic transposition, chord re-rooting
    harmony.ts             scales, key signatures, circle of fifths, Roman numerals, harmonic function, chord-in-key
  voicing-engine/      pure TS
    voicing-types.ts       VoicingTemplate, GeneratedVoicing, options
    template-dsl.ts        compact template notation ("1 b7 | 3 13 9")
    voicing-library.ts     197 curated templates in 10 families
    voicing-generator.ts   retrieve → transpose → place → add bass → validate → score → top N
    voicing-validator.ts   hard constraints + musical warnings (low-interval limits, minor 9ths)
    register-optimizer.ts  octave placement, bass placement
    hand-assignment.ts     LH/RH decisions for one-hand shapes (solo vs band)
    voicing-scorer.ts      normalised 0..1 cost components × configurable weights
    twelve-keys.ts         a template through all 12 keys
  voice-leading/       pure TS (Phase 2)
    style-profiles.ts      Pop / Ballad / Jazz / R&B / Neo-Soul preferences, incl. voice-leading weights
    voice-leading.ts       voice matching, transition analysis, Viterbi progression optimiser, smoother suggestions
    progressions.ts        21 reference progressions as scale degrees + qualities + harmonic functions
  practice/            pure TS (Phases 3–4)
    rng.ts                 seeded PRNG (reproducible exercises and tests)
    questions.ts           interval / chord-tone / extension / construction / voicing / voice-leading questions + grading
    vl-exercise.ts         "smooth move" exercises built from the progressions
    progress.ts            attempts, per-key and per-skill stats, adaptive levels, weak keys, streaks, sessions
    workout.ts             10/20/30-minute plan builder, weak-key picking, session summaries
  audio/piano-audio.ts     Tone.js (lazy-loaded); Salamander piano samples with a synth fallback; sequenced playback
  state/                   LocalStorage helpers, shared progress store, optional Web MIDI input
  components/              one page per tab plus shared PianoKeyboard, NoteEntry, QuestionView,
                           VoiceLeadingGraph, CircleOfFifths …
tests/                     Vitest suites
```

The React layer only consumes engine output; every musical decision lives in the pure-TS modules and is unit-tested.

## Phase 2 — Voice leading & progressions

**Voice matching.** With equal voice counts, notes are paired in pitch order. For |a − b| costs on a line, the sorted pairing is a minimum-cost perfect matching (any crossing pair can be uncrossed without increasing the total), so it equals the Hungarian-algorithm optimum; a test checks this against brute force over all permutations. With different counts, a monotone dynamic-programming alignment lets one voice split into two (or two merge). The bass (an added solo bass, or the left-hand root of a two-hand shape) follows the root motion and is reported separately; smoothness is the upper-voice movement.

**Transition analysis** lists every voice's move, total semitones, common tones, the largest leap, the top-voice motion and a rating, and names guide-tone motion ("the 7th resolves by step to the 3rd").

**Progression optimiser.** Candidate voicings come from the voicing library (two octave placements per compatible template). A Viterbi pass minimises Σ (1 − score) × style quality weight + Σ upper-voice movement × style movement weight. Voicings can be locked; the others re-optimise around them. The page also shows the independently best voicing per chord for comparison, and the movement of every voicing approach (smoothest, inversions, shells, rootless A/B, drop 2, quartal/colour).

**Progressions** are stored as degrees relative to the tonic, so they are spelled by function in every key (ii–V–I in F# = G#m7 C#7 F#maj7). Minor keys use conventional tonics (C# minor, not Db minor), and roots that would need a double accidental are respelled (bII7 in Db is D7, not Ebb7).

## Phase 3 — 12 keys

- Circle of fifths: key signatures, relative minors, enharmonic names, per-key accuracy colouring.
- Key panel: scale, diatonic seventh chords with Roman numerals and functions.
- Drills: intervals (name the note; name the interval), chord tones, extensions/alterations, or mixed. Keys: selected, walk the circle, all 12, or your weakest. Timing: practice, 60-second sprint, or beat the clock (11 − level seconds per question).
- Adaptive difficulty per skill (levels 1–5): up after 8 of the last 10 correct at target speed, down below 50 % over 6+.
- Spelling is graded strictly; answering F for the 7th of F#maj7 is marked "right pitch, wrong spelling". Distractors include the enharmonic twin on purpose.
- Transposer: any progression (with optimised voicings) or any voicing template through all 12 keys, in circle-of-fifths, fourths or chromatic order.
- Keyboard answers accept clicks/taps or a Web MIDI keyboard (chord capture: the notes held together are submitted when all keys are released).

## Phase 4 — Daily workout

- 10 min: intervals 2, construction 3, voicings 3, voice leading 2. 20 min adds chord tones; 30 min adds extensions.
- Personalised: the weakest skill gets an extra minute (30 s in the 10-minute plan), taken from the strongest; each block draws from that skill's weakest keys, your overall weakest keys and a key of the day that rotates around the circle; weaker keys are picked more often; every block runs at its adaptive level.
- The timer measures real time while the page is visible and not paused, so throttled background timers cannot make it drift. A block ends after the question in progress.
- Summary: accuracy (with change since the last workout), average time, results per skill and per key, level-ups, next focus keys.
- History: streak, minutes this week, per-skill levels and accuracy, per-key accuracy grid, 14-day activity chart, session list, JSON export and reset. Everything is stored in LocalStorage on this device (capped at 200 sessions).

## Music-theory data model

The model keeps three things apart:

| Layer | Representation | Used for |
|---|---|---|
| Pitch | MIDI number | register, spans, low-interval limits, playback |
| Function | degree label (`1 b3 5 b7 9 #11 b13…`) + semitones | required/optional logic, colours, explanations |
| Spelling | `{letter, acc}` from the root's spelling + degree number | display (F#maj7 → E#, C7b9 → Db, Cdim7 → Bbb) |

`parseChord("C7(b9,#11)")` returns the following:

- `root`, `quality` (canonical key such as `7b9#11`), `family`, `triad`, `seventh`
- `extensions`, `alterations`, `additions`, `omissions` (e.g. a dominant 11 omits the 3rd; 13 chords omit the natural 11)
- `tones[]`: every implied tone with `label`, `semitones`, `spelled`, `required`, `kind`, `role`
- `availableTensions`: tones a style may add without contradicting the symbol (for example 9, #11 and 13 on maj7)
- `requireAnyOf`: for `7alt`, at least one of b9/#9/#11/b13
- `bass`, `bassIsChordTone`, `bassLabel` for slash chords

A **voicing** is a selection from the chord's tones. A template fits a chord when every template tone is a chord tone or an available tension, and every essential tone except the root is present. The root may come from the bass. Fits are labelled `exact` or `enriched (+9, +13…)`.

### Template notation

Tokens run low to high, and `|` separates the left hand from the right. Each voice is placed at the next pitch above the previous voice, and `^` skips an extra octave. With no `|`, the template is a one-hand shape. In solo mode the right hand plays it and the left hand adds the bass. In band mode, Jazz/Neo-Soul assign it to the left hand for comping and the other styles assign it to the right hand.

```
"3 13 b7 9"        rootless A dominant 13   (E A Bb D over C)
"1 4 b7 | b3 5"    "So What" minor 11
"3 b7 | 9 #11 13"  II-triad upper structure over a tritone (needs a bassist)
```

### Library (197 templates; transpositions not counted)

| Family | Count |
|---|---|
| Triad inversions | 18 |
| Seventh/sixth-chord inversions | 32 |
| Shells | 14 |
| Rootless A / B | 17 / 17 |
| Open / spread | 19 |
| Drop 2 | 28 |
| Quartal | 17 |
| Upper structures | 19 |
| R&B / Neo-Soul colour | 16 |

Each template stores its quality, voices with octave placement, labels, hands, family, styles, register, difficulty, required/optional/omitted tones, bass requirement, max hand span and explanation. Review status is **`curated-unreviewed`**. The templates follow standard, widely taught keyboard practice and pass automated checks, but no external musician has reviewed them yet. The library doesn't credit any outside source.

### Generation pipeline and constraints

Hard constraints are checked first, and any one of them rejects a voicing:

- keyboard range
- hand span, which is user-selectable (12/13/14/16 semitones)
- at most 5 notes per hand
- no hand crossing
- required tones present
- a slash bass must be the lowest note
- low-interval limits. A low cluster is rejected unless "allow low clusters" is on. Other intervals are rejected when they sit far below the limit, otherwise they get a warning.

Valid voicings are then scored on style fit, register, colour vs. symbol, clusters, difficulty, stretch, warnings, top voice and root doubling against a bassist. Every component is normalised to a 0..1 cost and weighted.

## Tests

`npm test` covers:

- note and MIDI parsing
- intervals and enharmonic spelling
- chord parsing for 55 symbol forms
- slash chords and transposition
- library invariants: ≥120 distinct templates, every template is an exact fit for its own quality, metadata is complete, rootless A/B are classified correctly, and every template realises in all 12 keys without triple accidentals
- template octave placement
- hand-span limits and keyboard range
- rootless bass handling (solo vs band)
- slash-bass placement
- low-interval limits
- the hard-constraint audit of generated voicings

It also includes the requested regressions: Dm9 → F A C E (rootless F3 A3 C4 E4), G13 → B E F A (F3 A3 B3 E4), Cmaj9 → E G B D, F#maj7 → F# A# C# E#, C7b9 → C E G Bb Db.

Phases 2–4 add:

- **voice-leading.test.ts:** semitone movement for textbook ii–V–I voicings; sorted matching = brute-force optimum (200 random cases); split/merge matching; symmetry and transposition invariance; Dm9 → G13 rootless analysis (common tones, 7th → 3rd resolution); bass separation; the optimiser equals brute force over all candidate paths; locking; smoother suggestions; every progression playable in all 12 keys; spelling by function in every key; double-flat root respelling; declared harmonic functions match scale-degree functions; Roman numerals; free-play voicing checks.
- **practice.test.ts:** key signatures around the circle; major scales; diatonic chords, numerals and functions; minor tonics; every question type at every level in every key; spelled answers verified independently (letter = root letter + degree − 1, pitch = root + semitones); interval answers match the displayed notes; keyboard grading accepts solutions and rejects missing or foreign notes; voicing questions need the right bass note; level gating; adaptive levels; weak-key ranking; streaks; history capping and repair.
- **practice-vl.test.ts:** smooth-move exercises valid for every level over many seeds, reproducible, and the library's best answer grades as optimal.
- **workout.test.ts:** plans fill exactly 10/20/30 minutes with all four core skills; time shifts to the weakest skill; weak keys and the rotating key of the day; adaptive levels; weighted key picking; session summaries.

The UI was also checked end to end in headless Chrome (every tab; transition lab; exercise grading; progression keys, approaches, locking and playback; drills in all three timing modes; keyboard shortcuts; circle colouring; transposer; a full timed workout block; summary; history persistence across reloads).

## Known limitations

- Voicing templates and progressions are curated from standard pedagogy but have not been reviewed by an external musician.
- MIDI input ignores the sustain pedal and grades by pitch class, not octave.
- Practice history lives in one browser's LocalStorage; use Export JSON to keep a copy.

## Audio

Tone.js loads on the first Play, after a user gesture. It uses the Salamander Grand Piano samples (Alexander Holm, CC-BY 3.0) hosted by the Tone.js project. Until they load, or if the network blocks them, a soft synth plays instead, so playback always works.
