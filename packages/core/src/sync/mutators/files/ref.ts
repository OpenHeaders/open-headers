/**
 * FileRef intent factories.
 *
 * Two primitives keyed by `fileId`:
 *   - `addFileRef(ref)` — addToSet on the singleton's `refs` path.
 *     Concurrent same-fileId adds converge under per-(setPath, itemId)
 *     LWW; the highest-HLC payload wins. In practice each upload mints
 *     a fresh fileId (see `@openheaders/core/files.newFileId`), so
 *     contention is bounded to the rare metadata-rewrite case (filename
 *     rename — not surfaced today).
 *   - `removeFileRef(fileId)` — removeFromSet tombstone. The catalog
 *     drops the entry; the platform `BlobStore` deletion is the
 *     write-site's responsibility (catalog never owns bytes).
 *
 * No side effects. Rules don't reference files at the catalog level;
 * the variables resolver rebuilds its `FileRegistry` from `listFiles()`
 * at request time, so catalog mutations need no RECOMPILE_DNR /
 * INVALIDATE_RESOLVER intent.
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { FILES_ENTITY_TYPE, FILES_ID, FILES_REFS_PATH, type FileRefSlot } from './types';

export interface AddFileRefArgs {
  ref: FileRefSlot;
}

export function addFileRef(ctx: MutatorContext, args: AddFileRefArgs): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'addToSet',
        type: FILES_ENTITY_TYPE,
        id: FILES_ID,
        path: FILES_REFS_PATH,
        itemId: args.ref.fileId,
        item: args.ref,
      },
    ]),
    sideEffects: [],
  };
}

export interface RemoveFileRefArgs {
  fileId: string;
}

export function removeFileRef(ctx: MutatorContext, args: RemoveFileRefArgs): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'removeFromSet',
        type: FILES_ENTITY_TYPE,
        id: FILES_ID,
        path: FILES_REFS_PATH,
        itemId: args.fileId,
      },
    ]),
    sideEffects: [],
  };
}
