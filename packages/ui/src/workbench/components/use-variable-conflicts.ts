/**
 * Conflict-tracker binding shared across env / workspace-vars /
 * collection variable editors. Mirrors `use-request-conflicts.ts` —
 * the hook is the entity-agnostic `useEntityConflicts`, the binding is
 * a thin wrapper that pins `entityType` + adapter.
 *
 * Vault uses its own binding (`use-vault-conflicts.ts`) because the
 * VaultSecret schema diverges (TOTP discriminator).
 */

import type { Variable } from '@openheaders/core/types';
import {
  type EntityConflictsApi,
  useEntityConflicts,
} from '@openheaders/ui/shared/conflicts/use-entity-conflicts';
import {
  type VariableEntity,
  variableConflictAdapter,
} from './variable-conflict-adapter';

export interface UseVariableConflictsArgs<E extends VariableEntity> {
  liveEntity: E | null | undefined;
  isDirty: boolean;
  enabled: boolean;
  /** Entity type string — `ENVIRONMENT_ENTITY_TYPE`,
   *  `WORKSPACE_VARIABLES_ENTITY_TYPE`, `COLLECTION_ENTITY_TYPE`,
   *  `REQUEST_COLLECTION_ENTITY_TYPE`, `TEMPLATE_COLLECTION_ENTITY_TYPE`. */
  entityType: string;
}

export function useVariableConflicts<E extends VariableEntity>(
  args: UseVariableConflictsArgs<E>,
): EntityConflictsApi<VariableEntity> {
  return useEntityConflicts<VariableEntity>({
    liveEntity: args.liveEntity ?? null,
    isDirty: args.isDirty,
    enabled: args.enabled,
    entityType: args.entityType,
    adapter: variableConflictAdapter,
  });
}

/** Project a variables array into the path-keyed shape the tracker
 *  expects. Editors call this with their `draft` (a Variable[]) to
 *  produce the `form` argument for `getAllConflicts`. */
export function projectVariablesToForm(variables: readonly Variable[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of variables) {
    out[`variables.${v.uid}.name`] = String(v.name ?? '');
    out[`variables.${v.uid}.value`] = String(v.value ?? '');
    out[`variables.${v.uid}.type`] = String(v.type ?? 'default');
  }
  return out;
}
