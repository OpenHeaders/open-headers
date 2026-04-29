/**
 * `createRequestFolder` + `deleteRequestFolder` — request-folder entity lifecycle.
 *
 * Mirrors the rule-side folder lifecycle: each is a cross-entity batch
 * touching the folder entity itself plus the parent's child slot. The
 * `pathSegment` is frozen at create time so a rename never moves the
 * filesystem-style slug; downstream requests embed this segment in
 * their `path` and would orphan if it shifted.
 *
 * Cascading request deletes when a folder is removed are NOT modelled
 * here — the SW-side `request-store` cascade emits per-request
 * `delete(request, ...)` envelopes minted by the request catalog. Cross-
 * entity orchestration stays outside the folder catalog.
 */

import { toFolderName } from '../../../utils/workspace';
import type { MutationBody } from '../../envelope';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import {
  REQUEST_FOLDER_CHILDREN_PATH,
  REQUEST_FOLDER_ENTITY_TYPE,
  type RequestFolderParentRef,
  type RequestFolderSlot,
} from './types';

export interface CreateRequestFolderArgs {
  folderUid: string;
  parent: RequestFolderParentRef;
  name: string;
  /**
   * Stable last path segment for the folder's filesystem-style path
   * (e.g. `auth-x7k2abcd`). Frozen at create time; defaults to
   * `toFolderName(name, folderUid)` when the caller omits it.
   */
  pathSegment?: string;
  /** Pre-computed fractional-indexing key for the new slot's position. */
  orderKey?: string;
}

export function createRequestFolder(
  ctx: MutatorContext,
  args: CreateRequestFolderArgs,
): MutatorIntent {
  const slot: RequestFolderSlot = { uid: args.folderUid };
  const pathSegment = args.pathSegment ?? toFolderName(args.name, args.folderUid);
  const bodies: MutationBody[] = [
    {
      kind: 'create',
      type: REQUEST_FOLDER_ENTITY_TYPE,
      id: args.folderUid,
      payload: { schemaVersion: 5, name: args.name, pathSegment },
    },
    {
      kind: 'addToSet',
      type: args.parent.type,
      id: args.parent.uid,
      path: REQUEST_FOLDER_CHILDREN_PATH,
      itemId: args.folderUid,
      item: slot,
      orderKey: args.orderKey,
    },
  ];
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}

export interface DeleteRequestFolderArgs {
  folderUid: string;
  parent: RequestFolderParentRef;
}

export function deleteRequestFolder(
  ctx: MutatorContext,
  args: DeleteRequestFolderArgs,
): MutatorIntent {
  const bodies: MutationBody[] = [
    {
      kind: 'removeFromSet',
      type: args.parent.type,
      id: args.parent.uid,
      path: REQUEST_FOLDER_CHILDREN_PATH,
      itemId: args.folderUid,
    },
    { kind: 'delete', type: REQUEST_FOLDER_ENTITY_TYPE, id: args.folderUid },
  ];
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}
