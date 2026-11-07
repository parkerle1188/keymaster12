import { useEffect, useMemo, useRef, useState } from 'react';
import { tryParseChord } from '../music-theory/chord-parser';
import { midiToName } from '../music-theory/midi-notes';
import { keyName } from '../music-theory/harmony';
import {
  analyzeTransition, candidateVoicings, suggestSmoother, VOICING_APPROACHES, type VoiceLeadingOptions,
} from '../voice-leading/voice-leading';
import { STYLE_PROFILES } from '../voice-leading/style-profiles';
import { STYLE_LABELS, STYLES, type GeneratedVoicing, type Style } from '../voicing-engine/voicing-types';
import { playChord, playSequence } from '../audio/piano-audio';
import { usePersistentState } from '../state/usePersistentState';
import { recordPracticeAttempt, useProgress } from '../state/progress-store';
import { makeSmoothMoveExercise, gradeSmoothMove, VL_LEVELS, type SmoothMoveExercise, type SmoothMoveGrade } from '../practice/vl-exercise';
import { makeRng } from '../practice/rng';
import { PianoKeyboard, windowFor } from './PianoKeyboard';
import { NoteEntry } from './NoteEntry';
import { VoiceLeadingGraph, TransitionDetails, RatingBadge } from './VoiceLeadingGraph';
import { Legend } from './Legend';

const PRESETS: [string, string][] = [['Dm7', 'G7'], ['G7', 'Cmaj7'], ['Dm9', 'G13'], ['G13', 'Cmaj9'], ['C', 'G'], ['Am', 'F'], ['Fmaj7', 'Fm6'], ['Db7', 'Cmaj7'], ['Dm7b5', 'G7b9'], ['Cm9', 'F13']];

const hl = (v: GeneratedVoicing) => v.notes.map((n) => ({ midi: n.midi, role: n.role, hand: n.hand, label: n.label, name: n.name }));
const noteStr = (v: GeneratedVoicing) => v.notes.map((n) => n.name).join(' ');

interface LabSettings { a: string; b: string; style: Style; mode: 'solo' | 'band'; approach: string }

function TransitionLab() {
  const [s, setS] = usePersistentState<LabSettings>('vl-lab', { a: 'Dm7', b: 'G7', style: 'jazz', mode: 'solo', approach: 'smoothest' });
  const [inA, setInA] = useState(s.a);
  const [inB, setInB] = useState(s.b);
  const [aId, setAId] = useState<string | null>(null);
  const [bId, setBId] = useState<string | null>(null);
  const set = <K extends keyof LabSettings>(k: K, v: LabSettings[K]) => setS((p) => ({ ...p, [k]: v }));

  const pa = useMemo(() => tryParseChord(s.a), [s.a]);
  const pb = useMemo(() => tryParseChord(s.b), [s.b]);
  const opts: VoiceLeadingOptions = useMemo(() => ({ style: s.style, mode: s.mode, families: VOICING_APPROACHES.find((x) => x.id === s.approach)?.families, candidatesPerChord: 30 }), [s.style, s.mode, s.approach]);
  const candA = useMemo(() => (pa.chord ? candidateVoicings(pa.chord, opts) : []), [pa.chord, opts]);
  const candB = useMemo(() => (pb.chord ? candidateVoicings(pb.chord, opts) : []), [pb.chord, opts]);
  useEffect(() => { setAId(null); setBId(null); }, [candA, candB]);

  const A = candA.find((v) => v.id === aId) ?? candA[0];
  const smoothestB = useMemo(() => (A && pb.chord ? suggestSmoother(A, pb.chord, undefined, opts, 1)[0]?.voicing : undefined), [A, pb.chord, opts]);
  const B = candB.find((v) => v.id === bId) ?? smoothestB ?? candB[0];
  const t = useMemo(() => (A && B ? analyzeTransition(A, B) : null), [A, B]);
  const better = useMemo(() => (A && B && pb.chord ? suggestSmoother(A, pb.chord, B, opts, 4) : []), [A, B, pb.chord, opts]);
  const worst = useMemo(() => (A ? Math.max(...candB.map((v) => analyzeTransition(A, v).upperMovement)) : 0), [A, candB]);

  const [lo, hi] = windowFor([...(A?.notes ?? []), ...(B?.notes ?? [])].map((n) => n.midi), 3);
  const submit = () => { set('a', inA.trim()); set('b', inB.trim()); };

  return (
    <section className="card p-4">
      <h2 className="text-lg font-semibold text-white">Transition lab</h2>
      <p className="mt-0.5 text-sm text-neutral-400">Pick two chords and a voicing for each. See every note's movement, the total semitones, and smoother alternatives.</p>
      <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div><label className="label" htmlFor="vl-a">From</label><input id="vl-a" className="input w-28 font-mono" value={inA} onChange={(e) => setInA(e.target.value)} /></div>
        <span className="pb-2 text-neutral-500">→</span>
        <div><label className="label" htmlFor="vl-b">To</label><input id="vl-b" className="input w-28 font-mono" value={inB} onChange={(e) => setInB(e.target.value)} /></div>
        <button className="btn btn-accent" type="submit">Analyse</button>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map(([a, b]) => (
            <button type="button" key={a + b} className={`chip font-mono ${s.a === a && s.b === b ? 'chip-on' : ''}`} onClick={() => { setInA(a); setInB(b); setS((p) => ({ ...p, a, b })); }}>{a}→{b}</button>
          ))}
        </div>
      </form>
      {(pa.error || pb.error) && <p className="mt-2 text-xs text-rose-400" role="alert">{pa.error ?? pb.error}</p>}
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div><div className="label">Style</div><div className="seg" role="group" aria-label="Style">{STYLES.map((st) => <button key={st} aria-pressed={s.style === st} onClick={() => set('style', st)}>{STYLE_LABELS[st]}</button>)}</div></div>
        <div><div className="label">Setting</div><div className="seg" role="group" aria-label="Setting">
          <button aria-pressed={s.mode === 'solo'} onClick={() => set('mode', 'solo')}>Solo piano</button>
          <button aria-pressed={s.mode === 'band'} onClick={() => set('mode', 'band')}>With bassist</button>
        </div></div>
        <div><label className="label" htmlFor="vl-approach">Voicing approach</label>
          <select id="vl-approach" className="select" value={s.approach} onChange={(e) => set('approach', e.target.value)}>
            {VOICING_APPROACHES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>
      </div>

      {pa.chord && pb.chord && (!A || !B) && (
        <p className="mt-3 text-sm text-amber-300">No voicing for {!A ? pa.chord.symbol : pb.chord.symbol} with this approach and setting. Try “Smoothest (any family)” or the other setting.</p>
      )}
      {A && B && t && (
        <>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {[{ v: A, list: candA, id: aId, setId: setAId, tag: 'From' }, { v: B, list: candB, id: bId, setId: setBId, tag: 'To' }].map(({ v, list, setId, tag }, i) => (
              <div key={tag}>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-xs text-neutral-500">{tag}</span>
                  <span className="font-semibold text-white">{v.chord.symbol}</span>
                  <select className="select min-w-0 flex-1 py-1 text-xs" value={v.id} onChange={(e) => setId(e.target.value)} aria-label={`${tag} voicing`}>
                    {list.map((c) => <option key={c.id} value={c.id}>{c.template.name} · {noteStr(c)}{i === 1 ? ` · ${analyzeTransition(A, c).upperMovement} st` : ''}</option>)}
                  </select>
                  <button className="btn px-2 py-1 text-xs" onClick={() => playChord(v.notes.map((n) => n.midi))} aria-label={`Play ${v.chord.symbol}`}>▶</button>
                </div>
                <PianoKeyboard low={lo} high={hi} highlights={hl(v)} ghosts={i === 1 ? A.notes.map((n) => n.midi) : undefined} minWhiteWidth={14} ariaLabel={`${v.chord.symbol} voicing`} />
              </div>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-neutral-500">Dashed rings on the “To” keyboard mark where the “From” notes were.</p>

          <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
            <div>
              <VoiceLeadingGraph voicings={[A, B]} transitions={[t]} />
              <button className="btn btn-accent mt-2 w-full" onClick={() => playSequence([A.notes.map((n) => n.midi), B.notes.map((n) => n.midi)], { secondsPerChord: 1.4 })}>▶ Play {A.chord.symbol} → {B.chord.symbol}</button>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                <Stat label="Upper-voice movement" value={`${t.upperMovement} st`} />
                {t.bassMovement > 0 && <Stat label="Bass" value={`${t.bassMovement} st`} />}
                <Stat label="Common tones" value={String(t.commonTones)} />
                <Stat label="Largest move" value={`${t.maxLeap} st`} />
                <RatingBadge rating={t.rating} />
              </div>
              <TransitionDetails t={t} />
              <div>
                <div className="label">Smoother voicings of {B.chord.symbol}</div>
                {better.length === 0 ? (
                  <p className="text-xs text-emerald-300">This is the smoothest {B.chord.symbol} available with these settings{worst > t.upperMovement ? ` (the jumpiest moves ${worst} st)` : ''}.</p>
                ) : (
                  <ul className="space-y-1">
                    {better.map((sg) => (
                      <li key={sg.voicing.id} className="flex items-center justify-between gap-2 rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-1.5 text-xs">
                        <div className="min-w-0"><span className="font-semibold text-neutral-100">{sg.voicing.template.name}</span> <span className="font-mono text-neutral-400">{noteStr(sg.voicing)}</span></div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-emerald-300">{sg.movement} st (−{sg.saving})</span>
                          <button className="btn px-2 py-0.5 text-xs" onClick={() => setBId(sg.voicing.id)}>Use</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div><div className="text-lg font-bold text-accent">{value}</div></div>;
}

function SmoothMoveTrainer() {
  const progress = useProgress();
  const [level, setLevel] = usePersistentState('vl-ex-level', 1);
  const rng = useRef(makeRng());
  const [ex, setEx] = useState<SmoothMoveExercise | null>(null);
  const [played, setPlayed] = useState<number[]>([]);
  const [grade, setGrade] = useState<SmoothMoveGrade | null>(null);
  const [score, setScore] = useState({ n: 0, correct: 0, perfect: 0 });
  const started = useRef(Date.now());

  const next = (lv = level) => {
    setEx(makeSmoothMoveExercise(rng.current, lv));
    setPlayed([]); setGrade(null); started.current = Date.now();
  };
  useEffect(() => { next(level); }, [level]); // eslint-disable-line react-hooks/exhaustive-deps

  const check = () => {
    if (!ex) return;
    const g = gradeSmoothMove(ex, played);
    if (played.length >= 3) {
      recordPracticeAttempt({ category: 'voice-leading', keyPc: ex.keyPc, correct: g.correct, ms: Date.now() - started.current }, false);
      setScore((s) => ({ n: s.n + 1, correct: s.correct + (g.correct ? 1 : 0), perfect: s.perfect + (g.perfect ? 1 : 0) }));
    }
    setGrade(g);
    void playChord(played);
  };

  if (!ex) return null;
  const all = [...ex.fromUpper, ...ex.best.notes.map((n) => n.midi)];
  const lo = Math.max(36, Math.floor((Math.min(...all) - 5) / 12) * 12);
  const hi = Math.min(96, lo + 35);
  const tally = progress.byCategory['voice-leading'];

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Smooth-move exercise</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-neutral-400">The first chord is shown. Voice the next chord on the keyboard with as little movement as possible: keep common tones, move the rest by step. The root may be left out of seventh chords.</p>
        </div>
        <div className="text-right text-xs text-neutral-400">
          <div>This session: <b className="text-white">{score.correct}/{score.n}</b> correct · {score.perfect} optimal</div>
          <div>All time: {tally.n ? `${Math.round((100 * tally.correct) / tally.n)} % of ${tally.n}` : '—'}</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1" role="group" aria-label="Exercise level">
        {VL_LEVELS.map((l) => <button key={l.level} className={`chip ${level === l.level ? 'chip-on' : ''}`} aria-pressed={level === l.level} onClick={() => setLevel(l.level)}>L{l.level} · {l.name}</button>)}
      </div>

      <div className="mt-4 rounded-lg border border-ink-700 bg-ink-850 p-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-xs text-neutral-500">{ex.progression.name} in {keyName(ex.keyPc, ex.progression.mode)}</span>
          <span className="text-lg font-bold text-white">{ex.from.chord.symbol} <span className="text-xs font-normal text-neutral-500">{ex.fromNumeral}</span></span>
          <span className="text-neutral-500">→</span>
          <span className="text-lg font-bold text-accent">{ex.toChord.symbol} <span className="text-xs font-normal text-neutral-500">{ex.toNumeral}</span></span>
          <button className="btn ml-auto px-2 py-1 text-xs" onClick={() => playChord(ex.fromUpper)}>▶ Hear {ex.from.chord.symbol}</button>
        </div>
        <div className="mt-1 text-xs text-neutral-400">From: <span className="font-mono text-neutral-200">{noteStr(ex.from)}</span> <span className="text-neutral-500">({ex.from.template.name})</span> · {ex.toChord.symbol} = <span className="font-mono">{ex.toChord.notes.join(' ')}</span></div>
      </div>

      <div className="mt-3">
        <NoteEntry value={played} onChange={setPlayed} low={lo} high={hi} ghosts={ex.fromUpper} disabled={!!grade}
          reveal={grade ? ex.best.notes.map((n) => ({ midi: n.midi, role: n.role, label: n.label, name: n.name })) : undefined}
          onSubmit={check} />
        {!grade && <p className="mt-1 text-[11px] text-neutral-500">Rings show the notes of {ex.from.chord.symbol}.</p>}
      </div>

      {grade && (
        <div className="mt-3 space-y-3">
          <div className={`rounded-lg border p-3 text-sm ${grade.perfect ? 'border-emerald-700 bg-emerald-950/40 text-emerald-200' : grade.correct ? 'border-lime-800 bg-lime-950/30 text-lime-200' : 'border-rose-800 bg-rose-950/30 text-rose-200'}`} role="status">
            <b>{grade.perfect ? '✓ Optimal' : grade.correct ? '✓ Correct' : '✗ Not yet'}</b> — {grade.message}
            <div className="mt-1 text-xs opacity-80">You played: <span className="font-mono">{played.map((m) => midiToName(m)).join(' ')}</span> · Keyboard now shows the smoothest library voicing: <span className="font-mono">{noteStr(ex.best)}</span> ({ex.best.template.name}, {ex.bestMovement} st).</div>
          </div>
          <VoiceLeadingGraph voicings={[ex.from, ex.best]} transitions={[analyzeTransition(ex.from, ex.best)]} />
          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={() => playSequence([ex.fromUpper, played], { secondsPerChord: 1.3 })}>▶ Your move</button>
            <button className="btn" onClick={() => playSequence([ex.fromUpper, ex.best.notes.map((n) => n.midi)], { secondsPerChord: 1.3 })}>▶ Smoothest move</button>
            <button className="btn btn-accent ml-auto" onClick={() => next()}>Next exercise →</button>
          </div>
        </div>
      )}
    </section>
  );
}

export function VoiceLeadingPage() {
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h1 className="text-xl font-bold text-white">Voice leading</h1>
        <p className="mt-1 max-w-3xl text-sm text-neutral-400">
          Good voice leading moves each note of a chord to the nearest note of the next one. KEYMASTER 12 pairs the voices with a minimum-cost matching,
          counts the semitones the upper voices travel (the bass follows the roots and is reported separately), and names the guide-tone motion: in a ii–V–I the 3rd of each chord becomes the 7th of the next, and the 7th falls by step to the next 3rd.
        </p>
        <div className="mt-3 grid gap-2 text-xs text-neutral-400 sm:grid-cols-2 lg:grid-cols-5">
          {STYLES.map((st) => <div key={st} className="rounded-lg bg-ink-850 p-2"><b className="text-neutral-200">{STYLE_LABELS[st]}:</b> {STYLE_PROFILES[st].voiceLeading.text}</div>)}
        </div>
        <div className="mt-3"><Legend compact /></div>
      </div>
      <TransitionLab />
      <SmoothMoveTrainer />
    </div>
  );
}
