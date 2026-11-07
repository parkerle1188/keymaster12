import type { GeneratedVoicing } from '../voicing-engine/voicing-types';
import { FAMILY_LABELS } from '../voicing-engine/voicing-types';
import { PianoKeyboard, windowFor } from './PianoKeyboard';
import { playChord } from '../audio/piano-audio';
import { mod12 } from '../music-theory/note-parser';

export function VoicingComparison({ a, b, onClose }: { a: GeneratedVoicing; b: GeneratedVoicing; onClose: () => void }) {
  const all = [...a.notes, ...b.notes].map((n) => n.midi);
  const [lo, hi] = windowFor(all, 3);
  const labelsA = new Set(a.notes.map((n) => n.label));
  const labelsB = new Set(b.notes.map((n) => n.label));
  const shared = [...labelsA].filter((l) => labelsB.has(l));
  const onlyA = [...labelsA].filter((l) => !labelsB.has(l));
  const onlyB = [...labelsB].filter((l) => !labelsA.has(l));
  const commonKeys = a.notes.filter((n) => b.notes.some((m) => m.midi === n.midi)).map((n) => n.name);
  const stat = (v: GeneratedVoicing) => {
    const m = v.notes.map((n) => n.midi).sort((x, y) => x - y);
    const top = v.notes.reduce((p, c) => (c.midi > p.midi ? c : p));
    return { low: v.notes.find((n) => n.midi === m[0])!.name, top: `${top.name} (${top.label})`, range: m[m.length - 1] - m[0] };
  };
  const sa = stat(a), sb = stat(b);
  const pcs = (v: GeneratedVoicing) => new Set(v.notes.map((n) => mod12(n.midi)));
  const samePcs = [...pcs(a)].every((p) => pcs(b).has(p)) && pcs(a).size === pcs(b).size;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">Compare voicings</h3>
        <button className="btn py-1 text-xs" onClick={onClose}>Close</button>
      </div>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {[a, b].map((v, i) => (
          <div key={v.id}>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="min-w-0"><span className="text-xs text-neutral-500">{i === 0 ? 'A' : 'B'} · </span><span className="text-sm font-semibold">{v.template.name}</span></div>
              <button className="btn py-0.5 text-xs" onClick={() => playChord(v.notes.map((n) => n.midi))}>▶</button>
            </div>
            <PianoKeyboard low={lo} high={hi} highlights={v.notes.map((n) => ({ midi: n.midi, role: n.role, hand: n.hand, label: n.label, name: n.name }))} minWhiteWidth={12} showNoteNames={false} />
          </div>
        ))}
      </div>
      <table className="mt-3 w-full text-left text-xs">
        <thead className="text-neutral-500"><tr><th className="py-1 font-medium">&nbsp;</th><th className="font-medium">A</th><th className="font-medium">B</th></tr></thead>
        <tbody className="text-neutral-300 [&_td]:py-1 [&_tr]:border-t [&_tr]:border-ink-700">
          <tr><td className="text-neutral-500">Family</td><td>{FAMILY_LABELS[a.template.family]}</td><td>{FAMILY_LABELS[b.template.family]}</td></tr>
          <tr><td className="text-neutral-500">Tones</td><td className="font-mono">{a.notes.map((n) => n.label).join(' ')}</td><td className="font-mono">{b.notes.map((n) => n.label).join(' ')}</td></tr>
          <tr><td className="text-neutral-500">Lowest / top</td><td>{sa.low} / {sa.top}</td><td>{sb.low} / {sb.top}</td></tr>
          <tr><td className="text-neutral-500">Total range</td><td>{sa.range} st</td><td>{sb.range} st</td></tr>
          <tr><td className="text-neutral-500">Difficulty · score</td><td>{a.template.difficulty} · {a.score.total}</td><td>{b.template.difficulty} · {b.score.total}</td></tr>
        </tbody>
      </table>
      <p className="mt-2 text-xs text-neutral-400">
        Shared degrees: <span className="font-mono">{shared.join(' ') || '—'}</span>. Only in A: <span className="font-mono">{onlyA.join(' ') || '—'}</span>. Only in B: <span className="font-mono">{onlyB.join(' ') || '—'}</span>.
        {' '}{commonKeys.length ? `Common keys: ${commonKeys.join(', ')}.` : 'No keys in common.'}
        {samePcs ? ' Same pitch classes — the difference is purely spacing/register.' : ''}
      </p>
    </div>
  );
}
