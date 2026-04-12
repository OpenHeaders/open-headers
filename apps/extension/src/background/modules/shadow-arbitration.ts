/**
 * Shadow arbitration — approximates Chrome's declarativeNetRequest conflict
 * resolution so the popup can tell users "this rule matched, but a
 * higher-priority rule ate the request before it could do anything."
 *
 * ── What we can and cannot prove ───────────────────────────────────
 *
 * V5 priorities are deterministic per rule type — they're baked into the
 * DNR builders, not stored per-rule. That lets us run arbitration as a pure
 * function over `type`. But there is no per-rule tiebreaker we can see from
 * outside Chrome (internal order, ruleset id, etc.), so two rules at the
 * same priority+action-class are treated as "both apply" — no shadow claim.
 *
 * Phase 2 ships exactly **one** arbitration pattern:
 *
 *   - **block shadows everything at ≤ block priority except other blocks
 *     and the CSP-strip inject layer.** Block is terminal: Chrome cancels
 *     the request, so redirect/query-param/header/delay/body/mock/inject
 *     all silently fail. This is the single highest-signal diagnostic in
 *     V5 ("why is nothing happening — a block rule is eating the request")
 *     and we can prove it from priority + rule type alone.
 *
 * Anything else a future phase wants to model (redirect-vs-redirect, header
 * stacking, delay-under-user-redirect) needs tighter grounding before we
 * ship false-positive amber warnings at users. An `allow` action does not
 * exist in V5, so that escape-hatch pattern is simply N/A here.
 *
 * ── Design notes ───────────────────────────────────────────────────
 *
 * - The arbitration result is always computed, regardless of whether the
 *   user has the experimental setting on. The data flows through into
 *   RequestRecord.shadowedBy. The UI gates rendering of the amber warning
 *   on the setting — so enabling the flag just "lights up" data that was
 *   already there for debugging.
 * - `inject` rules strip CSP via modifyHeaders on the RESPONSE. They don't
 *   compete with block's terminal-on-request semantics — if block wins,
 *   the response never comes and inject is moot, but that's not a "shadow"
 *   in the user-visible sense. Treat inject as non-participating.
 * - `delay` has a deliberately low priority (2) so user redirects/blocks
 *   override it. That mechanism is already explicit in the delay builder's
 *   comment; our arbitration simply makes its consequences visible.
 */

import type { V5 } from '@openheaders/core/types';
import type { MatchingRule } from './request-tracker';

/** Action class used for arbitration. One entry per V5 rule type. */
export type ActionClass = 'block' | 'redirect' | 'header' | 'scriptable' | 'inject-csp';

/**
 * V5 DNR priority ladder — mirrors the constants in the dnr-builders modules.
 * Scriptable-only types (body, mock) don't have a DNR priority; we give them
 * header's value (100) so they sit below redirects in the arbitration order,
 * which matches their real-world behavior (they run against a request that
 * survives DNR arbitration).
 */
const RULE_PRIORITY: Record<V5.Rule['type'], number> = {
  inject: 2000,
  header: 100,
  block: 200,
  redirect: 150,
  'query-param': 150,
  delay: 2,
  mock: 100,
  body: 100,
};

const RULE_ACTION_CLASS: Record<V5.Rule['type'], ActionClass> = {
  inject: 'inject-csp',
  block: 'block',
  redirect: 'redirect',
  'query-param': 'redirect',
  delay: 'redirect',
  header: 'header',
  mock: 'scriptable',
  body: 'scriptable',
};

export interface ArbitratedRule extends MatchingRule {
  priority: number;
  actionClass: ActionClass;
  /**
   * Set when this rule would not have fired in practice because another rule
   * terminated the request first. Phase 2 only populates this for the
   * block-shadows-everything pattern; a missing value means "our arbitrator
   * has no confident claim about this rule's fate."
   */
  shadowedBy?: { uid: string; name: string };
}

/**
 * Decorate every matching rule with its priority + action class, and mark
 * any rule that a terminal `block` rule would shadow. Input order is
 * preserved so the caller can iterate in match-order without re-sorting.
 */
export function arbitrate(matching: MatchingRule[]): ArbitratedRule[] {
  const decorated: ArbitratedRule[] = matching.map((r) => ({
    ...r,
    priority: RULE_PRIORITY[r.type],
    actionClass: RULE_ACTION_CLASS[r.type],
  }));

  const blocks = decorated.filter((r) => r.actionClass === 'block');
  if (blocks.length === 0) return decorated;

  // Pick the highest-priority block as the "terminal" — if ties, pick the
  // first one encountered (insertion order is the rule-store order, which
  // is stable for the session).
  const topBlock = blocks.reduce((hi, r) => (r.priority > hi.priority ? r : hi));

  return decorated.map((r) => {
    if (r.uid === topBlock.uid) return r;
    if (r.actionClass === 'block') return r; // other blocks stack conceptually
    if (r.actionClass === 'inject-csp') return r; // CSP strip is response-side
    if (r.priority > topBlock.priority) return r; // higher priority than block — escapes it
    return {
      ...r,
      shadowedBy: { uid: topBlock.uid, name: topBlock.name },
    };
  });
}
