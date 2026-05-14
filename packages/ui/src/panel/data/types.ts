/**
 * Shared types for the DevTools Inspector panel.
 *
 * The traffic list is driven SOLELY by HAR entries forwarded from the
 * devtools_page, so it matches Chrome's native Network panel 1:1 — no
 * phantom rows, no "half-correlated" states. Rule-fire data is an
 * augmentation layer: fires attach to HAR entries when their URL
 * matches, or surface as "off-HAR rule activity" (dangling fires)
 * when the request didn't produce a HAR entry (e.g. a block rule
 * cancelled it before response, a service worker handled it, or the
 * request fired before DevTools was open to capture it).
 */

import type { InspectorHarEntry, InspectorNavTiming, RequestRecord, RuleSnapshot } from '@openheaders/core/types';

export type { InspectorNavTiming };

/**
 * Per-rule fire attached to an `InspectorRequest`. `authoritative`
 * distinguishes `onRuleMatchedDebug` fires (Chrome/Edge only — Chrome
 * told us this rule actually executed) from tab-telemetry's inferred
 * URL-matching path.
 *
 * `requestId` is the host's network-request identifier — present for
 * every network-observed fire and used as the deterministic join key to
 * the HAR entry. Absent only for scriptable fires reported from the
 * in-page fire-bridge.
 */
export interface InspectorFire {
  ruleUid: string;
  t: number;
  pattern: string;
  authoritative: boolean;
  requestId?: string;
  shadowedBy?: RequestRecord['shadowedBy'];
  evidence: RequestRecord['evidence'];
  /** Frozen rule snapshot captured at fire-emit time in the background.
   *  Authoritative source for what the row should display — prevents
   *  later edits to the live rule from rewriting historical attribution.
   *  See `RuleSnapshot` doc in `types/telemetry.ts`. */
  ruleSnapshot?: RuleSnapshot;
}

/**
 * "Rule actually ran" predicate. True when we have ground-truth evidence
 * the action executed — either:
 *
 *   - `authoritative`: Chrome's `onRuleMatchedDebug` reported this DNR
 *     rule executed on the wire.
 *   - `evidence === 'confirmed'`: the in-page fire-bridge reported the
 *     scriptable action ran inside the page.
 *
 * Both signals are equivalently strong from the user's POV — "yes, my
 * rule fired." `evidence: 'matched'` and `'matched-fallback'` are
 * inferred from URL pattern matching alone and don't qualify.
 *
 * Use this everywhere the UI answers the user question "did my rule
 * apply on this row?" so the answer is the same regardless of which
 * channel (DNR vs scriptable) the rule used.
 */
export function isAppliedFire(fire: InspectorFire): boolean {
  return fire.authoritative || fire.evidence === 'confirmed';
}

/**
 * Evidence ranking — higher is stronger. Mirrors `tab-telemetry`'s
 * internal `upgradeEvidence` so the panel and the popup agree on what
 * "stronger evidence" means when two records describe the same fire.
 */
const EVIDENCE_RANK: Record<RequestRecord['evidence'], number> = {
  confirmed: 3,
  matched: 2,
  'matched-fallback': 1,
  silent: 0,
};

/** Pick the stronger of two evidence values. Ties keep the first arg. */
export function strongerEvidence(
  a: RequestRecord['evidence'],
  b: RequestRecord['evidence'],
): RequestRecord['evidence'] {
  return EVIDENCE_RANK[a] >= EVIDENCE_RANK[b] ? a : b;
}

/**
 * Merge two fire records that describe the same `(ruleUid, requestId)` —
 * fold the stronger `authoritative` flag and the stronger `evidence`
 * tier into the existing record. Returns the same reference when no
 * upgrade is needed so callers can short-circuit equality checks.
 *
 * The two channels (Chrome's `onRuleMatchedDebug` and the in-page
 * fire-bridge) race in dev mode. Whichever arrives first must not
 * down-grade the row's badge later. Symmetrically — when the second
 * arrival is the stronger signal, it must overwrite. This helper makes
 * both cases race-independent.
 */
export function mergeFireEvidence<T extends InspectorFire>(existing: T, incoming: InspectorFire): T {
  const auth = existing.authoritative || incoming.authoritative;
  const ev = strongerEvidence(existing.evidence, incoming.evidence);
  // Snapshot policy: first arrival wins (closest in time to the actual
  // fire), but adopt the incoming snapshot if existing didn't have one
  // — covers the race where the authoritative fire (which carries a
  // snapshot) arrives before the inferred fire (which would also).
  const snap = existing.ruleSnapshot ?? incoming.ruleSnapshot;
  if (auth === existing.authoritative && ev === existing.evidence && snap === existing.ruleSnapshot) {
    return existing;
  }
  return {
    ...existing,
    authoritative: auth,
    evidence: ev,
    ...(snap ? { ruleSnapshot: snap } : {}),
  };
}

/**
 * A rule fire that couldn't be joined to any HAR entry. Typically
 * means the request was blocked / cancelled / cached / handled by a
 * service worker so DevTools never produced a HAR entry for it, but
 * the extension still saw the URL match a rule's conditions. Rendered
 * in the "Rule Activity" view as a separate list so power users can
 * audit rule behavior on requests that don't show up in the primary
 * traffic list.
 */
export interface DanglingFire extends InspectorFire {
  /** URL the rule fired on. */
  url: string;
}

/**
 * Canonical request row — exactly one per HAR entry. Mirrors the
 * shape of Chrome's Network tab row-by-row; the augmentation is the
 * `fires` array, which lists every Open Headers rule that matched
 * this request (empty when no rule matched).
 */
export interface InspectorRequest {
  /** Stable id — synthetic from `method + url + startedDateTime`. */
  id: string;
  /** Full HAR entry captured by the host's network inspector. */
  harEntry: InspectorHarEntry;
  /**
   * Network-request identifier attached by the background after
   * correlating the HAR with the per-URL FIFO of in-flight observations.
   * Present whenever the request was observed by the host's network
   * monitor while tab-telemetry was tracking the tab; absent for HAR rows
   * that landed before tracking started or for unobserved fetches.
   */
  chromeRequestId?: string;
  /** Convenience projections off the HAR entry. Read from `harEntry` where possible. */
  method: string;
  url: string;
  /** Wall-clock ms parsed from `harEntry.startedDateTime`. */
  timestamp: number;
  statusCode?: number;
  statusText?: string;
  mimeType?: string;
  responseSize?: number;
  duration?: number;
  resourceType?: string;
  /** Response body, attached asynchronously when the `har-body` message arrives. */
  responseBody?: string;
  responseBodyEncoding?: string;
  /** Rule fires attached to this entry, ordered by arrival. */
  fires: InspectorFire[];
  /** Monotonic counter — used as a stable render order tiebreaker. */
  arrivalIndex: number;
  /** Sequential display id (1, 2, 3, ...) — reset on clear. Shown in UI. */
  displayId: number;
}
