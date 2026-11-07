import { useMemo, useState } from 'react';
import type { GeneratedVoicing, GenerationOptions } from '../voicing-engine/voicing-types';
import { FAMILY_LABELS } from '../voicing-engine/voicing-types';
import { templateInAllKeys, type KeyOrder } from '../voicing-engine/twelve-keys';
import { PianoKeyboard, windowFor } from './PianoKeyboard';
import { playChord } from '../audio/piano-audio';

export function VoicingDetail({ v, options }: { v: GeneratedVoicing; options: GenerationOptions }) {
  const [showKeys, setShowKeys] = useState(false);
  const [order, setOrder] = useState<KeyOrder>('fourths');
  const [preview, setPreview] = useState<GeneratedVoicing | null>(null);
  const shown = preview ?? v;
  const midis = shown.notes.map((n) => n.midi);
  const [lo, hi] = windowFor(midis, 3, options.range);
  const keys = useMemo(() => (showKeys ? templateInAllKeys(v.template, options, order) : []), [showKeys, v.template, options, order]);
  const t = v.template;

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs text-neutral-500">{preview ? `Previewing in ${preview.chord.symbol}` : 'Selected voicing'}</div>
          <div className="text-lg font-semibold text-white">{shown.chord.symbol} — {t.name}</div>
        </div>
        <div className="flex gap-1.5">
          <button className="btn btn-accent" onClick={() => playChord(midis)}>▶ Block</button>
          <button className="btn" onClick={() => playChord(midis, { arpeggio: true, duration: 2.4 })}>Arpeggio</button>
          {preview && <button className="btn" onClick={() => setPreview(null)}>Back to {v.chord.symbol}</button>}
        </div>
      </div>
      <div className="mt-3">
        <PianoKeyboard low={lo} high={hi} highlights={shown.notes.map((n) => ({ midi: n.midi, role: n.role, hand: n.hand, label: n.label, name: n.name }))} minWhiteWidth={22} ariaLabel={`${shown.chord.symbol} voicing`} />
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_220px]">
        <div className="space-y-1.5 text-sm text-neutral-300">
          {shown.explanation.map((line, i) => <p key={i} className={i === shown.explanation.length - 1 ? 'text-neutral-400' : ''}>{line}</p>)}
          {shown.issues.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-amber-300">
              {shown.issues.map((iss, i) => <li key={i}>⚠ {iss.message}</li>)}
            </ul>
          )}
        </div>
        <div className="space-y-1">
          <div className="label">Score breakdown</div>
          {shown.score.components.map((c) => (
            <div key={c.key} className="text-[11px]">
              <div className="flex justify-between text-neutral-400"><span>{c.label}</span><span>{Math.round((1 - c.cost) * 100)}</span></div>
              <div className="h-1 rounded bg-ink-700"><div className="h-1 rounded bg-accent" style={{ width: `${(1 - c.cost) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
        <div><dt className="label">Family</dt><dd>{FAMILY_LABELS[t.family]}</dd></div>
        <div><dt className="label">Template tones</dt><dd className="font-mono">{t.labels.join(' ')}</dd></div>
        <div><dt className="label">Required</dt><dd className="font-mono">{t.requiredTones.join(' ') || '—'}</dd></div>
        <div><dt className="label">Optional / omitted</dt><dd className="font-mono">{t.optionalTones.join(' ') || '—'} / {t.omittedTones.join(' ') || '—'}</dd></div>
        <div><dt className="label">Bass</dt><dd>{t.bassRequirement === 'root-included' ? 'Root in voicing' : t.bassRequirement === 'external-bass' ? 'Root from bass / LH' : 'Bassist required'}</dd></div>
        <div><dt className="label">Max hand span</dt><dd>{t.maxHandSpan} semitones</dd></div>
        <div><dt className="label">Register</dt><dd>{t.register.description}</dd></div>
        <div><dt className="label">Review status</dt><dd title={t.review.note}>Curated, not yet externally reviewed</dd></div>
      </dl>

      <div className="mt-4 border-t border-ink-700 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn" onClick={() => setShowKeys((s) => !s)} aria-expanded={showKeys}>{showKeys ? 'Hide' : 'Show'} this shape in all 12 keys</button>
          {showKeys && (
            <div className="seg w-64" role="group" aria-label="Key order">
              {(['fourths', 'fifths', 'chromatic'] as KeyOrder[]).map((o) => (
                <button key={o} aria-pressed={order === o} onClick={() => setOrder(o)}>{o === 'fourths' ? 'Cycle of 4ths' : o === 'fifths' ? 'Cycle of 5ths' : 'Chromatic'}</button>
              ))}
            </div>
          )}
        </div>
        {showKeys && (
          <div className="mt-3 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {keys.map((k) => (
              <div key={k.rootPc} className="flex items-center justify-between gap-2 rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-1.5">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-neutral-100">{k.symbol}</div>
                  <div className="truncate font-mono text-[11px] text-neutral-400">{k.voicing ? k.voicing.notes.map((n) => n.name).join(' ') : k.reason}</div>
                </div>
                {k.voicing && (
                  <div className="flex shrink-0 gap-1">
                    <button className="btn px-2 py-0.5 text-xs" onClick={() => { setPreview(k.voicing!); }}>View</button>
                    <button className="btn px-2 py-0.5 text-xs" onClick={() => playChord(k.voicing!.notes.map((n) => n.midi))} aria-label={`Play ${k.symbol}`}>▶</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
