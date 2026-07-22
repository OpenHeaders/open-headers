/**
 * Telemetry consent gate — the single enforcement point the three
 * telemetry hosts (lifecycle, storage, console) read before serving a
 * desktop peer (OBSERVABILITY_PLAN.md §8 Phase 7): identity decides WHO
 * may attach (the NM plane), consent decides WHAT an attached peer may
 * subscribe to. The gate covers the watch planes only — rules/sync ride
 * the same wire untouched.
 *
 * `backend.allowDesktopWatch` is user-scope with a `chrome.storage.managed`
 * lock: the settings store serves a policy value over the user's, so a
 * fleet-locked gate governs these reads too.
 */

import type { TelemetryWatchPlane, TelemetryWatchRefusedMessage } from '@openheaders/core/protocol';
import { TELEMETRY_WATCH_REFUSED_TYPE } from '@openheaders/core/protocol';
import { get as getSetting, subscribeKey } from '@openheaders/ui/workbench/settings/store';

/** Whether the consent gate currently admits desktop watch traffic. */
export function desktopWatchAllowed(): boolean {
  return getSetting('backend.allowDesktopWatch');
}

/** Run `fn` on every consent flip. Returns the unsubscribe. */
export function subscribeDesktopWatchConsent(fn: (allowed: boolean) => void): () => void {
  return subscribeKey('backend.allowDesktopWatch', () => fn(desktopWatchAllowed()));
}

/** The coarse typed refusal one refused subscribe (or torn-down
 *  session) answers with. Returned as the wire-record shape the send
 *  seams take; `satisfies` pins it to the protocol message. */
export function watchRefusedFrame(
  plane: TelemetryWatchPlane,
  tabId: number,
  consumerId: string,
): Record<string, unknown> {
  return {
    type: TELEMETRY_WATCH_REFUSED_TYPE,
    plane,
    tabId,
    consumerId,
    reason: 'consent-off',
  } satisfies TelemetryWatchRefusedMessage;
}
