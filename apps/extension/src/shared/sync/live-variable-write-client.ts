/**
 * Renderer-side imperative entry point for live-variable writes.
 *
 * Mirrors `template-write-client`: write sites build a `MutationBatch`
 * via the shared catalog factories and fire `oh.sync.apply` directly
 * — no SW round-trip per write. LV is fully flat-scalar so set
 * replacement is not in scope; updates are a flat per-key `setField`
 * loop.
 *
 * Publication-gate symmetry with `rule-write-client`:
 *   - `applyLiveVariableCreate` mints uid + path locally and forces
 *     `published: false`; the binding is real from the first render
 *     but the resolver (gated on `isLiveVariableEffective`) won't
 *     surface the LV in `{{live.<name>}}` lookups until the user
 *     clicks Save.
 *   - `applyLiveVariablePublish` is the explicit Save gesture.
 *   - `applyLiveVariableUpdate` auto-unpublishes any in-flight runtime edit on
 *     a previously-published LV.
 */

import {
  liveVariableInvalidateResolverIntent,
  LIVE_VARIABLE_ENTITY_TYPE,
  mintBatch,
  type MutationBody,
} from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { generateUid, shouldAutoUnpublishOnUpdate, toFolderName } from '@openheaders/core/utils';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from '@/shared/sync/apply-payload';
import {
  getLiveVariableSyncMirrorForWorkspace,
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

export interface LiveVariableWriteOptions extends BaseSyncWriteOptions {
  mirror?: LiveVariableSyncMirror;
}

export async function applyLiveVariableUpdate(
  liveVariableUid: string,
  updates: LiveVariableUpdates,
  opts: LiveVariableWriteOptions,
): Promise<LiveVariableMutationResult> {
  const mirror = resolveMirror(opts, getLiveVariableSyncMirrorForWorkspace);
  const entry = mirror.getLiveVariableMirror(liveVariableUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  // Auto-unpublish on first runtime-affecting edit of a published LV —
  // same shape as `applyLiveWorkflowUpdate` / `applyRuleUpdate`.
  // Atomically batches the unpublish with the user's edit so the
  // resolver never observes a half-typed binding still flagged
  // published. Metadata-only updates (rename, description) bypass the
  // gate via `shouldAutoUnpublishOnUpdate`.
  const augmented: LiveVariableUpdates =
    entry.liveVariable.published === true && shouldAutoUnpublishOnUpdate(updates as Record<string, unknown>)
      ? { ...updates, published: false }
      : updates;
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildUpdateLiveVariableBatch(liveVariableUid, augmented, ctx);
  const ack = await applySyncPayload(payload);
  if (ack.ok) {
    return { ok: true, liveVariable: { ...entry.liveVariable, ...augmented } as V5.LiveVariable };
  }
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

/**
 * Renderer-direct LV create. Mints uid + path locally, forces
 * `published: false`, fires the seed batch. Per-keystroke binding edits
 * stream into a real entity from this point; explicit Save flips
 * publication via {@link applyLiveVariablePublish}.
 */
export async function applyLiveVariableCreate(
  request: { liveVariable: Omit<V5.LiveVariable, 'uid' | 'path' | 'schemaVersion'>; parentPath: string },
  opts: LiveVariableWriteOptions,
): Promise<LiveVariableMutationResult> {
  const uid = generateUid();
  const folderName = toFolderName(request.liveVariable.name, uid);
  const created: V5.LiveVariable = {
    ...request.liveVariable,
    schemaVersion: 5 as const,
    uid,
    path: `${request.parentPath}/${folderName}`,
    published: false,
  };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildAddLiveVariableBatch(created, ctx);
  const ack = await applySyncPayload(payload);
  if (ack.ok) return { ok: true, liveVariable: created };
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

/**
 * Promote a draft LV to live state. Single
 * `setField('published', true)` mutation + resolver invalidation.
 */
export async function applyLiveVariablePublish(
  liveVariableUid: string,
  opts: LiveVariableWriteOptions,
): Promise<LiveVariableSimpleResult> {
  const mirror = resolveMirror(opts, getLiveVariableSyncMirrorForWorkspace);
  if (!mirror.getLiveVariableMirror(liveVariableUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const bodies: MutationBody[] = [
    { kind: 'setField', type: LIVE_VARIABLE_ENTITY_TYPE, id: liveVariableUid, path: 'published', value: true },
  ];
  return applySyncPayload({
    batch: mintBatch(ctx, bodies),
    sideEffects: [liveVariableInvalidateResolverIntent(liveVariableUid, ctx.hlc)],
  });
}

export async function applyLiveVariableDelete(
  liveVariableUid: string,
  opts: LiveVariableWriteOptions,
): Promise<LiveVariableSimpleResult> {
  const mirror = resolveMirror(opts, getLiveVariableSyncMirrorForWorkspace);
  if (!mirror.getLiveVariableMirror(liveVariableUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildDeleteLiveVariableBatch(liveVariableUid, ctx);
  return applySyncPayload(payload);
}
