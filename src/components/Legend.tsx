import { LEGEND_ORDER, ROLE_COLORS } from './theme';

export function Legend({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 ${compact ? 'text-[11px]' : 'text-xs'} text-neutral-400`}>
      {LEGEND_ORDER.map((r) => (
        <span key={r} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: ROLE_COLORS[r].fill }} />
          {ROLE_COLORS[r].name}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-neutral-500 bg-[#111] text-[9px] font-bold text-white">L</span>Left hand
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-neutral-500 bg-neutral-100 text-[9px] font-bold text-black">R</span>Right hand
      </span>
    </div>
  );
}
