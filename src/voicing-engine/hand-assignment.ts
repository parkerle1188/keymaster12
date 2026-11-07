import type { GenerationMode, Hand, Style, VoicingTemplate } from './voicing-types';

/**
 * Decide which hand plays a one-hand template.
 * - Solo piano: the left hand plays the bass, so the shape goes to the right hand.
 * - Band: jazz / neo-soul convention is left-hand comping (right hand free for melody/solo);
 *   pop / ballad / R&B keyboard parts usually voice chords in the right hand.
 */
export function handForOneHandTemplate(mode: GenerationMode, style: Style): Hand {
  if (mode === 'solo') return 'R';
  return style === 'jazz' || style === 'neosoul' ? 'L' : 'R';
}

export function assignHands(template: VoicingTemplate, mode: GenerationMode, style: Style): Hand[] {
  if (!template.oneHand) return template.voices.map((v) => v.hand);
  const h = handForOneHandTemplate(mode, style);
  return template.voices.map(() => h);
}

export function handSpan(midis: number[]): number {
  if (midis.length < 2) return 0;
  return Math.max(...midis) - Math.min(...midis);
}
