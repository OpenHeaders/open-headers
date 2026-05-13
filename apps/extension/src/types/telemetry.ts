/**
 * Telemetry schema shared across execution contexts.
 *
 * The background's `tab-telemetry` module is the producer; the popup and
 * DevTools panel are consumers. They can't import from the background
 * directly (different processes, bridge RPC boundary), so the shape
 * lives here as the single source of truth for the wire format.
 */

import type { HeaderOperation, Rule } from '@openheaders/core/types';
import type { ShadowAttribution } from '@/background/modules/shadow-arbitration';
import type { TrackedResourceType } from './browser';

/**
 * Frozen snapshot of the rule that produced a fire, captured at fire-emit
 * time. Carries everything the panel needs to render attribution without
 * consulting the live rule registry — so editing the rule afterwards
 * does NOT retroactively rewrite what the user sees for a past request
 * (event-sourcing pattern: events are immutable, config is mutable).
 *
 * Header-rule modifications snapshot both the raw template and the
 * resolved value that hit the wire — the resolved value is what we
 * render on the row; the template is shown alongside in the popover so
 * the user can tell whether a divergence is "I edited the rule" vs
 * "the env var changed."
 */
export interface RuleSnapshot {
  ruleUid: string;
  name: string;
  type: Rule['type'];
  enabled: boolean;
  /** Header-rule modifications, present only when `type === 'header'`. */
  headerMods?: ReadonlyArray<RuleSnapshotHeaderMod>;
}

export interface RuleSnapshotHeaderMod {
  direction: 'request' | 'response';
  operation: HeaderOperation;
  /** Resolved header name — what hit the wire. Drives attribution
   *  matching against HAR rows and is the display name in the
   *  inspector. When the user wrote `{{vars}}` in the name field,
   *  `headerNameTemplate` carries the raw template alongside. */
  headerName: string;
  /** Raw header-name template before variable resolution — set only
   *  when it differs from `headerName` (i.e. the field used `{{}}`). */
  headerNameTemplate?: string;
  /** Raw value template — e.g. `"maybe {{env.wat}}"`. Absent for `remove`. */
  valueTemplate?: string;
  /** Post-resolution value as compiled into the DNR rule. Absent for
   *  `remove` and for any mod whose resolution failed at fire time. */
  valueResolved?: string;
  /** Resolved merge separator (only for `merge`). */
  mergeSeparator?: string;
  /** Raw merge-separator template before resolution — set only when
   *  the user wrote `{{vars}}` in the separator field. Symmetric with
   *  `headerNameTemplate` / `valueTemplate`. */
  mergeSeparatorTemplate?: string;
}

/**
 * Tier of evidence that a rule applied to a request.
 *
 *   - `confirmed`        — in-page fire-bridge reported that the action
 *                          ran. Ground truth for scriptable rule types.
 *   - `matched`          — webRequest observed a URL that satisfied the
 *                          rule's conditions. Best evidence for pure-DNR
 *                          rules (Chrome does not tell extensions which
 *                          rule wins in arbitration).
 *   - `matched-fallback` — observed fire for a deferred rule type
 *                          (could have emitted scriptable) that didn't
 *                          confirm within the fallback window.
 *   - `silent`           — pattern matched an observed URL but the
 *                          response was served from cache / a service
 *                          worker / bfcache. No network request reached
 *                          webRequest, so DNR / scriptable actions did
 *                          not run. Sourced from the perf-observer
 *                          content script; attached to records that
 *                          live in `ActiveRule.silentRecords`, NOT in
 *                          the telemetry `byRule` / `counters` (those
 *                          remain reserved for actions that ran).
 */
export type Evidence = 'confirmed' | 'matched' | 'matched-fallback' | 'silent';

/**
 * How Chrome served the response.
 *
 *   - `network`         — fresh network round-trip, no cache involvement.
 *   - `cached`          — served from the HTTP cache (disk or in-memory
 *                         tier at the network-service layer).
 *   - `service-worker`  — intercepted by a service worker.
 *
 * Undefined while the request is in-flight or when no webRequest
 * correlation is available (scriptable fires reported from the in-page
 * fire-bridge).
 */
export type DeliveryMode = 'network' | 'cached' | 'service-worker';

/** One observation of a rule firing on a specific URL. */
export interface RequestRecord {
  ruleUid: string;
  url: string;
  pattern: string;
  resourceType: TrackedResourceType;
  /** Wall-clock timestamp in ms. */
  t: number;
  evidence: Evidence;
  /**
   * Chrome webRequest identifier. Present for webRequest-observed fires
   * so delivery mode can be back-filled on `onCompleted`. Absent for
   * scriptable fires reported from the in-page fire-bridge.
   */
  requestId?: string;
  /** Populated post-fact from `onCompleted.fromCache`. */
  deliveryMode?: DeliveryMode;
  /** Shadow arbitration verdict — see shadow-arbitration.ts. */
  shadowedBy?: ShadowAttribution;
  /** Rule snapshot frozen at fire time — see `RuleSnapshot` doc. May be
   *  absent only for fires emitted before the snapshotter was wired
   *  (legacy ring-buffer entries) or for rules that vanished from the
   *  registry between fire and snapshot. */
  ruleSnapshot?: RuleSnapshot;
}

/** Per-tab telemetry snapshot returned to consumers. */
export interface TabTelemetrySnapshot {
  /** Per-rule event counters. Keys are rule UIDs that matched at least
   *  one request on this page since the last commit. */
  counters: Record<string, number>;
  /** Chronological fire log (newest last). Bounded. */
  fires: RequestRecord[];
  /** Per-rule unique-URL records, LRU order. */
  byRule: Record<string, RequestRecord[]>;
  /** Unique normalized URLs across all rules. */
  uniqueRequestCount: number;
}
