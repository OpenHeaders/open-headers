/**
 * Test fixture — a request-tree oracle built SYNCHRONOUSLY from the
 * flat collection / folder lists a pin already mocks, every container
 * slotted under the parent its path names. The ancestor walk reads the
 * slot index off this oracle; leaves need no slot (a slot-less leaf
 * nets by its stored path), so a pin's `makeRequest()` needs nothing
 * seeded. `slotLeaf` slots a leaf explicitly for the drag cases where
 * the slot and the stored path disagree.
 */

import {
  InMemoryDocumentStore,
  type MutationEnvelope,
  type MutatorContext,
  mintBatch,
  requestChild,
  requestFolderChild,
} from '@openheaders/core/sync';
import { seedRequestCollection } from '@openheaders/core/sync-builders/projections/request-collection-projection';
import { seedRequestFolder } from '@openheaders/core/sync-builders/projections/request-folder-projection';
import { seedRequest } from '@openheaders/core/sync-builders/projections/request-projection';
import type { Collection, Folder, Request } from '@openheaders/core/types';
import { parentPathOf } from '@openheaders/core/utils';
import { InMemoryBroadcast } from '../../../src/sync/broadcast';
import { buildSchemaRegistry, WORKSPACE_REGISTRY } from '../../../src/sync/entity-registry';
import { InMemoryMutationLog } from '../../../src/sync/mutation-log';
import { EntityOracle } from '../../../src/sync/oracle';
import { InMemoryPendingIntents } from '../../../src/sync/pending-intents';

export interface TreeParentRef {
  type: 'request-collection' | 'request-folder';
  uid: string;
}

let clock = 1_000;
const ctx = (): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: clock++, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
});

function applyAll(store: InMemoryDocumentStore, envelopes: readonly MutationEnvelope[]): void {
  for (const env of envelopes) store.apply(env);
}

/** The container whose path is `parentPath`, or `null`. */
function parentByPath(collections: readonly Collection[], folders: readonly Folder[], parentPath: string | null) {
  if (parentPath === null) return null;
  const collection = collections.find((c) => c.path === parentPath);
  if (collection) return { type: 'request-collection' as const, uid: collection.uid };
  const folder = folders.find((f) => f.path === parentPath);
  return folder ? { type: 'request-folder' as const, uid: folder.uid } : null;
}

export interface TreeOracle {
  oracle: EntityOracle;
  store: InMemoryDocumentStore;
}

/** Seed collections and folders, each folder slotted under the parent its path names. */
export function treeOracleFrom(
  collections: readonly Collection[],
  folders: readonly Folder[],
  requests: readonly Request[] = [],
): TreeOracle {
  const store = new InMemoryDocumentStore(buildSchemaRegistry(WORKSPACE_REGISTRY));
  for (const collection of collections) applyAll(store, seedRequestCollection(collection, ctx()).mutations);
  const byDepth = [...folders].sort((a, b) => a.path.length - b.path.length);
  for (const folder of byDepth) {
    applyAll(store, seedRequestFolder(folder, ctx()).mutations);
    const parent = parentByPath(collections, folders, parentPathOf(folder.path));
    if (parent) applyAll(store, mintBatch(ctx(), [requestFolderChild.slotAdd(folder.uid, parent)]).mutations);
  }
  for (const request of requests) {
    applyAll(store, seedRequest(request, ctx()).mutations);
    const parent = parentByPath(collections, folders, parentPathOf(request.path));
    if (parent) slotLeaf(store, request.uid, parent);
  }
  const oracle = new EntityOracle({
    workspaceId: 'ws-1',
    lock: async (_ws, _type, _id, fn) => fn(),
    log: new InMemoryMutationLog(),
    intents: new InMemoryPendingIntents(),
    broadcast: new InMemoryBroadcast(),
    store,
    schemas: buildSchemaRegistry(WORKSPACE_REGISTRY),
  });
  return { oracle, store };
}

/** Slot a leaf under `parent` — the containment the walk honors over the stored path. */
export function slotLeaf(store: InMemoryDocumentStore, requestUid: string, parent: TreeParentRef): void {
  applyAll(store, mintBatch(ctx(), [requestChild.slotAdd(requestUid, parent)]).mutations);
}

/** Remove a leaf's slot under `parent` — the leaf becomes slot-less and nets by its path. */
export function unslotLeaf(store: InMemoryDocumentStore, requestUid: string, parent: TreeParentRef): void {
  applyAll(store, mintBatch(ctx(), [requestChild.slotRemove(requestUid, parent)]).mutations);
}
