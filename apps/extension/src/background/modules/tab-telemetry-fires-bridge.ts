/**
 * Wires tab-telemetry's cross-tab fire stream into the `RuleFireHub`.
 *
 * Two engine-side fire sources converge here:
 *
 *   - `subscribeFiresAll` — heuristic, inferred from webRequest URL match.
 *     Mapped to `hub.notifyHeuristicFire`.
 *   - `notifyAuthoritativeFire(tabId, record)` (called by the DNR-debug
 *     listener wired through `setupOnRuleMatchedDebugBridge`) — authoritative,
 *     from `chrome.declarativeNetRequest.onRuleMatchedDebug`. Mapped to
 *     `hub.notifyAuthoritativeFire`.
 *
 * Rule-snapshot enrichment lives here (chrome-side) so the oracle hub +
 * store stay chrome-free. The hub deduplicates by `(ruleUid, requestId)`
 * (or `(ruleUid, t)` for scriptable), merges evidence, and broadcasts the
 * merged record on the `oh-fires:<tabId>` port.
 */

import type { RequestRecord } from '@openheaders/core/types';
import type { RuleFireHub } from '@openheaders/oracle/rule-fire-hub';
import { buildRuleSnapshot } from '@openheaders/oracle/rule-engine/rule-snapshot';

import { subscribeFiresAll } from './tab-telemetry';

export interface RuleFiresBridge {
  /** Authoritative-side ingress — called by the DNR-debug listener with
   *  the engine-built `RequestRecord`. */
  notifyAuthoritativeFire(tabId: number, record: RequestRecord): void;
  dispose(): void;
}

export interface RuleFiresBridgeOptions {
  readonly hub: RuleFireHub;
}

export function startTabTelemetryFiresBridge(options: RuleFiresBridgeOptions): RuleFiresBridge {
  const { hub } = options;
  const unsubscribe = subscribeFiresAll((tabId, record) => {
    hub.notifyHeuristicFire(tabId, enrich(record));
  });
  return {
    notifyAuthoritativeFire(tabId: number, record: RequestRecord): void {
      hub.notifyAuthoritativeFire(tabId, enrich(record));
    },
    dispose: unsubscribe,
  };
}

function enrich(record: RequestRecord): RequestRecord {
  if (record.ruleSnapshot) return record;
  const snapshot = buildRuleSnapshot(record.ruleUid);
  return snapshot ? { ...record, ruleSnapshot: snapshot } : record;
}
