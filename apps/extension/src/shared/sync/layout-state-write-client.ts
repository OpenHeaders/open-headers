/**
 * Renderer-side imperative entry point for layout-state writes.
 *
 * Mirrors `pause-markers-write-client.ts` for the singleton layout-state
 * entity. The single helper builds a `MutationBatch` against the active
 * mutator-context and fires `oh.sync.apply` directly — no SW round-trip
 * per write, no `setLayout` shim. The optimistic local apply is folded
 * into the renderer's own state via the responsive-layout hook's
 * existing `setPersisted` plumbing; the mirror catches the post-commit
 * broadcast for cross-surface consistency.
 */

import { type MutatorIntent } from '@openheaders/core/sync';
import { call } from '@utils/bridge';
import { ensureRendererContext, type RendererContextHandle } from '@/context/renderer-mutator-context';
import { buildSetLayoutBatch } from '@/shared/sync/layout-state-mutations';

export type LayoutStateResult = { ok: true } | { ok: false; reason: 'other'; message?: string };

export interface LayoutStateWriteOptions {
  workspaceId: string;
  surfaceId: string;
  batchId?: string;
  context?: RendererContextHandle;
}

function resolveContext(opts: LayoutStateWriteOptions): RendererContextHandle {
  if (opts.context) return opts.context;
  return ensureRendererContext({ workspaceId: opts.workspaceId, surfaceId: opts.surfaceId });
}

async function applyPayload(payload: MutatorIntent): Promise<LayoutStateResult> {
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

export interface ApplyLayoutSetInput {
  layout: unknown;
}

export async function applyLayoutSet(
  input: ApplyLayoutSetInput,
  opts: LayoutStateWriteOptions,
): Promise<LayoutStateResult> {
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applyPayload(buildSetLayoutBatch({ layout: input.layout }, ctx));
}
