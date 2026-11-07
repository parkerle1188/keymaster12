import type { ParsedChord } from '../music-theory/chord-parser';
import { formatNote } from '../music-theory/note-parser';
import { spellInterval } from '../music-theory/enharmonic-spelling';
import { ROLE_COLORS } from './theme';
import { roleOfLabel } from '../music-theory/intervals';

/** Breakdown of what a chord symbol implies — separate from any particular voicing. */
export function ChordExplorer({ chord }: { chord: ParsedChord }) {
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-2xl font-bold text-white">{chord.symbol}</div>
          <div className="text-sm text-neutral-400">{chord.qualityName} · {chord.family.replace('-', ' ')}</div>
        </div>
        {chord.bass && (
          <div className="rounded-md border border-ink-600 px-2 py-1 text-xs text-neutral-300">
            Bass: <span className="font-semibold text-white">{formatNote(chord.bass)}</span>{' '}
            {chord.bassIsChordTone ? `(the chord's ${chord.bassLabel})` : '(not a chord tone)'}
          </div>
        )}
      </div>
      <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Tones implied by the symbol</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {chord.tones.map((t) => (
          <div key={t.label} title={t.note} className={`rounded-lg border px-2.5 py-1.5 text-center ${t.required ? 'border-ink-600 bg-ink-800' : 'border-dashed border-ink-600'}`}>
            <div className="text-base font-bold" style={{ color: ROLE_COLORS[t.role].fill }}>{formatNote(t.spelled)}</div>
            <div className="text-[10px] text-neutral-400">{t.label} · {t.required ? 'essential' : 'optional'}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-2 text-xs text-neutral-400 sm:grid-cols-2">
        <div>
          <span className="text-neutral-500">Available tensions (may be added):</span>{' '}
          {chord.availableTensions.length ? chord.availableTensions.map((l) => (
            <span key={l} className="mr-1.5 whitespace-nowrap" style={{ color: ROLE_COLORS[roleOfLabel(l)].fill }}>{l}={formatNote(spellInterval(chord.root, l))}</span>
          )) : <span>none</span>}
        </div>
        <div>
          <span className="text-neutral-500">Omitted by convention:</span>{' '}
          {chord.omissions.length ? chord.omissions.map((o) => (
            <span key={o} className="mr-1.5">{o}{o === '3' && chord.quality.startsWith('11') ? ' (clashes with the 11th)' : o === '11' ? ' (natural 11 clashes with the major 3rd)' : o === '5' && chord.isAltered ? ' (altered 5ths replace it)' : ''}</span>
          )) : 'none'}
        </div>
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        Essential tones must appear in a voicing (the root may come from the bass). Optional tones are commonly left out to keep voicings clear.
      </p>
    </div>
  );
}
