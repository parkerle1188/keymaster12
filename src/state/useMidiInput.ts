/**
 * Optional Web MIDI input for keyboard exercises.
 * Chord capture: every note pressed while at least one key is held is collected; when all keys
 * are released, the collected set is delivered as one chord (sustain pedal is ignored).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

interface MidiMessageEventLike { data: Uint8Array | null }
interface MidiInputLike { name?: string | null; onmidimessage: ((e: MidiMessageEventLike) => void) | null }
interface MidiAccessLike { inputs: Map<string, MidiInputLike> & { forEach(cb: (i: MidiInputLike) => void): void }; onstatechange: (() => void) | null }

export type MidiStatus = 'unsupported' | 'idle' | 'connected' | 'no-devices' | 'denied';

export function useMidiInput(onChord: (midis: number[]) => void, onNote?: (midi: number, on: boolean) => void) {
  const supported = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
  const [status, setStatus] = useState<MidiStatus>(supported ? 'idle' : 'unsupported');
  const [devices, setDevices] = useState<string[]>([]);
  const access = useRef<MidiAccessLike | null>(null);
  const held = useRef(new Set<number>());
  const collected = useRef(new Set<number>());
  const cb = useRef({ onChord, onNote });
  cb.current = { onChord, onNote };

  const handler = useCallback((e: MidiMessageEventLike) => {
    if (!e.data || e.data.length < 3) return;
    const [st, note, vel] = e.data;
    const cmd = st & 0xf0;
    if (cmd === 0x90 && vel > 0) {
      held.current.add(note); collected.current.add(note);
      cb.current.onNote?.(note, true);
    } else if (cmd === 0x80 || (cmd === 0x90 && vel === 0)) {
      held.current.delete(note);
      cb.current.onNote?.(note, false);
      if (held.current.size === 0 && collected.current.size) {
        cb.current.onChord([...collected.current].sort((a, b) => a - b));
        collected.current.clear();
      }
    }
  }, []);

  const attach = useCallback(() => {
    const acc = access.current;
    if (!acc) return;
    const names: string[] = [];
    acc.inputs.forEach((input) => { input.onmidimessage = handler; names.push(input.name ?? 'MIDI input'); });
    setDevices(names);
    setStatus(names.length ? 'connected' : 'no-devices');
  }, [handler]);

  const connect = useCallback(async () => {
    if (!supported) return;
    try {
      const acc = (await (navigator as unknown as { requestMIDIAccess: () => Promise<MidiAccessLike> }).requestMIDIAccess()) as MidiAccessLike;
      access.current = acc;
      acc.onstatechange = attach;
      attach();
    } catch {
      setStatus('denied');
    }
  }, [supported, attach]);

  useEffect(() => () => {
    const acc = access.current;
    if (!acc) return;
    acc.onstatechange = null;
    acc.inputs.forEach((i) => { i.onmidimessage = null; });
  }, []);

  return { supported, status, devices, connect };
}
