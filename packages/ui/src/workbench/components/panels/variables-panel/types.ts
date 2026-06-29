/**
 * Shared types + scope config for the Scope panel. The display model
 * (`DisplayVariable`) is what every view renders; the model builders
 * (`scope-variables`, `live-registry`) produce it and the views never
 * touch raw domain shapes.
 */

import type { TotpAlgorithm } from '@openheaders/core/types';
import { SCOPE_COLORS } from '../../shared/scope-colors';

export const SCOPE_CONFIG = {
  vault: { label: 'Vault', priority: 'highest', color: SCOPE_COLORS.vault.color },
  environment: { label: 'Environment', priority: 'high', color: SCOPE_COLORS.environment.color },
  collection: { label: 'Collection', priority: 'medium', color: SCOPE_COLORS.collection.color },
  workspace: { label: 'Workspace', priority: 'lowest', color: SCOPE_COLORS.workspace.color },
  live: { label: 'Live', priority: 'resolved', color: SCOPE_COLORS.live.color },
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
