// ── Resolved-snapshot reads ─────────────────────────────────────────

import type { Rule } from '@openheaders/core/types';
import type { ResolutionError } from '@openheaders/core/variables';
import { activeState } from './state';

/**
 * Current resolved-rule snapshot for the runtime-Active workspace.
 * Returns an empty array until the first DNR compile runs.
 */
export function getResolvedRules(): Rule[] {
  return activeState().lastResolvedRules;
}

/**
 * Per-rule resolution errors from the most recent compile pass.
 * `.get(ruleUid)` returns the error list for that rule, or `undefined`
 * if the rule resolved cleanly (or hasn't been compiled yet).
 *
 * Both the outer Map and each inner list are typed readonly so callers
 * can't mutate module state through the returned reference — the same
 * snapshot is read by Status reporting, Inspector surfaces, and tests.
 */
export function getLastResolutionErrors(): ReadonlyMap<string, readonly ResolutionError[]> {
  return activeState().lastResolutionErrors;
}

/**
 * Flat list of every resolution error aggregated across the rule set,
 * deduped by `reference`. Useful for subsystem-level reporting
 * (observability + Status) where per-rule attribution isn't required.
 * Reserved-namespace errors (`{{file.X}}` / `{{dynamic.X}}`) are
 * filtered out — those references are intentionally unresolved until
 * those features ship in v2, so they should not yellow-pill the
 * `rules` subsystem.
 */
export function getLastAggregatedResolutionErrors(): ResolutionError[] {
  const seen = new Set<string>();
  const out: ResolutionError[] = [];
  for (const errors of activeState().lastResolutionErrors.values()) {
    for (const err of errors) {
      if (err.reason === 'reserved-namespace') continue;
      if (seen.has(err.reference)) continue;
      seen.add(err.reference);
      out.push(err);
    }
  }
  return out;
}

/**
 * Set of rule uids whose most recent resolution pass produced at
 * least one BLOCKING error (anything except `reserved-namespace`).
 * These rules are not shipped to DNR — a rule with `{{wat2}}` that
 * doesn't exist in any scope would otherwise set a header to the
 * literal string `{{wat2}}` on the wire, which is almost never the
 * user's intent. Re-exposed for the rule-state observer + sidebar so
 * the UI can surface the "unresolved" state distinct from draft.
 *
 * Returns an empty set until the first `resolveRulesForCompile` run.
 */
export function getUnresolvableRuleUids(): ReadonlySet<string> {
  const out = new Set<string>();
  for (const [uid, errors] of activeState().lastResolutionErrors) {
    const hasBlocker = errors.some((e) => e.reason !== 'reserved-namespace');
    if (hasBlocker) out.add(uid);
  }
  return out;
}
