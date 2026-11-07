/**
 * Compact template notation used by the curated library.
 *
 *   "1 b7 | 3 13 9"
 *
 * - Tokens are degree labels listed low → high.
 * - Tokens before "|" are left hand, after "|" right hand. With no "|", the shape is one-hand.
 * - Each voice is placed at the lowest pitch strictly above the previous voice
 *   (first voice: its pitch class above the root, 0–11 semitones).
 * - A "^" prefix skips one extra octave per caret ("1 5 | ^1 3 5").
 */
import { labelPitchClass, parseDegreeLabel } from '../music-theory/intervals';
import type { Hand, TemplateVoice } from './voicing-types';

export interface ParsedDsl {
  voices: TemplateVoice[];
  oneHand: boolean;
}

export function parseTemplateDsl(dsl: string): ParsedDsl {
  const parts = dsl.split('|');
  if (parts.length > 2) throw new Error(`Template "${dsl}" has more than one "|"`);
  const oneHand = parts.length === 1;
  const voices: TemplateVoice[] = [];
  let prev = -1;
  parts.forEach((part, idx) => {
    const hand: Hand = oneHand ? 'R' : idx === 0 ? 'L' : 'R';
    for (const raw of part.trim().split(/\s+/).filter(Boolean)) {
      const carets = (/^\^+/.exec(raw)?.[0].length) ?? 0;
      const label = raw.slice(carets);
      const canonical = parseDegreeLabel(label).label;
      const pc = labelPitchClass(label);
      let semis = prev < 0 ? pc : prev + 1 + (((pc - (prev + 1)) % 12) + 12) % 12;
      semis += 12 * carets;
      voices.push({ label: canonical, semis, hand });
      prev = semis;
    }
  });
  if (voices.length === 0) throw new Error(`Template "${dsl}" has no voices`);
  return { voices, oneHand };
}
