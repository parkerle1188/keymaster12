import { useEffect, useState } from 'react';
import { LearnPage } from './components/LearnPage';
import { VoicingExplorer } from './components/VoicingExplorer';
import { VoiceLeadingPage } from './components/VoiceLeadingPage';
import { ProgressionsPage } from './components/ProgressionsPage';
import { TwelveKeysPage } from './components/TwelveKeysPage';
import { DailyWorkoutPage } from './components/DailyWorkoutPage';
import { onAudioStatus, setMuted } from './audio/piano-audio';
import { VOICING_LIBRARY } from './voicing-engine/voicing-library';
import { PROGRESSIONS } from './voice-leading/progressions';
import { usePersistentState } from './state/usePersistentState';

export type Tab = 'learn' | 'explorer' | 'voice-leading' | 'twelve' | 'progressions' | 'workout';
export const TABS: { id: Tab; label: string }[] = [
  { id: 'learn', label: 'Learn' },
  { id: 'explorer', label: 'Voicing Explorer' },
  { id: 'voice-leading', label: 'Voice Leading' },
  { id: 'twelve', label: '12 Keys' },
  { id: 'progressions', label: 'Progressions' },
  { id: 'workout', label: 'Daily Workout' },
];

export default function App() {
  const [tab, setTab] = usePersistentState<Tab>('tab', 'learn');
  const [explorerChord, setExplorerChord] = useState<string | undefined>();
  const [progJump, setProgJump] = useState<{ progId: string; keyPc: number } | undefined>();
  const [audio, setAudio] = useState<'idle' | 'synth' | 'piano'>('idle');
  const [muted, setMute] = usePersistentState('muted', false);
  useEffect(() => onAudioStatus(setAudio), []);
  useEffect(() => setMuted(muted), [muted]);
  const current: Tab = TABS.some((t) => t.id === tab) ? tab : 'learn';

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-ink-700 bg-ink-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2.5">
          <div className="flex shrink-0 items-center gap-2">
            <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden><rect width="32" height="32" rx="6" fill="#17171a" /><rect x="5" y="7" width="5" height="18" rx="1" fill="#eee" /><rect x="11" y="7" width="5" height="18" rx="1" fill="#FF7900" /><rect x="17" y="7" width="5" height="18" rx="1" fill="#eee" /><rect x="23" y="7" width="4" height="18" rx="1" fill="#eee" /></svg>
            <span className="text-sm font-black tracking-widest text-white">KEYMASTER <span className="text-accent">12</span></span>
          </div>
          <nav className="scrollbar-thin -mb-px flex flex-1 gap-1 overflow-x-auto" aria-label="Primary">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} aria-current={current === t.id ? 'page' : undefined}
                className={`relative shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition ${current === t.id ? 'bg-ink-800 text-accent' : 'text-neutral-300 hover:bg-ink-800 hover:text-white'}`}>
                {t.label}
              </button>
            ))}
          </nav>
          <button className="btn shrink-0 px-2 py-1 text-xs" onClick={() => setMute(!muted)} aria-pressed={muted} title={audio === 'piano' ? 'Sampled piano loaded' : audio === 'synth' ? 'Synth fallback (piano samples loading or unavailable)' : 'Audio starts on first play'}>
            {muted ? '🔇 Muted' : audio === 'piano' ? '🔊 Piano' : audio === 'synth' ? '🔊 Synth' : '🔊 Sound'}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-5">
        {current === 'learn' && <LearnPage onOpenExplorer={(c) => { setExplorerChord(c); setTab('explorer'); }} onOpenTab={setTab} />}
        {current === 'explorer' && <VoicingExplorer initialChord={explorerChord} />}
        {current === 'voice-leading' && <VoiceLeadingPage />}
        {current === 'twelve' && <TwelveKeysPage onOpenProgression={(progId, keyPc) => { setProgJump({ progId, keyPc }); setTab('progressions'); }} />}
        {current === 'progressions' && <ProgressionsPage initial={progJump} />}
        {current === 'workout' && <DailyWorkoutPage />}
      </main>
      <footer className="mx-auto max-w-7xl px-4 pb-8 pt-4 text-[11px] text-neutral-600">
        KEYMASTER 12 · {VOICING_LIBRARY.length} curated voicing templates × 12 keys · {PROGRESSIONS.length} reference progressions. Templates are curated from standard keyboard pedagogy and verified by automated tests; they have not yet been reviewed by an external musician.
        Practice history is stored only in this browser. Piano samples: Salamander Grand Piano (Alexander Holm, CC-BY 3.0) via Tone.js, with a synth fallback.
      </footer>
    </div>
  );
}
