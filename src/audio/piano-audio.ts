/**
 * Audio playback via Tone.js.
 * - Tone is loaded lazily on first use (after a user gesture, as browsers require).
 * - A sampled piano (Salamander Grand, CC-BY 3.0, hosted by the Tone.js project) is used when reachable;
 *   otherwise a soft synth fallback plays immediately, so playback always works.
 */
import { midiToFrequency } from '../music-theory/midi-notes';

type ToneModule = typeof import('tone');
interface Voice { triggerAttack(n: string | number, t?: number, v?: number): unknown; triggerRelease(n: string | number, t?: number): unknown; releaseAll?(t?: number): unknown; }

let Tone: ToneModule | null = null;
let synth: Voice | null = null;
let sampler: Voice | null = null;
let samplerReady = false;
let loading: Promise<void> | null = null;
let muted = false;
let status: 'idle' | 'synth' | 'piano' = 'idle';
const listeners = new Set<(s: typeof status) => void>();

const SAMPLE_BASE = 'https://tonejs.github.io/audio/salamander/';
const SAMPLE_NOTES = ['A0', 'C1', 'Ds1', 'Fs1', 'A1', 'C2', 'Ds2', 'Fs2', 'A2', 'C3', 'Ds3', 'Fs3', 'A3', 'C4', 'Ds4', 'Fs4', 'A4', 'C5', 'Ds5', 'Fs5', 'A5', 'C6', 'Ds6', 'Fs6', 'A6', 'C7', 'Ds7', 'Fs7', 'A7', 'C8'];

function setStatus(s: typeof status) { status = s; listeners.forEach((l) => l(s)); }
export function onAudioStatus(fn: (s: typeof status) => void): () => void { listeners.add(fn); fn(status); return () => listeners.delete(fn); }
export function setMuted(m: boolean) { muted = m; if (m) stopAll(); }
export function isMuted() { return muted; }

async function ensureAudio(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    Tone = await import('tone');
    await Tone.start();
    const ps = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle8' },
      envelope: { attack: 0.005, decay: 0.6, sustain: 0.25, release: 1.2 },
      volume: -14,
    }).toDestination();
    synth = ps as unknown as Voice;
    setStatus('synth');
    try {
      const urls: Record<string, string> = {};
      for (const n of SAMPLE_NOTES) urls[n.replace('s', '#')] = `${n}.mp3`;
      const s = new Tone.Sampler({
        urls, baseUrl: SAMPLE_BASE, release: 1.2,
        onload: () => { samplerReady = true; setStatus('piano'); },
        onerror: () => { samplerReady = false; },
      }).toDestination();
      s.volume.value = -4;
      sampler = s as unknown as Voice;
    } catch {
      sampler = null;
    }
  })();
  return loading;
}

function voice(): Voice | null { return samplerReady && sampler ? sampler : synth; }
const freq = (m: number) => midiToFrequency(m);

export async function playChord(midis: number[], opts: { arpeggio?: boolean; duration?: number; velocity?: number } = {}): Promise<void> {
  if (muted || midis.length === 0) return;
  await ensureAudio();
  const v = voice();
  if (!v || !Tone) return;
  const now = Tone.now();
  const dur = opts.duration ?? 1.8;
  const sorted = [...midis].sort((a, b) => a - b);
  sorted.forEach((m, i) => {
    const t = now + (opts.arpeggio ? i * 0.11 : i * 0.008);
    v.triggerAttack(freq(m), t, opts.velocity ?? 0.7);
    v.triggerRelease(freq(m), t + dur);
  });
}

export async function noteOn(midi: number, velocity = 0.75) {
  if (muted) return;
  await ensureAudio();
  voice()?.triggerAttack(freq(midi), undefined, velocity);
}

export function noteOff(midi: number) {
  if (!Tone) return;
  voice()?.triggerRelease(freq(midi));
}

export function stopAll() {
  synth?.releaseAll?.();
  sampler?.releaseAll?.();
}

/**
 * Play chords one after another. Returns a stop function.
 * `onStep(i)` fires as chord i starts, and `onStep(-1)` when playback ends or is stopped.
 */
export function playSequence(chords: number[][], opts: { secondsPerChord?: number; loop?: boolean; arpeggio?: boolean; onStep?: (i: number) => void } = {}): () => void {
  const spc = opts.secondsPerChord ?? 1.6;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const step = (i: number) => {
    if (stopped) return;
    if (i >= chords.length) {
      if (opts.loop && chords.length) { step(0); return; }
      opts.onStep?.(-1);
      return;
    }
    opts.onStep?.(i);
    void playChord(chords[i], { duration: spc * 0.95, arpeggio: opts.arpeggio });
    timer = setTimeout(() => step(i + 1), spc * 1000);
  };
  step(0);
  return () => { stopped = true; if (timer) clearTimeout(timer); stopAll(); opts.onStep?.(-1); };
}
