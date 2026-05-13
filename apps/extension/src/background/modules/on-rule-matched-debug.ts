/**
 * onRuleMatchedDebug Bridge — feeds Chrome's authoritative "this DNR
 * rule actually executed" events into the DevTools Inspector panel.
 *
 * ## Why
 *
 * Tab-telemetry's existing fire pipeline records "probable fires" by
 * re-running the rule matcher against every observed URL — an
 * approximation of what DNR did. For most uses (counters, badges,
 * popup display) that's fine. The Inspector panel, however, wants to
 * show the user exactly which rule Chrome's C++ network stack
 * actually selected for a given request, so priority ties and
 * specificity edge cases are reported faithfully.
 *
 * `chrome.declarativeNetRequest.onRuleMatchedDebug` is the only source
 * of truth for that. It's gated behind the `declarativeNetRequestFeedback`
 * permission (already in the manifest) and is Chrome/Edge-only — Firefox
 * and Safari don't expose it. This module feature-detects and no-ops
 * on unsupported platforms, so the cross-browser build stays identical.
 *
 * ## Mapping
 *
 * `onRuleMatchedDebug` fires `MatchedRuleInfoDebug` with:
 *
 *   - `rule.ruleId`         — DNR rule id (numeric, chrome-assigned)
 *   - `rule.rulesetId`      — DNR ruleset id
 *   - `request.url`         — final URL of the matched request
 *   - `request.tabId`       — tab the request belongs to
 *   - `request.method`      — HTTP method
 *   - `request.type`        — resource type
 *   - `request.requestId`   — webRequest request id (join key)
 *
 * The extension's own rules are DNR-compiled with deterministic numeric
 * ids derived from the rule uid — `dnr-manager` maintains the
 * bidirectional mapping. This module translates `rule.ruleId` back to a
 * uid via that mapping and builds a `RequestRecord` that matches
 * the shape tab-telemetry produces for inferred fires. The record is
 * then broadcast with `authoritative: true` over the inspector port.
 *
 * ## Silent gates
 *
 *   - Unknown ruleId (no entry in the dnr-manager map): silently
 *     ignored. Happens for DNR rules the extension didn't author
 *     (Chrome's own internal rules, other extensions — should not
 *     occur but defense-in-depth).
 *   - No open inspector port for the tab: silently ignored. The
 *     global listener is always on because the chrome API doesn't
 *     let us scope a listener to a specific tab, and we pay a tiny
 *     per-fire cost in exchange for not having to install/uninstall
 *     the listener every time a port opens or closes.
 */

import { logger } from '@utils/logger';
import type { TrackedResourceType } from '@/types/browser';
import { getDnrIdToRuleUid } from '../dnr-manager';
import { broadcastAuthoritativeFire } from './devtools-inspector-port';
import type { RequestRecord } from './tab-telemetry';

/**
 * Translate Chrome's `resourceType` string to the tracked-resource-type
 * union used by tab-telemetry records. Chrome and tab-telemetry agree
 * on the vocabulary for the common cases; anything unexpected lands on
 * `'other'`.
 */
function normalizeResourceType(raw: string): TrackedResourceType {
  const allowed: TrackedResourceType[] = [
    'main_frame',
    'sub_frame',
    'xmlhttprequest',
    'script',
    'stylesheet',
    'image',
    'font',
    'media',
    'websocket',
    'ping',
    'other',
  ];
  return allowed.includes(raw as TrackedResourceType) ? (raw as TrackedResourceType) : 'other';
}

let bridgeSetupDone = false;

export function setupOnRuleMatchedDebugBridge(): void {
  if (bridgeSetupDone) return;
  bridgeSetupDone = true;

  // chrome.declarativeNetRequest.onRuleMatchedDebug is the authoritative
  // "this rule executed" signal on Chrome/Edge. Feature-detect through a
  // loosely-typed view of the namespace so Firefox/Safari builds don't
  // need ambient type support for the API.
  interface OnRuleMatchedDebugInfo {
    request: {
      tabId?: number;
      url: string;
      method?: string;
      type?: string;
      requestId?: string;
    };
    rule: {
      ruleId: number;
      rulesetId?: string;
    };
  }
  interface OnRuleMatchedDebugEvent {
    addListener(cb: (info: OnRuleMatchedDebugInfo) => void): void;
  }
  const dnr = (chrome as unknown as { declarativeNetRequest?: { onRuleMatchedDebug?: OnRuleMatchedDebugEvent } })
    .declarativeNetRequest;
  const onMatched = dnr?.onRuleMatchedDebug;
  if (!onMatched?.addListener) {
    logger.info(
      'OnRuleMatchedDebug',
      'onRuleMatchedDebug unavailable — panel rule-executions view will use inferred fires only',
    );
    return;
  }

  onMatched.addListener((info: OnRuleMatchedDebugInfo) => {
    try {
      const tabId = info.request.tabId;
      if (typeof tabId !== 'number' || tabId < 0) return;
      const ruleUid = getDnrIdToRuleUid().get(info.rule.ruleId);
      if (!ruleUid) return;
      // `requestId` is the deterministic join key shared with webRequest's
      // inferred-fire path. Threading it onto the record lets the panel
      // store dedupe authoritative + inferred fires for the same request
      // (and upgrade the row's badge to authoritative regardless of
      // arrival order). Always present in `MatchedRuleInfoDebug`, but
      // we read it defensively in case a future Chrome trims the field.
      const record: RequestRecord = {
        ruleUid,
        url: info.request.url,
        pattern: '',
        resourceType: normalizeResourceType(info.request.type ?? 'other'),
        t: Date.now(),
        evidence: 'matched',
        ...(info.request.requestId ? { requestId: info.request.requestId } : {}),
      };
      broadcastAuthoritativeFire(tabId, record);
    } catch (err) {
      logger.info('OnRuleMatchedDebug', `Failed to forward fire: ${(err as Error).message}`);
    }
  });
}
