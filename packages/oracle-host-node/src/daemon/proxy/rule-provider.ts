/**
 * Daemon-side {@link ProxyRuleSource}: the active workspace's effective
 * rule set (published + enabled + complete + un-paused, the shared
 * `isRuleEffective` contract) resolved through the variables resolver,
 * with unresolvable-`{{ref}}` rules excluded — exactly the set the
 * extension's DNR compile loop puts on the wire, so a rule fires
 * identically on both planes.
 *
 * The computed set is memoized and invalidated by the entity-store
 * change signals (rules/collections, environments+vars+vault, pause
 * markers), so per-exchange reads are a cached-array return on the hot
 * path. The extension's global engine kill switch is a browser-plane
 * setting with no daemon counterpart yet — the proxy plane passes
 * `enginePaused: false`.
 */

import type { Rule } from '@openheaders/core/types';
import { isRuleEffective } from '@openheaders/core/utils';
import { onEnvironmentStoreChange } from '@openheaders/oracle/entity/environment-store';
import { getPauseMarkers, onPauseMarkersChange } from '@openheaders/oracle/entity/pause-markers-store';
import { getRules, onStoreChange } from '@openheaders/oracle/entity/rule-store';
import { resolveRuleSubsetWithDiagnostics } from '@openheaders/oracle/rule-engine/variables-resolver';
import type { ProxyRuleSource } from './rule-enforcement';

export interface DisposableProxyRuleSource extends ProxyRuleSource {
  dispose(): void;
}

export function createProxyRuleSource(): DisposableProxyRuleSource {
  let cache: readonly Rule[] | null = null;
  const invalidate = (): void => {
    cache = null;
  };
  const unsubscribes = [
    onStoreChange(invalidate),
    onEnvironmentStoreChange(invalidate),
    onPauseMarkersChange(invalidate),
  ];

  return {
    getRules(): readonly Rule[] {
      if (cache === null) {
        const effective = getRules().filter((rule) => isRuleEffective(rule, getPauseMarkers(), false));
        const { resolved, unresolvableUids } = resolveRuleSubsetWithDiagnostics(effective);
        cache = resolved.filter((rule) => !unresolvableUids.has(rule.uid));
      }
      return cache;
    },
    dispose(): void {
      for (const unsubscribe of unsubscribes) unsubscribe();
    },
  };
}
