/**
 * Compose an in-scope tab's standing {@link CdpTabControlState} from its live
 * rules — the pure assembly `deriveState` (lifecycle-pipeline) runs once a tab
 * is confirmed in scope. The host meeting point: it folds the network plane
 * ({@link compileFetchPatterns} → `Fetch.enable`), the delivery plane
 * ({@link compileBootstrapScripts} → `Page.addScriptToEvaluateOnNewDocument`),
 * and the CSP-bypass plane (`bypassCsp` → `Page.setBypassCSP`) into one
 * replayed value.
 *
 * The three planes are INDEPENDENT: a tab whose only debug rule is a `ws`
 * wrapper has no Fetch patterns but DOES carry a bootstrap script; a tab whose
 * only rule is an unrestricted `response` carries the reverse; and an
 * inject-`bypassCSP` rule is page-DOM, so it contributes to NEITHER yet still
 * needs `bypassCsp`. So the empty-state short-circuit gates on ALL THREE being
 * empty — never on a subset, which would discard a tab whose sole contribution
 * is on a plane the guard forgot.
 */

import type { Rule } from '@openheaders/core/types';
import { type CdpTabControlState, EMPTY_TAB_CONTROL_STATE } from '@openheaders/oracle/correlator-cdp';
import { compileBootstrapScripts } from './cdp-bootstrap-scripts';
import { compileFetchPatterns } from './cdp-fetch-patterns';

/**
 * The standing CDP control state for an in-scope tab with these live rules.
 * Returns {@link EMPTY_TAB_CONTROL_STATE} only when the tab contributes nothing
 * on any plane — no Fetch pattern, no bootstrap script, and no CSP bypass.
 */
export function deriveTabControlState(rules: readonly Rule[]): CdpTabControlState {
  const fetchPatterns = compileFetchPatterns(rules);
  const bootstrapScripts = compileBootstrapScripts(rules);
  // CSP bypass is a THIRD independent plane: an inject-`bypassCSP` rule is
  // page-DOM (never Fetch-realizable, never bootstrap-eligible), so a tab whose
  // only debug rule is one would have both other planes empty yet still need
  // `Page.setBypassCSP`. Derived from the same flag the DNR CSP-strip gates on,
  // so CSP drops at the engine level only when a rule explicitly asks.
  const bypassCsp = rules.some((rule) => rule.type === 'inject' && rule.action.bypassCSP === true);
  if (fetchPatterns.length === 0 && bootstrapScripts.length === 0 && !bypassCsp) return EMPTY_TAB_CONTROL_STATE;
  // Opt into auth-challenge interception only when an auth rule is actually in
  // scope — a tab whose debug rules are all response/body/wrapper never widens
  // its pause surface to 401/407 challenges.
  const fetchHandleAuthRequests = rules.some((rule) => rule.type === 'auth');
  return { ...EMPTY_TAB_CONTROL_STATE, fetchPatterns, fetchHandleAuthRequests, bootstrapScripts, bypassCsp };
}
