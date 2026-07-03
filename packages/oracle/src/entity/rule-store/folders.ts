// ── Folders ─────────────────────────────────────────────────────────

import { COLLECTION_ENTITY_TYPE, FOLDER_ENTITY_TYPE, type FolderParentRef } from '@openheaders/core/sync';
import {
  buildCreateFolderBatch,
  buildDeleteFolderBatch,
  buildDeleteFolderEntityBatch,
  buildRenameFolderBatch,
} from '@openheaders/core/sync-builders/mutations/folder-mutations';
import { buildDeleteBatch } from '@openheaders/core/sync-builders/mutations/rule-mutations';
import { generateUid, logger, toFolderName } from '@openheaders/core/utils';
import { applyFolderMutationOrThrow, applyRuleMutationOrThrow } from './apply';
import { assertLoaded, collections, folders, type LocalFolder, rules } from './state';

/**
 * Resolve `parentPath` to a {@link FolderParentRef} via the local
 * mirrors. `parentPath` matches a collection root (`rules/<slug>-<uid>`)
 * or a folder path (`<collectionPath>/<slug>-<uid>`); we look up
 * collections first because their paths are shorter prefixes of
 * descendant folders.
 */
function resolveFolderParent(parentPath: string): FolderParentRef | null {
  const collection = collections.find((c) => c.path === parentPath);
  if (collection) return { type: COLLECTION_ENTITY_TYPE, uid: collection.uid };
  const folder = folders.find((f) => f.path === parentPath);
  if (folder) return { type: FOLDER_ENTITY_TYPE, uid: folder.uid };
  return null;
}

/**
 * Create a folder under `parentPath`. Routes through the oracle via
 * the folder catalog's atomic `(create folder + addToSet on parent)`
 * batch (§11.2). Returns the synthesized folder shape immediately —
 * the broadcast-driven `bridgeFolderSyncEngine` confirms the same
 * post-commit shape on the next tick.
 */
export async function createFolder(name: string, parentPath: string): Promise<LocalFolder | null> {
  assertLoaded();
  const parent = resolveFolderParent(parentPath);
  if (!parent) {
    logger.info('RuleStore', `createFolder: parent path not resolvable: ${parentPath}`);
    return null;
  }
  const uid = generateUid();
  const folderName = toFolderName(name, uid);
  await applyFolderMutationOrThrow(
    (ctx) =>
      buildCreateFolderBatch(
        { folderUid: uid, parent, name, pathSegment: folderName },
        { ...ctx, batchId: ctx.batchId ?? `folder-create-${uid}` },
      ),
    'createFolder',
  );
  return { schemaVersion: 5, uid, path: `${parentPath}/${folderName}`, name };
}

export async function renameFolder(uid: string, name: string): Promise<boolean> {
  assertLoaded();
  if (!folders.some((f) => f.uid === uid)) return false;
  await applyFolderMutationOrThrow((ctx) => buildRenameFolderBatch({ folderUid: uid, name }, ctx), 'renameFolder');
  return true;
}

export async function deleteFolder(uid: string): Promise<boolean> {
  assertLoaded();
  const folder = folders.find((f) => f.uid === uid);
  if (!folder) return false;
  const parentPath = folder.path.substring(0, folder.path.lastIndexOf('/'));
  const parent = resolveFolderParent(parentPath);

  // Cascade descendant rule + folder deletes through the oracle.
  // Folder cascade walks every nested folder by path-prefix; rules use
  // the same pattern (rules can also live inside nested folders).
  const cascadingRuleUids = rules.filter((r) => r.path.startsWith(`${folder.path}/`)).map((r) => r.uid);
  const cascadingNestedFolderUids = folders
    .filter((f) => f.uid !== uid && f.path.startsWith(`${folder.path}/`))
    .map((f) => f.uid);
  for (const ruleUid of cascadingRuleUids) {
    await applyRuleMutationOrThrow((ctx) => buildDeleteBatch(ruleUid, ctx), 'deleteFolder-cascade-rule');
  }
  for (const nestedUid of cascadingNestedFolderUids) {
    await applyFolderMutationOrThrow(
      (ctx) => ({ batch: buildDeleteFolderEntityBatch(nestedUid, ctx), sideEffects: [] }),
      'deleteFolder-cascade-folder',
    );
  }
  // Final delete: the folder itself + its parent slot. Parent ref is
  // resolved above; if missing (parent already tombstoned), fall back
  // to the bare entity tombstone — the parent's tombstone covers slot
  // cleanup.
  if (parent) {
    await applyFolderMutationOrThrow((ctx) => buildDeleteFolderBatch({ folderUid: uid, parent }, ctx), 'deleteFolder');
  } else {
    await applyFolderMutationOrThrow(
      (ctx) => ({ batch: buildDeleteFolderEntityBatch(uid, ctx), sideEffects: [] }),
      'deleteFolder',
    );
  }
  return true;
}
