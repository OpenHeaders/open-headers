// ── Folders ─────────────────────────────────────────────────────────

import { REQUEST_FOLDER_TREE_KINDS, type RequestFolderParentRef, resolveTreeParent } from '@openheaders/core/sync';
import {
  buildCreateRequestFolderBatch,
  buildDeleteRequestFolderBatch,
  buildDeleteRequestFolderEntityBatch,
  buildRenameRequestFolderBatch,
} from '@openheaders/core/sync-builders/mutations/request-folder-mutations';
import { buildDeleteEntityBatch } from '@openheaders/core/sync-builders/mutations/request-mutations';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import { applyRequestFolderMutationOrThrow, applyRequestMutationOrThrow } from './apply';
import { deleteResponseExamplesForRequests } from './response-examples';
import { assertLoaded, collections, folders, type LocalFolder, requests } from './state';

/**
 * Resolve `parentPath` to a {@link RequestFolderParentRef} via the
 * local mirrors (request collection root `requests/<slug>-<uid>` or
 * request folder path), with the path's own uid tail as the fallback
 * the shared resolver applies.
 */
export function resolveRequestFolderParent(parentPath: string): RequestFolderParentRef | null {
  return resolveTreeParent(parentPath, { collections, folders }, REQUEST_FOLDER_TREE_KINDS);
}

export async function createRequestFolder(name: string, parentPath: string): Promise<LocalFolder | null> {
  assertLoaded();
  const parent = resolveRequestFolderParent(parentPath);
  if (!parent) return null;
  const uid = generateUid();
  const folderName = toFolderName(name, uid);
  await applyRequestFolderMutationOrThrow(
    (ctx) =>
      buildCreateRequestFolderBatch(
        { folderUid: uid, parent, name, pathSegment: folderName },
        { ...ctx, batchId: ctx.batchId ?? `request-folder-create-${uid}` },
      ),
    'createRequestFolder',
  );
  return { schemaVersion: 5, uid, path: `${parentPath}/${folderName}`, name };
}

export async function renameRequestFolder(uid: string, name: string): Promise<boolean> {
  assertLoaded();
  if (!folders.some((f) => f.uid === uid)) return false;
  await applyRequestFolderMutationOrThrow(
    (ctx) => buildRenameRequestFolderBatch({ folderUid: uid, name }, ctx),
    'renameRequestFolder',
  );
  return true;
}

export async function deleteRequestFolder(uid: string): Promise<boolean> {
  assertLoaded();
  const folder = folders.find((f) => f.uid === uid);
  if (!folder) return false;
  const parentPath = folder.path.substring(0, folder.path.lastIndexOf('/'));
  const parent = resolveRequestFolderParent(parentPath);

  // Cascade descendant request + request-folder deletes through the
  // oracle. Same pattern as rule-folder cascades.
  const cascadingRequestUids = requests.filter((r) => r.path.startsWith(`${folder.path}/`)).map((r) => r.uid);
  const cascadingNestedFolderUids = folders
    .filter((f) => f.uid !== uid && f.path.startsWith(`${folder.path}/`))
    .map((f) => f.uid);
  await deleteResponseExamplesForRequests(cascadingRequestUids);
  for (const reqUid of cascadingRequestUids) {
    await applyRequestMutationOrThrow(
      (ctx) => buildDeleteEntityBatch(reqUid, ctx),
      'deleteRequestFolder-cascade-request',
    );
  }
  for (const nestedUid of cascadingNestedFolderUids) {
    await applyRequestFolderMutationOrThrow(
      (ctx) => ({ batch: buildDeleteRequestFolderEntityBatch(nestedUid, ctx), sideEffects: [] }),
      'deleteRequestFolder-cascade-folder',
    );
  }
  // Final delete: the folder itself + its parent slot. Parent ref is
  // resolved above; if missing (parent already tombstoned), fall back
  // to the bare entity tombstone.
  if (parent) {
    await applyRequestFolderMutationOrThrow(
      (ctx) => buildDeleteRequestFolderBatch({ folderUid: uid, parent }, ctx),
      'deleteRequestFolder',
    );
  } else {
    await applyRequestFolderMutationOrThrow(
      (ctx) => ({ batch: buildDeleteRequestFolderEntityBatch(uid, ctx), sideEffects: [] }),
      'deleteRequestFolder',
    );
  }
  return true;
}
