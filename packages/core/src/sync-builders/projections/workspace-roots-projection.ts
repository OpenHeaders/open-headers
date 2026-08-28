/**
 * Workspace-roots projection — `WorkspaceRoots ⇄ MutationBatch /
 * MaterializedEntity`.
 *
 * Mirrors `trusted-roots-projection.ts` for the singleton that owns
 * the three trees' collection order. The oracle stores each tree's
 * collections as `{ uid }` slots at its own set path (identity =
 * collection uid); the persisted `WorkspaceRoots` holds three plain
 * uid arrays in slot order. `seedWorkspaceRoots` emits one `addToSet`
 * per uid with ascending keys — array order IS the order — and
 * `projectWorkspaceRoots` folds the three live sets back.
 */

import {
  type MaterializedEntity,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
  orderKeyMinter,
  WORKSPACE_ROOTS_ENTITY_TYPE,
  WORKSPACE_ROOTS_ID,
  WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH,
  WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH,
  WORKSPACE_ROOTS_TEMPLATE_COLLECTIONS_PATH,
} from '@openheaders/core/sync';
import type { WorkspaceRoots } from '@openheaders/core/types';

/** The three roots sets, paired with the persisted array each folds to. */
export const WORKSPACE_ROOTS_SETS = [
  { path: WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH, field: 'ruleCollections' },
  { path: WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH, field: 'requestCollections' },
  { path: WORKSPACE_ROOTS_TEMPLATE_COLLECTIONS_PATH, field: 'templateCollections' },
] as const satisfies ReadonlyArray<{ path: string; field: keyof Omit<WorkspaceRoots, 'schemaVersion'> }>;

/**
 * Convert a persisted `WorkspaceRoots` into a `MutationBatch` of one
 * `create` for the scalar shell plus one keyed `addToSet` per uid of
 * every tree, in array order.
 */
export function seedWorkspaceRoots(roots: WorkspaceRoots, ctx: MutatorContext): MutationBatch {
  const bodies: MutationBody[] = [
    {
      kind: 'create',
      type: WORKSPACE_ROOTS_ENTITY_TYPE,
      id: WORKSPACE_ROOTS_ID,
      payload: { schemaVersion: roots.schemaVersion },
    },
  ];
  for (const set of WORKSPACE_ROOTS_SETS) {
    const nextKey = orderKeyMinter();
    for (const uid of roots[set.field]) {
      bodies.push({
        kind: 'addToSet',
        type: WORKSPACE_ROOTS_ENTITY_TYPE,
        id: WORKSPACE_ROOTS_ID,
        path: set.path,
        itemId: uid,
        item: { uid },
        orderKey: nextKey(),
      });
    }
  }
  return mintBatch(ctx, bodies);
}

/**
 * Fold the materialized singleton plus its three live sets back into
 * a `WorkspaceRoots`. Returns `null` for a foreign entity type.
 */
export function projectWorkspaceRoots(
  materialized: MaterializedEntity,
  liveItems: (setPath: string) => ReadonlyArray<{ itemId: string }>,
): WorkspaceRoots | null {
  if (materialized.type !== WORKSPACE_ROOTS_ENTITY_TYPE) return null;
  return {
    schemaVersion: 5,
    ruleCollections: liveItems(WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH).map((entry) => entry.itemId),
    requestCollections: liveItems(WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH).map((entry) => entry.itemId),
    templateCollections: liveItems(WORKSPACE_ROOTS_TEMPLATE_COLLECTIONS_PATH).map((entry) => entry.itemId),
  };
}
