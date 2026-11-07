import { CIRCLE_OF_FIFTHS } from '../music-theory/harmony';
import { formatNote } from '../music-theory/note-parser';
import type { KeyStat } from '../practice/progress';

interface Props {
  selected: number;
  onSelect: (pc: number) => void;
  stats?: KeyStat[];
  size?: number;
}

/** Accuracy colour: grey when unpractised, red → amber → green. */
export function accuracyColor(acc: number | null): string {
  if (acc === null) return '#2a2a30';
  const hue = Math.round(Math.max(0, Math.min(1, (acc - 0.4) / 0.55)) * 130);
  return `hsl(${hue} 65% 38%)`;
}

export function CircleOfFifths({ selected, onSelect, stats, size = 340 }: Props) {
  const c = size / 2, rOuter = size / 2 - 6, rMid = rOuter * 0.66, rInner = rOuter * 0.36;
  const arc = (r1: number, r2: number, i: number) => {
    const a0 = ((i - 0.5) * 30 - 90) * (Math.PI / 180), a1 = ((i + 0.5) * 30 - 90) * (Math.PI / 180);
    const p = (r: number, a: number) => `${c + r * Math.cos(a)} ${c + r * Math.sin(a)}`;
    return `M ${p(r2, a0)} A ${r2} ${r2} 0 0 1 ${p(r2, a1)} L ${p(r1, a1)} A ${r1} ${r1} 0 0 0 ${p(r1, a0)} Z`;
  };
  const pos = (r: number, i: number) => {
    const a = (i * 30 - 90) * (Math.PI / 180);
    return { x: c + r * Math.cos(a), y: c + r * Math.sin(a) };
  };
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto block w-full max-w-[360px]" role="group" aria-label="Circle of fifths: choose a key">
      {CIRCLE_OF_FIFTHS.map((k) => {
        const st = stats?.[k.pc];
        const isSel = k.pc === selected;
        const o = pos((rOuter + rMid) / 2, k.index), m = pos((rMid + rInner) / 2, k.index);
        const sig = k.signature === 0 ? '' : `${Math.abs(k.signature)}${k.signature > 0 ? '♯' : '♭'}`;
        return (
          <g key={k.pc} onClick={() => onSelect(k.pc)} style={{ cursor: 'pointer' }} role="button" tabIndex={0} aria-pressed={isSel}
            aria-label={`${k.name} major${st?.accuracy != null ? `, ${Math.round(st.accuracy * 100)} % accuracy` : ''}`}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(k.pc); } }}>
            <path d={arc(rMid, rOuter, k.index)} fill={isSel ? '#FF7900' : accuracyColor(st?.accuracy ?? null)} stroke="#0b0b0c" strokeWidth={2} />
            <path d={arc(rInner, rMid, k.index)} fill={isSel ? '#7a3a00' : '#17171a'} stroke="#0b0b0c" strokeWidth={2} />
            <text x={o.x} y={o.y - 1} textAnchor="middle" fontSize={16} fontWeight={800} fill={isSel ? '#000' : '#fff'}>{k.name}</text>
            <text x={o.x} y={o.y + 12} textAnchor="middle" fontSize={8.5} fill={isSel ? '#000' : '#d4d4d8'}>{k.altName ? `${k.altName} · ` : ''}{sig}</text>
            <text x={m.x} y={m.y + 4} textAnchor="middle" fontSize={11} fill={isSel ? '#fff' : '#a1a1aa'}>{formatNote(k.relativeMinor)}m</text>
            <title>{`${k.name} major / ${formatNote(k.relativeMinor)} minor · ${sig || 'no accidentals'}${st?.n ? ` · ${st.n} answers, ${Math.round((st.accuracy ?? 0) * 100)} % correct` : ' · not practised yet'}`}</title>
          </g>
        );
      })}
      <circle cx={c} cy={c} r={rInner - 2} fill="#0b0b0c" />
      <text x={c} y={c - 4} textAnchor="middle" fontSize={11} fill="#8a8a92">clockwise</text>
      <text x={c} y={c + 10} textAnchor="middle" fontSize={11} fill="#8a8a92">+1 sharp</text>
    </svg>
  );
}
