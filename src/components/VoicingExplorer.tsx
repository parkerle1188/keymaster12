import { useEffect, useMemo, useState } from 'react';
import { tryParseChord } from '../music-theory/chord-parser';
import { transposeChordSymbol } from '../music-theory/transposition';
import { DEFAULT_ROOTS } from '../music-theory/enharmonic-spelling';
import { formatNote } from '../music-theory/note-parser';
import { generateVoicings, DEFAULT_OPTIONS } from '../voicing-engine/voicing-generator';
import { FAMILY_LABELS, STYLE_LABELS, STYLES, type GeneratedVoicing, type GenerationOptions, type Style, type VoicingFamily } from '../voicing-engine/voicing-types';
import { STYLE_PROFILES } from '../voice-leading/style-profiles';
import { usePersistentState } from '../state/usePersistentState';
import { playChord } from '../audio/piano-audio';
import { ChordExplorer } from './ChordExplorer';
import { VoicingCard } from './VoicingCard';
import { VoicingDetail } from './VoicingDetail';
import { VoicingComparison } from './VoicingComparison';
import { Legend } from './Legend';

const EXAMPLES = ['Dm9', 'G13', 'Cmaj9', 'F#maj7', 'C7b9', 'C7alt', 'Ebm11', 'Am7/G', 'Bb/C', 'Fm7b5', 'Ab6/9', 'E7#9', 'Dsus4', 'C'];
const RANGES: { id: string; label: string; range: [number, number] }[] = [
  { id: '88', label: '88 keys (A0–C8)', range: [21, 108] },
  { id: '76', label: '76 keys (E1–G7)', range: [28, 103] },
  { id: '61', label: '61 keys (C2–C7)', range: [36, 96] },
  { id: '49', label: '49 keys (C2–C6)', range: [36, 84] },
];
const FAMILIES = Object.keys(FAMILY_LABELS) as VoicingFamily[];

interface Settings {
  chord: string;
  style: Style;
  mode: 'solo' | 'band';
  span: number;
  rangeId: string;
  maxDifficulty: number;
  families: VoicingFamily[];
  allowEnriched: boolean;
  allowLowClusters: boolean;
  limit: number;
}

const DEFAULT_SETTINGS: Settings = { chord: 'Dm9', style: 'jazz', mode: 'solo', span: 14, rangeId: '88', maxDifficulty: 5, families: [], allowEnriched: true, allowLowClusters: false, limit: 8 };

export interface SavedVoicing { chord: string; templateId: string; name: string; notes: string; style: Style; mode: 'solo' | 'band' }

export function VoicingExplorer({ initialChord }: { initialChord?: string }) {
  const [s, setS] = usePersistentState<Settings>('explorer-settings', DEFAULT_SETTINGS);
  const [input, setInput] = useState(initialChord ?? s.chord);
  const [saved, setSaved] = usePersistentState<SavedVoicing[]>('saved-voicings', []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => ({ ...p, [k]: v }));

  useEffect(() => { if (initialChord) { setInput(initialChord); set('chord', initialChord); } }, [initialChord]); // eslint-disable-line react-hooks/exhaustive-deps

  const parsed = useMemo(() => tryParseChord(s.chord), [s.chord]);
  const options: GenerationOptions = useMemo(() => ({
    ...DEFAULT_OPTIONS, style: s.style, mode: s.mode, maxHandSpan: s.span,
    range: RANGES.find((r) => r.id === s.rangeId)?.range ?? [21, 108],
    maxDifficulty: s.maxDifficulty, families: s.families.length ? s.families : undefined,
    allowEnriched: s.allowEnriched, allowLowClusters: s.allowLowClusters, limit: s.limit,
  }), [s]);
  const results: GeneratedVoicing[] = useMemo(() => (parsed.chord ? generateVoicings(parsed.chord, options) : []), [parsed.chord, options]);

  useEffect(() => { setSelectedId(results[0]?.id ?? null); setCompare([]); }, [results]);
  const selected = results.find((r) => r.id === selectedId) ?? results[0];
  const compared = compare.map((id) => results.find((r) => r.id === id)).filter(Boolean) as GeneratedVoicing[];

  const submit = (sym: string) => { setInput(sym); set('chord', sym.trim()); };
  const isSaved = (v: GeneratedVoicing) => saved.some((x) => x.chord === v.chord.symbol && x.templateId === v.template.id && x.style === s.style && x.mode === s.mode);
  const toggleSave = (v: GeneratedVoicing) => {
    if (isSaved(v)) setSaved(saved.filter((x) => !(x.chord === v.chord.symbol && x.templateId === v.template.id && x.style === s.style && x.mode === s.mode)));
    else setSaved([...saved, { chord: v.chord.symbol, templateId: v.template.id, name: v.template.name, notes: v.notes.map((n) => n.name).join(' '), style: s.style, mode: s.mode }]);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      {/* ---------------- controls */}
      <aside className="space-y-4">
        <div className="card space-y-3 p-4">
          <form onSubmit={(e) => { e.preventDefault(); submit(input); }}>
            <label className="label" htmlFor="chord-input">Chord symbol</label>
            <div className="flex gap-2">
              <input id="chord-input" className="input font-mono text-lg" value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. Dm9, G13, C7alt, Am7/G" autoComplete="off" spellCheck={false} />
              <button className="btn btn-accent" type="submit">Go</button>
            </div>
            {parsed.error && <p className="mt-1.5 text-xs text-rose-400" role="alert">{parsed.error}</p>}
          </form>
          <div className="flex flex-wrap gap-1">
            {EXAMPLES.map((e) => <button key={e} className={`chip font-mono ${s.chord === e ? 'chip-on' : ''}`} onClick={() => submit(e)}>{e}</button>)}
          </div>
          {parsed.chord && (
            <div>
              <div className="label">Same chord, other root</div>
              <div className="grid grid-cols-6 gap-1">
                {DEFAULT_ROOTS.map((r, pc) => {
                  const sym = transposeChordSymbol(parsed.chord!, pc);
                  return <button key={pc} className={`chip justify-center px-1 font-mono ${parsed.chord!.rootPc === pc ? 'chip-on' : ''}`} onClick={() => submit(sym)} title={sym}>{formatNote(r)}</button>;
                })}
              </div>
            </div>
          )}
        </div>

        <div className="card space-y-3 p-4">
          <div>
            <div className="label">Style</div>
            <div className="seg" role="group" aria-label="Style">
              {STYLES.map((st) => <button key={st} aria-pressed={s.style === st} onClick={() => set('style', st)}>{STYLE_LABELS[st]}</button>)}
            </div>
            <p className="mt-1 text-[11px] text-neutral-500">{STYLE_PROFILES[s.style].description}</p>
          </div>
          <div>
            <div className="label">Setting</div>
            <div className="seg" role="group" aria-label="Setting">
              <button aria-pressed={s.mode === 'solo'} onClick={() => set('mode', 'solo')}>Solo piano</button>
              <button aria-pressed={s.mode === 'band'} onClick={() => set('mode', 'band')}>With bassist</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="span">Max hand span</label>
              <select id="span" className="select" value={s.span} onChange={(e) => set('span', Number(e.target.value))}>
                <option value={12}>Octave (12)</option>
                <option value={13}>Minor 9th (13)</option>
                <option value={14}>Major 9th (14)</option>
                <option value={16}>Major 10th (16)</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="range">Keyboard</label>
              <select id="range" className="select" value={s.rangeId} onChange={(e) => set('rangeId', e.target.value)}>
                {RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="diff">Max difficulty: {s.maxDifficulty}</label>
            <input id="diff" type="range" min={1} max={5} value={s.maxDifficulty} onChange={(e) => set('maxDifficulty', Number(e.target.value))} className="w-full accent-[#FF7900]" />
            <div className="flex justify-between text-[10px] text-neutral-600"><span>Beginner</span><span>Advanced</span></div>
          </div>
          <div>
            <label className="label" htmlFor="limit">Results: {s.limit}</label>
            <input id="limit" type="range" min={5} max={10} value={s.limit} onChange={(e) => set('limit', Number(e.target.value))} className="w-full accent-[#FF7900]" />
          </div>
          <div>
            <div className="label">Voicing families {s.families.length ? `(${s.families.length})` : '(all)'}</div>
            <div className="flex flex-wrap gap-1">
              {FAMILIES.map((f) => {
                const on = s.families.includes(f);
                return <button key={f} className={`chip ${on ? 'chip-on' : ''}`} aria-pressed={on} onClick={() => set('families', on ? s.families.filter((x) => x !== f) : [...s.families, f])}>{FAMILY_LABELS[f]}</button>;
              })}
            </div>
            {s.families.length > 0 && <button className="mt-1.5 text-[11px] text-accent underline" onClick={() => set('families', [])}>Show all families</button>}
          </div>
          <label className="flex items-start gap-2 text-xs text-neutral-300">
            <input type="checkbox" className="mt-0.5 accent-[#FF7900]" checked={s.allowEnriched} onChange={(e) => set('allowEnriched', e.target.checked)} />
            <span>Allow added tensions <span className="text-neutral-500">(e.g. a 9th on a plain m7)</span></span>
          </label>
          <label className="flex items-start gap-2 text-xs text-neutral-300">
            <input type="checkbox" className="mt-0.5 accent-[#FF7900]" checked={s.allowLowClusters} onChange={(e) => set('allowLowClusters', e.target.checked)} />
            <span>Allow low-register clusters <span className="text-neutral-500">(normally rejected as muddy)</span></span>
          </label>
        </div>

        {saved.length > 0 && (
          <div className="card p-4">
            <div className="label">Saved voicings ({saved.length})</div>
            <ul className="space-y-1.5 text-xs">
              {saved.map((x, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <button className="min-w-0 text-left hover:text-accent" onClick={() => { set('style', x.style); set('mode', x.mode); submit(x.chord); }}>
                    <span className="font-semibold">{x.chord}</span> <span className="text-neutral-500">· {x.name}</span>
                    <div className="truncate font-mono text-[10px] text-neutral-500">{x.notes}</div>
                  </button>
                  <button className="text-neutral-500 hover:text-rose-400" aria-label="Remove saved voicing" onClick={() => setSaved(saved.filter((_, j) => j !== i))}>✕</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      {/* ---------------- results */}
      <section className="min-w-0 space-y-4">
        {parsed.chord && <ChordExplorer chord={parsed.chord} />}
        <Legend />
        {compared.length === 2 && <VoicingComparison a={compared[0]} b={compared[1]} onClose={() => setCompare([])} />}
        {selected && <VoicingDetail key={selected.id} v={selected} options={options} />}
        {parsed.chord && results.length === 0 && (
          <div className="card p-4 text-sm text-neutral-300">
            No voicing in the library satisfies all constraints. Try raising the difficulty, widening the hand span, choosing a larger keyboard, clearing the family filter, or switching between solo and band mode.
          </div>
        )}
        {results.length > 0 && (
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-neutral-300">Best {results.length} voicings for {parsed.chord?.symbol} · {STYLE_LABELS[s.style]} · {s.mode === 'solo' ? 'solo piano' : 'with bassist'}</h2>
              <span className="text-[11px] text-neutral-500">Pick two to compare</span>
            </div>
            <div className="grid gap-2 xl:grid-cols-2">
              {results.map((v, i) => (
                <VoicingCard key={v.id} v={v} rank={i + 1} selected={selected?.id === v.id} compared={compare.includes(v.id)} saved={isSaved(v)}
                  compareDisabled={compare.length >= 2}
                  onSelect={() => setSelectedId(v.id)} onPlay={() => playChord(v.notes.map((n) => n.midi))}
                  onToggleCompare={() => setCompare((c) => (c.includes(v.id) ? c.filter((x) => x !== v.id) : [...c, v.id].slice(-2)))}
                  onToggleSave={() => toggleSave(v)} />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
