/**
 * Per-envelope files post-state projection (Phase B).
 *
 * Same shape as `pause-markers-post-state.ts` for the singleton files
 * entity. Folds the live set at `refs` into a `FileRef[]` so renderer
 * + executor consumers see post-commit state without iterating arrays.
 *
 * Tombstoned (singleton deletion is a workspace-teardown gesture only)
 * and non-matching envelopes return `null`.
 *
 * Bytes never appear in this payload — the projection carries only the
 * `(fileId, hash, filename, mimeType, size)` shell. Bytes are read
 * lazily from the platform `BlobStore` when consumers actually need
 * them.
 */

import type { FileRef } from '@openheaders/core/files';
import type { SyncFilesPostState } from '@openheaders/core/protocol';
import {
  FILES_ENTITY_TYPE,
  FILES_ID,
  FILES_REFS_PATH,
  type FileRefSlot,
  type MutationEnvelope,
} from '@openheaders/core/sync';
import type { EntityOracle } from './oracle';

/**
 * Build the files post-state for `envelope` using `oracle`. Returns
 * `null` for non-matching envelopes, deletes (entity tombstoned), and
 * any envelope whose materialized record fails to project.
 */
export function projectFilesPostState(
  oracle: Pick<EntityOracle, 'materializeOne' | 'liveSetItems'>,
  envelope: MutationEnvelope,
): SyncFilesPostState | null {
  if (envelope.body.type !== FILES_ENTITY_TYPE) return null;
  return projectFilesSingleton(oracle);
}

/**
 * Build the files post-state for the singleton entity. Used by the
 * snapshot RPC to seed freshly-mounted renderer mirrors before the
 * next live broadcast lands. Returns `null` when the singleton hasn't
 * been materialized yet (cold oracle prior to seed).
 */
export function projectFilesSingleton(
  oracle: Pick<EntityOracle, 'materializeOne' | 'liveSetItems'>,
): SyncFilesPostState | null {
  const materialized = oracle.materializeOne(FILES_ENTITY_TYPE, FILES_ID);
  if (!materialized) return null;

  const refs: FileRef[] = [];
  for (const entry of oracle.liveSetItems(FILES_ENTITY_TYPE, FILES_ID, FILES_REFS_PATH)) {
    if (!isFileRefSlot(entry.item)) continue;
    refs.push(toFileRef(entry.item));
  }
  refs.sort((a, b) => (a.fileId < b.fileId ? -1 : a.fileId > b.fileId ? 1 : 0));
  const fileIds = refs.map((r) => r.fileId);
  return { refs, fileIds };
}

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
