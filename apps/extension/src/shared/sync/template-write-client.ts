/**
 * Renderer-side imperative entry point for Template writes.
 *
 * Mirrors {@link request-write-client}: write sites build a
 * `MutationBatch` against the active template mirror and fire
 * `oh.sync.apply` directly — no SW round-trip per write. Set-modeled
 * `conditions` replacement is handled inside `buildUpdateBatch` via the
 * mirror's `liveSetItems`.
 */

import type { V5 } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import {
  ensureRendererContext,
  type RendererContextHandle,
} from '@/context/rule-mutator-context';
import {
  getActiveTemplateSyncMirror,
  type TemplateSyncMirror,
} from '@/context/template-sync-mirror';
import {
  buildAddBatch,
  buildDeleteBatch,
  buildUpdateBatch,
  type TemplateMutationPayload,
} from '@/shared/sync/template-mutations';

export type TemplateUpdates = Partial<Omit<V5.Template, 'uid' | 'path' | 'schemaVersion'>>;

export type TemplateMutationResult =
  | { ok: true; template: V5.Template }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export type TemplateSimpleResult =
  | { ok: true }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export interface TemplateWriteOptions {
  workspaceId: string;
  surfaceId: string;
  batchId?: string;
  mirror?: TemplateSyncMirror;
  context?: RendererContextHandle;
}

function resolveMirror(opts: TemplateWriteOptions): TemplateSyncMirror {
  return opts.mirror ?? getActiveTemplateSyncMirror();
}

function resolveContext(opts: TemplateWriteOptions): RendererContextHandle {
  if (opts.context) return opts.context;
  return ensureRendererContext({ workspaceId: opts.workspaceId, surfaceId: opts.surfaceId });
}

async function applyPayload(payload: TemplateMutationPayload): Promise<TemplateSimpleResult> {
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

export async function applyTemplateUpdate(
  templateUid: string,
  updates: TemplateUpdates,
  opts: TemplateWriteOptions,
): Promise<TemplateMutationResult> {
  const mirror = resolveMirror(opts);
  const entry = mirror.getTemplateMirror(templateUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildUpdateBatch(templateUid, updates, ctx, (uid, path) =>
    mirror.liveSetItems(uid, path),
  );
  const ack = await applyPayload(payload);
  if (ack.ok) {
    return { ok: true, template: { ...entry.template, ...updates } as V5.Template };
  }
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

export async function applyTemplateCreate(
  template: V5.Template,
  opts: TemplateWriteOptions,
): Promise<TemplateSimpleResult> {
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildAddBatch(template, ctx);
  return applyPayload(payload);
}

export async function applyTemplateDelete(
  templateUid: string,
  opts: TemplateWriteOptions,
): Promise<TemplateSimpleResult> {
  const mirror = resolveMirror(opts);
  if (!mirror.getTemplateMirror(templateUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildDeleteBatch(templateUid, ctx);
  return applyPayload(payload);
}
