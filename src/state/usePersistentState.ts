import { useEffect, useState } from 'react';
import { load, save } from './storage';

export function usePersistentState<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => load(key, initial));
  useEffect(() => { save(key, value); }, [key, value]);
  return [value, setValue];
}
