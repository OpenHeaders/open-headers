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

import { ensureRendererContext, type RendererContextHandle } from '@/context/renderer-mutator-context';
import { applySyncPayload, type SyncSimpleResult } from '@/shared/sync/apply-payload';
import { buildSetLayoutBatch } from '@/shared/sync/layout-state-mutations';

export type LayoutStateResult = SyncSimpleResult;

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

export interface ApplyLayoutSetInput {
  layout: unknown;
}

export async function applyLayoutSet(
  input: ApplyLayoutSetInput,
  opts: LayoutStateWriteOptions,
): Promise<LayoutStateResult> {
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildSetLayoutBatch({ layout: input.layout }, ctx));
}
