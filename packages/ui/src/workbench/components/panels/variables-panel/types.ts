/**
 * Shared types + scope config for the Scope panel. The display model
 * (`DisplayVariable`) is what every view renders; the model builders
 * (`scope-variables`, `live-registry`) produce it and the views never
 * touch raw domain shapes.
 */

import type { TotpAlgorithm } from '@openheaders/core/types';

// Per-scope metadata for the "All scopes" view. `label` is the section
// title; `namespace` is the reference prefix ({{namespace.name}}). The
// four real scopes form a fallback ladder for a bare {{name}} (highest →
// lowest precedence in the resolver): whichever ranks higher wins when
// the same name is defined in more than one. Live is namespace-only —
// reached solely via {{live.*}}, never part of bare-name fallback. Both
// facts surface in each scope's (i) popover (`buildScopeInfo`).
export const SCOPE_CONFIG = {
  vault: { label: 'Vault', namespace: 'vault' },
  environment: { label: 'Environment', namespace: 'env' },
  collection: { label: 'Collection', namespace: 'collection' },
  workspace: { label: 'Workspace', namespace: 'workspace' },
  live: { label: 'Live', namespace: 'live' },
} as const;

export type DisplayScope = keyof typeof SCOPE_CONFIG;

/** What the focused tab references, if anything the Scope panel can filter to. */
export type ScopeKind = 'rule' | 'request' | 'template' | 'none';

export interface DisplayVariable {
  name: string;
  value: string;
  scope: DisplayScope;
  isSensitive: boolean;
  resolved: boolean;
  /** Present only on TOTP-kind vault rows — the renderer uses these
   *  to mount a live `TotpPreview` instead of the masked-string cell.
   *  Codes refresh on a 1Hz tick from the seed; never persisted. */
  totp?: {
    seed: string;
    algorithm: TotpAlgorithm;
    digits: number;
    period: number;
  };
  /** Present only on `live` rows — the LV uid the value came from. The
   *  per-row dispatcher uses it to open the LV's edit tab directly
   *  instead of falling back to the LiveVariables list page. */
  liveVariableUid?: string;
  /** Present only on `live` rows — true when the backing workflow's
   *  recipe changed since the cached value was extracted. The row
   *  badges "needs re-run". */
  definitionallyStale?: boolean;
}

/** The five scope buckets the "All" view renders, in priority order. */
export interface AllScopeVariables {
  vault: DisplayVariable[];
  environment: DisplayVariable[];
  collection: DisplayVariable[];
  workspace: DisplayVariable[];
  live: DisplayVariable[];
}
