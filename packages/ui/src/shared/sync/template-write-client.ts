/**
 * Renderer-side imperative entry point for Template writes.
 *
 * Mirrors {@link request-write-client} / {@link rule-write-client}: write
 * sites build a `MutationBatch` against the active template mirror and
 * fire `oh.sync.apply` directly — no SW round-trip per write. Set-modeled
 * `conditions` is routed through the shared {@link synthesizeSetDiff}
 * inside `buildUpdateBatch`; the adapter below combines the mirror's
 * `(itemId, orderKey)` pairs with the canonical template snapshot's
 * row arrays so the synthesizer can distinguish pure-reorder from
 * content edits.
 */

import type { Template } from '@openheaders/core/types';
import {
  getTemplateSyncMirrorForWorkspace,
  type TemplateSyncMirror,
} from '../../context/mirrors/template-sync-mirror';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from './apply-payload';
import {
  buildAddBatch,
  buildDeleteBatch,
  buildUpdateBatch,
} from '@openheaders/core/sync-builders/mutations/template-mutations';

export type TemplateUpdates = Partial<Omit<Template, 'uid' | 'path' | 'schemaVersion'>>;

export type TemplateMutationResult =
  | { ok: true; template: Template }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export type TemplateSimpleResult = SyncSimpleResult;

export interface TemplateWriteOptions extends BaseSyncWriteOptions {
  mirror?: TemplateSyncMirror;
}

export async function applyTemplateUpdate(
  templateUid: string,
  updates: TemplateUpdates,
  opts: TemplateWriteOptions,
): Promise<TemplateMutationResult> {
  const mirror = resolveMirror(opts, getTemplateSyncMirrorForWorkspace);
  // Hydration must complete before the mirror read — on a fresh boot
  // the user's first save can fire before the storage→mirror hydrate
  // resolves, and reading too early surfaces a spurious "deleted from
  // another tab" toast even though the entity is healthy.
  await mirror.hydrated;
  const entry = mirror.getTemplateMirror(templateUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  // Renderer-side adapter: combine the mirror's order keys with the
  // canonical template snapshot to find each row's content via uid
  // lookup. The synthesizer needs `(itemId, orderKey, item)` triplets
  // to distinguish pure-reorder from content edits.
  const payload = buildUpdateBatch(templateUid, updates, ctx, (uid, path) => {
    const orderKeys = mirror.liveOrderedSetItems(uid, path);
    if (orderKeys.length === 0) return [];
    const template = mirror.getTemplateMirror(uid)?.template;
    const rows = resolveTemplateRows(template, path);
    if (!rows) return orderKeys.map((e) => ({ itemId: e.itemId, orderKey: e.orderKey, item: undefined }));
    const byUid = new Map<string, unknown>();
    for (const row of rows) byUid.set(row.uid, row);
    return orderKeys.map((e) => ({ itemId: e.itemId, orderKey: e.orderKey, item: byUid.get(e.itemId) }));
  });
  const ack = await applySyncPayload(payload);
  if (ack.ok) {
    return { ok: true, template: { ...entry.template, ...updates } as Template };
  }
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

export async function applyTemplateCreate(
  template: Template,
  opts: TemplateWriteOptions,
): Promise<TemplateSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildAddBatch(template, ctx);
  return applySyncPayload(payload);
}

/**
 * Resolve the live row array on a template for a given set path.
 * Templates carry `conditions: RuleCondition[]` (each row has a
 * schema-required `uid`); other set paths don't exist on the template
 * shape today, so the helper returns `null` for everything else and
 * the synthesizer falls back to its content-unequal branch.
 */
function resolveTemplateRows(
  template: Template | undefined,
  path: string,
): ReadonlyArray<{ uid: string }> | null {
  if (!template) return null;
  if (path === 'conditions') return template.conditions;
  return null;
}

export async function applyTemplateDelete(
  templateUid: string,
  opts: TemplateWriteOptions,
): Promise<TemplateSimpleResult> {
  const mirror = resolveMirror(opts, getTemplateSyncMirrorForWorkspace);
  await mirror.hydrated;
  if (!mirror.getTemplateMirror(templateUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildDeleteBatch(templateUid, ctx);
  return applySyncPayload(payload);
}
