/**
 * Environment mutator catalog — high-level intent factories.
 *
 * UI surfaces (workbench EnvironmentEditor, popup environment switcher,
 * future devpanel surface) call these factories. They translate user
 * intent into a {@link MutationBatch} of generic mutations plus the
 * {@link SideEffectIntent}s the local oracle should enqueue once the
 * batch commits.
 *
 * Same shape as `rule/types.ts` — see that file for the rationale on
 * pure factories. Phase B of the sync engine adopts this pattern across
 * all entity types.
 *
 * The set member identity for env variables is the variable NAME, not a
 * synthetic itemId. §8's "renameEnvVar = remove + add" semantics depend
 * on that — without name-as-id, two devices independently adding
 * `API_KEY` produce two distinct entries and the catalog couldn't
 * express rename atomically. Convergence is per-(path, name) LWW.
 */

import type { MutationBatch } from '../../envelope';
import type { HLC } from '../../hlc';
import type { SideEffectIntent } from '../types';

/** Routing key carried on every environment mutation envelope. */
export const ENVIRONMENT_ENTITY_TYPE = 'environment';

/** Set path holding the variable list on an environment entity. */
export const ENV_VARS_PATH = 'variables';

/**
 * Per-batch context the local oracle stamps onto every envelope. Same
 * shape as `RuleMutatorContext` (§Phase B will collapse the two into
 * a single `MutatorContext` once a third entity arrives).
 */
export interface EnvironmentMutatorContext {
  workspaceId: string;
  hlc: HLC;
  surfaceId: string;
  deviceId: string;
  batchId?: string;
  userId?: string;
}

export interface EnvironmentIntent {
  batch: MutationBatch;
  sideEffects: SideEffectIntent[];
}
