/**
 * Per-envelope files post-state projection (Phase B).
 *
 * Thin adapter over `flat-entity-post-state.ts` (singleton variant).
 * Folds the live set at `refs` into a `FileRef[]` so renderer +
 * executor consumers see post-commit state without iterating arrays.
 *
 * Bytes never appear in this payload — the projection carries only the
 * `(fileId, hash, filename, mimeType, size)` shell. Bytes are read
 * lazily from the platform `BlobStore` when consumers actually need
 * them.
 */

import type { FileRef } from '@openheaders/core/files';
import type { SyncFilesPostState } from '@openheaders/core/protocol';
import { FILES_ENTITY_TYPE, FILES_ID, FILES_REFS_PATH, type FileRefSlot } from '@openheaders/core/sync';
import { makeSingletonEntityProjectors } from './flat-entity-post-state';
import type { EntityOracle } from './oracle';

type Reads = Pick<EntityOracle, 'materializeOne' | 'liveSetItems'>;

const projectors = makeSingletonEntityProjectors<Reads, SyncFilesPostState>({
  entityType: FILES_ENTITY_TYPE,
  entityId: FILES_ID,
  compose: (_materialized, oracle) => {
    const refs: FileRef[] = [];
    for (const entry of oracle.liveSetItems(FILES_ENTITY_TYPE, FILES_ID, FILES_REFS_PATH)) {
      if (!isFileRefSlot(entry.item)) continue;
      refs.push(toFileRef(entry.item));
    }
    refs.sort((a, b) => (a.fileId < b.fileId ? -1 : a.fileId > b.fileId ? 1 : 0));
    const fileIds = refs.map((r) => r.fileId);
    return { refs, fileIds };
  },
});

export const projectFilesPostState = projectors.projectPostState;
export const projectFilesSingleton = projectors.projectSingleton;

const isFileRefSlot = (v: unknown): v is FileRefSlot => {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.fileId === 'string' &&
    typeof r.hash === 'string' &&
    typeof r.filename === 'string' &&
    typeof r.size === 'number'
  );
};

function toFileRef(slot: FileRefSlot): FileRef {
  return {
    fileId: slot.fileId,
    hash: slot.hash,
    filename: slot.filename,
    mimeType: slot.mimeType,
    size: slot.size,
  };
}
