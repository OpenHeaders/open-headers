/**
 * Compose an in-scope tab's standing {@link CdpTabControlState} from its live
 * rules plus the per-tab cache toggle, throttle profile, and environment
 * overrides — the pure assembly `deriveState` (lifecycle-pipeline) runs once a
 * tab is confirmed in scope. The host meeting point: it folds the network plane
 * ({@link compileFetchPatterns} → `Fetch.enable`), the delivery plane
 * ({@link compileBootstrapScripts} → `Page.addScriptToEvaluateOnNewDocument`),
 * the CSP-bypass plane (`bypassCsp` → `Page.setBypassCSP`), the cache plane
 * (`cacheDisabled` → `Network.setCacheDisabled`), the conditions plane
 * (`networkConditions` → `Network.emulateNetworkConditions`), and the overrides
 * plane (`overrides` → `Network.setUserAgentOverride`, plus the F3b `Emulation.*`)
 * into one replayed value.
 *
 * The six planes are INDEPENDENT: a tab whose only debug rule is a `ws`
 * wrapper has no Fetch patterns but DOES carry a bootstrap script; a tab whose
 * only rule is an unrestricted `response` carries the reverse; an
 * inject-`bypassCSP` rule is page-DOM, so it contributes to NEITHER yet still
 * needs `bypassCsp`; a tab whose sole CDP state is the cache toggle has all
 * three rule-derived planes empty yet still needs `cacheDisabled`; a tab whose
 * sole state is a throttle profile has all FOUR of those empty yet still needs
 * `networkConditions`; and a tab whose sole state is a UA override has all FIVE
 * empty yet still needs `overrides`. Unlike the rule-derived planes, cache,
 * conditions, and overrides are per-tab panel controls threaded in as options.
 * So the empty-state short-circuit gates on ALL SIX being empty — never on a
 * subset, which would discard a tab whose sole contribution is on a plane the
 * guard forgot.
 */

import type { Rule } from '@openheaders/core/types';
import {
  type CdpEnvironmentOverrides,
  type CdpNetworkConditions,
  type CdpTabControlState,
  EMPTY_TAB_CONTROL_STATE,
} from '@openheaders/oracle/correlator-cdp';
import { compileBootstrapScripts } from './cdp-bootstrap-scripts';
import { compileFetchPatterns } from './cdp-fetch-patterns';

/**
 * The standing CDP control state for an in-scope tab with these live rules,
 * cache toggle, throttle profile, and environment overrides. Returns
 * {@link EMPTY_TAB_CONTROL_STATE} only when the tab contributes nothing on any
 * plane — no Fetch pattern, no bootstrap script, no CSP bypass, no cache
 * disable, no throttle, and no overrides.
 */
export function deriveTabControlState(
  rules: readonly Rule[],
  options: {
    readonly cacheDisabled?: boolean;
    readonly networkConditions?: CdpNetworkConditions | null;
    readonly overrides?: CdpEnvironmentOverrides | null;
  } = {},
): CdpTabControlState {
  const fetchPatterns = compileFetchPatterns(rules);
  const bootstrapScripts = compileBootstrapScripts(rules);
  // CSP bypass is a THIRD independent plane: an inject-`bypassCSP` rule is
  // page-DOM (never Fetch-realizable, never bootstrap-eligible), so a tab whose
  // only debug rule is one would have both other planes empty yet still need
  // `Page.setBypassCSP`. Derived from the same flag the DNR CSP-strip gates on,
  // so CSP drops at the engine level only when a rule explicitly asks.
  const bypassCsp = rules.some((rule) => rule.type === 'inject' && rule.action.bypassCSP === true);
  // Cache disable is a FOURTH independent plane — not rule-derived: the per-tab
  // "disable cache" toggle, threaded in so it joins the all-empty guard (a
  // cache-only tab has the three rule planes empty).
  const cacheDisabled = options.cacheDisabled === true;
  // Network conditions is a FIFTH independent plane — also not rule-derived: the
  // per-tab throttle profile. It has NO banner-free fallback (unlike cache's DNR
  // path), so a throttle-only tab must not collapse to EMPTY or its profile is
  // silently lost. `null` = no throttle.
  const networkConditions = options.networkConditions ?? null;
  // Environment overrides is a SIXTH independent plane — also not rule-derived:
  // the per-tab UA / (F3b) Emulation overrides. Like throttle it has NO
  // banner-free fallback (CDP-only), so an overrides-only tab must not collapse
  // to EMPTY or its overrides are silently lost. `null` = no overrides.
  const overrides = options.overrides ?? null;
  if (
    fetchPatterns.length === 0 &&
    bootstrapScripts.length === 0 &&
    !bypassCsp &&
    !cacheDisabled &&
    networkConditions === null &&
    overrides === null
  ) {
    return EMPTY_TAB_CONTROL_STATE;
  }
  // Opt into auth-challenge interception only when an auth rule is actually in
  // scope — a tab whose debug rules are all response/body/wrapper never widens
  // its pause surface to 401/407 challenges.
  const fetchHandleAuthRequests = rules.some((rule) => rule.type === 'auth');
  return {
    ...EMPTY_TAB_CONTROL_STATE,
    fetchPatterns,
    fetchHandleAuthRequests,
    bootstrapScripts,
    bypassCsp,
    cacheDisabled,
    networkConditions,
    overrides,
  };
}
