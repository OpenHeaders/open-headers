/**
 * Renderer-side imperative entry point for files catalog writes.
 *
 * Mirrors `pause-markers-write-client.ts` for the singleton files
 * entity. Each helper builds a `MutationBatch` and fires
 * `oh.sync.apply` directly. **Bytes are NOT handled here** — these
 * helpers only mutate the `FileRef` catalog. Renderers that need to
 * actually upload bytes still go through the existing `putFile` RPC,
 * which routes the byte write through `BlobStore` + emits the catalog
 * mutation in the same SW path.
 *
 * Shipped alongside the SW write-site conversion as a future-ready
 * surface for renderer-direct catalog updates (rename, metadata edits)
 * — none of those gestures land in this slice but the seam is in
 * place.
 */

import {
  type FileRefSlot,
  type MutatorIntent,
} from '@openheaders/core/sync';
import { call } from '@utils/bridge';
import {
  ensureRendererContext,
  type RendererContextHandle,
} from '@/context/renderer-mutator-context';
import {
  createFilesSyncMirror,
  getActiveFilesSyncMirror,
  type FilesSyncMirror,
} from '@/context/files-sync-mirror';
import {
  buildAddFileRefBatch,
  buildRemoveFileRefBatch,
} from '@/shared/sync/files-mutations';

// Re-exported so tests can construct a mirror without going through the singleton.
export { createFilesSyncMirror } from '@/context/files-sync-mirror';

export type FilesResult = { ok: true } | { ok: false; reason: 'other'; message?: string };

export interface FilesWriteOptions {
  workspaceId: string;
  surfaceId: string;
  batchId?: string;
  mirror?: FilesSyncMirror;
  context?: RendererContextHandle;
}

function resolveContext(opts: FilesWriteOptions): RendererContextHandle {
  if (opts.context) return opts.context;
  return ensureRendererContext({ workspaceId: opts.workspaceId, surfaceId: opts.surfaceId });
}

function resolveMirror(opts: FilesWriteOptions): FilesSyncMirror {
  return opts.mirror ?? getActiveFilesSyncMirror();
}

async function applyPayload(payload: MutatorIntent): Promise<FilesResult> {
  if (payload.batch.mutations.length === 0) return { ok: true };
  try {
    const resp = await call('oh.sync.apply', {
      batch: payload.batch,
      sideEffects: payload.sideEffects,
    });
    if (resp.ok) return { ok: true };
    return { ok: false, reason: 'other', message: resp.failure?.detail };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return { ok: false, reason: 'other', message };
  }
}

export interface ApplyFileAddInput {
  ref: FileRefSlot;
}

export async function applyFileAdd(
  input: ApplyFileAddInput,
  opts: FilesWriteOptions,
): Promise<FilesResult> {
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applyPayload(buildAddFileRefBatch(input, ctx));
}

export interface ApplyFileRemoveInput {
  fileId: string;
}

export async function applyFileRemove(
  input: ApplyFileRemoveInput,
  opts: FilesWriteOptions,
): Promise<FilesResult> {
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applyPayload(buildRemoveFileRefBatch(input, ctx));
}

export function activeMirror(): FilesSyncMirror {
  return getActiveFilesSyncMirror();
}
