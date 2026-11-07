import type { ToneRole } from '../music-theory/intervals';

export type DisplayRole = ToneRole | 'bass';

/** Role colours chosen for ≥ 3:1 contrast against both white and black keys' label backgrounds. */
export const ROLE_COLORS: Record<DisplayRole, { fill: string; text: string; name: string }> = {
  root: { fill: '#FF7900', text: '#000000', name: 'Root' },
  third: { fill: '#3BA7FF', text: '#000000', name: '3rd' },
  fifth: { fill: '#A1A1AA', text: '#000000', name: '5th' },
  seventh: { fill: '#B98CFF', text: '#000000', name: '7th' },
  sixth: { fill: '#E0B3FF', text: '#000000', name: '6th' },
  sus: { fill: '#2DD4BF', text: '#000000', name: 'Sus 2/4' },
  extension: { fill: '#4ADE80', text: '#000000', name: 'Extension (9/11/13)' },
  alteration: { fill: '#FB7185', text: '#000000', name: 'Alteration (b9 #9 #11 b13 b5 #5)' },
  bass: { fill: '#FACC15', text: '#000000', name: 'Slash bass (non-chord tone)' },
};

export const LEGEND_ORDER: DisplayRole[] = ['root', 'third', 'fifth', 'seventh', 'sixth', 'sus', 'extension', 'alteration', 'bass'];
