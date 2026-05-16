/**
 * Scope-expansion detector for the Activity Feed (F2.d).
 *
 * A rule's effective surface is the AND of its conditions. Widening
 * means: relaxing what the rule matches such that it now fires on
 * traffic it previously ignored. The user-visible reason to highlight
 * this on inbound mutations is that a remote peer just expanded what
 * the receiver's network is rewriting — a possible privacy / security
 * surprise that the silent-LWW path would otherwise swallow.
 *
 * The detector compares the prior + next materialized rule view. It
 * returns `true` when next is *strictly broader* than prior on at
 * least one condition axis; it returns `false` for narrowing, no-op,
 * or orthogonal edits.
 *
 * Conservative-true-positive design: false positives produce a noisy
 * yellow row (annoying but recoverable); false negatives silently
 * underreport (privacy regression). The detector errs toward emitting.
 *
 * Three widening shapes covered:
 *
 *   1. **Condition removed.** `next.conditions` lacks a uid that
 *      `prior.conditions` had. Conditions AND → fewer of them = wider.
 *   2. **Condition values widened.** Same uid + type on both sides;
 *      the values list either lost an entry (e.g. removed an
 *      exclude-domain) or gained one (e.g. added another domain to a
 *      `request-domains` whitelist — broader match surface).
 *   3. **Condition type narrowed elsewhere → widened here.** Type
 *      flipped on an inclusive condition (e.g. `request-domains` →
 *      `exclude-request-domains`) — handled by case 1/2 because the
 *      uid is the same row identity.
 *
 * Out of scope today (false negatives we accept):
 *   - URL-filter glob comparison ("\*.example.com" → "\*"). Treated as
 *     "values changed" which still trips case 2 if the values array
 *     differs.
 *   - regex equivalence; we compare value arrays as strings only.
 */

import { RULE_ENTITY_TYPE } from '../mutators/rule/types';

/** Minimum shape we need from a materialized rule view. */
interface RuleLike {
  conditions?: ConditionLike[];
}
interface ConditionLike {
  uid?: string;
  type?: string;
  values?: string[];
  headerName?: string;
}

/**
 * `entityType` is gated: callers may pass any materialized entity, but
 * the helper short-circuits to `false` for non-rule entities so the
 * classifier can call it unconditionally.
 */
export function widensScope(entityType: string, prior: unknown, next: unknown): boolean {
  if (entityType !== RULE_ENTITY_TYPE) return false;
  if (!isPlainObject(prior) || !isPlainObject(next)) return false;

  const priorConds = readConditions(prior as RuleLike);
  const nextConds = readConditions(next as RuleLike);

  // No prior conditions at all → can't tell directionality. Skip.
  if (priorConds.length === 0) return false;

  const nextByUid = new Map<string, ConditionLike>();
  for (const c of nextConds) if (typeof c.uid === 'string') nextByUid.set(c.uid, c);

  for (const priorCond of priorConds) {
    if (typeof priorCond.uid !== 'string') continue;
    const nextCond = nextByUid.get(priorCond.uid);

    // Case 1: condition removed.
    if (!nextCond) return true;

    // Case 2: values widened. Same uid + same type → compare values arrays.
    if (priorCond.type === nextCond.type) {
      if (valuesWidened(priorCond.values, nextCond.values)) return true;
    }
  }

  return false;
}

function readConditions(rule: RuleLike): ConditionLike[] {
  const conds = rule.conditions;
  if (!Array.isArray(conds)) return [];
  return conds.filter((c): c is ConditionLike => isPlainObject(c));
}

/**
 * A values array is "widened" when it either grew (new match target)
 * OR when the prior set is not a subset of the next set (an item was
 * dropped, which for an inclusion list narrows; for an exclusion list
 * widens — we flag both as we can't tell sense from the values alone).
 *
 * Both directions flagged: the cost is a noisy highlight on rare
 * include-list pruning; the win is catching exclusion-list shrinks.
 */
function valuesWidened(priorValues: string[] | undefined, nextValues: string[] | undefined): boolean {
  const prior = new Set(Array.isArray(priorValues) ? priorValues : []);
  const next = new Set(Array.isArray(nextValues) ? nextValues : []);
  if (prior.size === 0 && next.size === 0) return false;
  if (prior.size === 0 && next.size > 0) return true; // grew from empty → wider surface
  for (const v of next) if (!prior.has(v)) return true; // added value
  for (const v of prior) if (!next.has(v)) return true; // removed value
  return false;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
