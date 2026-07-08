/**
 * Environment projection — `Environment ⇄ MutationBatch / MaterializedEntity`.
 *
 * Mirrors `rule-projection.ts` for the Environment entity. The oracle
 * stores variables as set members at `variables` (set member identity =
 * `variable.uid`, see `mutators/environment/types.ts`); persisted
 * `Environment.variables` is a plain array. `seedEnvironment`
 * therefore strips the `variables` array off the create payload and
 * emits one `addToSet` per variable (itemId = uid); `projectEnvironment`
 * is the inverse.
 *
 * Variable identity is stable across cold wakes because the itemId is
 * the persisted `uid` — survives renames intact (the user-mutable
 * `name` is just another field on the LWW item body).
 */

import {
  ENV_VARS_PATH,
  ENVIRONMENT_ENTITY_TYPE,
  type MaterializedEntity,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
  orderKeyMinter,
} from '@openheaders/core/sync';
import type { Environment } from '@openheaders/core/types';

/**
 * Convert a persisted `Environment` into a `MutationBatch` of one
 * `create` for the scalar shell (uid, name, path, schemaVersion,
 * version) plus one `addToSet` per variable. All-or-nothing under the
 * oracle's per-entity lock.
 */
export function seedEnvironment(env: Environment, ctx: MutatorContext): MutationBatch {
  const shell = stripVariables(env);

  const bodies: MutationBody[] = [{ kind: 'create', type: ENVIRONMENT_ENTITY_TYPE, id: env.uid, payload: shell }];
  // Sequential orderKeys — a keyless addToSet defaults every row to the
  // same seedKey(), collapsing creation order to the uid tie-break at
  // materialize time.
  const nextKey = orderKeyMinter();
  for (const variable of env.variables) {
    bodies.push({
      kind: 'addToSet',
      type: ENVIRONMENT_ENTITY_TYPE,
      id: env.uid,
      path: ENV_VARS_PATH,
      itemId: variable.uid,
      item: variable,
      orderKey: nextKey(),
    });
  }
  return mintBatch(ctx, bodies);
}

/**
 * Convert a `MaterializedEntity` (the oracle's per-environment snapshot)
 * back into a `Environment`. Returns `null` when the materialized
 * data fails basic shape checks.
 */
export function projectEnvironment(materialized: MaterializedEntity): Environment | null {
  if (materialized.type !== ENVIRONMENT_ENTITY_TYPE) return null;
  const data = materialized.data;
  if (!isPlainObject(data)) return null;
  // Materialized data already carries `variables: Variable[]` thanks to
  // the oracle emitting set members under the same path. The cast is
  // honest because seedEnvironment committed to that shape on the way
  // in and per-(setPath, itemId) LWW preserves it.
  return data as Environment;
}

// ── internals ─────────────────────────────────────────────────────

function stripVariables(env: Environment): unknown {
  const shell = JSON.parse(JSON.stringify(env)) as Record<string, unknown>;
  delete shell.variables;
  return shell;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
