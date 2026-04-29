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
import { call } from '@utils/bridge';
import {
  ensureRendererContext,
  type RendererContextHandle,
} from '@/context/rule-mutator-context';
import {
  getActiveLiveVariableSyncMirror,
  type LiveVariableSyncMirror,
} from '@/context/live-variable-sync-mirror';
import {
  buildAddLiveVariableBatch,
  buildDeleteLiveVariableBatch,
  buildUpdateLiveVariableBatch,
  type LiveVariableMutationPayload,
} from '@/shared/sync/live-variable-mutations';

export type LiveVariableUpdates = Partial<Omit<V5.LiveVariable, 'uid' | 'path' | 'schemaVersion'>>;

export type LiveVariableMutationResult =
  | { ok: true; liveVariable: V5.LiveVariable }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export type LiveVariableSimpleResult =
  | { ok: true }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

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

function resolveContext(opts: LiveVariableWriteOptions): RendererContextHandle {
  if (opts.context) return opts.context;
  return ensureRendererContext({ workspaceId: opts.workspaceId, surfaceId: opts.surfaceId });
}

async function applyPayload(payload: LiveVariableMutationPayload): Promise<LiveVariableSimpleResult> {
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

export async function applyLiveVariableUpdate(
  liveVariableUid: string,
  updates: LiveVariableUpdates,
  opts: LiveVariableWriteOptions,
): Promise<LiveVariableMutationResult> {
  const mirror = resolveMirror(opts);
  const entry = mirror.getLiveVariableMirror(liveVariableUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildUpdateLiveVariableBatch(liveVariableUid, updates, ctx);
  const ack = await applyPayload(payload);
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
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildAddLiveVariableBatch(liveVariable, ctx);
  return applyPayload(payload);
}

export async function applyLiveVariableDelete(
  liveVariableUid: string,
  opts: LiveVariableWriteOptions,
): Promise<LiveVariableSimpleResult> {
  const mirror = resolveMirror(opts);
  if (!mirror.getLiveVariableMirror(liveVariableUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildDeleteLiveVariableBatch(liveVariableUid, ctx);
  return applyPayload(payload);
}
