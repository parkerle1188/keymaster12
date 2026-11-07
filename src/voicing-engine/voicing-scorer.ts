/**
 * Soft scoring of a valid voicing. Every component is normalised to a 0..1 cost
 * before weighting so that weights are comparable and configurable.
 */
import { STYLE_PROFILES } from '../voice-leading/style-profiles';
import { centroid } from './register-optimizer';
import type { GenerationOptions, ScoreBreakdown, ValidationIssue, VoicedNote, VoicingTemplate } from './voicing-types';

export interface ScoreWeights {
  style: number; register: number; color: number; clusters: number; difficulty: number;
  span: number; warnings: number; topVoice: number; rootDoubling: number;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  style: 2, register: 1.2, color: 1, clusters: 0.8, difficulty: 0.5, span: 0.4, warnings: 1.5, topVoice: 0.6, rootDoubling: 0.4,
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export interface ScoreInput {
  template: VoicingTemplate;
  notes: VoicedNote[];
  matchType: 'exact' | 'enriched';
  issues: ValidationIssue[];
  options: GenerationOptions;
  addedCount?: number;
}

export function scoreVoicing(input: ScoreInput, weights: ScoreWeights = DEFAULT_WEIGHTS): ScoreBreakdown {
  const { template, notes, matchType, issues, options } = input;
  const profile = STYLE_PROFILES[options.style];
  const upper = notes.filter((n) => !n.isAddedBass);
  const sorted = [...upper].sort((a, b) => a.midi - b.midi);

  const famW = profile.familyWeight[template.family];
  const styleFit = template.styles.includes(options.style) ? 0.5 + 0.5 * famW : 0.5 * famW;

  const center = centroid(sorted.map((n) => n.midi));
  const registerCost = clamp01(Math.abs(center - profile.center) / 12);

  // Exact matches play what is written; enriched voicings add tensions. Styles that welcome colour
  // only lightly penalise plain voicings, and every added tension costs a little so exact
  // matches win ties.
  const added = input.addedCount ?? 0;
  const colorCost = matchType === 'enriched'
    ? Math.max(0, -profile.colorAttitude) + 0.15 * added * (1 - Math.max(0, profile.colorAttitude))
    : Math.max(0, profile.colorAttitude) * 0.1;

  let clusters = 0;
  for (let i = 0; i < sorted.length - 1; i++) if (sorted[i + 1].midi - sorted[i].midi <= 2) clusters++;
  const clusterCost = profile.clusterAttitude < 0
    ? -profile.clusterAttitude * clamp01(clusters / 2)
    : clusters === 0 ? profile.clusterAttitude * 0.3 : 0;

  const difficultyCost = (template.difficulty - 1) / 4;

  const spans = (['L', 'R'] as const).map((h) => {
    const m = notes.filter((n) => n.hand === h).map((n) => n.midi);
    return m.length > 1 ? Math.max(...m) - Math.min(...m) : 0;
  });
  const spanCost = clamp01((Math.max(...spans) - 10) / 6);

  const warnCost = clamp01(issues.filter((i) => i.severity === 'warning').length * 0.5);

  const top = sorted[sorted.length - 1];
  const topCost = top && top.label === '1' ? profile.colorTopPreference : 0;

  const lowest = [...notes].sort((a, b) => a.midi - b.midi)[0];
  const rootDoublingCost = options.mode === 'band' && lowest && lowest.label === '1' && lowest.midi < 50 ? 1 : 0;

  const components = [
    { key: 'style', label: 'Style fit', cost: 1 - styleFit, weight: weights.style },
    { key: 'register', label: 'Register', cost: registerCost, weight: weights.register },
    { key: 'color', label: 'Colour vs. symbol', cost: colorCost, weight: weights.color },
    { key: 'clusters', label: 'Clusters', cost: clusterCost, weight: weights.clusters },
    { key: 'difficulty', label: 'Difficulty', cost: difficultyCost, weight: weights.difficulty },
    { key: 'span', label: 'Hand stretch', cost: spanCost, weight: weights.span },
    { key: 'warnings', label: 'Musical warnings', cost: warnCost, weight: weights.warnings },
    { key: 'top', label: 'Top voice', cost: topCost, weight: weights.topVoice },
    { key: 'rootDoubling', label: 'Low root vs. bassist', cost: rootDoublingCost, weight: weights.rootDoubling },
  ];
  const wsum = components.reduce((s, c) => s + c.weight, 0);
  const csum = components.reduce((s, c) => s + c.weight * c.cost, 0);
  return { total: Math.round(100 * (1 - csum / wsum)), components };
}
