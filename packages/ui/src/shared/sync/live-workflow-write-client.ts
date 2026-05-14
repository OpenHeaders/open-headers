/**
 * Renderer-side imperative entry point for live-workflow writes.
 *
 * Same posture as `live-variable-write-client`. LW has no set-modeled
 * paths — `steps` is whole-array LWW, `refresh` is whole-policy LWW —
 * so the update path is a flat per-key `setField` loop.
 *
 * Publication-gate symmetry with `rule-write-client`:
 *   - `applyLiveWorkflowCreate` mints uid + path locally and forces
 *     `published: false`; the entity is real from the first render but
 *     the refresh scheduler (gated on `isWorkflowEffective`) won't fire
 *     until the user clicks Save.
 *   - `applyLiveWorkflowPublish` is the explicit Save gesture: a single
 *     `setField('published', true)` mutation + resolver invalidation.
 *   - `applyLiveWorkflowUpdate` auto-unpublishes any in-flight runtime edit on
 *     a previously-published workflow so the scheduler never observes a
 *     half-typed step or refresh policy still flagged published.
 */

import {
  liveWorkflowInvalidateResolverIntent,
  LIVE_WORKFLOW_ENTITY_TYPE,
  mintBatch,
  type MutationBody,
} from '@openheaders/core/sync';
import type { LiveWorkflow } from '@openheaders/core/types';
import { generateUid, shouldAutoUnpublishOnUpdate, toFolderName } from '@openheaders/core/utils';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from './apply-payload';
import {
  getLiveWorkflowSyncMirrorForWorkspace,
  type LiveWorkflowSyncMirror,
} from '../../context/live-workflow-sync-mirror';
import {
  buildAddLiveWorkflowBatch,
  buildDeleteLiveWorkflowBatch,
  buildUpdateLiveWorkflowBatch,
} from '@openheaders/core/sync-builders/live-workflow-mutations';

export type LiveWorkflowUpdates = Partial<Omit<LiveWorkflow, 'uid' | 'path' | 'schemaVersion'>>;

export type LiveWorkflowMutationResult =
  | { ok: true; workflow: LiveWorkflow }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export type LiveWorkflowSimpleResult = SyncSimpleResult;

export interface LiveWorkflowWriteOptions extends BaseSyncWriteOptions {
  mirror?: LiveWorkflowSyncMirror;
}

export async function applyLiveWorkflowUpdate(
  workflowUid: string,
  updates: LiveWorkflowUpdates,
  opts: LiveWorkflowWriteOptions,
): Promise<LiveWorkflowMutationResult> {
  const mirror = resolveMirror(opts, getLiveWorkflowSyncMirrorForWorkspace);
  // Await the mirror's bootstrap snapshot before the existence check —
  // a workspace-switch race (user saves between mirror instantiation
  // and `oh.sync.snapshotLiveWorkflows` resolving) would otherwise
  // surface as a spurious `not-found` even though the entity exists
  // in the SW oracle.
  await mirror.hydrated;
  const entry = mirror.getLiveWorkflowMirror(workflowUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  // Auto-unpublish on first runtime-affecting edit of a published
  // workflow (publication-gate symmetry with `applyRuleUpdate`). The
  // single batch ensures the scheduler / resolver-invalidate runners
  // observe the unpublish + edit atomically — they never see a
  // half-typed value while the workflow is still flagged published.
  // Metadata-only updates (rename, description) bypass the gate via
  // `shouldAutoUnpublishOnUpdate`.
  const augmented: LiveWorkflowUpdates =
    entry.workflow.published === true && shouldAutoUnpublishOnUpdate(updates as Record<string, unknown>)
      ? { ...updates, published: false }
      : updates;
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildUpdateLiveWorkflowBatch(workflowUid, augmented, ctx);
  const ack = await applySyncPayload(payload);
  if (ack.ok) {
    return { ok: true, workflow: { ...entry.workflow, ...augmented } as LiveWorkflow };
  }
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

/**
 * Renderer-direct workflow create. Mints uid + path locally, builds the
 * seed batch, and fires `oh.sync.apply`. The created workflow starts
 * `published: false` — per-keystroke edits stream into a real entity
 * from this point; the explicit Save gesture flips publication via
 * {@link applyLiveWorkflowPublish}.
 *
 * `request.workflow` carries everything except entity-managed fields
 * (uid, path, schemaVersion). `published` in the request payload is
 * ignored; the write client always overrides to `false`.
 */
export async function applyLiveWorkflowCreate(
  request: { workflow: Omit<LiveWorkflow, 'uid' | 'path' | 'schemaVersion'>; parentPath: string },
  opts: LiveWorkflowWriteOptions,
): Promise<LiveWorkflowMutationResult> {
  const uid = generateUid();
  const folderName = toFolderName(request.workflow.name, uid);
  const created: LiveWorkflow = {
    ...request.workflow,
    schemaVersion: 5 as const,
    uid,
    path: `${request.parentPath}/${folderName}`,
    published: false,
  };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildAddLiveWorkflowBatch(created, ctx);
  const ack = await applySyncPayload(payload);
  if (ack.ok) return { ok: true, workflow: created };
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

/**
 * Promote a draft workflow to live state. Single
 * `setField('published', true)` mutation + resolver invalidation. The
 * Save button binds to this; per-keystroke edits go through
 * {@link applyLiveWorkflowUpdate} which auto-unpublishes on first edit.
 */
export async function applyLiveWorkflowPublish(
  workflowUid: string,
  opts: LiveWorkflowWriteOptions,
): Promise<LiveWorkflowSimpleResult> {
  const mirror = resolveMirror(opts, getLiveWorkflowSyncMirrorForWorkspace);
  await mirror.hydrated;
  if (!mirror.getLiveWorkflowMirror(workflowUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const bodies: MutationBody[] = [
    { kind: 'setField', type: LIVE_WORKFLOW_ENTITY_TYPE, id: workflowUid, path: 'published', value: true },
  ];
  return applySyncPayload({
    batch: mintBatch(ctx, bodies),
    sideEffects: [liveWorkflowInvalidateResolverIntent(workflowUid, ctx.hlc)],
  });
}

export async function applyLiveWorkflowDelete(
  workflowUid: string,
  opts: LiveWorkflowWriteOptions,
): Promise<LiveWorkflowSimpleResult> {
  const mirror = resolveMirror(opts, getLiveWorkflowSyncMirrorForWorkspace);
  await mirror.hydrated;
  if (!mirror.getLiveWorkflowMirror(workflowUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildDeleteLiveWorkflowBatch(workflowUid, ctx);
  return applySyncPayload(payload);
}
