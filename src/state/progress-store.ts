/**
 * Shared, persisted practice progress (LocalStorage) with a tiny subscribe API so every
 * tab sees the same data.
 */
import { useSyncExternalStore } from 'react';
import { addSession, emptyProgress, normaliseProgress, recordAttempt, type Attempt, type ProgressData, type SessionRecord } from '../practice/progress';
import { load, save } from './storage';

const KEY = 'progress-v1';
let data: ProgressData = normaliseProgress(load<ProgressData | null>(KEY, null));
const listeners = new Set<() => void>();

function set(next: ProgressData) {
  data = next;
  save(KEY, data);
  listeners.forEach((l) => l());
}

export function getProgress(): ProgressData { return data; }

export function recordPracticeAttempt(a: Attempt, adapt = true): -1 | 0 | 1 {
  const r = recordAttempt(data, a, new Date(), adapt);
  set(r.data);
  return r.levelChange;
}

export function recordSession(s: SessionRecord) { set(addSession(data, s)); }

export function setCategoryLevel(category: keyof ProgressData['levels'], level: number) {
  set({ ...data, levels: { ...data.levels, [category]: { level, recent: [] } } });
}

export function resetProgress() { set(emptyProgress()); }

export function subscribeProgress(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useProgress(): ProgressData {
  return useSyncExternalStore(subscribeProgress, getProgress, getProgress);
}
