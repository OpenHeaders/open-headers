/**
 * Renderer-side imperative entry point for live-variable writes.
 *
 * Mirrors `template-write-client`: write sites build a `MutationBatch`
 * via the shared catalog factories and fire `oh.sync.apply` directly
 * — no SW round-trip per write. LV is fully flat-scalar so set
 * replacement is not in scope; updates are a flat per-key `setField`
 * loop.
 */

import type { V5 } from '@openheaders/core/types';
import { applySyncPayload, resolveRendererContext, type SyncSimpleResult } from '@/shared/sync/apply-payload';
import type { RendererContextHandle } from '@/context/renderer-mutator-context';
import {
  getActiveLiveVariableSyncMirror,
  type LiveVariableSyncMirror,
} from '@/context/live-variable-sync-mirror';
import {
  buildAddLiveVariableBatch,
  buildDeleteLiveVariableBatch,
  buildUpdateLiveVariableBatch,
} from '@/shared/sync/live-variable-mutations';

export type LiveVariableUpdates = Partial<Omit<V5.LiveVariable, 'uid' | 'path' | 'schemaVersion'>>;

export type LiveVariableMutationResult =
  | { ok: true; liveVariable: V5.LiveVariable }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export type LiveVariableSimpleResult = SyncSimpleResult;

export interface LiveVariableWriteOptions {
  workspaceId: string;
  surfaceId: string;
  batchId?: string;
  mirror?: LiveVariableSyncMirror;
  context?: RendererContextHandle;
}

function resolveMirror(opts: LiveVariableWriteOptions): LiveVariableSyncMirror {
  return opts.mirror ?? getActiveLiveVariableSyncMirror();
}

export async function applyLiveVariableUpdate(
  liveVariableUid: string,
  updates: LiveVariableUpdates,
  opts: LiveVariableWriteOptions,
): Promise<LiveVariableMutationResult> {
  const mirror = resolveMirror(opts);
  const entry = mirror.getLiveVariableMirror(liveVariableUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildUpdateLiveVariableBatch(liveVariableUid, updates, ctx);
  const ack = await applySyncPayload(payload);
  if (ack.ok) {
    return { ok: true, liveVariable: { ...entry.liveVariable, ...updates } as V5.LiveVariable };
  }
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

export async function applyLiveVariableCreate(
  liveVariable: V5.LiveVariable,
  opts: LiveVariableWriteOptions,
): Promise<LiveVariableSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildAddLiveVariableBatch(liveVariable, ctx);
  return applySyncPayload(payload);
}

export async function applyLiveVariableDelete(
  liveVariableUid: string,
  opts: LiveVariableWriteOptions,
): Promise<LiveVariableSimpleResult> {
  const mirror = resolveMirror(opts);
  if (!mirror.getLiveVariableMirror(liveVariableUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildDeleteLiveVariableBatch(liveVariableUid, ctx);
  return applySyncPayload(payload);
}
