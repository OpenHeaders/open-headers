/**
 * Renderer-side imperative entry point for spec writes.
 *
 * Mirrors `script-package-write-client`: write sites build a
 * `MutationBatch` via the shared spec-mutation builders and fire
 * `oh.sync.apply` directly — no SW round-trip per write. Scalar
 * metadata (name, description, format) rides per-key `setField`
 * envelopes; the source-file set rides the upsert/remove pair keyed by
 * `file.uid`. Specs are design-time documents — every batch carries
 * zero side effects.
 *
 * File upserts are position-preserving (§23.5): an existing row keeps
 * its live orderKey from the mirror; a new row appends after the
 * current tail.
 */

import {
  buildAddSpecBatch,
  buildDeleteSpecBatch,
  buildRemoveSpecFileBatch,
  buildSetSpecFileBatch,
  buildUpdateSpecBatch,
} from '@openheaders/core/sync-builders/mutations/spec-mutations';
import { keyBetween } from '@openheaders/core/sync';
import type { Spec, SpecFile } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import { getSpecSyncMirrorForWorkspace, type SpecSyncMirror } from '../../context/mirrors/spec-sync-mirror';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from './apply-payload';

export type SpecUpdates = Partial<Pick<Spec, 'name' | 'description' | 'format' | 'rootFileUid'>>;

export type SpecMutationResult =
  | { ok: true; spec: Spec }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export type SpecSimpleResult = SyncSimpleResult;

export interface SpecWriteOptions extends BaseSyncWriteOptions {
  mirror?: SpecSyncMirror;
}

export async function applySpecCreate(
  request: { spec: Omit<Spec, 'uid' | 'path' | 'schemaVersion'> },
  opts: SpecWriteOptions,
): Promise<SpecMutationResult> {
  const uid = generateUid();
  const created: Spec = {
    ...request.spec,
    schemaVersion: 5 as const,
    uid,
    path: `specs/${toFolderName(request.spec.name, uid)}`,
  };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildAddSpecBatch(created, ctx);
  const ack = await applySyncPayload(payload);
  if (ack.ok) return { ok: true, spec: created };
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

export async function applySpecUpdate(
  specUid: string,
  updates: SpecUpdates,
  opts: SpecWriteOptions,
): Promise<SpecMutationResult> {
  const mirror = resolveMirror(opts, getSpecSyncMirrorForWorkspace);
  await mirror.hydrated;
  const entry = mirror.getSpecMirror(specUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildUpdateSpecBatch(specUid, updates, ctx);
  const ack = await applySyncPayload(payload);
  if (ack.ok) return { ok: true, spec: { ...entry.spec, ...updates } };
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

export async function applySpecDelete(specUid: string, opts: SpecWriteOptions): Promise<SpecSimpleResult> {
  const mirror = resolveMirror(opts, getSpecSyncMirrorForWorkspace);
  await mirror.hydrated;
  if (!mirror.getSpecMirror(specUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildDeleteSpecBatch(specUid, ctx);
  return applySyncPayload(payload);
}

/**
 * Upsert one source file (add, content edit, or rename — the row is
 * whole-record LWW keyed by `file.uid`). An existing row keeps its
 * live orderKey; a new row appends after the current tail.
 */
export async function applySpecSetFile(
  specUid: string,
  file: SpecFile,
  opts: SpecWriteOptions,
): Promise<SpecSimpleResult> {
  const mirror = resolveMirror(opts, getSpecSyncMirrorForWorkspace);
  await mirror.hydrated;
  if (!mirror.getSpecMirror(specUid)) return { ok: false, reason: 'not-found' };
  const orderKeys = mirror.liveFileOrderKeys(specUid);
  const existing = orderKeys.find((e) => e.itemId === file.uid);
  const tail = orderKeys.length > 0 ? orderKeys[orderKeys.length - 1].orderKey : null;
  const orderKey = existing ? existing.orderKey : keyBetween(tail, null);
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildSetSpecFileBatch({ specUid, file, orderKey }, ctx);
  return applySyncPayload(payload);
}

export async function applySpecRemoveFile(
  specUid: string,
  fileUid: string,
  opts: SpecWriteOptions,
): Promise<SpecSimpleResult> {
  const mirror = resolveMirror(opts, getSpecSyncMirrorForWorkspace);
  await mirror.hydrated;
  if (!mirror.getSpecMirror(specUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildRemoveSpecFileBatch({ specUid, uid: fileUid }, ctx);
  return applySyncPayload(payload);
}
