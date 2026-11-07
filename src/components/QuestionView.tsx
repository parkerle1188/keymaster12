import { useEffect, useRef, useState } from 'react';
import { gradeChoice, gradeKeyboard, type Grade, type Question } from '../practice/questions';
import { CATEGORY_INFO } from '../practice/progress';
import { playChord } from '../audio/piano-audio';
import { PianoKeyboard, windowFor } from './PianoKeyboard';
import { NoteEntry } from './NoteEntry';

export interface AnswerResult { correct: boolean; ms: number; timedOut: boolean }

interface Props {
  q: Question;
  onAnswered: (r: AnswerResult) => void;
  onNext: () => void;
  /** Move on automatically after a correct answer (timed modes). */
  autoAdvanceMs?: number;
  /** Move on automatically after a wrong answer, with time to read the correction (timed modes). */
  autoAdvanceWrongMs?: number;
  /** Per-question limit; an unanswered question counts as wrong. */
  timeLimitMs?: number;
}

const hl = (xs: Question['solution']) => xs.map((s) => ({ midi: s.midi, role: 'root' as const, name: s.name, label: s.label }));

/** Renders one practice question (multiple choice or keyboard), grades it once, then shows the solution. */
export function QuestionView({ q, onAnswered, onNext, autoAdvanceMs, autoAdvanceWrongMs, timeLimitMs }: Props) {
  const [grade, setGrade] = useState<(Grade & { picked?: string; timedOut?: boolean }) | null>(null);
  const [played, setPlayed] = useState<number[]>([]);
  const [now, setNow] = useState(Date.now());
  const start = useRef(Date.now());
  const answered = useRef(false);

  useEffect(() => { setGrade(null); setPlayed([]); start.current = Date.now(); answered.current = false; }, [q.id]);

  const finish = (g: Grade & { picked?: string; timedOut?: boolean }) => {
    if (answered.current) return;
    answered.current = true;
    setGrade(g);
    onAnswered({ correct: g.correct, ms: Date.now() - start.current, timedOut: !!g.timedOut });
    if (q.solution.length) void playChord(q.solution.map((s) => s.midi), { duration: 1.2, velocity: 0.55 });
  };

  // countdown
  useEffect(() => {
    if (!timeLimitMs || grade) return;
    const id = setInterval(() => {
      setNow(Date.now());
      if (Date.now() - start.current >= timeLimitMs) finish({ correct: false, message: "Time's up.", timedOut: true });
    }, 100);
    return () => clearInterval(id);
  }, [timeLimitMs, grade, q.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // auto-advance (timed modes)
  useEffect(() => {
    if (!grade) return;
    const delay = grade.correct ? autoAdvanceMs : autoAdvanceWrongMs;
    if (!delay) return;
    const id = setTimeout(onNext, delay);
    return () => clearTimeout(id);
  }, [grade, autoAdvanceMs, autoAdvanceWrongMs]); // eslint-disable-line react-hooks/exhaustive-deps

  // keyboard shortcuts: 1–4 pick a choice, Enter = next / check
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'SELECT') return;
      if (grade && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onNext(); return; }
      if (!grade && q.input === 'choice') {
        const i = Number(e.key) - 1;
        const c = q.choices?.[i];
        if (c) finish({ ...gradeChoice(q, c.value), picked: c.value });
      }
      if (!grade && q.input === 'keyboard' && e.key === 'Enter' && played.length) finish(gradeKeyboard(q, played));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const remaining = timeLimitMs ? Math.max(0, timeLimitMs - (now - start.current)) : 0;
  const showWindow = q.showMidis?.length ? windowFor(q.showMidis.map((s) => s.midi), 2) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{CATEGORY_INFO[q.category].label} · level {q.level}</div>
          <div className="text-2xl font-bold text-white" aria-live="polite">{q.prompt}</div>
          {q.detail && <div className="mt-0.5 text-sm text-neutral-400">{q.detail}</div>}
        </div>
        {q.playMidis && <button className="btn shrink-0" onClick={() => playChord(q.playMidis!, { arpeggio: q.category === 'interval' })}>▶ Hear</button>}
      </div>
      {timeLimitMs ? (
        <div className="h-1.5 overflow-hidden rounded bg-ink-700" aria-hidden><div className="h-full bg-accent transition-[width] duration-100" style={{ width: `${grade ? 0 : (100 * remaining) / timeLimitMs}%` }} /></div>
      ) : null}

      {showWindow && q.input === 'choice' && (
        <div className="max-w-2xl">
          <PianoKeyboard low={showWindow[0]} high={showWindow[1]} highlights={(grade && q.category === 'voice-leading' ? q.solution : q.showMidis!).map((s) => ({ midi: s.midi, role: 'root' as const, name: s.name, label: s.label }))}
            ghosts={grade && q.category === 'voice-leading' ? q.ghosts : undefined} minWhiteWidth={16} />
        </div>
      )}

      {q.input === 'choice' ? (
        <div className={`grid gap-2 ${q.category === 'voice-leading' ? '' : 'grid-cols-2 sm:grid-cols-4'}`}>
          {q.choices!.map((c, i) => {
            const isAns = c.value === q.answer, picked = grade?.picked === c.value;
            const cls = !grade ? 'hover:border-accent' : isAns ? 'border-emerald-500 bg-emerald-950/50 text-emerald-200' : picked ? 'border-rose-500 bg-rose-950/40 text-rose-200' : 'opacity-50';
            return (
              <button key={c.value} data-choice={i + 1} disabled={!!grade} onClick={() => finish({ ...gradeChoice(q, c.value), picked: c.value })}
                className={`rounded-lg border border-ink-600 bg-ink-850 px-3 py-3 text-left transition ${cls}`}>
                <span className="mr-2 text-[10px] text-neutral-500">{i + 1}</span>
                <span className={q.category === 'voice-leading' ? 'font-mono text-sm' : 'text-lg font-bold'}>{c.label}</span>
                {c.detail && <div className="text-[11px] text-neutral-500">{c.detail}</div>}
              </button>
            );
          })}
        </div>
      ) : (
        <NoteEntry value={played} onChange={setPlayed} low={q.range?.[0]} high={q.range?.[1]} disabled={!!grade}
          reveal={grade ? hl(q.solution) : undefined} onSubmit={() => finish(gradeKeyboard(q, played))} />
      )}

      {grade && (
        <div className={`rounded-lg border p-3 text-sm ${grade.correct ? 'border-emerald-700 bg-emerald-950/40 text-emerald-200' : 'border-rose-800 bg-rose-950/30 text-rose-200'}`} role="status">
          <div className="flex flex-wrap items-center gap-2">
            <b>{grade.correct ? '✓ Correct' : grade.timedOut ? '⏱ Time’s up' : '✗ Not quite'}</b>
            {!grade.correct && <span>{grade.message}</span>}
            <button className="btn btn-accent ml-auto py-1 text-xs" onClick={onNext}>Next ↵</button>
          </div>
          <div className="mt-1 text-xs opacity-85">{q.explanation}</div>
          {q.input === 'keyboard' && <div className="mt-1 text-xs opacity-70">The keyboard now shows the answer.</div>}
          {q.input === 'choice' && !q.showMidis && q.solution.length > 0 && (
            <div className="mt-2 max-w-xl"><PianoKeyboard {...rangeProps(q)} highlights={hl(q.solution)} minWhiteWidth={12} /></div>
          )}
        </div>
      )}
    </div>
  );
}

function rangeProps(q: Question) {
  const [low, high] = windowFor(q.solution.map((s) => s.midi), 2);
  return { low, high };
}
