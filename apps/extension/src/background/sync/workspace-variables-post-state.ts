/**
 * Per-envelope workspace-variables post-state projection (Phase B).
 *
 * Same shape as `env-post-state.ts` / `collection-post-state.ts` for
 * the singleton workspace-variables entity. Renderer-side write
 * helpers need the live variable names before they can emit matching
 * `removeFromSet` envelopes (variable identity = name). Tombstoned
 * (singleton deletion is not a production gesture) and non-matching
 * envelopes return `null`.
 */

import type { SyncWorkspaceVariablesPostState } from '@openheaders/core/protocol';
import type { MutationEnvelope } from '@openheaders/core/sync';
import {
  WORKSPACE_VARIABLES_ENTITY_TYPE,
  WORKSPACE_VARIABLES_ID,
  WORKSPACE_VARIABLES_PATH,
} from '@openheaders/core/sync';
import { projectWorkspaceVariables } from '@/shared/sync/workspace-variables-projection';
import type { EntityOracle } from './oracle';

/**
 * Build the workspace-variables post-state for `envelope` using
 * `oracle`. Returns `null` for non-matching envelopes, deletes (entity
 * tombstoned), and any envelope whose materialized record fails to
 * project.
 */
export function projectWorkspaceVariablesPostState(
  oracle: Pick<EntityOracle, 'materializeOne' | 'liveSetItems'>,
  envelope: MutationEnvelope,
): SyncWorkspaceVariablesPostState | null {
  if (envelope.body.type !== WORKSPACE_VARIABLES_ENTITY_TYPE) return null;
  return projectWorkspaceVariablesSingleton(oracle);
}

/**
 * Build the workspace-variables post-state for the singleton entity.
 * Used by the snapshot RPC to seed freshly-mounted renderer mirrors
 * before the next live broadcast lands. Returns `null` when the
 * singleton hasn't been materialized yet (cold oracle prior to seed).
 */
export function projectWorkspaceVariablesSingleton(
  oracle: Pick<EntityOracle, 'materializeOne' | 'liveSetItems'>,
): SyncWorkspaceVariablesPostState | null {
  const materialized = oracle.materializeOne(
    WORKSPACE_VARIABLES_ENTITY_TYPE,
    WORKSPACE_VARIABLES_ID,
  );
  if (!materialized) return null;

  const workspaceVariables = projectWorkspaceVariables(materialized);
  if (!workspaceVariables) return null;

  const varNames = oracle
    .liveSetItems(WORKSPACE_VARIABLES_ENTITY_TYPE, WORKSPACE_VARIABLES_ID, WORKSPACE_VARIABLES_PATH)
    .map((entry) => entry.itemId);

  return { workspaceVariables, varNames };
}
