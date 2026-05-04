/**
 * Workspace-variables projection — `V5.WorkspaceVariables ⇄
 * MutationBatch / MaterializedEntity`.
 *
 * Mirrors `env-projection.ts` / `collection-projection.ts` for the
 * singleton workspace-variables entity. The oracle stores variables as
 * set members at `variables` (set member identity = `variable.uid`,
 * see `mutators/workspace-variables/types.ts`); persisted
 * `V5.WorkspaceVariables.variables` is a plain array. `seedWorkspaceVariables`
 * therefore strips the `variables` array off the create payload and
 * emits one `addToSet` per variable (itemId = uid);
 * `projectWorkspaceVariables` is the inverse.
 *
 * There is exactly one materialized record per workspace at the fixed
 * id `WORKSPACE_VARIABLES_ID`. The seed function takes no id —
 * singletons don't have one to thread.
 */

import type { V5 } from '@openheaders/core/types';
import {
  type MaterializedEntity,
  mintBatch,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  WORKSPACE_VARIABLES_ENTITY_TYPE,
  WORKSPACE_VARIABLES_ID,
  WORKSPACE_VARIABLES_PATH,
} from '@openheaders/core/sync';

/**
 * Convert a persisted `V5.WorkspaceVariables` into a `MutationBatch`
 * of one `create` for the scalar shell plus one `addToSet` per
 * variable. All-or-nothing under the oracle's per-entity lock.
 */
export function seedWorkspaceVariables(
  workspaceVars: V5.WorkspaceVariables,
  ctx: MutatorContext,
): MutationBatch {
  const shell = stripVariables(workspaceVars);

  const bodies: MutationBody[] = [
    {
      kind: 'create',
      type: WORKSPACE_VARIABLES_ENTITY_TYPE,
      id: WORKSPACE_VARIABLES_ID,
      payload: shell,
    },
  ];
  for (const variable of workspaceVars.variables) {
    bodies.push({
      kind: 'addToSet',
      type: WORKSPACE_VARIABLES_ENTITY_TYPE,
      id: WORKSPACE_VARIABLES_ID,
      path: WORKSPACE_VARIABLES_PATH,
      itemId: variable.uid,
      item: variable,
    });
  }
  return mintBatch(ctx, bodies);
}

/**
 * Convert a `MaterializedEntity` (the oracle's snapshot of the
 * singleton) back into a `V5.WorkspaceVariables`. Returns `null` when
 * the materialized data fails basic shape checks.
 */
export function projectWorkspaceVariables(
  materialized: MaterializedEntity,
): V5.WorkspaceVariables | null {
  if (materialized.type !== WORKSPACE_VARIABLES_ENTITY_TYPE) return null;
  const data = materialized.data;
  if (!isPlainObject(data)) return null;
  return data as V5.WorkspaceVariables;
}

// ── internals ─────────────────────────────────────────────────────

function stripVariables(workspaceVars: V5.WorkspaceVariables): unknown {
  const shell = JSON.parse(JSON.stringify(workspaceVars)) as Record<string, unknown>;
  delete shell.variables;
  return shell;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
