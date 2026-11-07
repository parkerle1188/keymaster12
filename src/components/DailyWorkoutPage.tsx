import { useEffect, useMemo, useRef, useState } from 'react';
import { tonicFor } from '../music-theory/harmony';
import { formatNote } from '../music-theory/note-parser';
import {
  CATEGORIES, CATEGORY_INFO, accuracyOf, avgSecondsOf, dayKey, keyStats, streak, weakKeys, type Attempt, type Category, type SessionRecord,
} from '../practice/progress';
import { buildWorkout, pickBlockKey, summarizeAttempts, WORKOUT_LENGTHS, type WorkoutLength, type WorkoutPlan } from '../practice/workout';
import { makeQuestion, type Question } from '../practice/questions';
import { makeRng } from '../practice/rng';
import { getProgress, recordPracticeAttempt, recordSession, resetProgress, useProgress } from '../state/progress-store';
import { usePersistentState } from '../state/usePersistentState';
import { QuestionView, type AnswerResult } from './QuestionView';
import { accuracyColor } from './CircleOfFifths';

const keyName = (pc: number) => formatNote(tonicFor(pc));
const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)} %`);
const mmss = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

interface Running {
  plan: WorkoutPlan;
  blockIdx: number;
  /** Seconds (fractional) spent in the current block, excluding pauses and hidden time. */
  blockElapsed: number;
  totalElapsed: number;
  paused: boolean;
  attempts: Attempt[];
  levelUps: string[];
}

export function DailyWorkoutPage() {
  const progress = useProgress();
  const [minutes, setMinutes] = usePersistentState<WorkoutLength>('workout-length', 20);
  const plan = useMemo(() => buildWorkout(minutes, progress), [minutes, progress]);
  const [run, setRun] = useState<Running | null>(null);
  const [done, setDone] = useState<{ record: SessionRecord; levelUps: string[]; prevAcc: number | null } | null>(null);
  const [q, setQ] = useState<Question | null>(null);
  const [answered, setAnswered] = useState(false);
  const rng = useRef(makeRng());
  // Timers (auto-advance, block end) call back into this component; always act on the latest state.
  const runRef = useRef(run);
  runRef.current = run;

  const block = run ? run.plan.blocks[run.blockIdx] : null;

  const newQuestion = (r: Running) => {
    const b = r.plan.blocks[r.blockIdx];
    const data = getProgress();
    setQ(makeQuestion(b.category, rng.current, data.levels[b.category].level, pickBlockKey(rng.current, b, data)));
    setAnswered(false);
  };

  const start = () => {
    const r: Running = { plan, blockIdx: 0, blockElapsed: 0, totalElapsed: 0, paused: false, attempts: [], levelUps: [] };
    setRun(r); setDone(null); newQuestion(r);
  };

  // Clock: measures real time between ticks, so throttled timers cannot make it drift. Time only counts
  // while the page is visible and not paused; gaps over 5 s (device asleep, tab away) are not counted.
  useEffect(() => {
    if (!run || run.paused) return;
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      if (document.hidden || dt > 5) return;
      setRun((r) => (r && !r.paused ? { ...r, blockElapsed: r.blockElapsed + dt, totalElapsed: r.totalElapsed + dt } : r));
    }, 250);
    return () => clearInterval(id);
  }, [run?.paused, !!run]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = (r: Running) => {
    const s = summarizeAttempts(r.attempts);
    const prev = getProgress().sessions.find((x) => x.kind === 'workout');
    const record: SessionRecord = {
      id: `workout-${Date.now()}`, date: new Date().toISOString(), kind: 'workout', title: `${r.plan.minutes}-minute workout`,
      plannedMinutes: r.plan.minutes, seconds: Math.round(r.totalElapsed), tally: s.tally, byCategory: s.byCategory, byKey: s.byKey,
    };
    if (s.tally.n > 0) recordSession(record);
    setDone({ record, levelUps: r.levelUps, prevAcc: prev ? accuracyOf(prev.tally) : null });
    setRun(null); setQ(null);
  };

  const nextBlock = (r: Running) => {
    if (r.blockIdx + 1 >= r.plan.blocks.length) { finish(r); return; }
    const n = { ...r, blockIdx: r.blockIdx + 1, blockElapsed: 0 };
    setRun(n); newQuestion(n);
  };

  const onAnswered = (res: AnswerResult) => {
    if (!run || !q) return;
    const a: Attempt = { category: q.category, keyPc: q.keyPc, correct: res.correct, ms: res.ms };
    const change = recordPracticeAttempt(a, true);
    setAnswered(true);
    setRun((r) => r && ({
      ...r, attempts: [...r.attempts, a],
      levelUps: change > 0 ? [...r.levelUps, `${CATEGORY_INFO[q.category].label} → level ${q.level + 1}`] : r.levelUps,
    }));
  };

  const onNext = () => {
    const r = runRef.current;
    if (!r) return;
    if (r.blockElapsed >= r.plan.blocks[r.blockIdx].seconds) nextBlock(r);
    else newQuestion(r);
  };

  const timeUp = !!run && !!block && run.blockElapsed >= block.seconds;
  // If the block's time runs out between questions (after an answer), move on automatically.
  useEffect(() => { if (run && timeUp && answered) { const id = setTimeout(onNext, 1500); return () => clearTimeout(id); } }, [timeUp, answered]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- running
  if (run && block && q) {
    const totalPlanned = run.plan.blocks.reduce((s, b) => s + b.seconds, 0);
    const sumSoFar = summarizeAttempts(run.attempts);
    return (
      <div className="space-y-4">
        <div className="card p-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-neutral-500">Block {run.blockIdx + 1} of {run.plan.blocks.length}</div>
              <div className="text-lg font-semibold text-white">{block.title}</div>
            </div>
            <div><div className="text-[11px] uppercase tracking-wider text-neutral-500">Block time left</div><div className={`font-mono text-2xl font-bold ${timeUp ? 'text-amber-300' : 'text-accent'}`}>{mmss(block.seconds - run.blockElapsed)}</div></div>
            <div><div className="text-[11px] uppercase tracking-wider text-neutral-500">Session</div><div className="font-mono text-lg text-neutral-200">{mmss(run.totalElapsed)} / {mmss(totalPlanned)}</div></div>
            <div><div className="text-[11px] uppercase tracking-wider text-neutral-500">Score</div><div className="text-lg text-neutral-200"><b className="text-white">{sumSoFar.tally.correct}</b>/{sumSoFar.tally.n} · {pct(sumSoFar.accuracy)}</div></div>
            <div className="ml-auto flex gap-2">
              <button className="btn" onClick={() => setRun({ ...run, paused: !run.paused })}>{run.paused ? '▶ Resume' : '❚❚ Pause'}</button>
              <button className="btn" onClick={() => nextBlock(run)}>Skip block →</button>
              <button className="btn" onClick={() => finish(run)}>End workout</button>
            </div>
          </div>
          <div className="mt-3 flex gap-1" aria-hidden>
            {run.plan.blocks.map((b, i) => (
              <div key={i} className="h-1.5 rounded bg-ink-700" style={{ flex: b.seconds }}>
                <div className="h-full rounded bg-accent" style={{ width: `${i < run.blockIdx ? 100 : i === run.blockIdx ? Math.min(100, (100 * run.blockElapsed) / b.seconds) : 0}%` }} />
              </div>
            ))}
          </div>
          {timeUp && <p className="mt-2 text-sm text-amber-300" role="status">Time is up for this block — finish this question to move on.</p>}
        </div>
        <div className="card relative p-4">
          {run.paused && <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-ink-950/85 text-lg font-semibold text-white">Paused</div>}
          <div className="mb-2 text-xs text-neutral-500">Key: <b className="text-neutral-300">{keyName(q.keyPc)}</b> · {block.why}</div>
          <QuestionView key={q.id} q={q} onAnswered={onAnswered} onNext={onNext} autoAdvanceMs={900} />
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- setup / summary / history
  return (
    <div className="space-y-4">
      {done && <Summary done={done} onAgain={start} onClose={() => setDone(null)} />}
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="card p-5">
          <h1 className="text-xl font-bold text-white">Daily workout</h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-400">A timed session that combines interval recognition, chord construction, voicings and voice leading. It is built from your history: weak keys come up more often, your weakest skill gets extra time, and each skill runs at its adaptive level.</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="label mb-0">Length</span>
            {WORKOUT_LENGTHS.map((m) => <button key={m} className={`chip px-4 py-1.5 text-sm ${minutes === m ? 'chip-on' : ''}`} aria-pressed={minutes === m} onClick={() => setMinutes(m)}>{m} min</button>)}
          </div>
          <ol className="mt-4 space-y-2">
            {plan.blocks.map((b, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2">
                <span className="w-5 text-sm text-neutral-500">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-neutral-100">{b.title} <span className="text-xs font-normal text-neutral-500">· level {b.level}</span></div>
                  <div className="text-xs text-neutral-500">{CATEGORY_INFO[b.category].text} <span className="text-neutral-400">({b.why})</span></div>
                </div>
                <div className="text-xs text-neutral-400">Keys: <span className="font-mono text-neutral-200">{b.keys.map(keyName).join(' ')}</span></div>
                <div className="w-14 text-right font-mono text-sm text-accent">{mmss(b.seconds)}</div>
              </li>
            ))}
          </ol>
          <div className="mt-3 text-xs text-neutral-500">Focus keys today: <b className="text-neutral-300">{plan.focusKeys.map(keyName).join(', ')}</b> · key of the day (rotates round the circle of fifths): <b className="text-neutral-300">{keyName(plan.keyOfTheDay)}</b></div>
          <button className="btn btn-accent mt-4 px-6 py-2 text-base" onClick={start}>Start {minutes}-minute workout</button>
        </div>
        <Overview />
      </div>
      <History />
    </div>
  );
}

function Summary({ done, onAgain, onClose }: { done: { record: SessionRecord; levelUps: string[]; prevAcc: number | null }; onAgain: () => void; onClose: () => void }) {
  const r = done.record;
  const acc = accuracyOf(r.tally);
  const progress = useProgress();
  const keys = Object.entries(r.byKey).map(([pc, t]) => ({ pc: Number(pc), t })).sort((a, b) => (accuracyOf(a.t) ?? 0) - (accuracyOf(b.t) ?? 0));
  return (
    <div className="card border-accent p-5" role="status">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-white">Workout complete</h2>
          <p className="text-sm text-neutral-400">{r.title} · {mmss(r.seconds)} practised{r.tally.n ? ' · saved to your history' : ' · no answers, nothing saved'}</p>
        </div>
        <div className="flex gap-2"><button className="btn btn-accent" onClick={onAgain}>Another round</button><button className="btn" onClick={onClose}>Close</button></div>
      </div>
      <div className="mt-3 flex flex-wrap gap-6">
        <Big label="Answers" value={String(r.tally.n)} />
        <Big label="Accuracy" value={pct(acc)} sub={done.prevAcc !== null && acc !== null ? `${acc >= done.prevAcc ? '▲' : '▼'} ${Math.abs(Math.round((acc - done.prevAcc) * 100))} pts vs last workout` : undefined} />
        <Big label="Avg time" value={r.tally.n ? `${(r.tally.ms / r.tally.n / 1000).toFixed(1)} s` : '—'} />
        <Big label="Streak" value={`${streak(progress)} day${streak(progress) === 1 ? '' : 's'}`} />
      </div>
      {done.levelUps.length > 0 && <p className="mt-2 text-sm text-accent">Level up: {done.levelUps.join(' · ')}</p>}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <table className="w-full text-left text-xs">
          <thead className="text-neutral-500"><tr><th className="py-1 font-medium">Skill</th><th className="font-medium">Correct</th><th className="font-medium">Accuracy</th><th className="font-medium">Avg</th></tr></thead>
          <tbody className="text-neutral-300 [&_tr]:border-t [&_tr]:border-ink-700 [&_td]:py-1">
            {(Object.entries(r.byCategory) as [Category, NonNullable<SessionRecord['byCategory'][Category]>][]).map(([c, t]) => (
              <tr key={c}><td>{CATEGORY_INFO[c].label}</td><td>{t.correct}/{t.n}</td><td>{pct(accuracyOf(t))}</td><td>{avgSecondsOf(t)?.toFixed(1)} s</td></tr>
            ))}
          </tbody>
        </table>
        <div>
          <div className="label">Keys this session (weakest first)</div>
          <div className="flex flex-wrap gap-1.5">
            {keys.map(({ pc, t }) => <span key={pc} className="rounded px-2 py-0.5 text-xs text-white" style={{ background: accuracyColor(accuracyOf(t)) }}>{keyName(pc)} {t.correct}/{t.n}</span>)}
          </div>
          <p className="mt-2 text-xs text-neutral-500">Next workout will focus on: <b className="text-neutral-300">{weakKeys(progress, 3).map(keyName).join(', ')}</b></p>
        </div>
      </div>
    </div>
  );
}

function Big({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div><div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div><div className="text-2xl font-bold text-accent">{value}</div>{sub && <div className="text-[11px] text-neutral-400">{sub}</div>}</div>;
}

function Overview() {
  const d = useProgress();
  const stats = keyStats(d);
  const total = Object.values(d.byCategory).reduce((s, t) => s + t.n, 0);
  const weekAgo = Date.now() - 7 * 86400000;
  const weekSeconds = d.sessions.filter((s) => new Date(s.date).getTime() >= weekAgo).reduce((s, x) => s + x.seconds, 0);
  return (
    <div className="card space-y-3 p-4">
      <div className="flex flex-wrap gap-5">
        <Big label="Streak" value={`${streak(d)} d`} />
        <Big label="This week" value={`${Math.round(weekSeconds / 60)} min`} />
        <Big label="Answers" value={String(total)} />
      </div>
      <div>
        <div className="label">Skills (adaptive level · accuracy · avg time)</div>
        <ul className="space-y-1 text-xs">
          {CATEGORIES.map((c) => {
            const t = d.byCategory[c];
            return (
              <li key={c} className="flex items-center gap-2">
                <span className="w-32 text-neutral-300">{CATEGORY_INFO[c].label}</span>
                <span className="w-8 text-neutral-500">L{d.levels[c].level}</span>
                <div className="h-1.5 flex-1 rounded bg-ink-700"><div className="h-full rounded" style={{ width: `${(accuracyOf(t) ?? 0) * 100}%`, background: accuracyColor(accuracyOf(t)) }} /></div>
                <span className="w-10 text-right text-neutral-400">{pct(accuracyOf(t))}</span>
                <span className="w-10 text-right text-neutral-500">{avgSecondsOf(t)?.toFixed(1) ?? '—'}s</span>
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <div className="label">Keys (accuracy; weakest outlined)</div>
        <div className="grid grid-cols-6 gap-1">
          {stats.map((k) => {
            const weak = weakKeys(d, 3).includes(k.pc);
            return (
              <div key={k.pc} className={`rounded px-1 py-1 text-center text-xs text-white ${weak ? 'ring-2 ring-accent' : ''}`} style={{ background: accuracyColor(k.accuracy) }}
                title={k.n ? `${k.n} answers · ${pct(k.accuracy)} · ${((k.avgMs ?? 0) / 1000).toFixed(1)} s` : 'not practised yet'}>
                <div className="font-bold">{keyName(k.pc)}</div><div className="text-[10px] opacity-80">{k.n ? pct(k.accuracy) : '—'}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function History() {
  const d = useProgress();
  const days = Array.from({ length: 14 }, (_, i) => {
    const dt = new Date(); dt.setDate(dt.getDate() - (13 - i));
    return { key: dayKey(dt), label: dt.toLocaleDateString(undefined, { weekday: 'narrow' }), t: d.daily[dayKey(dt)] };
  });
  const max = Math.max(1, ...days.map((x) => x.t?.n ?? 0));
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `keymaster12-progress-${dayKey(new Date())}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-white">Practice history</h2>
        <div className="flex gap-2">
          <button className="btn py-1 text-xs" onClick={exportJson}>Export JSON</button>
          <button className="btn py-1 text-xs hover:border-rose-500 hover:text-rose-300" onClick={() => { if (window.confirm('Delete all practice history, levels and statistics on this device?')) resetProgress(); }}>Reset progress</button>
        </div>
      </div>
      <p className="text-xs text-neutral-500">Stored locally in this browser (LocalStorage); nothing is sent anywhere.</p>
      <div className="mt-3">
        <div className="label">Last 14 days (answers; colour = accuracy)</div>
        <div className="flex h-24 items-end gap-1" role="img" aria-label="Answers per day over the last 14 days">
          {days.map((x) => (
            <div key={x.key} className="flex flex-1 flex-col items-center gap-1" title={`${x.key}: ${x.t?.n ?? 0} answers${x.t?.n ? `, ${pct(accuracyOf(x.t))}` : ''}`}>
              <div className="w-full rounded-t" style={{ height: `${((x.t?.n ?? 0) / max) * 72}px`, minHeight: x.t?.n ? 3 : 0, background: accuracyColor(accuracyOf(x.t)) }} />
              <span className="text-[9px] text-neutral-500">{x.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 label">Sessions ({d.sessions.length})</div>
      {d.sessions.length === 0 ? <p className="text-sm text-neutral-500">No sessions yet. Finish a workout or a drill to see it here.</p> : (
        <div className="scrollbar-thin max-h-72 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-ink-900 text-neutral-500"><tr><th className="py-1 font-medium">When</th><th className="font-medium">Session</th><th className="font-medium">Time</th><th className="font-medium">Score</th><th className="font-medium">Accuracy</th><th className="font-medium">Avg</th></tr></thead>
            <tbody className="text-neutral-300 [&_tr]:border-t [&_tr]:border-ink-700 [&_td]:py-1">
              {d.sessions.slice(0, 50).map((s) => (
                <tr key={s.id}>
                  <td className="whitespace-nowrap">{new Date(s.date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{s.title}</td><td>{mmss(s.seconds)}</td><td>{s.tally.correct}/{s.tally.n}</td><td>{pct(accuracyOf(s.tally))}</td><td>{avgSecondsOf(s.tally)?.toFixed(1)} s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
