import type { Framework, FrameworkCategory } from '../types';
import { copywritingFrameworks } from './copywriting';
import { structureFrameworks } from './structure';
import { qualificationFrameworks } from './qualification';
import { pitchFrameworks } from './pitch';
import { objectionFrameworks } from './objection';
import { followupFrameworks } from './followup';

// Single source of truth — no other file hardcodes framework content.
const ALL_FRAMEWORKS: Framework[] = [
  ...copywritingFrameworks,
  ...structureFrameworks,
  ...qualificationFrameworks,
  ...pitchFrameworks,
  ...objectionFrameworks,
  ...followupFrameworks,
];

const INDEX = new Map<string, Framework>(ALL_FRAMEWORKS.map(f => [f.id, f]));

export function getFramework(id: string): Framework {
  const f = INDEX.get(id);
  if (!f) throw new Error(`Unknown framework id: "${id}"`);
  return f;
}

export function listFrameworks(category?: FrameworkCategory): Framework[] {
  if (!category) return ALL_FRAMEWORKS;
  return ALL_FRAMEWORKS.filter(f => f.category === category);
}

// UI picker compatibility map — existing picker sends PAS/AIDA/BAB/STORY/SPIN/4PS/HSO/FAB
export const UI_PICKER_MAP: Record<string, string> = {
  PAS: 'pas',
  AIDA: 'aida',
  BAB: 'bab',
  STORY: 'hso',
  SPIN: 'spin',
  '4PS': 'four_ps',
  HSO: 'hso',
  FAB: 'fab',
};
