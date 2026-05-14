/**
 * Rule write-site → oracle helpers.
 *
 * `rule-store.ts` historically owned the in-memory `Rule[]` array
 * and persisted it to host storage on every write. With the
 * sync engine activated (Phase A Fw6f), rule writes route through the
 * oracle as `MutationBatch`es; the rule cache projects the oracle's
 * materialized state back to `Rule[]` and persists it.
 *
 * The four helpers below produce `(batch, sideEffects)` pairs for the
 * four legacy write paths. They're pure transforms — no oracle reads,
 * no IO — so the rule-store can apply them under its existing
 * orchestration.
 *
 * Set-modeled fields (`conditions`, `action.requestHeaders`,
 * `action.responseHeaders`) need special handling on partial updates:
 * a naïve `setField('conditions', [...])` would write a leaf entry
 * that competes with the oracle's setItems entries at the same path,
 * producing a non-deterministic materialized view. The shared
 * {@link synthesizeSetDiff} computes the **minimum** envelope sequence
 * — `removeFromSet` for vanished uids, `addToSet` for new and
 * content-changed uids (per-itemId LWW supersedes; no redundant
 * `removeFromSet` for content edits), and `moveBefore` for pure
 * position changes. Mixed gestures emit the minimum diff in one walk.
 *
 * Persistent row identity comes from the schema: each `RuleCondition`,
 * `HeaderModification` carries a required `uid` field that doubles as
 * the sync engine's itemId. Save → reload preserves identity.
 */

import {
  mintBatch,
  type MutationBatch,
  type MutationBody,
  recompileDnrIntent,
  RULE_ENTITY_TYPE,
  type MutatorContext,
  type SideEffectIntent,
  toggleEnabled,
} from '@openheaders/core/sync';
import type { Rule } from '@openheaders/core/types';
import { seedRule } from './rule-projection';
import { type LiveSetEntry, synthesizeSetDiff } from '@openheaders/core/sync-builders';

export interface RuleMutationPayload {
  batch: MutationBatch;
  sideEffects: SideEffectIntent[];
}

/**
 * Live-set reader for set-modeled paths on a Rule. Returns the
 * triplet `{itemId, orderKey, item}` per live set member in canonical
 * sort order — {@link synthesizeSetDiff} consults the orderKey + item
 * to detect pure-reorder gestures, content edits, and additions in
 * one pass. SW + renderer both satisfy this — see
 * `oracle.liveOrderedSetItems` and `RuleSyncMirror.liveOrderedSetItems`
 * combined with the rule snapshot for `item` resolution.
 */
export type LiveSetEntries = (
  ruleUid: string,
  setPath: string,
) => ReadonlyArray<LiveSetEntry>;

/** New rule → seed batch + DNR recompile intent. */
export function buildAddBatch(rule: Rule, ctx: MutatorContext): RuleMutationPayload {
  return {
    batch: seedRule(rule, ctx),
    sideEffects: [recompileDnrIntent(rule.uid, ctx.hlc)],
  };
}

/** Toggle a rule's `enabled` flag. */
export function buildToggleBatch(ruleUid: string, enabled: boolean, ctx: MutatorContext): RuleMutationPayload {
  const intent = toggleEnabled(ctx, { ruleUid, enabled });
  return { batch: intent.batch, sideEffects: intent.sideEffects };
}

/** Delete a rule. Tombstone is permanent under §7.2 delete-wins. */
export function buildDeleteBatch(ruleUid: string, ctx: MutatorContext): RuleMutationPayload {
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
 * Translate a `Partial<Omit<Rule, 'uid'|'path'>>` patch into a
 * single batch of mutations. Scalar fields → one `setField` per
 * leaf; set-modeled fields → minimum diff via {@link synthesizeSetDiff}.
 *
 * Concurrency with another emitter mid-update is handled by per-itemId
 * LWW: a concurrent `addToSet(newItemId, ...)` wins because we never
 * tombstone an itemId we didn't observe; a concurrent
 * `removeFromSet(itemId)` is idempotent under tombstone HLC compare.
 */
export function buildUpdateBatch(
  ruleUid: string,
  ruleType: Rule['type'],
  updates: Partial<Omit<Rule, 'uid' | 'path'>>,
  ctx: MutatorContext,
  liveSetEntries: LiveSetEntries,
): RuleMutationPayload {
  const bodies: MutationBody[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;

    // conditions: top-level set-modeled path on every rule variant.
    if (key === 'conditions' && Array.isArray(value)) {
      bodies.push(
        ...synthesizeSetDiff({
          type: RULE_ENTITY_TYPE,
          id: ruleUid,
          path: 'conditions',
          live: liveSetEntries(ruleUid, 'conditions'),
          newItems: value,
        }),
      );
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
          bodies.push(
            ...synthesizeSetDiff({
              type: RULE_ENTITY_TYPE,
              id: ruleUid,
              path: setPath,
              live: liveSetEntries(ruleUid, setPath),
              newItems: subVal,
            }),
          );
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

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
