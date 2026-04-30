/**
 * Renderer-side imperative entry point for live-workflow writes.
 *
 * Same posture as `live-variable-write-client`. LW has no set-modeled
 * paths — `steps` is whole-array LWW, `refresh` is whole-policy LWW —
 * so the update path is a flat per-key `setField` loop.
 */

import type { V5 } from '@openheaders/core/types';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveRendererContext,
  type SyncSimpleResult,
} from '@/shared/sync/apply-payload';
import {
  getActiveLiveWorkflowSyncMirror,
  type LiveWorkflowSyncMirror,
} from '@/context/live-workflow-sync-mirror';
import {
  buildAddLiveWorkflowBatch,
  buildDeleteLiveWorkflowBatch,
  buildUpdateLiveWorkflowBatch,
} from '@/shared/sync/live-workflow-mutations';

export type LiveWorkflowUpdates = Partial<Omit<V5.LiveWorkflow, 'uid' | 'path' | 'schemaVersion'>>;

export type LiveWorkflowMutationResult =
  | { ok: true; workflow: V5.LiveWorkflow }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export type LiveWorkflowSimpleResult = SyncSimpleResult;

export interface LiveWorkflowWriteOptions extends BaseSyncWriteOptions {
  mirror?: LiveWorkflowSyncMirror;
}

function resolveMirror(opts: LiveWorkflowWriteOptions): LiveWorkflowSyncMirror {
  return opts.mirror ?? getActiveLiveWorkflowSyncMirror();
}

export async function applyLiveWorkflowUpdate(
  workflowUid: string,
  updates: LiveWorkflowUpdates,
  opts: LiveWorkflowWriteOptions,
): Promise<LiveWorkflowMutationResult> {
  const mirror = resolveMirror(opts);
  const entry = mirror.getLiveWorkflowMirror(workflowUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildUpdateLiveWorkflowBatch(workflowUid, updates, ctx);
  const ack = await applySyncPayload(payload);
  if (ack.ok) {
    return { ok: true, workflow: { ...entry.workflow, ...updates } as V5.LiveWorkflow };
  }
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

export async function applyLiveWorkflowCreate(
  workflow: V5.LiveWorkflow,
  opts: LiveWorkflowWriteOptions,
): Promise<LiveWorkflowSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildAddLiveWorkflowBatch(workflow, ctx);
  return applySyncPayload(payload);
}

export async function applyLiveWorkflowDelete(
  workflowUid: string,
  opts: LiveWorkflowWriteOptions,
): Promise<LiveWorkflowSimpleResult> {
  const mirror = resolveMirror(opts);
  if (!mirror.getLiveWorkflowMirror(workflowUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildDeleteLiveWorkflowBatch(workflowUid, ctx);
  return applySyncPayload(payload);
}
