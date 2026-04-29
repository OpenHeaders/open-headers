/**
 * Renderer-side imperative entry point for live-workflow writes.
 *
 * Same posture as `live-variable-write-client`. LW has no set-modeled
 * paths — `steps` is whole-array LWW, `refresh` is whole-policy LWW —
 * so the update path is a flat per-key `setField` loop.
 */

import type { V5 } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import {
  ensureRendererContext,
  type RendererContextHandle,
} from '@/context/rule-mutator-context';
import {
  getActiveLiveWorkflowSyncMirror,
  type LiveWorkflowSyncMirror,
} from '@/context/live-workflow-sync-mirror';
import {
  buildAddLiveWorkflowBatch,
  buildDeleteLiveWorkflowBatch,
  buildUpdateLiveWorkflowBatch,
  type LiveWorkflowMutationPayload,
} from '@/shared/sync/live-workflow-mutations';

export type LiveWorkflowUpdates = Partial<Omit<V5.LiveWorkflow, 'uid' | 'path' | 'schemaVersion'>>;

export type LiveWorkflowMutationResult =
  | { ok: true; workflow: V5.LiveWorkflow }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export type LiveWorkflowSimpleResult =
  | { ok: true }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export interface LiveWorkflowWriteOptions {
  workspaceId: string;
  surfaceId: string;
  batchId?: string;
  mirror?: LiveWorkflowSyncMirror;
  context?: RendererContextHandle;
}

function resolveMirror(opts: LiveWorkflowWriteOptions): LiveWorkflowSyncMirror {
  return opts.mirror ?? getActiveLiveWorkflowSyncMirror();
}

function resolveContext(opts: LiveWorkflowWriteOptions): RendererContextHandle {
  if (opts.context) return opts.context;
  return ensureRendererContext({ workspaceId: opts.workspaceId, surfaceId: opts.surfaceId });
}

async function applyPayload(payload: LiveWorkflowMutationPayload): Promise<LiveWorkflowSimpleResult> {
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

export async function applyLiveWorkflowUpdate(
  workflowUid: string,
  updates: LiveWorkflowUpdates,
  opts: LiveWorkflowWriteOptions,
): Promise<LiveWorkflowMutationResult> {
  const mirror = resolveMirror(opts);
  const entry = mirror.getLiveWorkflowMirror(workflowUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildUpdateLiveWorkflowBatch(workflowUid, updates, ctx);
  const ack = await applyPayload(payload);
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
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildAddLiveWorkflowBatch(workflow, ctx);
  return applyPayload(payload);
}

export async function applyLiveWorkflowDelete(
  workflowUid: string,
  opts: LiveWorkflowWriteOptions,
): Promise<LiveWorkflowSimpleResult> {
  const mirror = resolveMirror(opts);
  if (!mirror.getLiveWorkflowMirror(workflowUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildDeleteLiveWorkflowBatch(workflowUid, ctx);
  return applyPayload(payload);
}
