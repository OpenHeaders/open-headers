/**
 * Thin rule-bound wrapper around the generic `useEntityConflicts` hook.
 *
 * The conflict tracker stack splits cleanly along the editor / entity
 * axis (see `shared/conflicts/conflict-adapters.ts`):
 *
 *   - **Editor / UI surfaces** are entity-agnostic — chips, banner,
 *     dialog, key encoding, presence-mirror lookups all consume the
 *     same `(path, conflict)` shape regardless of entity type.
 *   - **Entity projection + resolution** is per-entity — see
 *     `rule-conflict-adapter.ts` (read side) +
 *     `rule-resolve-adapter.ts` (write side).
 *
 * This file binds the rule adapters to the generic factory + re-
 * exports key codec helpers + types so existing rule-only consumers
 * import from one place.
 */

import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import type { ConflictBridge, ConflictRemoteInfo, PathConflict } from '@/shared/conflicts/types';
import {
  decodeReorderConflictKey,
  decodeSetConflictKey,
  isReorderConflictKey,
  isSetConflictKey,
} from '@/shared/conflicts/conflict-keys';
import { type EntityConflictsApi, useEntityConflicts } from '@/shared/conflicts/use-entity-conflicts';
import { ruleConflictAdapter } from './rule-conflict-adapter';

export type { ConflictBridge, ConflictRemoteInfo, PathConflict };
export { isSetConflictKey, isReorderConflictKey, decodeSetConflictKey, decodeReorderConflictKey };

/** Rule-bound API surface. Identical shape to `EntityConflictsApi<V5.Rule>`
 *  with `projectRule` aliased from `projectEntity` for back-compat. */
export interface RuleConflictsApi extends Omit<EntityConflictsApi<V5.Rule>, 'projectEntity'> {
  /** Project the live rule into the same path-keyed shape as the
   *  baseline. Useful for entity-level diff dialog rendering. */
  projectRule: (rule: V5.Rule) => Record<string, string>;
}

export interface UseRuleConflictsArgs {
  liveRule: V5.Rule | null | undefined;
  isDirty: boolean;
  /** When false, getConflict returns null unconditionally. */
  enabled: boolean;
}

export function useRuleConflicts(args: UseRuleConflictsArgs): RuleConflictsApi {
  const api = useEntityConflicts<V5.Rule>({
    liveEntity: args.liveRule,
    isDirty: args.isDirty,
    enabled: args.enabled,
    entityType: RULE_ENTITY_TYPE,
    adapter: ruleConflictAdapter,
  });
  // Preserve the pre-refactor `projectRule` name for rule consumers.
  return {
    setBaseline: api.setBaseline,
    getConflict: api.getConflict,
    getAllConflicts: api.getAllConflicts,
    getSetConflict: api.getSetConflict,
    getAutoMergeable: api.getAutoMergeable,
    acceptTheirs: api.acceptTheirs,
    dismiss: api.dismiss,
    clearDismissed: api.clearDismissed,
    projectRule: api.projectEntity,
  };
}
