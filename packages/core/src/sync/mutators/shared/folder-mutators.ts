/**
 * Shared folder-mutator factory — a thin adapter over the generic
 * child-mutator factory (`child-mutators.ts`).
 *
 * The three folder catalogs (`folder/`, `request-folder/`,
 * `template-folder/`) all model the same shape:
 *   - the folder entity itself carries `{ name, pathSegment, schemaVersion }`
 *   - the parent (collection or sibling folder) carries an ordered set
 *     of slot markers `{ uid }` at a fixed path (`folders`)
 *   - lifecycle / move are the generic child verbs
 *   - rename = `setField('name', _)` on the entity
 *
 * Cascading children deletes (rules / requests / templates under a
 * folder) are NOT modelled here — the SW-side store cascades emit per-
 * child `delete(...)` envelopes minted by the child catalog. Cross-
 * entity orchestration stays outside the folder catalog.
 *
 * Side effects are always empty: a folder rename or move never changes
 * variable resolution downstream.
 */

import { toFolderName } from '../../../utils/workspace';
import type { MutationBatch, MutationBody } from '../../envelope';
import type { MutatorContext, MutatorIntent } from '../types';
import { type ChildMutators, type ChildSlotShape, makeChildMutators, type ParentRefShape } from './child-mutators';

export type FolderParentRefShape = ParentRefShape;

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
  /** The generic child verbs the folder verbs adapt — seed builders and
   *  cascades reach for `slotAdd` / `slotRemove` here. */
  child: ChildMutators<P>;
}

export function makeFolderMutators<P extends FolderParentRefShape>(bindings: FolderMutatorBindings): FolderMutators<P> {
  const { entityType, childrenPath, mintBatch } = bindings;
  const child = makeChildMutators<P, ChildSlotShape>({
    entityType,
    childrenPath,
    slot: (uid) => ({ uid }),
    mintBatch,
  });

  return {
    child,
    createFolder(ctx, input) {
      const pathSegment = input.pathSegment ?? toFolderName(input.name, input.folderUid);
      return child.create(ctx, {
        childUid: input.folderUid,
        parent: input.parent,
        payload: { schemaVersion: 5, name: input.name, pathSegment },
        orderKey: input.orderKey,
      });
    },
    deleteFolder(ctx, input) {
      return child.delete(ctx, { childUid: input.folderUid, parent: input.parent });
    },
    moveFolder(ctx, input) {
      return child.move(ctx, {
        childUid: input.folderUid,
        newParent: input.newParent,
        orderKey: input.orderKey,
        oldParent: input.oldParent,
      });
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
