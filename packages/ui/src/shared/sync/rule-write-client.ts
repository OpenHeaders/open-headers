/**
 * Renderer-side imperative entry point for Rule writes.
 *
 * Write sites build a `MutationBatch` against the active rule mirror and
 * fire `oh.sync.apply` directly — no SW round-trip per write, no
 * `updateLocalRule`/`toggleRule` shim. The synchronous-render discipline
 * (§19.4) lives in the editors; this helper is what they reach for once
 * the user commits.
 *
 * `useRuleMutator` is the React-friendly wrapper that pulls the active
 * workspace + surface attribution from context. Surfaces that live
 * outside `RuleContext` (devpanel popovers, future awareness affordances)
 * call these functions directly with an explicit workspace id.
 */

import { type MutationBody, mintBatch, RULE_ENTITY_TYPE, recompileDnrIntent } from '@openheaders/core/sync';
import {
  buildAddBatch,
  buildDeleteBatch,
  buildToggleBatch,
  buildUpdateBatch,
} from '@openheaders/core/sync-builders/mutations/rule-mutations';
import type { TelemetryRuleCreatedOrigin } from '@openheaders/core/telemetry';
import type { Rule } from '@openheaders/core/types';
import { generateUid, shouldAutoUnpublishOnUpdate, toFolderName } from '@openheaders/core/utils';
import { getRuleSyncMirrorForWorkspace, type RuleSyncMirror } from '../../context/mirrors/rule-sync-mirror';
import { trackProductTelemetryEvent } from '../product-telemetry';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from './apply-payload';

export type RuleUpdates = Partial<Omit<Rule, 'uid' | 'path' | 'schemaVersion'>>;

export type RuleMutationResult =
  | { ok: true; rule: Rule }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export type RuleSimpleResult = SyncSimpleResult;

export interface RuleWriteOptions extends BaseSyncWriteOptions {
  /** Override the singleton mirror for tests. */
  mirror?: RuleSyncMirror;
  /**
   * Which affordance a create gesture came from, for the `rule_created`
   * telemetry split (plan §3, S16). Defaults to `editor`; quick-create
   * popovers and empty-state affordances pass their own member. Only
   * `applyRuleCreate` reads it.
   */
  origin?: TelemetryRuleCreatedOrigin;
}

/**
 * Surface attribution import flows write under. Rules materialized by
 * an import are counted by `import_run`, never by `rule_created` — a
 * bulk import must not inflate the rule-type distribution.
 */
export const IMPORT_ATTRIBUTION_SURFACE_ID = 'workbench-import';

/**
 * Apply a partial Rule patch through the local oracle.
 *
 * Returns `{ ok: true, rule }` with an optimistic merge of `updates`
 * into the mirror's pre-image so callers that need a post-commit
 * snapshot get one without waiting for the broadcast round-trip. The
 * authoritative state still arrives via `syncBroadcast` and overwrites
 * any consumer that subscribes to the mirror.
 */
export async function applyRuleUpdate(
  ruleUid: string,
  updates: RuleUpdates,
  opts: RuleWriteOptions,
): Promise<RuleMutationResult> {
  const mirror = resolveMirror(opts, getRuleSyncMirrorForWorkspace);
  // Hydration must complete before the mirror read — on a fresh boot
  // the user's first save can fire before the storage→mirror hydrate
  // resolves, and reading too early surfaces a spurious "deleted from
  // another tab" toast even though the entity is healthy.
  await mirror.hydrated;
  const entry = mirror.getRuleMirror(ruleUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  // Auto-unpublish on first runtime-affecting edit of a published rule
  // (publication-gate symmetry). The single batch ensures side-effect
  // runners (DNR compile, inject) see the unpublish + edit atomically —
  // they never observe a half-typed runtime value while the rule is
  // still flagged published. Subsequent keystrokes find `published === false`
  // and skip the augmentation. Metadata-only updates (rename, description)
  // bypass the gate via `shouldAutoUnpublishOnUpdate` so cosmetic edits
  // don't drop a live rule back to draft state.
  const augmented: RuleUpdates =
    entry.rule.published === true && shouldAutoUnpublishOnUpdate(updates as Record<string, unknown>)
      ? { ...updates, published: false }
      : updates;
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  // Renderer-side adapter: combine the mirror's order keys with the
  // canonical rule snapshot to find each row's content via uid lookup.
  // The synthesizer needs `(itemId, orderKey, item)` triplets to
  // distinguish pure-reorder from content edits.
  const payload = buildUpdateBatch(
    ruleUid,
    entry.rule.type,
    augmented,
    ctx,
    (uid, path) => {
      const orderKeys = mirror.liveOrderedSetItems(uid, path);
      if (orderKeys.length === 0) return [];
      const rule = mirror.getRuleMirror(uid)?.rule;
      const rows = resolveRuleRows(rule, path);
      if (!rows) return orderKeys.map((e) => ({ itemId: e.itemId, orderKey: e.orderKey, item: undefined }));
      const byUid = new Map<string, unknown>();
      for (const row of rows) byUid.set(row.uid, row);
      return orderKeys.map((e) => ({ itemId: e.itemId, orderKey: e.orderKey, item: byUid.get(e.itemId) }));
    },
    // Baseline for the non-header action per-leaf flatten-diff — the
    // live materialized action from the same canonical snapshot.
    (uid, path) => (path === 'action' ? mirror.getRuleMirror(uid)?.rule.action : undefined),
  );
  const ack = await applySyncPayload(payload);
  if (ack.ok) {
    return { ok: true, rule: { ...entry.rule, ...augmented } as Rule };
  }
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

/**
 * Renderer-direct rule create. Mints uid + path locally, builds the seed
 * batch (one `create` + one `addToSet` per set-modeled item), and fires
 * `oh.sync.apply`. The created rule starts `published: false` — per-keystroke
 * edits stream into a real entity from this point; the explicit Save
 * gesture flips publication via {@link applyRulePublish}.
 *
 * `request.rule` carries everything except the entity-managed fields
 * (uid, path, schemaVersion). Passing `published` in the request payload
 * is allowed but the write client always overrides to `false` — drafts
 * must not arrive published.
 */
export async function applyRuleCreate(
  request: { rule: Omit<Rule, 'uid' | 'path' | 'schemaVersion'>; parentPath: string },
  opts: RuleWriteOptions,
): Promise<RuleMutationResult> {
  const uid = generateUid();
  const folderName = toFolderName(request.rule.name, uid);
  const created = {
    ...request.rule,
    schemaVersion: 5 as const,
    uid,
    path: `${request.parentPath}/${folderName}`,
    published: false,
  } as Rule;
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildAddBatch(created, ctx);
  const ack = await applySyncPayload(payload);
  if (ack.ok) {
    if (opts.surfaceId !== IMPORT_ATTRIBUTION_SURFACE_ID) {
      trackProductTelemetryEvent({ name: 'rule_created', ruleType: created.type, origin: opts.origin ?? 'editor' });
    }
    return { ok: true, rule: created };
  }
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

/**
 * Promote a draft rule to live state. Single `setField('published', true)`
 * mutation + DNR recompile intent. The Save button in `RuleEditor` /
 * `EditorHeader` binds to this; per-keystroke edits go through
 * {@link applyRuleUpdate} which auto-unpublishes on the first
 * runtime-affecting edit (per `shouldAutoUnpublishOnUpdate`).
 */
export async function applyRulePublish(ruleUid: string, opts: RuleWriteOptions): Promise<RuleSimpleResult> {
  const mirror = resolveMirror(opts, getRuleSyncMirrorForWorkspace);
  await mirror.hydrated;
  if (!mirror.getRuleMirror(ruleUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const bodies: MutationBody[] = [
    { kind: 'setField', type: RULE_ENTITY_TYPE, id: ruleUid, path: 'published', value: true },
  ];
  return applySyncPayload({
    batch: mintBatch(ctx, bodies),
    sideEffects: [recompileDnrIntent(ruleUid, ctx.hlc)],
  });
}

export async function applyRuleToggle(
  ruleUid: string,
  enabled: boolean,
  opts: RuleWriteOptions,
): Promise<RuleSimpleResult> {
  const mirror = resolveMirror(opts, getRuleSyncMirrorForWorkspace);
  await mirror.hydrated;
  if (!mirror.getRuleMirror(ruleUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildToggleBatch(ruleUid, enabled, ctx);
  return applySyncPayload(payload);
}

export async function applyRuleDelete(ruleUid: string, opts: RuleWriteOptions): Promise<RuleSimpleResult> {
  const mirror = resolveMirror(opts, getRuleSyncMirrorForWorkspace);
  await mirror.hydrated;
  if (!mirror.getRuleMirror(ruleUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildDeleteBatch(ruleUid, ctx);
  return applySyncPayload(payload);
}

/**
 * Resolve the live row array on a rule for a given set path. Returns
 * `null` for paths the rule shape doesn't carry (e.g. a non-header rule
 * has no `action.requestHeaders`), in which case the caller surfaces
 * the orderKeys with `item: undefined` and the synthesizer falls back
 * to its content-unequal branch — correct, just one envelope per row.
 */
function resolveRuleRows(rule: Rule | undefined, path: string): ReadonlyArray<{ uid: string }> | null {
  if (!rule) return null;
  if (path === 'conditions') return rule.conditions;
  if (rule.type !== 'header') return null;
  if (path === 'action.requestHeaders') return rule.action.requestHeaders;
  if (path === 'action.responseHeaders') return rule.action.responseHeaders;
  return null;
}
