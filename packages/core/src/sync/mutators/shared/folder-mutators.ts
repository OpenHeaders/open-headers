/**
 * Shared folder-mutator factory.
 *
 * The three folder catalogs (`folder/`, `request-folder/`,
 * `template-folder/`) all model the same shape:
 *   - the folder entity itself carries `{ name, pathSegment, schemaVersion }`
 *   - the parent (collection or sibling folder) carries an ordered set
 *     of slot markers `{ uid }` at a fixed path (`folders`)
 *   - lifecycle = create entity + addToSet slot / removeFromSet slot + delete entity
 *   - move = same-parent `moveBefore` OR atomic remove+add reparent
 *   - rename = `setField('name', _)` on the entity
 *
 * Per-batch all-or-nothing at the local oracle (§11.2) keeps observers
 * from seeing the half-and-half intermediate state on lifecycle and
 * reparent batches.
 *
 * Cascading children deletes (rules / requests / templates under a
 * folder) are NOT modelled here — the SW-side store cascades emit per-
 * child `delete(...)` envelopes minted by the child catalog. Cross-
 * entity orchestration stays outside the folder catalog (see session 14
 * for the equivalent collection-delete pattern).
 *
 * Side effects are always empty: a folder rename or move never changes
 * variable resolution downstream.
 */

import { toFolderName } from '../../../utils/workspace';
import type { MutationBatch, MutationBody } from '../../envelope';
import type { MutatorContext, MutatorIntent } from '../types';

export interface FolderParentRefShape {
  type: string;
  uid: string;
}

export interface FolderMutatorBindings {
  entityType: string;
  childrenPath: string;
  mintBatch: (ctx: MutatorContext, bodies: MutationBody[]) => MutationBatch;
}

export interface CreateFolderInput<P extends FolderParentRefShape> {
  folderUid: string;
  parent: P;
  name: string;
  /**
   * Stable last path segment for the folder's filesystem-style path
   * (e.g. `login-x7k2abcd`). Frozen at create time so the projected
   * `path` doesn't shift on rename — children embed this segment in
   * their own paths and would orphan if it moved. Defaults to
   * `toFolderName(name, folderUid)` when omitted.
   */
  pathSegment?: string;
  /** Pre-computed fractional-indexing key for the new slot's position. */
  orderKey?: string;
}

export interface DeleteFolderInput<P extends FolderParentRefShape> {
  folderUid: string;
  parent: P;
}

export interface MoveFolderInput<P extends FolderParentRefShape> {
  folderUid: string;
  newParent: P;
  /** Fractional-indexing key for the new slot position. Required —
   *  callers derive it from their live mirror via `keyBetween(prev, next)`. */
  orderKey: string;
  /** Omit (or pass equal to `newParent`) for intra-parent reorder. */
  oldParent?: P;
}

export interface RenameFolderInput {
  folderUid: string;
  name: string;
}

export interface FolderMutators<P extends FolderParentRefShape> {
  createFolder(ctx: MutatorContext, input: CreateFolderInput<P>): MutatorIntent;
  deleteFolder(ctx: MutatorContext, input: DeleteFolderInput<P>): MutatorIntent;
  /** Sibling reorder + reparent. LWW per (setPath, itemId) for same-parent;
   *  per-batch all-or-nothing for cross-parent. */
  moveFolder(ctx: MutatorContext, input: MoveFolderInput<P>): MutatorIntent;
  renameFolder(ctx: MutatorContext, input: RenameFolderInput): MutatorIntent;
}

export function makeFolderMutators<P extends FolderParentRefShape>(
  bindings: FolderMutatorBindings,
): FolderMutators<P> {
  const { entityType, childrenPath, mintBatch } = bindings;

  return {
    createFolder(ctx, input) {
      const pathSegment = input.pathSegment ?? toFolderName(input.name, input.folderUid);
      const bodies: MutationBody[] = [
        {
          kind: 'create',
          type: entityType,
          id: input.folderUid,
          payload: { schemaVersion: 5, name: input.name, pathSegment },
        },
        {
          kind: 'addToSet',
          type: input.parent.type,
          id: input.parent.uid,
          path: childrenPath,
          itemId: input.folderUid,
          item: { uid: input.folderUid },
          orderKey: input.orderKey,
        },
      ];
      return { batch: mintBatch(ctx, bodies), sideEffects: [] };
    },
    deleteFolder(ctx, input) {
      const bodies: MutationBody[] = [
        {
          kind: 'removeFromSet',
          type: input.parent.type,
          id: input.parent.uid,
          path: childrenPath,
          itemId: input.folderUid,
        },
        { kind: 'delete', type: entityType, id: input.folderUid },
      ];
      return { batch: mintBatch(ctx, bodies), sideEffects: [] };
    },
    moveFolder(ctx, input) {
      const sameParent =
        !input.oldParent ||
        (input.oldParent.type === input.newParent.type && input.oldParent.uid === input.newParent.uid);

      if (sameParent) {
        return {
          batch: mintBatch(ctx, [
            {
              kind: 'moveBefore',
              type: input.newParent.type,
              id: input.newParent.uid,
              path: childrenPath,
              itemId: input.folderUid,
              orderKey: input.orderKey,
            },
          ]),
          sideEffects: [],
        };
      }

      const oldParent = input.oldParent as P;
      const bodies: MutationBody[] = [
        {
          kind: 'removeFromSet',
          type: oldParent.type,
          id: oldParent.uid,
          path: childrenPath,
          itemId: input.folderUid,
        },
        {
          kind: 'addToSet',
          type: input.newParent.type,
          id: input.newParent.uid,
          path: childrenPath,
          itemId: input.folderUid,
          item: { uid: input.folderUid },
          orderKey: input.orderKey,
        },
      ];
      return { batch: mintBatch(ctx, bodies), sideEffects: [] };
    },
    renameFolder(ctx, input) {
      return {
        batch: mintBatch(ctx, [
          { kind: 'setField', type: entityType, id: input.folderUid, path: 'name', value: input.name },
        ]),
        sideEffects: [],
      };
    },
  };
}
