/**
 * Files Store — SW-side wrapper around the IDB `BlobStore` plus the
 * sync engine's catalog of `FileRef` shells.
 *
 * Two-layer split (Phase B):
 *   • Bytes — `@openheaders/oracle/files` (IndexedDB, keyed by
 *     `(workspaceId, fileId)`). Always the source of truth for actual
 *     blob content.
 *   • Catalog — sync engine `files` entity (singleton, set-modeled by
 *     `fileId`). Routes through `oracle.apply` so concurrent uploads
 *     across surfaces converge under per-(setPath, itemId) LWW. The
 *     {@link FilesCache} owns the in-memory mirror via broadcast-driven
 *     re-projection — no separate `chrome.storage.local` write because
 *     the durable record is already in BlobStore IDB.
 *
 * Every mutating write does the byte layer first, then emits the
 * catalog mutation; on cold boot the bridge seeds the oracle from
 * `BlobStore.listBlobs` so the catalog matches the durable record.
 *
 * Reads (`list`, `get`) stay synchronous off the active mirror when the
 * service is bridged; cross-workspace reads + cold-boot reads (before
 * the bridge) fall back to BlobStore directly.
 */

import type { FileRef } from '@openheaders/core/files';
import type { FileRefSlot, MutationBatch, MutatorContext, SideEffectIntent } from '@openheaders/core/sync';
import { logger } from '@utils/logger';
import * as BlobStore from '@openheaders/oracle/files';
import { buildAddFileRefBatch, buildRemoveFileRefBatch, buildRenameFileRefBatch } from '@openheaders/oracle/sync-builders/files-mutations';
import { FILES_REGISTRATION } from '@openheaders/oracle/sync/entity-registry';
import type { FilesCache } from '@openheaders/oracle/sync/files-cache';
import {
  getActiveCacheForRegistration,
  getOracleForWorkspace,
  nextSwMutatorContextForWorkspace,
} from '@openheaders/oracle/sync/service';
import { getActiveWorkspaceId } from './workspace-store';

// ── Change listeners ────────────────────────────────────────────────
//
// Same pattern as environment-store: store modules emit a cheap
// "something mutated" ping and the background wiring translates it
// into a typed `filesChanged` broadcast. Renderers subscribe to the
// broadcast, not to the store, so multi-tab sync stays live without
// shared-worker hacks.

type ChangeListener = () => void;
const listeners: Set<ChangeListener> = new Set();

export function onFilesStoreChange(listener: ChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyChange(): void {
  for (const fn of listeners) fn();
}

// ── In-memory mirror (active workspace) ───────────────────────────

let mirror: FileRef[] = [];
let mirrorWorkspaceId: string | null = null;

// ── Reads ──────────────────────────────────────────────────────────

/** List every file in the given workspace (defaults to runtime-Active). Metadata only (no bytes). */
export async function listFiles(workspaceId?: string): Promise<FileRef[]> {
  const wsId = workspaceId ?? getActiveWorkspaceId();
  if (wsId === mirrorWorkspaceId) {
    // Defensive copy — callers occasionally sort the result in place.
    return mirror.slice();
  }
  return BlobStore.listBlobs(wsId);
}

/**
 * Return the raw bytes for the given `fileId` in the given workspace.
 * Used by the request executor when building a multipart body and by
 * the UI to offer a download. Returns null when the fileId isn't stored
 * in this workspace.
 */
export async function getFileBlob(fileId: string, workspaceId?: string): Promise<Blob | null> {
  const wsId = workspaceId ?? getActiveWorkspaceId();
  return BlobStore.getBlob(wsId, fileId);
}

/**
 * Return the raw bytes by content hash — first entry in the workspace
 * with that hash wins. Used by `{{file.X}}` template resolution when
 * users reference a file by content rather than identity.
 */
export async function getFileBlobByHash(hash: string, workspaceId?: string): Promise<Blob | null> {
  const wsId = workspaceId ?? getActiveWorkspaceId();
  return BlobStore.getBlobByHash(wsId, hash);
}

// ── Writes ─────────────────────────────────────────────────────────

/**
 * Upload a blob. Returns the resulting FileRef. Always creates a fresh
 * `fileId` even when the bytes already exist in the workspace (matches
 * the user's mental model: identical bytes uploaded under two filenames
 * = two files).
 *
 * Two-step write: BlobStore first (durable), catalog mutation second.
 * If the catalog emit fails, the bytes are present but unindexed —
 * acceptable; eventually consistent. The reverse (catalog before bytes)
 * could expose a fileId that has no bytes attached.
 */
export async function putFile(input: {
  blob: Blob;
  filename: string;
  mimeType?: string;
  workspaceId?: string;
}): Promise<FileRef> {
  const wsId = input.workspaceId ?? getActiveWorkspaceId();
  const ref = await BlobStore.putBlob(wsId, input);
  logger.debug('FilesStore', `Stored "${ref.filename}" (${ref.size}B, ${ref.hash.slice(0, 14)}…)`);
  await applyFilesMutationOrThrow(wsId, (ctx) => buildAddFileRefBatch({ ref: toSlot(ref) }, ctx), 'putFile');
  notifyChange();
  return ref;
}

/**
 * Rename a file's metadata in place. Two-step write that mirrors
 * `putFile` / `deleteFile`:
 *   1. {@link BlobStore.renameBlob} — durable update to the byte
 *      record (bytes + hash unchanged; only filename + mimeType move).
 *   2. Catalog `renameFileRef` envelope through the oracle so other
 *      surfaces converge to the new metadata via per-(setPath, itemId)
 *      LWW.
 *
 * Returns the updated `FileRef` shell on success, or `null` when the
 * fileId isn't present in this workspace (rename target deleted between
 * gesture and apply). Callers translate that into a structured RPC
 * response.
 */
export async function renameFile(input: {
  fileId: string;
  filename: string;
  mimeType?: string;
  workspaceId?: string;
}): Promise<FileRef | null> {
  const wsId = input.workspaceId ?? getActiveWorkspaceId();
  const updated = await BlobStore.renameBlob(wsId, input.fileId, {
    filename: input.filename,
    mimeType: input.mimeType,
  });
  if (!updated) return null;
  logger.debug('FilesStore', `Renamed ${updated.fileId} → "${updated.filename}"`);
  await applyFilesMutationOrThrow(wsId, (ctx) => buildRenameFileRefBatch({ ref: toSlot(updated) }, ctx), 'renameFile');
  notifyChange();
  return updated;
}

/** Delete a file by `fileId`. Returns `true` iff an entry was removed. */
export async function deleteFile(fileId: string, workspaceId?: string): Promise<boolean> {
  const wsId = workspaceId ?? getActiveWorkspaceId();
  const removed = await BlobStore.deleteBlob(wsId, fileId);
  if (!removed) return false;
  logger.info('FilesStore', `Deleted file ${fileId}`);
  await applyFilesMutationOrThrow(wsId, (ctx) => buildRemoveFileRefBatch({ fileId }, ctx), 'deleteFile');
  notifyChange();
  return true;
}

/**
 * Drop every blob owned by a workspace. Called by the
 * workspace-orchestrator during workspace delete to keep the
 * per-workspace-data-keys discipline honest. Direct BlobStore call —
 * the sync service is being torn down for that workspace, so emitting
 * a catalog tombstone wouldn't reach an oracle.
 */
export async function purgeFilesForWorkspace(workspaceId: string): Promise<void> {
  await BlobStore.clearWorkspaceBlobs(workspaceId);
  logger.info('FilesStore', `Purged all files for workspace ${workspaceId}`);
  if (workspaceId === mirrorWorkspaceId) {
    mirror = [];
  }
  notifyChange();
}

// ── Sync engine plumbing ──────────────────────────────────────────

async function applyFilesMutationOrThrow(
  workspaceId: string,
  factory: (ctx: MutatorContext) => { batch: MutationBatch; sideEffects: SideEffectIntent[] },
  op: string,
): Promise<void> {
  const oracle = getOracleForWorkspace(workspaceId);
  const ctx = nextSwMutatorContextForWorkspace(workspaceId, { surfaceId: 'sw' });
  if (!oracle || !ctx) {
    throw new Error(`FilesStore.${op}: sync service not initialized for workspace ${workspaceId}`);
  }
  const { batch, sideEffects } = factory(ctx);
  if (batch.mutations.length === 0) return;
  const result = await oracle.apply(batch, sideEffects);
  if (!result.ok) {
    throw new Error(
      `FilesStore.${op}: oracle rejected batch (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
    );
  }
}

function toSlot(ref: FileRef): FileRefSlot {
  return {
    fileId: ref.fileId,
    hash: ref.hash,
    filename: ref.filename,
    mimeType: ref.mimeType,
    size: ref.size,
  };
}

// ── Hydration / bridge ────────────────────────────────────────────

let cacheUnsubscribe: (() => void) | null = null;

/**
 * Wire the local mirror to the active workspace's {@link FilesCache}.
 * Idempotent — the prior subscription is dropped first. Seeds the
 * oracle from the workspace's current `BlobStore` rows (the durable
 * record).
 */
export async function bridgeFilesSyncEngine(): Promise<void> {
  const cache = getActiveCacheForRegistration<FilesCache>(FILES_REGISTRATION);
  if (!cache) return;
  if (cacheUnsubscribe) {
    cacheUnsubscribe();
    cacheUnsubscribe = null;
  }
  const workspaceId = getActiveWorkspaceId();
  cacheUnsubscribe = cache.onChange(() => {
    mirror = cache.getSnapshot().refs.slice();
    notifyChange();
  });
  const persisted = await BlobStore.listBlobs(workspaceId);
  await cache.seedFromPersistedFiles(persisted);
  mirror = cache.getSnapshot().refs.slice();
  mirrorWorkspaceId = workspaceId;
  logger.info('FilesStore', `Bridged ws=${workspaceId}: ${mirror.length} refs`);
}

// ── Test helpers ──────────────────────────────────────────────────

export function __resetForTests(): void {
  mirror = [];
  mirrorWorkspaceId = null;
  listeners.clear();
  if (cacheUnsubscribe) {
    cacheUnsubscribe();
    cacheUnsubscribe = null;
  }
}
