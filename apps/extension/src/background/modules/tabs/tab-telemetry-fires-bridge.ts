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
 * store stay chrome-free, and so does the secret scrub of the snapshot's
 * resolved header values — the fire is the one other path a compiled
 * secret-manager value could leave the worker by, beside the lifecycle
 * store's own intake scrub. The hub deduplicates by `(ruleUid, requestId)`
 * (or `(ruleUid, t)` for scriptable), merges evidence, and broadcasts the
 * merged record on the `oh-fires:<tabId>` port.
 *
 * Authoritative fires carry the WEBREQUEST request id. On a heuristic
 * tab that id is the row key, so the exact-key ingest converges the
 * authoritative and driver arrivals into one record. On a CDP-owned tab
 * the rows (and driver fires) are keyed by the CDP store id — the exact
 * key can never bind, so the arrival routes through the hub's
 * confidence-gated translation instead, matching by `(ruleUid,
 * normalized url, ±window)`. Ownership knowledge stays here (chrome
 * side); the oracle never learns about tabs' correlator sources.
 */

import { scrubRuleSnapshot } from '@openheaders/core/request-lifecycle';
import type { RequestRecord } from '@openheaders/core/types';
import { buildRuleSnapshot } from '@openheaders/oracle/rule-engine/rule-snapshot';
import type { RuleFireHub } from '@openheaders/oracle/rule-fire-hub';

import { subscribeFiresAll } from '../tab-telemetry';
import { normalizeUrlForTracking } from '../url-utils';

export interface RuleFiresBridge {
  /** Authoritative-side ingress — called by the DNR-debug listener with
   *  the engine-built `RequestRecord`. */
  notifyAuthoritativeFire(tabId: number, record: RequestRecord): void;
  dispose(): void;
}

export interface RuleFiresBridgeOptions {
  readonly hub: RuleFireHub;
  /** Whether the tab's lifecycle rows come from the CDP correlator —
   *  i.e. its request-id space is foreign to webRequest ids. */
  readonly isCdpOwned: (tabId: number) => boolean;
  /** The secret-manager values to scrub from a snapshot's resolved
   *  header values before the fire leaves the worker. Empty by default. */
  readonly secretValues?: () => ReadonlySet<string>;
}

const NO_SECRETS: ReadonlySet<string> = new Set();

export function startTabTelemetryFiresBridge(options: RuleFiresBridgeOptions): RuleFiresBridge {
  const { hub, isCdpOwned } = options;
  const secretValues = options.secretValues ?? (() => NO_SECRETS);
  const enrich = (record: RequestRecord): RequestRecord => {
    const snapshot = record.ruleSnapshot ?? buildRuleSnapshot(record.ruleUid);
    if (!snapshot) return record;
    const scrubbed = scrubRuleSnapshot(snapshot, secretValues());
    return scrubbed === record.ruleSnapshot ? record : { ...record, ruleSnapshot: scrubbed };
  };
  const unsubscribe = subscribeFiresAll((tabId, record) => {
    hub.notifyHeuristicFire(tabId, enrich(record));
  });
  return {
    notifyAuthoritativeFire(tabId: number, record: RequestRecord): void {
      const enriched = enrich(record);
      if (isCdpOwned(tabId)) {
        hub.notifyAuthoritativeFireTranslated(tabId, enriched, normalizeUrlForTracking(record.url));
      } else {
        hub.notifyAuthoritativeFire(tabId, enriched);
      }
    },
    dispose: unsubscribe,
  };
}
