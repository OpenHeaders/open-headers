/**
 * Request-collection projection — `Collection ⇄ MutationBatch /
 * MaterializedEntity` for the request-collection entity type.
 *
 * Mirrors `collection-projection.ts` (rule-collection side). The
 * oracle stores variables as set members at `variables` (set member
 * identity = `variable.uid`); persisted `Collection.variables` is a
 * plain array. `seedRequestCollection` strips the `variables` array off
 * the create payload and emits one `addToSet` per variable (itemId =
 * uid) — the auth pool (`auths`, itemId = the entry uid) rides the same
 * way; `projectRequestCollection` is the inverse via the materialized
 * `data` blob the oracle composes back from set members at materialize
 * time.
 *
 * `pinnedEnvironmentIds` / `defaultEnvironmentId` stay on the scalar
 * shell — a future surface that exposes pinned-env editing for request
 * collections would peel them off into their own paths the same way.
 */

import { hasInheritableSettings } from '@openheaders/core/schemas';
import {
  type ChildPlacement,
  type MaterializedEntity,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
  orderKeyMinter,
  REQUEST_COLLECTION_AUTHS_PATH,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_COLLECTION_VARS_PATH,
  requestCollectionChild,
  type WorkspaceRootsRef,
} from '@openheaders/core/sync';
import type { Collection } from '@openheaders/core/types';
/**
 * Convert a persisted `Collection` (under request-collection
 * routing) into a `MutationBatch` of one `create` for the scalar shell
 * plus one `addToSet` per variable. All-or-nothing under the oracle's
 * per-entity lock.
 *
 * `placement` is the roots linkage for a NEW collection: the workspace
 * roots' slot rides the same batch. Boot-time re-seeds pass none.
 */
export function seedRequestCollection(
  collection: Collection,
  ctx: MutatorContext,
  placement?: ChildPlacement<WorkspaceRootsRef>,
): MutationBatch {
  const shell = stripSets(collection);

  const bodies: MutationBody[] = [
    { kind: 'create', type: REQUEST_COLLECTION_ENTITY_TYPE, id: collection.uid, payload: shell },
  ];
  // Sequential orderKeys — a keyless addToSet defaults every row to the
  // same seedKey(), collapsing creation order to the uid tie-break at
  // materialize time.
  const nextKey = orderKeyMinter();
  for (const variable of collection.variables) {
    bodies.push({
      kind: 'addToSet',
      type: REQUEST_COLLECTION_ENTITY_TYPE,
      id: collection.uid,
      path: REQUEST_COLLECTION_VARS_PATH,
      itemId: variable.uid,
      item: variable,
      orderKey: nextKey(),
    });
  }
  // The auth pool is a set too — one `addToSet` per entry, the same
  // sequential keys, so the pool materializes in authored order.
  const nextAuthKey = orderKeyMinter();
  for (const entry of collection.auths ?? []) {
    bodies.push({
      kind: 'addToSet',
      type: REQUEST_COLLECTION_ENTITY_TYPE,
      id: collection.uid,
      path: REQUEST_COLLECTION_AUTHS_PATH,
      itemId: entry.uid,
      item: entry,
      orderKey: nextAuthKey(),
    });
  }
  if (placement) bodies.push(requestCollectionChild.slotAdd(collection.uid, placement.parent, placement.orderKey));
  return mintBatch(ctx, bodies);
}

/**
 * Convert a `MaterializedEntity` (the oracle's per-request-collection
 * snapshot) back into a `Collection`. Returns `null` when the
 * materialized data fails basic shape checks.
 */
export function projectRequestCollection(materialized: MaterializedEntity): Collection | null {
  if (materialized.type !== REQUEST_COLLECTION_ENTITY_TYPE) return null;
  const data = materialized.data;
  if (!isPlainObject(data)) return null;
  return data as Collection;
}

// ── internals ─────────────────────────────────────────────────────

function stripSets(collection: Collection): unknown {
  const shell = JSON.parse(JSON.stringify(collection)) as Record<string, unknown>;
  delete shell.variables;
  delete shell.auths;
  // A settings record that sets nothing never seeds: an empty-object
  // leaf at `settings` would fight the per-knob leaves written later.
  if (!hasInheritableSettings(collection.settings)) delete shell.settings;
  return shell;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
