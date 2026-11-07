import { PianoKeyboard, type KeyHighlight } from './PianoKeyboard';
import { noteOn, noteOff } from '../audio/piano-audio';
import { midiToName } from '../music-theory/midi-notes';
import { useMidiInput } from '../state/useMidiInput';

interface Props {
  value: number[];
  onChange: (midis: number[]) => void;
  low?: number;
  high?: number;
  /** Previous-chord notes drawn as rings. */
  ghosts?: number[];
  /** When set (after answering), shown instead of the user's selection. */
  reveal?: KeyHighlight[];
  disabled?: boolean;
  onSubmit?: () => void;
  submitLabel?: string;
}

/** Click keys to toggle notes (or play a chord on a MIDI keyboard), then submit. */
export function NoteEntry({ value, onChange, low = 48, high = 83, ghosts, reveal, disabled, onSubmit, submitLabel = 'Check' }: Props) {
  const midi = useMidiInput((chord) => { if (!disabled) onChange(chord); }, (m, on) => (on ? noteOn(m, 0.7) : noteOff(m)));
  const toggle = (m: number) => {
    if (disabled) return;
    noteOn(m, 0.6);
    setTimeout(() => noteOff(m), 350);
    onChange(value.includes(m) ? value.filter((x) => x !== m) : [...value, m].sort((a, b) => a - b));
  };
  const highlights: KeyHighlight[] = reveal ?? value.map((m) => ({ midi: m, role: 'root' as const, name: midiToName(m) }));
  return (
    <div>
      <PianoKeyboard low={low} high={high} minWhiteWidth={22} highlights={highlights} ghosts={ghosts}
        onNoteOn={disabled ? undefined : toggle} showNoteNames={!!reveal} ariaLabel="Answer keyboard: click keys to select notes" />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="min-h-[1.5rem] flex-1 font-mono text-sm text-accent" aria-live="polite">
          {value.length ? [...value].sort((a, b) => a - b).map((m) => midiToName(m)).join(' ') : <span className="text-neutral-500">Click keys to select notes{midi.status === 'connected' ? ' or play a chord on your MIDI keyboard' : ''}.</span>}
        </div>
        {!disabled && value.length > 0 && <button className="btn py-1 text-xs" onClick={() => onChange([])}>Clear</button>}
        {midi.supported && midi.status !== 'connected' && !disabled && (
          <button className="btn py-1 text-xs" onClick={() => void midi.connect()} title="Use a USB/Bluetooth MIDI keyboard">
            {midi.status === 'denied' ? 'MIDI blocked' : midi.status === 'no-devices' ? 'No MIDI device — retry' : '🎹 Connect MIDI'}
          </button>
        )}
        {midi.status === 'connected' && <span className="text-[11px] text-emerald-400" title={midi.devices.join(', ')}>MIDI: {midi.devices[0]}</span>}
        {onSubmit && !disabled && <button className="btn btn-accent" onClick={onSubmit} disabled={value.length === 0}>{submitLabel}</button>}
      </div>
    </div>
  );
}
