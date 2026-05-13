/**
 * Shared invocation + ack-shape adapter + context/mirror resolution for
 * renderer-side write-clients.
 *
 * Every entity's write-client (rule, template, request, env, vault,
 * collection, folder, …) emits a `(batch, sideEffects)` pair and
 * collapses the bridge response into a uniform structured result.
 * Context resolution (per-surface HLC sequencer) and mirror resolution
 * (test-injectable singleton fallback) follow the same shape across
 * every entity, so all three live here.
 *
 * Per-entity `MutationResult` shapes that extend the simple result with
 * an entity-specific success payload (e.g. `{ ok: true, rule: Rule }`)
 * stay in their write-client — only the simple ack adapter is shared.
 */

import type { MutationBatch, SideEffectIntent } from '@openheaders/core/sync';
import { call } from '@utils/bridge';
import {
  ensureRendererContext,
  type RendererContextHandle,
} from '@/context/renderer-mutator-context';

/**
 * Uniform structured result for sync writes. Every entity's
 * `XSimpleResult` is a structural alias of this — keeping per-entity
 * names in the write-client API while sharing the implementation.
 */
export type SyncSimpleResult =
  | { ok: true }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export interface SyncMutationPayload {
  batch: MutationBatch;
  sideEffects: SideEffectIntent[];
}

/**
 * Common shape every renderer-side write-client's options carry.
 * Per-entity options extend this with their mirror (and any
 * entity-specific knobs).
 */
export interface BaseSyncWriteOptions {
  workspaceId: string;
  surfaceId: string;
  /** Optional batchId so multi-mutation gestures share one all-or-nothing batch. */
  batchId?: string;
  /** Override the renderer context handle for tests. */
  context?: RendererContextHandle;
}

/**
 * Resolve the per-surface HLC sequencer + nodeId for the active
 * workspace. Tests pass an explicit `context`; production goes through
 * the singleton renderer-mutator-context.
 */
export function resolveRendererContext(opts: BaseSyncWriteOptions): RendererContextHandle {
  if (opts.context) return opts.context;
  return ensureRendererContext({ workspaceId: opts.workspaceId, surfaceId: opts.surfaceId });
}

/**
 * Resolve a per-entity sync mirror: tests pass an explicit `mirror`;
 * production reaches for the per-workspace mirror via
 * `getXSyncMirrorForWorkspace(opts.workspaceId)` (M-3 — every renderer
 * write-client routes by the workspaceId carried on `opts`, never via
 * a `getActiveXSyncMirror` singleton).
 *
 * Generic over the mirror type so each entity's write-client keeps its
 * own structurally-narrowed mirror surface without re-declaring the
 * helper.
 */
export function resolveMirror<M>(
  opts: { mirror?: M; workspaceId: string },
  getForWorkspace: (workspaceId: string) => M,
): M {
  return opts.mirror ?? getForWorkspace(opts.workspaceId);
}

/**
 * Fire `oh.sync.apply` for a built batch + side-effect intents.
 *
 * - Empty-batch short-circuit returns `{ ok: true }` without firing the
 *   bridge — every entity's `buildUpdateBatch` may emit zero envelopes
 *   for a no-op patch (byte-identical save), and that's success.
 * - Bridge transport rejections collapse onto
 *   `{ ok: false, reason: 'other', message }` — see §oracle for the
 *   `failure.detail` shape.
 * - Thrown errors (bridge dead, runtime disconnect) likewise collapse
 *   to `'other'` with the error message.
 */
export async function applySyncPayload(payload: SyncMutationPayload): Promise<SyncSimpleResult> {
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
