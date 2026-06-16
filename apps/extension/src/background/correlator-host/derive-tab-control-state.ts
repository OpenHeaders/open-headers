/**
 * Compose an in-scope tab's standing {@link CdpTabControlState} from its live
 * rules — the pure assembly `deriveState` (lifecycle-pipeline) runs once a tab
 * is confirmed in scope. The host meeting point: it folds the network plane
 * ({@link compileFetchPatterns} → `Fetch.enable`) and the delivery plane
 * ({@link compileBootstrapScripts} → `Page.addScriptToEvaluateOnNewDocument`)
 * into one replayed value.
 *
 * The two planes are INDEPENDENT: a tab whose only debug rule is a `ws` wrapper
 * has no Fetch patterns but DOES carry a bootstrap script, and the reverse for
 * a tab whose only rule is an unrestricted `response`. So the empty-state
 * short-circuit gates on BOTH being empty — never on `fetchPatterns` alone,
 * which would discard a wrapper-only tab's bootstrap.
 */

import type { Rule } from '@openheaders/core/types';
import { type CdpTabControlState, EMPTY_TAB_CONTROL_STATE } from '@openheaders/oracle/correlator-cdp';
import { compileBootstrapScripts } from './cdp-bootstrap-scripts';
import { compileFetchPatterns } from './cdp-fetch-patterns';

/**
 * The standing CDP control state for an in-scope tab with these live rules.
 * Returns {@link EMPTY_TAB_CONTROL_STATE} only when the tab contributes neither
 * a Fetch pattern nor a bootstrap script.
 */
export function deriveTabControlState(rules: readonly Rule[]): CdpTabControlState {
  const fetchPatterns = compileFetchPatterns(rules);
  const bootstrapScripts = compileBootstrapScripts(rules);
  if (fetchPatterns.length === 0 && bootstrapScripts.length === 0) return EMPTY_TAB_CONTROL_STATE;
  // Opt into auth-challenge interception only when an auth rule is actually in
  // scope — a tab whose debug rules are all response/body/wrapper never widens
  // its pause surface to 401/407 challenges.
  const fetchHandleAuthRequests = rules.some((rule) => rule.type === 'auth');
  return { ...EMPTY_TAB_CONTROL_STATE, fetchPatterns, fetchHandleAuthRequests, bootstrapScripts };
}
