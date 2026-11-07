import type { GeneratedVoicing } from '../voicing-engine/voicing-types';
import type { MotionKind, TransitionAnalysis } from '../voice-leading/voice-leading';
import { ROLE_COLORS } from './theme';

export const MOTION_COLORS: Record<MotionKind, string> = {
  common: '#9CA3AF', step: '#4ADE80', skip: '#FACC15', leap: '#FB7185',
};
export const MOTION_LABELS: Record<MotionKind, string> = {
  common: 'Held (common tone)', step: 'Step (1–2 st)', skip: 'Skip (3–4 st)', leap: 'Leap (5+ st)',
};

interface Props {
  voicings: GeneratedVoicing[];
  transitions: TransitionAnalysis[];
  labels?: string[];
  active?: number;
  onSelect?: (i: number) => void;
}

/** Pitch-vs-time diagram: each chord is a column, each line one voice moving to the next chord. */
export function VoiceLeadingGraph({ voicings, transitions, labels, active = -1, onSelect }: Props) {
  if (voicings.length === 0) return null;
  const all = voicings.flatMap((v) => v.notes.map((n) => n.midi));
  const lo = Math.min(...all) - 1, hi = Math.max(...all) + 1;
  const colW = 120, padX = 46, top = 30, rowH = 9.5;
  const H = top + (hi - lo) * rowH + 14;
  const W = padX * 2 + colW * (voicings.length - 1);
  const x = (i: number) => padX + i * colW;
  const y = (m: number) => top + (hi - m) * rowH;
  return (
    <div className="scrollbar-thin overflow-x-auto rounded-lg border border-ink-700 bg-ink-850 p-2">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: Math.min(W, 160 + voicings.length * 90), width: '100%', maxWidth: W * 1.6, maxHeight: 480, margin: '0 auto', display: 'block' }} role="img"
        aria-label={`Voice-leading diagram: ${voicings.map((v) => v.chord.symbol).join(', ')}`}>
        {/* octave guides at each C */}
        {Array.from({ length: hi - lo + 1 }, (_, k) => lo + k).filter((m) => m % 12 === 0).map((m) => (
          <g key={m}>
            <line x1={8} x2={W - 8} y1={y(m)} y2={y(m)} stroke="#2a2a30" strokeDasharray="3 4" />
            <text x={4} y={y(m) - 2} fontSize={8} fill="#6b6b75">C{m / 12 - 1}</text>
          </g>
        ))}
        {transitions.map((t, i) => t.moves.map((mv, k) => {
          const x1 = x(i) + 16, x2 = x(i + 1) - 16, y1 = y(mv.from.midi), y2 = y(mv.to.midi);
          return (
            <g key={`${i}-${k}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={MOTION_COLORS[mv.kind]} strokeWidth={mv.isBass ? 1.5 : 2.2} strokeDasharray={mv.isBass ? '4 3' : undefined} opacity={mv.isBass ? 0.6 : 0.95} />
              {mv.delta !== 0 && !mv.isBass && (
                <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 3} fontSize={8} textAnchor="middle" fill={MOTION_COLORS[mv.kind]}>{mv.delta > 0 ? `+${mv.delta}` : mv.delta}</text>
              )}
            </g>
          );
        }))}
        {voicings.map((v, i) => (
          <g key={i} onClick={onSelect ? () => onSelect(i) : undefined} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
            {active === i && <rect x={x(i) - 40} y={2} width={80} height={H - 4} rx={8} fill="#FF7900" opacity={0.08} />}
            <text x={x(i)} y={13} textAnchor="middle" fontSize={11} fontWeight={700} fill={active === i ? '#FF7900' : '#e5e5e5'}>{v.chord.symbol}</text>
            {labels?.[i] && <text x={x(i)} y={24} textAnchor="middle" fontSize={8.5} fill="#8a8a92">{labels[i]}</text>}
            {v.notes.map((n) => (
              <g key={n.midi}>
                <circle cx={x(i)} cy={y(n.midi)} r={5} fill={ROLE_COLORS[n.role].fill} stroke="#000" strokeWidth={0.8} />
                <text x={x(i) + 8} y={y(n.midi) + 3} fontSize={8} fill="#d4d4d8">{n.name}</text>
                <title>{`${n.name} · ${n.label}${n.isAddedBass ? ' (bass)' : ''}`}</title>
              </g>
            ))}
          </g>
        ))}
      </svg>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 px-1 text-[11px] text-neutral-400">
        {(Object.keys(MOTION_COLORS) as MotionKind[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-4" style={{ background: MOTION_COLORS[k] }} />{MOTION_LABELS[k]}</span>
        ))}
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-4 border-t border-dashed border-neutral-400" />Bass (follows the roots, not scored)</span>
      </div>
    </div>
  );
}

export function TransitionDetails({ t }: { t: TransitionAnalysis }) {
  return (
    <div className="text-xs">
      <div className="flex flex-wrap gap-1">
        {t.moves.map((mv, i) => (
          <span key={i} className="rounded border px-1.5 py-0.5 font-mono" style={{ borderColor: MOTION_COLORS[mv.kind], color: MOTION_COLORS[mv.kind] }}
            title={`${mv.from.label} → ${mv.to.label}${mv.type !== 'move' ? ` (voice ${mv.type})` : ''}`}>
            {mv.isBass ? 'bass ' : ''}{mv.from.name}→{mv.to.name} {mv.delta === 0 ? '·' : mv.delta > 0 ? `+${mv.delta}` : mv.delta}
          </span>
        ))}
      </div>
      <ul className="mt-2 space-y-0.5 text-neutral-400">
        {t.explanation.map((l, i) => <li key={i}>{l}</li>)}
      </ul>
    </div>
  );
}

export function RatingBadge({ rating }: { rating: TransitionAnalysis['rating'] }) {
  const c = rating === 'very smooth' ? 'bg-emerald-900/50 text-emerald-300' : rating === 'smooth' ? 'bg-lime-900/40 text-lime-300' : rating === 'moderate' ? 'bg-amber-900/40 text-amber-300' : 'bg-rose-900/40 text-rose-300';
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${c}`}>{rating}</span>;
}
