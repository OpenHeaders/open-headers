/**
 * Shared types for the DevTools Inspector panel.
 *
 * Row data lives on `InspectorRow` / `InspectorRowWithFires`
 * (see `inspector-facet.ts` and `inspector-row-projection.ts`); the
 * lifecycle itself comes from `@openheaders/core/request-lifecycle`.
 * This file is now scoped to the fire-attribution layer.
 *
 * Fires augment rows when their URL matches a rule. Unmatched fires
 * (request blocked before HAR landed, served from cache without DNR
 * feedback, scriptable-only fires) surface as "dangling" — same
 * `InspectorFire` shape, no row.
 */

import type { RequestRecord, RuleSnapshot } from '@openheaders/core/types';

/**
 * Per-rule fire attached to an inspector row. `authoritative`
 * distinguishes engine-confirmed DNR fires (Chrome/Edge only — the
 * platform told us this rule actually executed) from tab-telemetry's
 * inferred URL-matching path.
 *
 * `requestId` is the host's network-request identifier — present for
 * every network-observed fire and used as the deterministic join key to
 * the lifecycle. Absent only for scriptable fires reported from the
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
 *   - `authoritative`: the engine reported this DNR rule executed on the wire.
 *   - `evidence === 'confirmed'`: the in-page fire-bridge reported the
 *     scriptable action ran inside the page.
 *
 * Both signals are equivalently strong from the user's POV.
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
