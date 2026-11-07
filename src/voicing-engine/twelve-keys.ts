/**
 * Transpose a single template through all 12 keys, choosing readable root spellings
 * (e.g. C# instead of Db when Db would force double flats).
 */
import { parseChord } from '../music-theory/chord-parser';
import { chooseRootSpelling } from '../music-theory/enharmonic-spelling';
import { formatNote, mod12 } from '../music-theory/note-parser';
import { DEFAULT_OPTIONS, realizeTemplate } from './voicing-generator';
import type { GeneratedVoicing, GenerationOptions, VoicingTemplate } from './voicing-types';

export type KeyOrder = 'chromatic' | 'fourths' | 'fifths';

export function rootOrder(order: KeyOrder, startPc = 0): number[] {
  const step = order === 'chromatic' ? 1 : order === 'fourths' ? 5 : 7;
  return Array.from({ length: 12 }, (_, i) => mod12(startPc + step * i));
}

export interface KeyRealization {
  rootPc: number;
  symbol: string;
  voicing?: GeneratedVoicing;
  reason?: string;
}

export function templateInAllKeys(template: VoicingTemplate, opts: Partial<GenerationOptions> = {}, order: KeyOrder = 'chromatic'): KeyRealization[] {
  const options = { ...DEFAULT_OPTIONS, ...opts, maxDifficulty: 5, families: undefined };
  const sample = parseChord('C' + (template.quality === 'maj' ? '' : template.quality));
  const labels = sample.tones.map((t) => t.label).concat(template.labels);
  return rootOrder(order).map((pc) => {
    const root = chooseRootSpelling(pc, labels);
    const symbol = formatNote(root) + (template.quality === 'maj' ? '' : template.quality);
    const chord = parseChord(symbol);
    const v = realizeTemplate(template, chord, options)[0];
    return { rootPc: pc, symbol, voicing: v, reason: v ? undefined : 'No playable placement with the current range / hand-span settings.' };
  });
}
