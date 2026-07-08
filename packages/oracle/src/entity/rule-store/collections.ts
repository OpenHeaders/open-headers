// ── Collections ─────────────────────────────────────────────────────

import {
  buildDeleteCollectionBatch,
  buildRenameCollectionBatch,
  buildSetPinnedAndDefaultBatch,
} from '@openheaders/core/sync-builders/mutations/collection-mutations';
import { buildDeleteFolderEntityBatch } from '@openheaders/core/sync-builders/mutations/folder-mutations';
import { buildDeleteBatch } from '@openheaders/core/sync-builders/mutations/rule-mutations';
import { seedCollection } from '@openheaders/core/sync-builders/projections/collection-projection';
import type { Collection } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import { entityLockName, withLock } from '@openheaders/oracle/coordination';
import { applyCollectionMutationOrThrow, applyFolderMutationOrThrow, applyRuleMutationOrThrow } from './apply';
import { assertLoaded, collections, folders, rules, setCollections } from './state';

const DEFAULT_COLLECTION_NAME = 'My Rules';

/**
 * Synchronously return the default collection if it already exists,
 * or mint and seed one through the oracle. The seed batch fires
 * fire-and-forget; the local mirror updates on the broadcast that
 * follows. Callers that need the post-commit collection on disk
 * should `await ensureDefaultCollection()`.
 */
export function ensureDefaultCollection(): Collection {
  const existing = collections.find((c) => c.name === DEFAULT_COLLECTION_NAME);
  if (existing) return existing;

  const uid = generateUid();
  const folderName = toFolderName(DEFAULT_COLLECTION_NAME, uid);
  const collection: Collection = {
    schemaVersion: 5,
    uid,
    path: `rules/${folderName}`,
    name: DEFAULT_COLLECTION_NAME,
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  };
  // Optimistic local insert so synchronous callers see the new
  // collection immediately; the oracle's broadcast will confirm the
  // identical post-commit shape (variables list re-projected from
  // its addToSet members).
  setCollections([...collections, collection]);
  void applyCollectionMutationOrThrow(
    (ctx) => ({ batch: seedCollection(collection, ctx), sideEffects: [] }),
    'ensureDefaultCollection',
  );
  return collection;
}

export function createCollection(name: string): Collection {
  const uid = generateUid();
  const folderName = toFolderName(name, uid);
  const collection: Collection = {
    schemaVersion: 5,
    uid,
    path: `rules/${folderName}`,
    name,
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  };
  setCollections([...collections, collection]);
  void applyCollectionMutationOrThrow(
    (ctx) => ({ batch: seedCollection(collection, ctx), sideEffects: [] }),
    'createCollection',
  );
  return collection;
}

/**
 * Outcome of a collection write. The legacy stale-draft branch is
 * retired in Phase B — convergence is per-(field) LWW at the oracle,
 * not a versioned compare-and-set.
 */
export type CollectionWriteResult = { ok: true; collection: Collection } | { ok: false; reason: 'not-found' };

export async function renameCollection(uid: string, name: string): Promise<CollectionWriteResult> {
  assertLoaded();
  const existing = collections.find((c) => c.uid === uid);
  if (!existing) return { ok: false, reason: 'not-found' };
  await applyCollectionMutationOrThrow(
    (ctx) => buildRenameCollectionBatch({ collectionUid: uid, name }, ctx),
    'renameCollection',
  );
  return { ok: true, collection: { ...existing, name } };
}

export async function deleteCollection(uid: string): Promise<boolean> {
  const workspaceId = assertLoaded();
  return withLock(
    entityLockName(workspaceId, 'collection', uid),
    async () => {
      const collection = collections.find((c) => c.uid === uid);
      if (!collection) return false;

      // Cascade rule + folder deletes through the oracle so every cache
      // stays consistent. The collection's tombstone covers its parent
      // slot for top-level folders; nested folders/rules are deleted by
      // uid through the oracle.
      const cascadingRuleUids = rules.filter((r) => r.path.startsWith(collection.path)).map((r) => r.uid);
      const cascadingFolderUids = folders.filter((f) => f.path.startsWith(collection.path)).map((f) => f.uid);
      for (const ruleUid of cascadingRuleUids) {
        await applyRuleMutationOrThrow((ctx) => buildDeleteBatch(ruleUid, ctx), 'deleteCollection-cascade');
      }
      for (const folderUid of cascadingFolderUids) {
        await applyFolderMutationOrThrow(
          (ctx) => ({
            batch: buildDeleteFolderEntityBatch(folderUid, ctx),
            sideEffects: [],
          }),
          'deleteCollection-cascade-folder',
        );
      }
      // Tombstone the collection through the oracle — the broadcast
      // drives the cache + local mirror update.
      await applyCollectionMutationOrThrow((ctx) => buildDeleteCollectionBatch(uid, ctx), 'deleteCollection');
      return true;
    },
    { op: 'collection-delete' },
  );
}

export async function updateCollectionPinnedEnvs(
  collectionUid: string,
  pinnedEnvironmentIds: string[],
  defaultEnvironmentId: string | null,
): Promise<boolean> {
  assertLoaded();
  if (!collections.some((c) => c.uid === collectionUid)) return false;
  await applyCollectionMutationOrThrow(
    (ctx) =>
      buildSetPinnedAndDefaultBatch(
        { collectionUid, pinnedEnvironmentIds, defaultEnvironmentId },
        {
          ...ctx,
          batchId: ctx.batchId ?? `coll-pinned-${collectionUid}`,
        },
      ),
    'updateCollectionPinnedEnvs',
  );
  return true;
}
