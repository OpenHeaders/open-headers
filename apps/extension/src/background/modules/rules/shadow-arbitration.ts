/**
 * Shadow arbitration — approximates Chrome's declarativeNetRequest conflict
 * resolution (plus scriptable-rule interactions the DNR doesn't know about)
 * so the test-results view can tell users "this rule matched, but something
 * else in the same scope made its effect invisible / ambiguous."
 *
 * ── Phases ─────────────────────────────────────────────────────────
 *
 * Phase 3 ships FIVE per-hop shadow patterns, applied in order; a rule
 * carries at most one attribution (the first phase that claims it wins).
 * The ordering encodes precedence — a rule shadowed by a block is never
 * relabelled as "redirect-retargeted", because the block claim is a
 * stronger statement about what actually happened.
 *
 *   1. **block-terminal**  — block cancels the request; everything at
 *      priority ≤ block except other blocks and inject (response-side
 *      CSP strip) is shadowed. The only phase with *terminal* semantics
 *      (the request never reaches the network).
 *
 *   2. **redirect-retarget** — a redirect (or query-param) rule sends the
 *      request to a different URL. Lower-priority modify rules (header,
 *      request-body, response, delay) that matched the pre-redirect URL are shadowed
 *      because the user-visible response comes from the REDIRECT target,
 *      not the matched URL. Chrome does technically run modifyHeaders on
 *      the pre-redirect request, but that request is discarded, so from
 *      the user's perspective "my header rule did nothing."
 *
 *   3. **mock-intercept** — a mock-source response rule fabricates the response.
 *      Response-side header modifications and body rules in the same
 *      matching set operate on fabricated bytes (or on a real response
 *      the user will never see). Marked so the test view can explain
 *      "this ran, but the response was replaced by a mock."
 *
 *   4. **header-stacking-ambiguous** — two or more header rules touch the
 *      same header name on the same side (request/response) and their
 *      operations conflict in a way that depends on insertion order. DNR
 *      priority doesn't disambiguate this within a single priority tier,
 *      so Chrome's result is effectively non-deterministic. Flagged so
 *      the user can pick one rule as the source of truth.
 *
 *   5. **delay-page-intercept** — a delay rule rewrites the main-frame
 *      navigation to chrome-extension://delay.html. Inject rules in the
 *      matching set are conditioned on the *real* user URL, so they
 *      never get a chance to mount on delay.html. Detected statically:
 *      delay + inject in the same matching set → inject is shadowed.
 *      No session-wide commit inspection needed, because the outcome is
 *      deterministic from the rule set alone.
 *
 * Anything else (redirect-chain "stale-pattern", request-body replaces response
 * + cookie mod ordering, etc.) is deliberately not modelled. The flow
 * visualization is the diagnostic surface for those — adjacent
 * green/grey cards in the same tier already tell the story.
 *
 * ── Design notes ───────────────────────────────────────────────────
 *
 * - Arbitration is a pure function over the matching set, decorated per
 *   rule with priority + action class + (for header rules) header ops.
 *   It never reads global state, which keeps every consumer call-site
 *   trivially testable.
 * - The arbitration result is always computed, regardless of whether
 *   the user has the experimental setting on. Data flows into
 *   `RequestRecord.shadowedBy`; the UI gates rendering of the amber
 *   warning on the setting, so enabling the flag just "lights up"
 *   data that was already there for debugging.
 * - `inject` rules strip CSP via modifyHeaders on the RESPONSE and also
 *   mount content scripts on the committed document. They don't compete
 *   with block's request-terminal semantics (the response never comes if
 *   a block cancels), and they're not retargeted by redirects in a
 *   meaningful way (the CSP strip runs on whichever response survives).
 *   So they're treated as non-participating in the block and redirect
 *   phases. BUT a delay rule rewrites the committed *document URL* to
 *   chrome-extension://delay.html, and inject's content-script mount
 *   targets the user URL — so inject IS shadowable by delay on the same
 *   URL. The delay phase is the only one where inject participates.
 * - There is no `allow` action. That arbitration escape-hatch is N/A here.
 */

import type { Rule, ShadowAttribution, ShadowKind } from '@openheaders/core/types';
import type { MatchingRule } from '../request-tracker';

export type { ShadowAttribution, ShadowKind } from '@openheaders/core/types';

/** Action class used for arbitration. One entry per rule type. */
export type ActionClass =
  | 'block'
  | 'redirect'
  | 'query-param'
  | 'header'
  | 'request-body'
  // 'mock' = a synthetic-reply (mock-source) response rule; it intercepts.
  // 'response-modify' = a network-source response rule; it rewrites the real
  // reply and is shadowable like a request-body rule, but never itself a shadower.
  | 'mock'
  | 'response-modify'
  | 'delay'
  | 'inject-csp'
  | 'message'
  | 'auth';

/**
 * DNR priority ladder used for arbitration. These are *conceptual*
 * priorities — they encode "who wins in a semantic conflict" rather than
 * the literal emitted DNR priority (which can be 1000/950 for response
 * headers, etc.). Keeping them decoupled lets arbitration reason about
 * user-visible outcomes without re-implementing Chrome's matcher.
 *
 * Scriptable-only types (request-body, response) don't have a DNR priority;
 * we give them header's value (100) so they sit below redirects in the
 * arbitration order, which matches real-world behavior (they run against
 * a request that survives DNR arbitration).
 */
const RULE_PRIORITY: Record<Rule['type'], number> = {
  inject: 2000,
  block: 200,
  redirect: 150,
  'query-param': 150,
  header: 100,
  response: 100,
  'request-body': 100,
  ws: 100,
  sse: 100,
  // Auth answers a challenge over CDP against a request that survives DNR —
  // same tier as the other scriptable/CDP effects, below the retargeters.
  auth: 100,
  delay: 2,
};

const RULE_ACTION_CLASS: Record<Rule['type'], ActionClass> = {
  inject: 'inject-csp',
  block: 'block',
  redirect: 'redirect',
  'query-param': 'query-param',
  delay: 'delay',
  header: 'header',
  // Default for response rules — the synthetic-reply (mock) source. The
  // network source is reclassified to 'response-modify' in actionClassFor().
  response: 'mock',
  'request-body': 'request-body',
  // ws/sse wrappers act in-page on connections that survive DNR — like
  // request-body/response they sit below retargeters and are shadowable by block
  // (a blocked upgrade never opens a socket for the wrapper to act on).
  ws: 'message',
  sse: 'message',
  // Auth provides credentials when a request reaches a challenge. It never
  // shadows another class, but a block (request never sent) or a redirect
  // (the challenged request is discarded) makes its effect moot — so it
  // participates passively, shadowable like the other priority-100 classes.
  auth: 'auth',
};

/**
 * Action class for a matching rule. Every type maps statically except
 * `response`, which splits on its source axis: a `mock` source fabricates
 * the reply (class `mock` — the mock-intercept shadower), while a `network`
 * source rewrites the real reply (class `response-modify` — shadowable like
 * a request-body rule, but never itself a shadower).
 */
function actionClassFor(rule: MatchingRule): ActionClass {
  if (rule.type === 'response') {
    return rule.responseSource === 'mock' ? 'mock' : 'response-modify';
  }
  return RULE_ACTION_CLASS[rule.type];
}

export interface ArbitratedRule extends MatchingRule {
  priority: number;
  actionClass: ActionClass;
  /**
   * Set when this rule's effect is not user-visible because another rule
   * in the same matching set superseded, retargeted, mocked, or conflicted
   * with it. A missing value means "the arbitrator has no confident claim
   * about this rule's fate" — UI treats that as unshadowed.
   */
  shadowedBy?: ShadowAttribution;
}

/**
 * Decorate every matching rule with priority + action class + (for header
 * rules) header ops, then walk the shadow detectors in precedence order.
 * Input order is preserved so the caller can iterate in match-order
 * without re-sorting.
 */
export function arbitrate(matching: MatchingRule[]): ArbitratedRule[] {
  const decorated: ArbitratedRule[] = matching.map((r) => ({
    ...r,
    priority: RULE_PRIORITY[r.type],
    actionClass: actionClassFor(r),
  }));

  applyBlockShadow(decorated);
  applyRedirectShadow(decorated);
  applyMockIntercept(decorated);
  applyDelayPageShadow(decorated);
  applyHeaderStacking(decorated);

  return decorated;
}

/**
 * Strategy-aware wrapper around arbitrate(). `rulesEngine.evaluationStrategy`
 * translates directly into how observed-fire recording treats a matching set:
 *
 *   - `closest-match` (default): full shadow arbitration. Each rule either
 *     fires unshadowed or carries a `shadowedBy` attribution explaining
 *     which higher-specificity rule overrode its effect.
 *   - `all-matching`: report every matching rule as unshadowed. Useful when
 *     the user wants the debug panel to list everything Chrome might have
 *     touched, regardless of visible outcome.
 *   - `first-match`: only the first (highest DNR priority) matching rule is
 *     retained. Mirrors the semantics of classic proxies / MITM tools where
 *     a URL hits exactly one rule.
 *
 * This wrapper intentionally lives in the shadow-arbitration module so the
 * strategy and the arbitration pass share a single source of truth.
 */
export function arbitrateWithStrategy(
  matching: MatchingRule[],
  strategy: 'first-match' | 'closest-match' | 'all-matching',
): ArbitratedRule[] {
  if (matching.length === 0) return [];

  if (strategy === 'all-matching') {
    return matching.map((r) => ({
      ...r,
      priority: RULE_PRIORITY[r.type],
      actionClass: actionClassFor(r),
    }));
  }

  const decorated = arbitrate(matching);

  if (strategy === 'first-match') {
    // Pick the single rule with the highest conceptual priority; on ties,
    // keep match order. Drop any shadowedBy attribution — there is only
    // one rule in the result, so the concept doesn't apply.
    let winner = decorated[0];
    for (let i = 1; i < decorated.length; i++) {
      if (decorated[i].priority > winner.priority) winner = decorated[i];
    }
    const { shadowedBy: _unused, ...rest } = winner;
    void _unused;
    return [rest];
  }

  return decorated;
}

// ── Phase 1: block-terminal ───────────────────────────────────────

/**
 * Block is the only terminal action in the data model — Chrome cancels the request,
 * so redirect / query-param / header / delay / request-body / response all silently
 * fail. Inject's CSP strip runs on the response, which never comes, so
 * it's moot rather than "shadowed" in the user-visible sense (we treat
 * it as non-participating). Two blocks stack conceptually — we don't
 * mark them as shadowing each other.
 */
function applyBlockShadow(decorated: ArbitratedRule[]): void {
  const blocks = decorated.filter((r) => r.actionClass === 'block');
  if (blocks.length === 0) return;

  const topBlock = blocks.reduce((hi, r) => (r.priority > hi.priority ? r : hi));

  for (const r of decorated) {
    if (r.shadowedBy) continue;
    if (r.uid === topBlock.uid) continue;
    if (r.actionClass === 'block') continue;
    if (r.actionClass === 'inject-csp') continue;
    if (r.priority > topBlock.priority) continue;
    r.shadowedBy = { uid: topBlock.uid, name: topBlock.name, kind: 'block-terminal' };
  }
}

// ── Phase 2: redirect / query-param retarget ───────────────────────

/**
 * Redirect and query-param rules rewrite the request URL. Lower-priority
 * *modify* classes (header, request-body, response, delay) that matched the
 * pre-redirect URL are semantically shadowed: Chrome does run their
 * modifications on the pre-redirect request, but that request is
 * discarded the moment the redirect fires, so the user never sees the
 * effect on the real response (which comes from the retargeted URL).
 *
 * Redirects don't shadow other redirects (users can stack them in a
 * pipeline), they don't shadow inject (response-side), and they don't
 * shadow block (block at the same priority tier just stacks above).
 *
 * We pick the highest-priority retargeting rule as the shadower. If
 * both a redirect and a query-param rule are present, priority is
 * equal (150) and insertion order decides — matches Chrome's own
 * undefined-order behavior.
 */
function applyRedirectShadow(decorated: ArbitratedRule[]): void {
  const retargeters = decorated.filter((r) => r.actionClass === 'redirect' || r.actionClass === 'query-param');
  if (retargeters.length === 0) return;

  // First retargeter wins attribution (stable insertion order).
  const topRetarget = retargeters.reduce((hi, r) => (r.priority > hi.priority ? r : hi));
  const kind: ShadowKind = topRetarget.actionClass === 'query-param' ? 'query-param-retarget' : 'redirect-retarget';

  for (const r of decorated) {
    if (r.shadowedBy) continue;
    if (r.uid === topRetarget.uid) continue;
    // Retargeters don't shadow each other — users stack them deliberately.
    if (r.actionClass === 'redirect' || r.actionClass === 'query-param') continue;
    // Inject (CSP strip) is response-side and survives the retargeting.
    if (r.actionClass === 'inject-csp') continue;
    // Block is not shadowed by retargeting — if block is present the block
    // phase already ran and the retargeter itself would be shadowed first.
    if (r.actionClass === 'block') continue;
    // Only modify-class rules at strictly lower priority than the retargeter.
    if (r.priority >= topRetarget.priority) continue;
    r.shadowedBy = { uid: topRetarget.uid, name: topRetarget.name, kind };
  }
}

// ── Phase 3: mock intercepts response-side modifiers ───────────────

/**
 * A mock-source response rule fabricates the response bytes (the request
 * never reaches the network). Any other rule whose effect targets the
 * response is moot from the user's perspective:
 *
 *   - Request-body rules rewrite a request that never leaves the browser → moot.
 *   - Network-source response rules rewrite the real reply → operate on
 *     bytes the fabricated response replaced → mocked.
 *   - Header rules with response-side modifications run on the response
 *     headers → mocked. Header rules with only request-side modifications
 *     are NOT shadowed (their effect on the outgoing request is real;
 *     what comes back just happens to be a mock).
 *
 * Only a `mock`-source response rule fabricates — a `network`-source one
 * (`response-modify`) modifies the real reply and is itself a target here,
 * never the shadower. If multiple mocks match, the first is
 * attribution-source (interception-wins-race for scriptable rules).
 */
function applyMockIntercept(decorated: ArbitratedRule[]): void {
  const mock = decorated.find((r) => r.actionClass === 'mock');
  if (!mock) return;

  for (const r of decorated) {
    if (r.shadowedBy) continue;
    if (r.uid === mock.uid) continue;
    if (r.actionClass === 'request-body' || r.actionClass === 'response-modify') {
      r.shadowedBy = { uid: mock.uid, name: mock.name, kind: 'mock-intercept' };
      continue;
    }
    if (r.actionClass === 'header' && hasResponseSideOp(r)) {
      r.shadowedBy = { uid: mock.uid, name: mock.name, kind: 'mock-intercept' };
    }
  }
}

function hasResponseSideOp(r: ArbitratedRule): boolean {
  if (!r.headerOps) return false;
  return r.headerOps.some((op) => op.side === 'response');
}

// ── Phase 4: delay-page intercept ──────────────────────────────────

/**
 * A delay rule rewrites main-frame / sub-frame navigations to
 * chrome-extension://delay.html (see dnr-builders/delay-builder.ts).
 * Inject rules mount content scripts on the *committed* document, so if
 * the document commits to delay.html the user's inject conditioned on
 * the real URL never runs — even though from the DNR priority ladder
 * they don't "conflict" (inject is priority 2000, delay is 2).
 *
 * This is the one phase where inject participates. Mark inject rules
 * in the matching set as shadowed by the delay rule when both match
 * the same URL. The arbitrator can't be 100% certain the delay page
 * will commit — the delay might redirect instantly, or the sub-resource
 * path might bypass delay.html entirely — but if the user has a delay
 * and an inject targeting the same URL, the expected outcome is
 * "inject doesn't run during the delay visit", and that's what the
 * test-results view should tell them.
 */
function applyDelayPageShadow(decorated: ArbitratedRule[]): void {
  const delay = decorated.find((r) => r.actionClass === 'delay');
  if (!delay) return;

  for (const r of decorated) {
    if (r.shadowedBy) continue;
    if (r.uid === delay.uid) continue;
    if (r.actionClass !== 'inject-csp') continue;
    r.shadowedBy = { uid: delay.uid, name: delay.name, kind: 'delay-page-intercept' };
  }
}

// ── Phase 4: header-stacking ambiguity ─────────────────────────────

/**
 * Two or more header rules touching the same header name on the same side
 * (request/response) produce a non-deterministic effective value: Chrome
 * runs them in priority order, and within a priority tier the order is
 * undefined (insertion order on our side, but not a contract users should
 * rely on).
 *
 * Whether this is *actually* ambiguous depends on the operations:
 *
 *   - set-vs-set (override): last-write-wins, ordering matters → AMBIGUOUS
 *   - set-vs-append / append-vs-set: final value depends on which ran first
 *     → AMBIGUOUS
 *   - remove-vs-anything: removal wins if it runs last, append wins if it
 *     runs last → AMBIGUOUS
 *   - append-vs-append on the same name: both run, order of tokens in the
 *     stacked value depends on insertion → AMBIGUOUS (user-visible)
 *   - merge is scriptable, runs outside the DNR order, and is deterministic
 *     against whatever survives DNR → NOT AMBIGUOUS by itself (but a
 *     merge-plus-override on the same name IS ambiguous because it depends
 *     on which one Chrome applies first)
 *
 * We flag every rule involved in an ambiguous clash. Attribution points
 * at one of the OTHER rules in the clash so the UI can show "conflicts
 * with <that rule>" — if there are 3+ rules in a clash, the first other
 * rule is used.
 */
function applyHeaderStacking(decorated: ArbitratedRule[]): void {
  // Group by (side, normalized name).
  const groups = new Map<string, ArbitratedRule[]>();
  for (const r of decorated) {
    if (r.actionClass !== 'header' || !r.headerOps) continue;
    for (const op of r.headerOps) {
      const key = `${op.side}:${op.name}`;
      let list = groups.get(key);
      if (!list) {
        list = [];
        groups.set(key, list);
      }
      if (!list.includes(r)) list.push(r);
    }
  }

  for (const [, rulesInGroup] of groups) {
    if (rulesInGroup.length < 2) continue;
    // Any rule already shadowed by an earlier phase is irrelevant — its
    // effective contribution is already moot.
    const active = rulesInGroup.filter((r) => !r.shadowedBy);
    if (active.length < 2) continue;
    // Flag every active rule with attribution pointing at a sibling.
    for (const r of active) {
      if (r.shadowedBy) continue;
      const sibling = active.find((o) => o.uid !== r.uid);
      if (!sibling) continue;
      r.shadowedBy = { uid: sibling.uid, name: sibling.name, kind: 'header-stacking-ambiguous' };
    }
  }
}
