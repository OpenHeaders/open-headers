/**
 * Copy + intent strings for each collision strategy. Centralised so the
 * sidebar chip, segmented control, and per-row tooltip all share the
 * same wording — design §4 (clarity over jargon: "Replace existing"
 * not `update`, "Add as new" not `new-uid`).
 */

import type { CollisionStrategy } from '@openheaders/core/workspace-export';

export interface StrategyMeta {
  /** Short label shown in the segmented control. */
  label: string;
  /** One-sentence explanation rendered as the diff-pane subtitle. */
  description: string;
  /** Tone — drives the strategy chip's accent color in the sidebar. */
  tone: 'neutral' | 'accent' | 'warn';
}

export const STRATEGY_META: Record<CollisionStrategy, StrategyMeta> = {
  'new-uid': {
    label: 'Add as new',
    description: "Creates a new entity alongside the existing one. The target's current entity stays untouched.",
    tone: 'accent',
  },
  update: {
    label: 'Replace existing',
    description: 'Keeps the target uid; every field is replaced with what this export carries.',
    tone: 'warn',
  },
  skip: {
    label: 'Skip',
    description: "This entity won't be imported. The target's current entity stays untouched.",
    tone: 'neutral',
  },
  'merge-children': {
    label: 'Merge children',
    description: 'Existing children of this collection stay. Incoming children are added beside them.',
    tone: 'accent',
  },
  'merge-vars': {
    label: 'Merge variables',
    description: 'Existing variables stay. Incoming variables with the same name overwrite, new names are appended.',
    tone: 'accent',
  },
  'merge-by-name': {
    label: 'Merge by name',
    description: 'Incoming entries overwrite existing entries with the same name; everything else stays.',
    tone: 'accent',
  },
  replace: {
    label: 'Replace all',
    description: 'Every existing entry is removed and replaced with the incoming set.',
    tone: 'warn',
  },
};
