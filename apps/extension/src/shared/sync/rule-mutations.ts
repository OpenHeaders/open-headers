/**
 * Rule write-site → oracle helpers.
 *
 * `rule-store.ts` historically owned the in-memory `V5.Rule[]` array
 * and persisted it to chrome.storage.local on every write. With the
 * sync engine activated (Phase A Fw6f), rule writes route through the
 * oracle as `MutationBatch`es; the rule cache projects the oracle's
 * materialized state back to `V5.Rule[]` and persists it.
 *
 * The four helpers below produce `(batch, sideEffects)` pairs for the
 * four legacy write paths. They're pure transforms — no oracle reads,
 * no IO — so the rule-store can apply them under its existing
 * orchestration (which still owns optimistic local apply for collection
 * / folder operations, batched scheduleUpdate, and the chrome.runtime
 * `rulesUpdated` broadcast).
 *
 * Set-modeled fields (`conditions`, `action.requestHeaders`,
 * `action.responseHeaders`) need special handling on partial updates:
 * a naïve `setField('conditions', [...])` would write a leaf entry
 * that competes with the oracle's setItems entries at the same path,
 * producing a non-deterministic materialized view. {@link buildUpdateBatch}
 * therefore reads the live itemIds from the oracle, emits one
 * `removeFromSet` per existing item, then emits one `addToSet` per
 * member of the new value with a fresh itemId. Replacement semantics
 * are preserved; convergence is preserved; latest-HLC wins between
 * concurrent set-replacements applies as designed.
 */

import {
  mintBatch,
  type MutationBatch,
  type MutationBody,
  recompileDnrIntent,
  RULE_ENTITY_TYPE,
  type RuleMutatorContext,
  type SideEffectIntent,
  toggleEnabled,
} from '@openheaders/core/sync';
import { generateUid } from '@openheaders/core/utils';
import type { V5 } from '@openheaders/core/types';
import { seedRule } from './rule-projection';

export interface RuleMutationPayload {
  batch: MutationBatch;
  sideEffects: SideEffectIntent[];
}

/**
 * Live-itemId reader for set-modeled paths. The SW oracle exposes
 * `(itemId, item)` pairs via `oracle.liveSetItems`; the renderer-side
 * mirror exposes just `string[]` itemIds via
 * `mirror.liveSetItems(uid, path)`. {@link buildUpdateBatch} only needs
 * itemIds — anything else would couple the renderer to the SW's richer
 * shape — so we accept the narrower function signature and let either
 * caller satisfy it.
 */
export type LiveSetItemIds = (ruleUid: string, setPath: string) => readonly string[];

/** New rule → seed batch + DNR recompile intent. */
export function buildAddBatch(rule: V5.Rule, ctx: RuleMutatorContext): RuleMutationPayload {
  return {
    batch: seedRule(rule, ctx),
    sideEffects: [recompileDnrIntent(rule.uid, ctx.hlc)],
  };
}

/** Toggle a rule's `enabled` flag. */
export function buildToggleBatch(ruleUid: string, enabled: boolean, ctx: RuleMutatorContext): RuleMutationPayload {
  const intent = toggleEnabled(ctx, { ruleUid, enabled });
  return { batch: intent.batch, sideEffects: intent.sideEffects };
}

/** Delete a rule. Tombstone is permanent under §7.2 delete-wins. */
export function buildDeleteBatch(ruleUid: string, ctx: RuleMutatorContext): RuleMutationPayload {
  const bodies: MutationBody[] = [{ kind: 'delete', type: RULE_ENTITY_TYPE, id: ruleUid }];
  return {
    batch: mintBatch(ctx, bodies),
    sideEffects: [recompileDnrIntent(ruleUid, ctx.hlc)],
  };
}

/**
 * Set-modeled paths on a Rule. Mirrors `SET_PATHS` in
 * {@link rule-projection.ts}; kept inline so this module doesn't import
 * a private constant from a sibling.
 */
const SET_PATHS = ['conditions', 'action.requestHeaders', 'action.responseHeaders'] as const;
type SetPath = (typeof SET_PATHS)[number];

const isSetPath = (top: string, sub?: string): SetPath | null => {
  if (top === 'conditions' && sub === undefined) return 'conditions';
  if (top === 'action' && sub === 'requestHeaders') return 'action.requestHeaders';
  if (top === 'action' && sub === 'responseHeaders') return 'action.responseHeaders';
  return null;
};

/**
 * Translate a `Partial<Omit<V5.Rule, 'uid'|'path'>>` patch into a
 * single batch of mutations. Scalar fields → one `setField` per
 * leaf; set-modeled fields → `removeFromSet` per existing itemId
 * followed by `addToSet` per new member.
 *
 * `oracle.liveSetItems` is consulted at emit time so the removeFromSet
 * envelopes carry the itemIds the oracle currently holds. Concurrency
 * with another emitter mid-update is handled by per-itemId LWW: a
 * concurrent `addToSet(newItemId, ...)` wins because we never tombstone
 * an itemId we didn't observe; a concurrent `removeFromSet(itemId)` is
 * idempotent under tombstone HLC compare.
 */
export function buildUpdateBatch(
  ruleUid: string,
  ruleType: V5.Rule['type'],
  updates: Partial<Omit<V5.Rule, 'uid' | 'path'>>,
  ctx: RuleMutatorContext,
  liveSetItemIds: LiveSetItemIds,
): RuleMutationPayload {
  const bodies: MutationBody[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;

    // conditions: top-level set-modeled path on every rule variant.
    if (key === 'conditions' && Array.isArray(value)) {
      pushSetReplacement(bodies, ruleUid, 'conditions', value, liveSetItemIds);
      continue;
    }

    // action: header rules carry two set-modeled subpaths
    // (requestHeaders, responseHeaders); other action subfields are
    // scalar and go through setField. Non-header rule variants don't
    // expose set-modeled paths under `action`, so the whole patch
    // travels as one setField at `action`.
    if (key === 'action' && ruleType === 'header' && isPlainObject(value)) {
      const action = value as Record<string, unknown>;
      const remaining: Record<string, unknown> = {};
      for (const [subKey, subVal] of Object.entries(action)) {
        const setPath = isSetPath('action', subKey);
        if (setPath && Array.isArray(subVal)) {
          pushSetReplacement(bodies, ruleUid, setPath, subVal, liveSetItemIds);
          continue;
        }
        remaining[subKey] = subVal;
      }
      // Any non-set-modeled action subfields land as a single setField
      // at the leaf path. We don't flatten further — the editor's
      // submit shape never carries deeply-nested mixed paths today;
      // this can be revisited if a real surface needs per-leaf writes.
      for (const [subKey, subVal] of Object.entries(remaining)) {
        bodies.push({
          kind: 'setField',
          type: RULE_ENTITY_TYPE,
          id: ruleUid,
          path: `action.${subKey}`,
          value: subVal,
        });
      }
      continue;
    }

    bodies.push({ kind: 'setField', type: RULE_ENTITY_TYPE, id: ruleUid, path: key, value });
  }

  return {
    batch: mintBatch(ctx, bodies),
    sideEffects: bodies.length > 0 ? [recompileDnrIntent(ruleUid, ctx.hlc)] : [],
  };
}

function pushSetReplacement(
  bodies: MutationBody[],
  ruleUid: string,
  setPath: SetPath,
  newItems: unknown[],
  liveSetItemIds: LiveSetItemIds,
): void {
  const live = liveSetItemIds(ruleUid, setPath);
  for (const itemId of live) {
    bodies.push({ kind: 'removeFromSet', type: RULE_ENTITY_TYPE, id: ruleUid, path: setPath, itemId });
  }
  for (const item of newItems) {
    bodies.push({
      kind: 'addToSet',
      type: RULE_ENTITY_TYPE,
      id: ruleUid,
      path: setPath,
      itemId: generateUid(),
      item,
    });
  }
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
