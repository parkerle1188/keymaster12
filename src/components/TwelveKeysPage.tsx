import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CIRCLE_OF_FIFTHS, FUNCTION_INFO, circleKeyForPc, diatonicChords, keySignatureText, majorScale, tonicFor,
} from '../music-theory/harmony';
import { formatNote, mod12 } from '../music-theory/note-parser';
import { spelledToMidi } from '../music-theory/midi-notes';
import { generateVoicings } from '../voicing-engine/voicing-generator';
import { VOICING_LIBRARY } from '../voicing-engine/voicing-library';
import { FAMILY_LABELS, STYLE_LABELS } from '../voicing-engine/voicing-types';
import { templateInAllKeys, rootOrder, type KeyOrder } from '../voicing-engine/twelve-keys';
import { PROGRESSIONS, realizeProgression } from '../voice-leading/progressions';
import { optimizeProgression } from '../voice-leading/voice-leading';
import { CATEGORY_INFO, keyStats, mergeTally, emptyTally, addToTally, weakKeys, type Category, type SessionRecord, type Tally } from '../practice/progress';
import { makeQuestion, type Question } from '../practice/questions';
import { makeRng, pick } from '../practice/rng';
import { recordPracticeAttempt, recordSession, setCategoryLevel, useProgress } from '../state/progress-store';
import { usePersistentState } from '../state/usePersistentState';
import { playChord, playSequence } from '../audio/piano-audio';
import { CircleOfFifths } from './CircleOfFifths';
import { QuestionView, type AnswerResult } from './QuestionView';

type DrillCat = 'interval' | 'chord-tone' | 'extension' | 'mixed';
type Scope = 'selected' | 'all' | 'weak' | 'circle';
type Mode = 'practice' | 'sprint' | 'clock';
interface DrillSettings { cat: DrillCat; scope: Scope; mode: Mode; level: 'auto' | number }

const DRILL_CATS: { id: DrillCat; label: string }[] = [
  { id: 'interval', label: 'Intervals' }, { id: 'chord-tone', label: 'Chord tones' }, { id: 'extension', label: 'Extensions' }, { id: 'mixed', label: 'Mixed' },
];
const SCOPES: { id: Scope; label: string; text: string }[] = [
  { id: 'selected', label: 'Selected key', text: 'Every question in the key chosen on the circle.' },
  { id: 'circle', label: 'Walk the circle', text: 'Three questions per key, moving clockwise through all 12.' },
  { id: 'all', label: 'All 12 keys', text: 'Random keys.' },
  { id: 'weak', label: 'Weakest keys', text: 'Your 4 weakest keys by accuracy and speed.' },
];
const MODES: { id: Mode; label: string; text: string }[] = [
  { id: 'practice', label: 'Practice', text: 'Untimed; study each answer.' },
  { id: 'sprint', label: '60-s sprint', text: 'As many as you can in a minute.' },
  { id: 'clock', label: 'Beat the clock', text: 'A time limit per question (shorter at higher levels).' },
];
const SPRINT_MS = 60000;
const clockLimit = (level: number) => 11000 - level * 1000;

function KeyPanel({ pc }: { pc: number }) {
  const k = circleKeyForPc(pc);
  const tonic = tonicFor(pc);
  const scale = majorScale(tonic);
  const chords = diatonicChords(tonic, true);
  const prev = CIRCLE_OF_FIFTHS[(k.index + 11) % 12], next = CIRCLE_OF_FIFTHS[(k.index + 1) % 12];
  const playScale = () => {
    const base = spelledToMidi(tonic, 4) > 66 ? spelledToMidi(tonic, 3) : spelledToMidi(tonic, 4);
    const steps = [0, 2, 4, 5, 7, 9, 11, 12];
    playSequence(steps.map((s) => [base + s]), { secondsPerChord: 0.32 });
  };
  const playChordSym = (sym: string) => {
    const v = generateVoicings(sym, { style: 'ballad', mode: 'solo', limit: 1 })[0];
    if (v) void playChord(v.notes.map((n) => n.midi));
  };
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold text-white">{k.name} major <span className="text-base font-normal text-neutral-400">/ {formatNote(k.relativeMinor)} minor</span></h2>
          <div className="text-sm text-neutral-400">{keySignatureText(tonic)}{k.altName ? ` · enharmonic ${k.altName} major` : ''} · neighbours on the circle: {prev.name} and {next.name} (one accidental different)</div>
        </div>
        <button className="btn" onClick={playScale}>▶ Scale</button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {scale.map((n, i) => (
          <div key={i} className="min-w-[44px] rounded-lg border border-ink-600 bg-ink-850 px-2 py-1 text-center">
            <div className="text-lg font-bold text-white">{formatNote(n)}</div><div className="text-[10px] text-neutral-500">{i + 1}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 label">Diatonic seventh chords (click to hear)</div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 xl:grid-cols-7">
        {chords.map((c) => (
          <button key={c.degree} className="rounded-lg border border-ink-600 bg-ink-850 px-2 py-1.5 text-left transition hover:border-accent" onClick={() => playChordSym(c.symbol)}>
            <div className="flex items-center justify-between"><span className="text-xs text-neutral-400">{c.numeral}</span>
              <span className="rounded px-1 text-[10px] font-semibold text-black" style={{ background: FUNCTION_INFO[c.function].color }}>{FUNCTION_INFO[c.function].short}</span></div>
            <div className="font-mono font-bold text-white">{c.symbol}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Transposer({ pc, onOpenProgression }: { pc: number; onOpenProgression: (progId: string, keyPc: number) => void }) {
  const [what, setWhat] = usePersistentState<'progression' | 'voicing'>('tk-transpose-what', 'progression');
  const [progId, setProgId] = usePersistentState('tk-transpose-prog', 'ii-V-I');
  const [tplId, setTplId] = usePersistentState('tk-transpose-tpl', 'rl-a-m9');
  const [order, setOrder] = usePersistentState<KeyOrder>('tk-transpose-order', 'fifths');
  const prog = PROGRESSIONS.find((p) => p.id === progId) ?? PROGRESSIONS[0];
  const tpl = VOICING_LIBRARY.find((t) => t.id === tplId) ?? VOICING_LIBRARY[0];

  const rows = useMemo(() => {
    const roots = rootOrder(order);
    if (what === 'progression') {
      return roots.map((k) => {
        const steps = realizeProgression(prog, tonicFor(k, prog.mode));
        const r = optimizeProgression(steps.map((s) => s.symbol), { style: prog.style, mode: 'solo', candidatesPerChord: 16 });
        return { pc: k, title: `${formatNote(tonicFor(k, prog.mode))} ${prog.mode}`, symbols: steps.map((s) => s.symbol).join(' – '), notes: r.voicings.map((v) => v.notes.map((n) => n.name).join(' ')).join('  |  '), midis: r.voicings.map((v) => v.notes.map((n) => n.midi)), extra: `${r.upperMovement} st` };
      });
    }
    const keys = templateInAllKeys(tpl, { mode: tpl.bassRequirement === 'bassist-required' ? 'band' : 'solo', maxHandSpan: 16, style: tpl.styles[0] }, order);
    return keys.map((k) => ({ pc: k.rootPc, title: k.symbol, symbols: k.symbol, notes: k.voicing ? k.voicing.notes.map((n) => n.name).join(' ') : k.reason ?? '', midis: k.voicing ? [k.voicing.notes.map((n) => n.midi)] : [], extra: '' }));
  }, [what, prog, tpl, order]);

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-white">Transpose through all 12 keys</h2>
        <div className="seg w-56" role="group" aria-label="What to transpose">
          <button aria-pressed={what === 'progression'} onClick={() => setWhat('progression')}>Progression</button>
          <button aria-pressed={what === 'voicing'} onClick={() => setWhat('voicing')}>Voicing shape</button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {what === 'progression' ? (
          <select className="select w-auto" value={prog.id} onChange={(e) => setProgId(e.target.value)} aria-label="Progression">
            {PROGRESSIONS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        ) : (
          <select className="select w-auto max-w-sm" value={tpl.id} onChange={(e) => setTplId(e.target.value)} aria-label="Voicing template">
            {Object.entries(FAMILY_LABELS).map(([f, label]) => (
              <optgroup key={f} label={label}>{VOICING_LIBRARY.filter((t) => t.family === f).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>
            ))}
          </select>
        )}
        <div className="seg w-72" role="group" aria-label="Key order">
          {(['fifths', 'fourths', 'chromatic'] as KeyOrder[]).map((o) => <button key={o} aria-pressed={order === o} onClick={() => setOrder(o)}>{o === 'fifths' ? 'Circle of 5ths' : o === 'fourths' ? 'Cycle of 4ths' : 'Chromatic'}</button>)}
        </div>
        {what === 'progression' && <span className="self-center text-xs text-neutral-500">{STYLE_LABELS[prog.style]} · optimised voice leading · solo piano</span>}
      </div>
      <div className="mt-3 space-y-1">
        {rows.map((r) => (
          <div key={r.pc} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${r.pc === pc ? 'border-accent bg-accent/10' : 'border-ink-700 bg-ink-850'}`}>
            <div className="w-24 shrink-0 text-sm font-semibold text-neutral-100">{r.title}</div>
            <div className="min-w-0 flex-1">
              {what === 'progression' && <div className="truncate font-mono text-sm text-white">{r.symbols}</div>}
              <div className="truncate font-mono text-[11px] text-neutral-400" title={r.notes}>{r.notes}</div>
            </div>
            {r.extra && <span className="shrink-0 font-mono text-[11px] text-neutral-500" title="Upper-voice movement">{r.extra}</span>}
            {r.midis.length > 0 && <button className="btn shrink-0 px-2 py-0.5 text-xs" onClick={() => (r.midis.length > 1 ? playSequence(r.midis, { secondsPerChord: 1.2 }) : playChord(r.midis[0]))} aria-label={`Play ${r.title}`}>▶</button>}
            {what === 'progression' && <button className="btn shrink-0 px-2 py-0.5 text-xs" onClick={() => onOpenProgression(prog.id, r.pc)}>Open</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

interface DrillStats { n: number; correct: number; streak: number; best: number; ms: number; byKey: Record<number, Tally>; byCategory: Partial<Record<Category, Tally>> }
const emptyStats = (): DrillStats => ({ n: 0, correct: 0, streak: 0, best: 0, ms: 0, byKey: {}, byCategory: {} });

function Drill({ selectedPc }: { selectedPc: number }) {
  const progress = useProgress();
  const [s, setS] = usePersistentState<DrillSettings>('tk-drill', { cat: 'interval', scope: 'selected', mode: 'practice', level: 'auto' });
  const set = <K extends keyof DrillSettings>(k: K, v: DrillSettings[K]) => setS((p) => ({ ...p, [k]: v }));
  const [phase, setPhase] = useState<'setup' | 'running' | 'done'>('setup');
  const [q, setQ] = useState<Question | null>(null);
  const [stats, setStats] = useState<DrillStats>(emptyStats());
  const [note, setNote] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const rng = useRef(makeRng());
  const startedAt = useRef(0);
  const count = useRef(0);

  const catFor = (): Category => (s.cat === 'mixed' ? pick(rng.current, ['interval', 'chord-tone', 'extension'] as Category[]) : s.cat);
  const levelFor = (c: Category) => (s.level === 'auto' ? progress.levels[c].level : s.level);
  const keyFor = (): number => {
    switch (s.scope) {
      case 'selected': return selectedPc;
      case 'all': return Math.floor(rng.current() * 12);
      case 'weak': return pick(rng.current, weakKeys(progress, 4));
      case 'circle': return CIRCLE_OF_FIFTHS[(circleKeyForPc(selectedPc).index + Math.floor(count.current / 3)) % 12].pc;
    }
  };
  const nextQuestion = () => {
    const c = catFor();
    setQ(makeQuestion(c, rng.current, levelFor(c), keyFor()));
    count.current++;
  };
  const start = () => {
    setStats(emptyStats()); setNote(null); count.current = 0; startedAt.current = Date.now();
    setPhase('running'); nextQuestion();
  };
  const finish = (st = stats) => {
    setPhase('done');
    if (st.n > 0) {
      const tally: Tally = { n: st.n, correct: st.correct, ms: st.ms, rel: Object.values(st.byCategory).reduce((a, t) => a + (t?.rel ?? 0), 0) };
      const rec: SessionRecord = {
        id: `drill-${Date.now()}`, date: new Date().toISOString(), kind: 'drill',
        title: `${DRILL_CATS.find((c) => c.id === s.cat)!.label} · ${SCOPES.find((x) => x.id === s.scope)!.label} · ${MODES.find((m) => m.id === s.mode)!.label}`,
        seconds: Math.round((Date.now() - startedAt.current) / 1000), tally, byCategory: st.byCategory, byKey: st.byKey,
      };
      recordSession(rec);
    }
  };

  // sprint clock
  useEffect(() => {
    if (phase !== 'running' || s.mode !== 'sprint') return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [phase, s.mode]);
  const sprintLeft = Math.max(0, SPRINT_MS - (now - startedAt.current));
  useEffect(() => { if (phase === 'running' && s.mode === 'sprint' && sprintLeft === 0) finish(); }, [sprintLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  const onAnswered = (r: AnswerResult) => {
    if (!q) return;
    const change = recordPracticeAttempt({ category: q.category, keyPc: q.keyPc, correct: r.correct, ms: r.ms }, s.level === 'auto');
    if (change) setNote(change > 0 ? `Level up! ${CATEGORY_INFO[q.category].label} is now level ${q.level + 1}.` : `${CATEGORY_INFO[q.category].label} eased to level ${q.level - 1}.`);
    setStats((st) => {
      const streakNow = r.correct ? st.streak + 1 : 0;
      const a = { category: q.category, correct: r.correct, ms: r.ms };
      return {
        n: st.n + 1, correct: st.correct + (r.correct ? 1 : 0), streak: streakNow, best: Math.max(st.best, streakNow), ms: st.ms + r.ms,
        byKey: { ...st.byKey, [q.keyPc]: addToTally(st.byKey[q.keyPc], a) },
        byCategory: { ...st.byCategory, [q.category]: addToTally(st.byCategory[q.category], a) },
      };
    });
  };

  const acc = stats.n ? Math.round((100 * stats.correct) / stats.n) : 0;
  const avg = stats.n ? (stats.ms / stats.n / 1000).toFixed(1) : '–';
  const catForDisplay: Category = s.cat === 'mixed' ? 'interval' : s.cat;

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-white">Recognition drills</h2>
        {phase === 'running' && (
          <div className="flex items-center gap-4 text-sm">
            {s.mode === 'sprint' && <span className="font-mono text-lg font-bold text-accent">{Math.ceil(sprintLeft / 1000)}s</span>}
            <span><b className="text-white">{stats.correct}</b>/{stats.n}</span>
            <span title="Current streak">🔥 {stats.streak}</span>
            <span className="text-neutral-400">avg {avg}s</span>
            <button className="btn py-1 text-xs" onClick={() => finish()}>End</button>
          </div>
        )}
      </div>

      {phase === 'setup' && (
        <div className="mt-3 space-y-3">
          <div><div className="label">Drill</div><div className="seg" role="group" aria-label="Drill type">{DRILL_CATS.map((c) => <button key={c.id} aria-pressed={s.cat === c.id} onClick={() => set('cat', c.id)}>{c.label}</button>)}</div>
            <p className="mt-1 text-[11px] text-neutral-500">{s.cat === 'mixed' ? 'Intervals, chord tones and extensions, shuffled.' : CATEGORY_INFO[s.cat].text}</p></div>
          <div><div className="label">Keys</div><div className="seg" role="group" aria-label="Key scope">{SCOPES.map((x) => <button key={x.id} aria-pressed={s.scope === x.id} onClick={() => set('scope', x.id)}>{x.label}</button>)}</div>
            <p className="mt-1 text-[11px] text-neutral-500">{SCOPES.find((x) => x.id === s.scope)!.text}{s.scope === 'weak' ? ` Currently: ${weakKeys(progress, 4).map((pc) => formatNote(tonicFor(pc))).join(', ')}.` : s.scope === 'selected' || s.scope === 'circle' ? ` Starting key: ${formatNote(tonicFor(selectedPc))}.` : ''}</p></div>
          <div><div className="label">Timing</div><div className="seg" role="group" aria-label="Timing">{MODES.map((m) => <button key={m.id} aria-pressed={s.mode === m.id} onClick={() => set('mode', m.id)}>{m.label}</button>)}</div>
            <p className="mt-1 text-[11px] text-neutral-500">{MODES.find((m) => m.id === s.mode)!.text}</p></div>
          <div>
            <div className="label">Difficulty</div>
            <div className="flex flex-wrap gap-1">
              <button className={`chip ${s.level === 'auto' ? 'chip-on' : ''}`} onClick={() => set('level', 'auto')}>Adaptive (now level {progress.levels[catForDisplay].level})</button>
              {[1, 2, 3, 4, 5].map((l) => <button key={l} className={`chip ${s.level === l ? 'chip-on' : ''}`} onClick={() => set('level', l)}>Level {l}</button>)}
            </div>
            <p className="mt-1 text-[11px] text-neutral-500">Adaptive moves up after 8 of 10 correct at target speed and down below 50 %. {s.level === 'auto' && s.cat !== 'mixed' && progress.levels[s.cat].level > 1 && <button className="underline" onClick={() => setCategoryLevel(s.cat as Category, 1)}>Reset to level 1</button>}</p>
          </div>
          <button className="btn btn-accent px-6 py-2 text-base" onClick={start}>Start drill</button>
        </div>
      )}

      {phase === 'running' && q && (
        <div className="mt-3">
          {note && <div className="mb-2 rounded-lg border border-accent/50 bg-accent/10 px-3 py-1.5 text-sm text-accent" role="status">{note}</div>}
          <div className="mb-2 text-xs text-neutral-500">Key: <b className="text-neutral-300">{formatNote(tonicFor(q.keyPc))} major</b></div>
          <QuestionView q={q} onAnswered={onAnswered} onNext={nextQuestion}
            autoAdvanceMs={s.mode === 'practice' ? undefined : 650}
            autoAdvanceWrongMs={s.mode === 'practice' ? undefined : 2200}
            timeLimitMs={s.mode === 'clock' ? clockLimit(q.level) : undefined} />
        </div>
      )}

      {phase === 'done' && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-6">
            <Big label="Score" value={`${stats.correct}/${stats.n}`} />
            <Big label="Accuracy" value={`${acc} %`} />
            <Big label="Avg time" value={`${avg} s`} />
            <Big label="Best streak" value={String(stats.best)} />
          </div>
          {Object.keys(stats.byKey).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(stats.byKey).map(([pc, t]) => (
                <span key={pc} className="rounded border border-ink-600 px-2 py-0.5 text-xs">{formatNote(tonicFor(Number(pc)))}: {t.correct}/{t.n}</span>
              ))}
            </div>
          )}
          <p className="text-xs text-neutral-500">{stats.n ? 'Saved to your practice history.' : 'No answers — nothing saved.'}</p>
          <div className="flex gap-2"><button className="btn btn-accent" onClick={start}>Go again</button><button className="btn" onClick={() => setPhase('setup')}>Change settings</button></div>
        </div>
      )}
    </div>
  );
}

function Big({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div><div className="text-2xl font-bold text-accent">{value}</div></div>;
}

export function TwelveKeysPage({ onOpenProgression }: { onOpenProgression: (progId: string, keyPc: number) => void }) {
  const progress = useProgress();
  const [pc, setPc] = usePersistentState('tk-key', 0);
  const [statCat, setStatCat] = useState<Category | 'all'>('all');
  const stats = useMemo(() => keyStats(progress, statCat === 'all' ? undefined : statCat), [progress, statCat]);
  const total = useMemo(() => Object.values(progress.byKey).reduce(mergeTally, emptyTally()), [progress]);
  const sel = stats[mod12(pc)];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="card p-4">
          <CircleOfFifths selected={pc} onSelect={setPc} stats={stats} />
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-neutral-500">
            <span>Outer ring coloured by accuracy (grey = not practised).</span>
            <select className="select w-auto py-0.5 text-[11px]" value={statCat} onChange={(e) => setStatCat(e.target.value as Category | 'all')} aria-label="Accuracy for">
              <option value="all">All categories</option>
              {(Object.keys(CATEGORY_INFO) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_INFO[c].label}</option>)}
            </select>
          </div>
          <div className="mt-2 rounded-lg bg-ink-850 px-3 py-2 text-xs text-neutral-300">
            {formatNote(tonicFor(pc))}: {sel.n ? `${sel.n} answers · ${Math.round((sel.accuracy ?? 0) * 100)} % correct · ${((sel.avgMs ?? 0) / 1000).toFixed(1)} s average` : 'not practised yet'}
            <span className="text-neutral-500"> · all keys: {total.n} answers</span>
          </div>
        </div>
        <KeyPanel pc={pc} />
      </div>
      <Drill selectedPc={pc} />
      <Transposer pc={pc} onOpenProgression={onOpenProgression} />
    </div>
  );
}
