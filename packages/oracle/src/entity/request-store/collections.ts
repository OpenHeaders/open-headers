// ── Collections ─────────────────────────────────────────────────────

import {
  buildDeleteRequestCollectionBatch,
  buildRenameRequestCollectionBatch,
} from '@openheaders/core/sync-builders/mutations/request-collection-mutations';
import { buildDeleteRequestFolderEntityBatch } from '@openheaders/core/sync-builders/mutations/request-folder-mutations';
import { buildDeleteBatch } from '@openheaders/core/sync-builders/mutations/request-mutations';
import { seedRequestCollection } from '@openheaders/core/sync-builders/projections/request-collection-projection';
import type { Collection } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import {
  applyRequestCollectionMutationOrThrow,
  applyRequestFolderMutationOrThrow,
  applyRequestMutationOrThrow,
} from './apply';
import { deleteResponseExamplesForRequests } from './response-examples';
import { assertLoaded, collections, folders, requests, setCollections } from './state';

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
  await applyRequestCollectionMutationOrThrow(
    (ctx) => ({ batch: seedRequestCollection(collection, ctx), sideEffects: [] }),
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
  await applyRequestCollectionMutationOrThrow(
    (ctx) => ({ batch: seedRequestCollection(collection, ctx), sideEffects: [] }),
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

  // Cascade descendant request + request-folder deletes through the
  // oracle so every cache stays consistent. The collection's tombstone
  // covers its parent slot for top-level folders; nested folders/requests
  // are deleted by uid through the oracle.
  const cascadingRequestUids = requests.filter((r) => r.path.startsWith(collection.path)).map((r) => r.uid);
  const cascadingFolderUids = folders.filter((f) => f.path.startsWith(collection.path)).map((f) => f.uid);
  await deleteResponseExamplesForRequests(cascadingRequestUids);
  for (const reqUid of cascadingRequestUids) {
    await applyRequestMutationOrThrow((ctx) => buildDeleteBatch(reqUid, ctx), 'deleteRequestCollection-cascade');
  }
  for (const folderUid of cascadingFolderUids) {
    await applyRequestFolderMutationOrThrow(
      (ctx) => ({ batch: buildDeleteRequestFolderEntityBatch(folderUid, ctx), sideEffects: [] }),
      'deleteRequestCollection-cascade-folder',
    );
  }
  // Tombstone the collection through the oracle — the broadcast drives
  // the cache + local mirror update.
  await applyRequestCollectionMutationOrThrow(
    (ctx) => buildDeleteRequestCollectionBatch(uid, ctx),
    'deleteRequestCollection',
  );
  return true;
}
