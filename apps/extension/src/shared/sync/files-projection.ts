/**
 * Files projection — `FileRef[] ⇄ MutationBatch`.
 *
 * The persisted record lives one layer down: byte rows in the
 * `oh.files` IndexedDB store, each row carrying both blob bytes and a
 * `FileRef` shell. The sync engine governs only the catalog of refs —
 * no bytes ever cross the mutation log. `seedFiles` walks a list of
 * refs and emits one `addToSet` per entry under `FILES_REFS_PATH`,
 * plus one `create` for the scalar shell. All-or-nothing under the
 * oracle's per-entity lock.
 *
 * The materialized form folds set items into arrays; consumers want
 * `FileRef[]`. The post-state projector in `files-post-state.ts` uses
 * `oracle.liveSetItems` to recover the original refs — projection is
 * co-located there because it needs oracle access; this file owns
 * only seed.
 */

import type { FileRef } from '@openheaders/core/files';
import {
  FILES_ENTITY_TYPE,
  FILES_ID,
  FILES_REFS_PATH,
  type FileRefSlot,
  mintBatch,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
} from '@openheaders/core/sync';

/**
 * Convert a list of `FileRef` into a `MutationBatch` of one `create`
 * for the scalar shell + one `addToSet` per ref. All-or-nothing under
 * the oracle's per-entity lock.
 */
export function seedFiles(refs: readonly FileRef[], ctx: MutatorContext): MutationBatch {
  const bodies: MutationBody[] = [
    {
      kind: 'create',
      type: FILES_ENTITY_TYPE,
      id: FILES_ID,
      payload: {},
    },
  ];
  for (const ref of refs) {
    const slot: FileRefSlot = {
      fileId: ref.fileId,
      hash: ref.hash,
      filename: ref.filename,
      mimeType: ref.mimeType,
      size: ref.size,
    };
    bodies.push({
      kind: 'addToSet',
      type: FILES_ENTITY_TYPE,
      id: FILES_ID,
      path: FILES_REFS_PATH,
      itemId: ref.fileId,
      item: slot,
    });
  }
  return mintBatch(ctx, bodies);
}
