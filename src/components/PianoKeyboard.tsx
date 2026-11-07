import { useMemo, useRef, useState } from 'react';
import { isBlackKey, midiToName } from '../music-theory/midi-notes';
import { mod12 } from '../music-theory/note-parser';
import { ROLE_COLORS, type DisplayRole } from './theme';

export interface KeyHighlight {
  midi: number;
  role: DisplayRole;
  hand?: 'L' | 'R';
  label?: string;
  name?: string;
}

interface Props {
  low: number;
  high: number;
  highlights?: KeyHighlight[];
  onNoteOn?: (midi: number) => void;
  onNoteOff?: (midi: number) => void;
  /** Minimum rendered width per white key, in px (keyboard scrolls horizontally if needed). */
  minWhiteWidth?: number;
  showNoteNames?: boolean;
  ariaLabel?: string;
  /** Notes of a previous chord, drawn as rings so movement into the highlighted chord is visible. */
  ghosts?: number[];
}

/** Black-key centre offset from the boundary between neighbouring white keys, in white-key widths (real keyboards are asymmetric). */
const BLACK_SHIFT: Record<number, number> = { 1: -0.1, 3: 0.1, 6: -0.12, 8: 0, 10: 0.12 };

const W = 24;
const H = 120;
const BW = 14;
const BH = 76;

export function PianoKeyboard({ low, high, highlights = [], onNoteOn, onNoteOff, minWhiteWidth = 16, showNoteNames = true, ariaLabel, ghosts = [] }: Props) {
  const lo = isBlackKey(low) ? low - 1 : low;
  const hi = isBlackKey(high) ? high + 1 : high;
  const [pressed, setPressed] = useState<Set<number>>(new Set());
  const active = useRef<number | null>(null);

  const { whites, blacks } = useMemo(() => {
    const whites: { midi: number; x: number }[] = [];
    const blacks: { midi: number; x: number }[] = [];
    let i = 0;
    for (let m = lo; m <= hi; m++) {
      if (!isBlackKey(m)) { whites.push({ midi: m, x: i * W }); i++; }
      else blacks.push({ midi: m, x: i * W + BLACK_SHIFT[mod12(m)] * W - BW / 2 });
    }
    return { whites, blacks };
  }, [lo, hi]);

  const hl = useMemo(() => new Map(highlights.map((h) => [h.midi, h])), [highlights]);
  const ghostSet = useMemo(() => new Set(ghosts), [ghosts]);
  const ghostRing = (cx: number, y: number, onBlack: boolean) => (
    <circle cx={cx} cy={y} r={5} fill="none" stroke={onBlack ? '#f5f5f5' : '#111'} strokeWidth={1.6} strokeDasharray="2.2 1.6" pointerEvents="none" />
  );
  const width = whites.length * W;
  const interactive = !!onNoteOn;

  const down = (m: number) => {
    if (!interactive) return;
    active.current = m;
    setPressed((p) => new Set(p).add(m));
    onNoteOn?.(m);
  };
  const up = (m: number) => {
    if (!interactive) return;
    if (active.current === m) active.current = null;
    setPressed((p) => { const n = new Set(p); n.delete(m); return n; });
    onNoteOff?.(m);
  };
  const handlers = (m: number) => interactive ? {
    onPointerDown: (e: React.PointerEvent) => { (e.target as Element).releasePointerCapture?.(e.pointerId); down(m); },
    onPointerUp: () => up(m),
    onPointerLeave: () => { if (pressed.has(m)) up(m); },
    onPointerEnter: (e: React.PointerEvent) => { if (e.buttons === 1 && active.current !== null) down(m); },
  } : {};

  const badge = (h: KeyHighlight, cx: number, y: number) => (
    <g pointerEvents="none">
      <circle cx={cx} cy={y} r={7.2} fill={h.hand === 'L' ? '#111' : '#f5f5f5'} stroke={ROLE_COLORS[h.role].fill} strokeWidth={2} />
      <text x={cx} y={y + 3} textAnchor="middle" fontSize={8.5} fontWeight={700} fill={h.hand === 'L' ? '#fff' : '#000'}>{h.hand ?? ''}</text>
    </g>
  );

  return (
    <div className="scrollbar-thin overflow-x-auto rounded-lg border border-ink-700 bg-black/60 p-1.5" role="group" aria-label={ariaLabel ?? 'Piano keyboard'}>
      <svg viewBox={`0 0 ${width} ${H + 16}`} style={{ minWidth: whites.length * minWhiteWidth, width: '100%', display: 'block', touchAction: interactive ? 'none' : 'auto' }}>
        {whites.map(({ midi, x }) => {
          const h = hl.get(midi);
          const isPressed = pressed.has(midi);
          const fill = h ? ROLE_COLORS[h.role].fill : isPressed ? '#ffd2a8' : '#f4f4f2';
          return (
            <g key={midi} {...handlers(midi)} style={{ cursor: interactive ? 'pointer' : 'default' }}>
              <rect x={x + 0.5} y={0} width={W - 1} height={H} rx={3} fill={fill} stroke="#1a1a1a" strokeWidth={1} />
              <title>{h?.name ?? midiToName(midi)}{h?.label ? ` · ${h.label}` : ''}{h?.hand ? ` · ${h.hand === 'L' ? 'left' : 'right'} hand` : ''}{ghostSet.has(midi) ? ' · in previous chord' : ''}</title>
              {h && showNoteNames && (
                <text x={x + W / 2} y={H - 30} textAnchor="middle" fontSize={8} fontWeight={700} fill="#000" pointerEvents="none">{h.label}</text>
              )}
              {h && showNoteNames && h.name && (
                <text x={x + W / 2} y={H - 20} textAnchor="middle" fontSize={7} fill="#000" pointerEvents="none">{h.name.replace(/-?\d+$/, '')}</text>
              )}
              {h?.hand && badge(h, x + W / 2, H - 9)}
              {ghostSet.has(midi) && ghostRing(x + W / 2, 12, false)}
              {mod12(midi) === 0 && (
                <text x={x + W / 2} y={H + 12} textAnchor="middle" fontSize={8} fill="#8a8a92" pointerEvents="none">C{Math.floor(midi / 12) - 1}</text>
              )}
            </g>
          );
        })}
        {blacks.map(({ midi, x }) => {
          const h = hl.get(midi);
          const isPressed = pressed.has(midi);
          const fill = h ? ROLE_COLORS[h.role].fill : isPressed ? '#7a3a00' : '#141416';
          return (
            <g key={midi} {...handlers(midi)} style={{ cursor: interactive ? 'pointer' : 'default' }}>
              <rect x={x} y={0} width={BW} height={BH} rx={2} fill={fill} stroke="#000" strokeWidth={1} />
              <title>{h?.name ?? midiToName(midi)}{h?.label ? ` · ${h.label}` : ''}{h?.hand ? ` · ${h.hand === 'L' ? 'left' : 'right'} hand` : ''}{ghostSet.has(midi) ? ' · in previous chord' : ''}</title>
              {h && showNoteNames && (
                <text x={x + BW / 2} y={BH - 28} textAnchor="middle" fontSize={7} fontWeight={700} fill="#000" pointerEvents="none">{h.label}</text>
              )}
              {h?.hand && badge(h, x + BW / 2, BH - 10)}
              {ghostSet.has(midi) && ghostRing(x + BW / 2, 10, !h)}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Pick a display window around a set of notes: whole octaves, at least `minOctaves` wide. */
export function windowFor(midis: number[], minOctaves = 3, bounds: [number, number] = [21, 108]): [number, number] {
  if (midis.length === 0) return [48, 84];
  let lo = Math.floor(Math.min(...midis) / 12) * 12;
  let hi = Math.ceil((Math.max(...midis) + 1) / 12) * 12 - 1;
  while ((hi - lo + 1) / 12 < minOctaves) { if (lo - 12 >= bounds[0] - 12) lo -= 12; if ((hi - lo + 1) / 12 < minOctaves) hi += 12; }
  return [Math.max(bounds[0], lo), Math.min(bounds[1], hi)];
}
