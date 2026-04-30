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

import type { V5 } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import {
  ensureRendererContext,
  type RendererContextHandle,
} from '@/context/rule-mutator-context';
import {
  getActiveRuleSyncMirror,
  type RuleSyncMirror,
} from '@/context/rule-sync-mirror';
import {
  buildDeleteBatch,
  buildToggleBatch,
  buildUpdateBatch,
  type RuleMutationPayload,
} from '@/shared/sync/rule-mutations';

export type RuleUpdates = Partial<Omit<V5.Rule, 'uid' | 'path' | 'schemaVersion'>>;

export type RuleMutationResult =
  | { ok: true; rule: V5.Rule }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export type RuleSimpleResult =
  | { ok: true }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export interface RuleWriteOptions {
  workspaceId: string;
  surfaceId: string;
  /** Optional batchId so multi-mutation gestures share one all-or-nothing batch. */
  batchId?: string;
  /** Override the singleton mirror for tests. */
  mirror?: RuleSyncMirror;
  /** Override the renderer context handle for tests. */
  context?: RendererContextHandle;
}

function resolveMirror(opts: RuleWriteOptions): RuleSyncMirror {
  return opts.mirror ?? getActiveRuleSyncMirror();
}

function resolveContext(opts: RuleWriteOptions): RendererContextHandle {
  if (opts.context) return opts.context;
  return ensureRendererContext({ workspaceId: opts.workspaceId, surfaceId: opts.surfaceId });
}

async function applyPayload(payload: RuleMutationPayload): Promise<RuleSimpleResult> {
  if (payload.batch.mutations.length === 0) return { ok: true };
  try {
    const resp = await call('oh.sync.apply', { batch: payload.batch, sideEffects: payload.sideEffects });
    if (resp.ok) return { ok: true };
    return { ok: false, reason: 'other', message: resp.failure?.detail };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return { ok: false, reason: 'other', message };
  }
}

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
  const mirror = resolveMirror(opts);
  const entry = mirror.getRuleMirror(ruleUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  // Renderer-side adapter: combine the mirror's order keys with the
  // canonical rule snapshot to find each row's content via uid lookup.
  // The synthesizer needs `(itemId, orderKey, item)` triplets to
  // distinguish pure-reorder from content edits.
  const payload = buildUpdateBatch(ruleUid, entry.rule.type, updates, ctx, (uid, path) => {
    const orderKeys = mirror.liveOrderedSetItems(uid, path);
    if (orderKeys.length === 0) return [];
    const rule = mirror.getRuleMirror(uid)?.rule;
    const rows = resolveRuleRows(rule, path);
    if (!rows) return orderKeys.map((e) => ({ itemId: e.itemId, orderKey: e.orderKey, item: undefined }));
    const byUid = new Map<string, unknown>();
    for (const row of rows) byUid.set(row.uid, row);
    return orderKeys.map((e) => ({ itemId: e.itemId, orderKey: e.orderKey, item: byUid.get(e.itemId) }));
  });
  const ack = await applyPayload(payload);
  if (ack.ok) {
    return { ok: true, rule: { ...entry.rule, ...updates } as V5.Rule };
  }
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

export async function applyRuleToggle(
  ruleUid: string,
  enabled: boolean,
  opts: RuleWriteOptions,
): Promise<RuleSimpleResult> {
  const mirror = resolveMirror(opts);
  if (!mirror.getRuleMirror(ruleUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildToggleBatch(ruleUid, enabled, ctx);
  return applyPayload(payload);
}

export async function applyRuleDelete(
  ruleUid: string,
  opts: RuleWriteOptions,
): Promise<RuleSimpleResult> {
  const mirror = resolveMirror(opts);
  if (!mirror.getRuleMirror(ruleUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildDeleteBatch(ruleUid, ctx);
  return applyPayload(payload);
}

/**
 * Resolve the live row array on a rule for a given set path. Returns
 * `null` for paths the rule shape doesn't carry (e.g. a non-header rule
 * has no `action.requestHeaders`), in which case the caller surfaces
 * the orderKeys with `item: undefined` and the synthesizer falls back
 * to its content-unequal branch — correct, just one envelope per row.
 */
function resolveRuleRows(
  rule: V5.Rule | undefined,
  path: string,
): ReadonlyArray<{ uid: string }> | null {
  if (!rule) return null;
  if (path === 'conditions') return rule.conditions;
  if (rule.type !== 'header') return null;
  if (path === 'action.requestHeaders') return rule.action.requestHeaders;
  if (path === 'action.responseHeaders') return rule.action.responseHeaders;
  return null;
}
