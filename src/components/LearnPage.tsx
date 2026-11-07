import { useMemo, useState } from 'react';
import { VOICING_LIBRARY, FAMILY_DESCRIPTIONS } from '../voicing-engine/voicing-library';
import { FAMILY_LABELS, type VoicingFamily } from '../voicing-engine/voicing-types';
import { templateInAllKeys } from '../voicing-engine/twelve-keys';
import { PianoKeyboard, windowFor } from './PianoKeyboard';
import { Legend } from './Legend';
import { playChord, noteOn, noteOff } from '../audio/piano-audio';
import { midiToName } from '../music-theory/midi-notes';
import type { Tab } from '../App';

const LESSON_EXAMPLES: Record<VoicingFamily, string> = {
  'triad-inversion': 'tri-maj-inv1', 'seventh-inversion': 'sev-m7-inv0', shell: 'shell-7-r37', 'rootless-a': 'rl-a-m9', 'rootless-b': 'rl-b-13',
  open: 'open-maj9-b', 'drop-2': 'd2-maj7-0', quartal: 'q-m11-sowhat', 'upper-structure': 'us-II-solo', 'rnb-color': 'rnb-m11-cluster',
};
const FAMILY_ORDER = Object.keys(LESSON_EXAMPLES) as VoicingFamily[];

function FamilyLesson({ family }: { family: VoicingFamily }) {
  const templates = VOICING_LIBRARY.filter((t) => t.family === family);
  const [tid, setTid] = useState(LESSON_EXAMPLES[family]);
  const [keyIdx, setKeyIdx] = useState(0);
  const template = templates.find((t) => t.id === tid) ?? templates[0];
  const keys = useMemo(() => templateInAllKeys(template, { mode: template.bassRequirement === 'bassist-required' ? 'band' : 'solo', maxHandSpan: 16, style: template.styles[0] }, 'fourths'), [template]);
  const k = keys[keyIdx % 12];
  const v = k.voicing;
  const [lo, hi] = windowFor(v ? v.notes.map((n) => n.midi) : [60], 3);

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h3 className="text-lg font-semibold text-white">{FAMILY_LABELS[family]} <span className="text-xs font-normal text-neutral-500">· {templates.length} templates</span></h3>
          <p className="mt-1 text-sm text-neutral-400">{FAMILY_DESCRIPTIONS[family]}</p>
        </div>
        <select className="select w-auto max-w-xs" value={template.id} onChange={(e) => { setTid(e.target.value); setKeyIdx(0); }} aria-label={`${FAMILY_LABELS[family]} example`}>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="btn" onClick={() => setKeyIdx((i) => (i + 11) % 12)} aria-label="Previous key">◀</button>
        <div className="min-w-[90px] text-center text-lg font-bold text-accent">{k.symbol}</div>
        <button className="btn" onClick={() => setKeyIdx((i) => (i + 1) % 12)} aria-label="Next key (cycle of 4ths)">▶</button>
        <span className="text-xs text-neutral-500">Key {keyIdx % 12 + 1}/12 · cycle of 4ths</span>
        {v && <button className="btn btn-accent ml-auto" onClick={() => playChord(v.notes.map((n) => n.midi))}>▶ Play</button>}
      </div>
      <div className="mt-3">
        {v ? <PianoKeyboard low={lo} high={hi} highlights={v.notes.map((n) => ({ midi: n.midi, role: n.role, hand: n.hand, label: n.label, name: n.name }))} minWhiteWidth={18} />
          : <p className="text-sm text-neutral-400">{k.reason}</p>}
      </div>
      {v && <p className="mt-2 text-sm text-neutral-300">{v.explanation[0]} {v.explanation.slice(1, -1).join(' ')}</p>}
      <p className="mt-1 text-xs text-neutral-500">{template.explanation.split('. ')[0]}.</p>
    </div>
  );
}

function FreePlay() {
  const [held, setHeld] = useState<number[]>([]);
  return (
    <div className="card p-4">
      <h3 className="text-lg font-semibold text-white">Free play</h3>
      <p className="mt-1 text-sm text-neutral-400">Click or touch the keys (drag across for glissandi). Octave labels mark every C; middle C is C4.</p>
      <div className="mt-3">
        <PianoKeyboard low={48} high={84} minWhiteWidth={26}
          highlights={held.map((m) => ({ midi: m, role: 'root' as const }))}
          onNoteOn={(m) => { noteOn(m); setHeld((h) => [...new Set([...h, m])]); }}
          onNoteOff={(m) => { noteOff(m); setHeld((h) => h.filter((x) => x !== m)); }} showNoteNames={false} ariaLabel="Playable piano keyboard" />
      </div>
      <div className="mt-2 h-5 font-mono text-sm text-accent" aria-live="polite">{held.sort((a, b) => a - b).map((m) => midiToName(m)).join(' ')}</div>
    </div>
  );
}

export function LearnPage({ onOpenExplorer, onOpenTab }: { onOpenExplorer: (chord: string) => void; onOpenTab: (t: Tab) => void }) {
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h2 className="text-xl font-bold text-white">How KEYMASTER 12 thinks about chords</h2>
        <ol className="mt-3 grid gap-3 text-sm text-neutral-300 md:grid-cols-3">
          <li className="rounded-lg bg-ink-850 p-3"><span className="font-semibold text-accent">1 · Symbol</span><br />“Dm9” means a root, quality and extensions. The parser spells each tone by function: F#maj7 has <b>E#</b>, C7b9 has <b>Db</b>.</li>
          <li className="rounded-lg bg-ink-850 p-3"><span className="font-semibold text-accent">2 · Implied tones</span><br />Every tone the symbol implies is marked essential or optional. Guide tones (3rd, 7th) are essential; the 5th and the root are often left out.</li>
          <li className="rounded-lg bg-ink-850 p-3"><span className="font-semibold text-accent">3 · Voicing</span><br />A voicing is a practical <i>selection and arrangement</i> of those tones for two hands, in a register that sounds clear, in a given style.</li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          {['Dm9', 'G13', 'Cmaj9', 'F#maj7', 'C7b9'].map((c) => <button key={c} className="btn font-mono" onClick={() => onOpenExplorer(c)}>Explore {c} →</button>)}
        </div>
        <div className="mt-4"><Legend /></div>
      </div>
      <Guide onOpenTab={onOpenTab} />
      <FreePlay />
      <h2 className="pt-2 text-lg font-semibold text-neutral-200">Voicing families</h2>
      {FAMILY_ORDER.map((f) => <FamilyLesson key={f} family={f} />)}
    </div>
  );
}

export const GUIDE: { tab: Tab; title: string; text: string }[] = [
  { tab: 'voice-leading', title: 'Voice Leading', text: 'Compare two chords note by note, see the semitones each voice travels, get smoother voicings, and train with the smooth-move exercise.' },
  { tab: 'progressions', title: 'Progressions', text: 'Jazz, pop/ballad and R&B progressions in any key, voiced with the smoothest path, Roman numerals and harmonic functions.' },
  { tab: 'twelve', title: '12 Keys', text: 'Circle of fifths, timed recognition drills for intervals, chord tones and extensions, and transposition through all 12 keys.' },
  { tab: 'workout', title: 'Daily Workout', text: '10-, 20- or 30-minute sessions built from your weak keys and skills, with history saved on this device.' },
];

function Guide({ onOpenTab }: { onOpenTab: (t: Tab) => void }) {
  return (
    <div className="card p-4">
      <h2 className="text-sm font-semibold text-neutral-300">Practise what you learn</h2>
      <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {GUIDE.map((g) => (
          <button key={g.tab} className="rounded-lg border border-ink-700 bg-ink-850 p-3 text-left transition hover:border-accent" onClick={() => onOpenTab(g.tab)}>
            <div className="font-semibold text-accent">{g.title} →</div>
            <div className="mt-1 text-xs text-neutral-400">{g.text}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
