/**
 * Per-envelope environment post-state projection (Phase B).
 *
 * Same shape as `rule-post-state.ts` for the Environment entity:
 * renderer-side write helpers (`buildRenameEnvVarBatch`, etc.) need
 * to know the live variable names before they can emit the matching
 * `removeFromSet` envelope. Round-tripping back to the SW per write
 * would kill the synchronous-render discipline (§19.4).
 *
 * Variable identity is the variable NAME (see
 * `mutators/environment/types.ts`), so the post-state carries a flat
 * `varNames: string[]` rather than a per-path itemId map. That's the
 * §8 "renameEnvVar = remove + add" invariant in physical form.
 */

import type { SyncEnvironmentPostState } from '@openheaders/core/protocol';
import type { MutationEnvelope } from '@openheaders/core/sync';
import { ENV_VARS_PATH, ENVIRONMENT_ENTITY_TYPE } from '@openheaders/core/sync';
import { projectEnvironment } from '@/shared/sync/env-projection';
import type { EntityOracle } from './oracle';

/**
 * Build the environment post-state for `envelope` using `oracle`.
 * Returns `null` for non-Environment envelopes, deletes (entity
 * tombstoned), and any envelope whose target environment fails to
 * project — the broadcast still fires; just without the optional
 * payload.
 */
export function projectEnvironmentPostState(
  oracle: Pick<EntityOracle, 'materializeOne' | 'liveSetItems'>,
  envelope: MutationEnvelope,
): SyncEnvironmentPostState | null {
  if (envelope.body.type !== ENVIRONMENT_ENTITY_TYPE) return null;
  return projectEnvironmentByUid(oracle, envelope.body.id);
}

/**
 * Build the environment post-state for a known envId. Same shape the
 * envelope projector returns; used by the snapshot RPC to seed
 * freshly-mounted renderer mirrors before the next live broadcast.
 */
export function projectEnvironmentByUid(
  oracle: Pick<EntityOracle, 'materializeOne' | 'liveSetItems'>,
  envId: string,
): SyncEnvironmentPostState | null {
  const materialized = oracle.materializeOne(ENVIRONMENT_ENTITY_TYPE, envId);
  if (!materialized) return null;

  const environment = projectEnvironment(materialized);
  if (!environment) return null;

  // Live variable names — itemId IS the name for env vars, so the
  // oracle's set-item itemIds are the canonical name list.
  const varNames = oracle
    .liveSetItems(ENVIRONMENT_ENTITY_TYPE, envId, ENV_VARS_PATH)
    .map((entry) => entry.itemId);

  return { environment, varNames };
}
