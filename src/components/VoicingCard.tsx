import type { GeneratedVoicing } from '../voicing-engine/voicing-types';
import { FAMILY_LABELS, STYLE_LABELS } from '../voicing-engine/voicing-types';
import { ROLE_COLORS } from './theme';

interface Props {
  v: GeneratedVoicing;
  rank: number;
  selected: boolean;
  compared: boolean;
  saved: boolean;
  onSelect: () => void;
  onPlay: () => void;
  onToggleCompare: () => void;
  onToggleSave: () => void;
  compareDisabled: boolean;
}

export function VoicingCard({ v, rank, selected, compared, saved, onSelect, onPlay, onToggleCompare, onToggleSave, compareDisabled }: Props) {
  return (
    <div className={`card cursor-pointer p-3 transition ${selected ? 'border-accent ring-1 ring-accent' : 'hover:border-ink-600'}`} onClick={onSelect} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }} aria-pressed={selected}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-500">#{rank}</span>
            <span className="truncate font-semibold text-neutral-100">{v.template.name}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap gap-1 text-[10px]">
            <span className="rounded bg-ink-700 px-1.5 py-0.5 text-neutral-300">{FAMILY_LABELS[v.template.family]}</span>
            <span className="rounded bg-ink-700 px-1.5 py-0.5 text-neutral-400">Level {v.template.difficulty}</span>
            {v.matchType === 'enriched' && <span className="rounded bg-emerald-900/50 px-1.5 py-0.5 text-emerald-300">+{v.addedTensions.join(', ')}</span>}
            {v.template.styles.slice(0, 3).map((s) => <span key={s} className="rounded px-1 py-0.5 text-neutral-500">{STYLE_LABELS[s]}</span>)}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-bold text-accent">{v.score.total}</div>
          <div className="text-[10px] text-neutral-500">score</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {v.notes.map((n) => (
          <span key={n.midi} className="rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold text-black" style={{ background: ROLE_COLORS[n.role].fill }} title={`${n.label} · ${n.hand === 'L' ? 'left' : 'right'} hand`}>
            {n.name}<span className="ml-1 opacity-60">{n.hand}</span>
          </span>
        ))}
        {v.bassNote?.playedBy === 'bassist' && <span className="rounded border border-dashed border-ink-600 px-1.5 py-0.5 font-mono text-[11px] text-neutral-400">bass: {v.bassNote.name}</span>}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
        <button className="btn py-1 text-xs" onClick={onPlay} aria-label={`Play ${v.template.name}`}>▶ Play</button>
        <button className={`btn py-1 text-xs ${compared ? 'border-accent text-accent' : ''}`} onClick={onToggleCompare} disabled={compareDisabled && !compared} aria-pressed={compared}>
          {compared ? '✓ Comparing' : 'Compare'}
        </button>
        <button className={`btn py-1 text-xs ${saved ? 'border-accent text-accent' : ''}`} onClick={onToggleSave} aria-pressed={saved}>{saved ? '★ Saved' : '☆ Save'}</button>
      </div>
    </div>
  );
}
