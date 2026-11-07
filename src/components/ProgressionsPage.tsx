import { useEffect, useMemo, useRef, useState } from 'react';
import { FUNCTION_INFO, keyName, tonicFor } from '../music-theory/harmony';
import { DEFAULT_ROOTS } from '../music-theory/enharmonic-spelling';
import { formatNote } from '../music-theory/note-parser';
import {
  CATEGORY_LABELS, PROGRESSIONS, realizeProgression, type ProgressionCategory,
} from '../voice-leading/progressions';
import {
  independentVoicings, optimizeProgression, quickMovement, VOICING_APPROACHES, type ProgressionResult, type VoiceLeadingOptions,
} from '../voice-leading/voice-leading';
import { STYLE_LABELS, STYLES, type GeneratedVoicing, type Style } from '../voicing-engine/voicing-types';
import { playChord, playSequence } from '../audio/piano-audio';
import { usePersistentState } from '../state/usePersistentState';
import { PianoKeyboard, windowFor } from './PianoKeyboard';
import { VoiceLeadingGraph, TransitionDetails, RatingBadge } from './VoiceLeadingGraph';
import { Legend } from './Legend';

interface Settings { progId: string; keyPc: number; style: Style | 'auto'; mode: 'solo' | 'band'; approach: string; bpm: number; loop: boolean }
const DEFAULTS: Settings = { progId: 'ii-V-I', keyPc: 0, style: 'auto', mode: 'solo', approach: 'smoothest', bpm: 80, loop: false };

export function ProgressionsPage({ initial }: { initial?: { progId: string; keyPc: number } }) {
  const [s, setS] = usePersistentState<Settings>('prog-settings', DEFAULTS);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => ({ ...p, [k]: v }));
  useEffect(() => { if (initial) setS((p) => ({ ...p, progId: initial.progId, keyPc: initial.keyPc })); }, [initial]); // eslint-disable-line react-hooks/exhaustive-deps

  const prog = PROGRESSIONS.find((p) => p.id === s.progId) ?? PROGRESSIONS[0];
  const style: Style = s.style === 'auto' ? prog.style : s.style;
  const steps = useMemo(() => realizeProgression(prog, tonicFor(s.keyPc, prog.mode)), [prog, s.keyPc]);
  const symbols = steps.map((x) => x.symbol);
  const [locked, setLocked] = useState<Record<number, string>>({});
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(-1);
  const stopRef = useRef<(() => void) | null>(null);
  useEffect(() => { setLocked({}); setSelected(0); }, [s.progId, s.keyPc, style, s.mode, s.approach]);
  useEffect(() => () => stopRef.current?.(), []);

  const opts: VoiceLeadingOptions = useMemo(() => ({ style, mode: s.mode, families: VOICING_APPROACHES.find((a) => a.id === s.approach)?.families, candidatesPerChord: 30 }), [style, s.mode, s.approach]);
  const result: ProgressionResult = useMemo(() => optimizeProgression(symbols, { ...opts, locked }), [symbols.join(' '), opts, locked]); // eslint-disable-line react-hooks/exhaustive-deps
  const baseline = useMemo(() => independentVoicings(symbols, opts), [symbols.join(' '), opts]); // eslint-disable-line react-hooks/exhaustive-deps
  const comparison = useMemo(() => VOICING_APPROACHES.map((a) => {
    const r = optimizeProgression(symbols, { style, mode: s.mode, families: a.families, candidatesPerChord: 20 });
    return { ...a, ok: r.missing.length === 0, movement: r.upperMovement };
  }), [symbols.join(' '), style, s.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const ok = result.missing.length === 0;
  const play = () => {
    stopRef.current?.();
    if (!ok) return;
    stopRef.current = playSequence(result.voicings.map((v) => v.notes.map((n) => n.midi)), { secondsPerChord: (60 / s.bpm) * 2, loop: s.loop, onStep: setPlaying });
  };
  const stop = () => { stopRef.current?.(); stopRef.current = null; };

  const sel = ok ? result.voicings[selected] : undefined;
  const alternatives = useMemo(() => {
    if (!ok || !sel) return [];
    const prev = result.voicings[selected - 1], next = result.voicings[selected + 1];
    return result.candidates[selected]
      .map((v) => ({ v, movement: (prev ? quickMovement(prev, v).upper : 0) + (next ? quickMovement(v, next).upper : 0) }))
      .sort((a, b) => a.movement - b.movement || b.v.score.total - a.v.score.total)
      .slice(0, 8);
  }, [ok, sel, result, selected]);

  const categories = Object.keys(CATEGORY_LABELS) as ProgressionCategory[];
  const saving = baseline.missing.length === 0 && ok ? baseline.upperMovement - result.upperMovement : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-4">
        <div className="card space-y-3 p-4">
          {categories.map((c) => (
            <div key={c}>
              <div className="label">{CATEGORY_LABELS[c]}</div>
              <div className="space-y-0.5">
                {PROGRESSIONS.filter((p) => p.category === c).map((p) => (
                  <button key={p.id} onClick={() => set('progId', p.id)} aria-pressed={p.id === prog.id}
                    className={`block w-full rounded-md px-2 py-1 text-left text-sm transition ${p.id === prog.id ? 'bg-accent/15 text-accent' : 'text-neutral-300 hover:bg-ink-800'}`}>{p.name}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="card space-y-3 p-4">
          <div>
            <div className="label">Key ({prog.mode})</div>
            <div className="grid grid-cols-6 gap-1">
              {DEFAULT_ROOTS.map((_, pc) => (
                <button key={pc} className={`chip justify-center px-1 font-mono ${s.keyPc === pc ? 'chip-on' : ''}`} onClick={() => set('keyPc', pc)} aria-pressed={s.keyPc === pc}>{formatNote(tonicFor(pc, prog.mode))}</button>
              ))}
            </div>
            <div className="mt-1 flex gap-1">
              <button className="btn flex-1 py-1 text-xs" onClick={() => set('keyPc', (s.keyPc + 5) % 12)} title="Next key in the cycle of 4ths">Next key (4ths) →</button>
              <button className="btn py-1 text-xs" onClick={() => set('keyPc', Math.floor(Math.random() * 12))}>Random</button>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="pg-style">Style</label>
            <select id="pg-style" className="select" value={s.style} onChange={(e) => set('style', e.target.value as Style | 'auto')}>
              <option value="auto">Progression default ({STYLE_LABELS[prog.style]})</option>
              {STYLES.map((st) => <option key={st} value={st}>{STYLE_LABELS[st]}</option>)}
            </select>
          </div>
          <div><div className="label">Setting</div><div className="seg" role="group" aria-label="Setting">
            <button aria-pressed={s.mode === 'solo'} onClick={() => set('mode', 'solo')}>Solo piano</button>
            <button aria-pressed={s.mode === 'band'} onClick={() => set('mode', 'band')}>With bassist</button>
          </div></div>
          <div>
            <div className="label">Voicing approach</div>
            <div className="space-y-0.5">
              {comparison.map((a) => (
                <button key={a.id} onClick={() => set('approach', a.id)} disabled={!a.ok} aria-pressed={s.approach === a.id} title={a.description}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${s.approach === a.id ? 'bg-accent/15 text-accent' : 'text-neutral-300 hover:bg-ink-800'}`}>
                  <span>{a.label}</span><span className="font-mono text-[11px]">{a.ok ? `${a.movement} st` : 'n/a'}</span>
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-neutral-500">Numbers: total upper-voice movement of the optimised path for each approach.</p>
          </div>
          <div>
            <label className="label" htmlFor="pg-bpm">Tempo: {s.bpm} BPM (2 beats per chord)</label>
            <input id="pg-bpm" type="range" min={50} max={140} step={5} value={s.bpm} onChange={(e) => set('bpm', Number(e.target.value))} className="w-full accent-[#FF7900]" />
            <label className="mt-1 flex items-center gap-2 text-xs text-neutral-300"><input type="checkbox" className="accent-[#FF7900]" checked={s.loop} onChange={(e) => set('loop', e.target.checked)} /> Loop</label>
          </div>
        </div>
      </aside>

      <section className="min-w-0 space-y-4">
        <div className="card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-neutral-500">{CATEGORY_LABELS[prog.category]} · {keyName(s.keyPc, prog.mode)}</div>
              <h1 className="text-xl font-bold text-white">{prog.name}</h1>
              <p className="mt-1 max-w-2xl text-sm text-neutral-400">{prog.description}</p>
            </div>
            <div className="flex gap-2">
              {playing >= 0 ? <button className="btn" onClick={stop}>■ Stop</button> : <button className="btn btn-accent" onClick={play} disabled={!ok}>▶ Play progression</button>}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {steps.map((st, i) => (
              <button key={i} onClick={() => setSelected(i)} className={`rounded-lg border px-3 py-1.5 text-left transition ${selected === i ? 'border-accent bg-accent/10' : 'border-ink-600 hover:border-neutral-500'} ${playing === i ? 'ring-2 ring-accent' : ''}`}>
                <div className="font-mono text-base font-bold text-white">{st.symbol}</div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-neutral-300">{st.numeral}</span>
                  <span className="rounded px-1 font-semibold text-black" style={{ background: FUNCTION_INFO[st.function].color }} title={FUNCTION_INFO[st.function].text}>{FUNCTION_INFO[st.function].short}</span>
                  {st.analysis && <span className="text-neutral-500">{st.analysis}</span>}
                </div>
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-neutral-500">
            {Object.values(FUNCTION_INFO).map((f) => <span key={f.short}><span className="mr-1 rounded px-1 font-semibold text-black" style={{ background: f.color }}>{f.short}</span>{f.name}: {f.text}</span>)}
          </div>
        </div>

        {!ok ? (
          <div className="card p-4 text-sm text-amber-300">
            No {VOICING_APPROACHES.find((a) => a.id === s.approach)?.label} voicing fits {result.missing.map((i) => symbols[i]).join(', ')} in this setting. Choose another approach (the list shows which ones work) or switch solo/band.
          </div>
        ) : (
          <>
            <div className="card p-4">
              <div className="mb-2 flex flex-wrap items-center gap-x-6 gap-y-1">
                <div><div className="text-[10px] uppercase tracking-wider text-neutral-500">Upper-voice movement</div><div className="text-xl font-bold text-accent">{result.upperMovement} st</div></div>
                <div><div className="text-[10px] uppercase tracking-wider text-neutral-500">Best voicing per chord, ignoring transitions</div><div className="text-xl font-bold text-neutral-300">{baseline.upperMovement} st</div></div>
                {saving > 0 && <div className="text-sm text-emerald-300">Optimised path saves {saving} semitones ({Math.round((100 * saving) / Math.max(1, baseline.upperMovement))} %).</div>}
                {Object.keys(locked).length > 0 && <button className="btn ml-auto py-1 text-xs" onClick={() => setLocked({})}>Unlock all ({Object.keys(locked).length})</button>}
              </div>
              <VoiceLeadingGraph voicings={result.voicings} transitions={result.transitions} labels={steps.map((x) => x.numeral)} active={playing >= 0 ? playing : selected} onSelect={setSelected} />
            </div>

            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {result.voicings.map((v, i) => (
                <ChordCard key={i} v={v} prev={result.voicings[i - 1]} active={selected === i || playing === i} locked={!!locked[i]} numeral={steps[i].numeral}
                  transition={result.transitions[i - 1]} onSelect={() => setSelected(i)} />
              ))}
            </div>

            {sel && (
              <div className="card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-semibold text-white">Alternatives for {sel.chord.symbol} <span className="text-xs font-normal text-neutral-500">(chord {selected + 1}; movement in and out, smoothest first)</span></h2>
                  {locked[selected] && <button className="btn py-1 text-xs" onClick={() => setLocked((l) => { const n = { ...l }; delete n[selected]; return n; })}>Unlock this chord</button>}
                </div>
                <ul className="mt-2 grid gap-1.5 md:grid-cols-2">
                  {alternatives.map(({ v, movement }) => (
                    <li key={v.id} className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${v.id === sel.id ? 'border-accent bg-accent/10' : 'border-ink-700 bg-ink-850'}`}>
                      <div className="min-w-0"><div className="truncate font-semibold text-neutral-100">{v.template.name}</div><div className="truncate font-mono text-neutral-400">{v.notes.map((n) => n.name).join(' ')}</div></div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="font-mono text-neutral-300">{movement} st</span>
                        <button className="btn px-2 py-0.5 text-xs" onClick={() => playChord(v.notes.map((n) => n.midi))} aria-label="Play">▶</button>
                        {v.id !== sel.id && <button className="btn px-2 py-0.5 text-xs" onClick={() => setLocked((l) => ({ ...l, [selected]: v.id }))}>Lock in</button>}
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-neutral-500">Locking a voicing re-optimises the other chords around it.</p>
              </div>
            )}
            <Legend compact />
          </>
        )}
      </section>
    </div>
  );
}

function ChordCard({ v, prev, active, locked, numeral, transition, onSelect }: {
  v: GeneratedVoicing; prev?: GeneratedVoicing; active: boolean; locked: boolean; numeral: string;
  transition?: ProgressionResult['transitions'][number]; onSelect: () => void;
}) {
  const [lo, hi] = windowFor([...v.notes, ...(prev?.notes ?? [])].map((n) => n.midi), 2);
  const [open, setOpen] = useState(false);
  return (
    <div className={`card p-3 ${active ? 'border-accent' : ''}`} onClick={onSelect}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2"><span className="text-lg font-bold text-white">{v.chord.symbol}</span><span className="text-xs text-neutral-500">{numeral}</span>{locked && <span className="text-[10px] text-accent">🔒 locked</span>}</div>
          <div className="truncate text-xs text-neutral-400">{v.template.name}</div>
        </div>
        <button className="btn shrink-0 px-2 py-1 text-xs" onClick={(e) => { e.stopPropagation(); void playChord(v.notes.map((n) => n.midi)); }} aria-label={`Play ${v.chord.symbol}`}>▶</button>
      </div>
      <div className="mt-2"><PianoKeyboard low={lo} high={hi} highlights={v.notes.map((n) => ({ midi: n.midi, role: n.role, hand: n.hand, label: n.label, name: n.name }))} ghosts={prev?.notes.map((n) => n.midi)} minWhiteWidth={10} /></div>
      <div className="mt-1.5 font-mono text-[11px] text-neutral-300">{v.notes.map((n) => n.name).join(' ')}</div>
      {transition ? (
        <div className="mt-1.5 border-t border-ink-700 pt-1.5" onClick={(e) => e.stopPropagation()}>
          <button className="flex w-full items-center gap-2 text-left text-xs text-neutral-400" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <span>From {transition.fromSymbol}: <b className="text-neutral-200">{transition.upperMovement} st</b>, {transition.commonTones} held</span>
            <RatingBadge rating={transition.rating} />
            <span className="ml-auto">{open ? '▲' : '▼'}</span>
          </button>
          {open && <div className="mt-1.5"><TransitionDetails t={transition} /></div>}
        </div>
      ) : <div className="mt-1.5 border-t border-ink-700 pt-1.5 text-xs text-neutral-500">Starting chord</div>}
    </div>
  );
}
