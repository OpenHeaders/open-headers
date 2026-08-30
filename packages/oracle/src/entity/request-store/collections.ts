// ── Collections ─────────────────────────────────────────────────────

import { REQUEST_COLLECTION_ENTITY_TYPE, WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH } from '@openheaders/core/sync';
import {
  buildDeleteRequestCollectionBatch,
  buildRenameRequestCollectionBatch,
} from '@openheaders/core/sync-builders/mutations/request-collection-mutations';
import { seedRequestCollection } from '@openheaders/core/sync-builders/projections/request-collection-projection';
import type { Collection } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import { getOracleForCurrentWorkspace } from '@openheaders/oracle/sync/service/accessors';
import { rootsPlacement } from '../tree-placement';
import { applyRequestCollectionMutationOrThrow } from './apply';
import { deleteRequestTreeDescendants } from './cascade';
import { assertLoaded, collections, setCollections } from './state';

const DEFAULT_COLLECTION_NAME = 'My Requests';

export async function ensureDefaultRequestCollection(): Promise<Collection> {
  const existing = collections.find((c) => c.name === DEFAULT_COLLECTION_NAME);
  if (existing) return existing;

  const uid = generateUid();
  const folderName = toFolderName(DEFAULT_COLLECTION_NAME, uid);
  const collection: Collection = {
    schemaVersion: 5,
    uid,
    path: `requests/${folderName}`,
    name: DEFAULT_COLLECTION_NAME,
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  };
  // Optimistic local insert so synchronous callers see the new
  // collection immediately; the oracle's broadcast confirms the same
  // post-commit shape on the next tick.
  setCollections([...collections, collection]);
  const placement = rootsPlacement(getOracleForCurrentWorkspace(), WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH);
  await applyRequestCollectionMutationOrThrow(
    (ctx) => ({ batch: seedRequestCollection(collection, ctx, placement), sideEffects: [] }),
    'ensureDefaultRequestCollection',
  );
  return collection;
}

export async function createRequestCollection(name: string): Promise<Collection> {
  const uid = generateUid();
  const folderName = toFolderName(name, uid);
  const collection: Collection = {
    schemaVersion: 5,
    uid,
    path: `requests/${folderName}`,
    name,
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  };
  setCollections([...collections, collection]);
  const placement = rootsPlacement(getOracleForCurrentWorkspace(), WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH);
  await applyRequestCollectionMutationOrThrow(
    (ctx) => ({ batch: seedRequestCollection(collection, ctx, placement), sideEffects: [] }),
    'createRequestCollection',
  );
  return collection;
}

export async function renameRequestCollection(uid: string, name: string): Promise<boolean> {
  assertLoaded();
  if (!collections.some((c) => c.uid === uid)) return false;
  await applyRequestCollectionMutationOrThrow(
    (ctx) => buildRenameRequestCollectionBatch({ collectionUid: uid, name }, ctx),
    'renameRequestCollection',
  );
  return true;
}

export async function deleteRequestCollection(uid: string): Promise<boolean> {
  assertLoaded();
  const collection = collections.find((c) => c.uid === uid);
  if (!collection) return false;

  // Everything under the collection goes first — the parent-owned
  // sets name it, every request kind included (`cascade.ts`).
  await deleteRequestTreeDescendants({ type: REQUEST_COLLECTION_ENTITY_TYPE, uid }, 'deleteRequestCollection');
  // Tombstone the collection through the oracle — the broadcast drives
  // the cache + local mirror update.
  await applyRequestCollectionMutationOrThrow(
    (ctx) => buildDeleteRequestCollectionBatch(uid, ctx),
    'deleteRequestCollection',
  );
  return true;
}
