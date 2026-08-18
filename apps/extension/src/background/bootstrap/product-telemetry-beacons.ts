/**
 * Product-telemetry beacons — wires host-neutral observability seams to
 * the vocabulary's typed events (the telemetry plan §3). The oracle
 * modules stay telemetry-free; this is the extension's one place that
 * maps their signals onto product-telemetry events. The controller's
 * session latch keeps each member to once per session (re-armed daily).
 *
 * Sync plane: the `workspace-sync` feature signal on a wire connect,
 * plus the typed error codes.
 *
 *   - push: a pending-out enqueue that threw, or a flush that died
 *     mid-drain (`sync-push-failed`) — routine queueing while
 *     disconnected never fires.
 *   - pull: a scope catch-up ending `failed` / `timed-out`
 *     (`sync-pull-failed`).
 *
 * `ws-connect-failed` is wired where the connection manager is
 * installed (`websocket.ts`).
 *
 * Rule-match plane (S16): `rule_matched` per rule type off the
 * tab-telemetry fire pipeline — see
 * {@link installProductTelemetryRuleMatchBeacon}.
 */

import type { TelemetryRuleTypeId } from '@openheaders/core/telemetry';
import { getRules } from '@openheaders/oracle/entity/rule-store';
import { subscribeOnWebSocketOpen } from '@openheaders/oracle/sync/client/backend-connection-manager';
import { setOutboundSyncFailureObserver } from '@openheaders/oracle/sync/client/mutation-forwarder';
import { setStorageQuotaObserver } from '@/host/extension-storage';
import type { CdpAttachFault, CdpAttachObservable } from '../correlator-host/cdp-attach-controller';
import { trackProductTelemetryEvent } from '../modules/product-telemetry';
import { subscribeFiresAll } from '../modules/tab-telemetry';
import type { SyncWiring } from './ws-frame-routing';

export function installProductTelemetrySyncBeacons(syncWiring: SyncWiring): void {
  // A backend wire actually connecting is workspace sync in use — the
  // feature_used signal for the sync plane (once per session via latch).
  subscribeOnWebSocketOpen(() => {
    trackProductTelemetryEvent({ name: 'feature_used', feature: 'workspace-sync' });
  });

  setOutboundSyncFailureObserver(() => {
    trackProductTelemetryEvent({ name: 'error_beacon', code: 'sync-push-failed' });
  });

  const unsubscribers = new Map<string, () => void>();
  syncWiring.subscribeHandshakeLifecycle((event) => {
    if (event.kind === 'created') {
      unsubscribers.set(
        event.backendId,
        event.handles.initiator.subscribe((state) => {
          if (state === 'failed' || state === 'timed-out') {
            trackProductTelemetryEvent({ name: 'error_beacon', code: 'sync-pull-failed' });
          }
        }),
      );
      return;
    }
    unsubscribers.get(event.backendId)?.();
    unsubscribers.delete(event.backendId);
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CACHED_RULE_TYPES = 1024;

/**
 * `rule_matched` — the activation funnel's fired side (plan §3, S16):
 * a rule of this type demonstrably acted this session, once per type
 * per UTC day. Fed by the tab-telemetry fire pipeline, which runs on
 * every install with no consumer required (the background holds an
 * `active-tab` tracking reason per window) and sits downstream of the
 * effective-uid intersection and shadow arbitration — a rule that was
 * unpublished, paused, or dropped over the rule cap never claims a
 * fire, so created-but-silently-dead rules correctly stay silent here
 * too. The controller's daily-re-armed latch is authoritative; the
 * in-memory day set just keeps this hot path (every matching request
 * on the active tab) from re-entering the controller per fire.
 */
export function installProductTelemetryRuleMatchBeacon(): void {
  const typeByUid = new Map<string, TelemetryRuleTypeId>();
  const reported = new Set<TelemetryRuleTypeId>();
  let reportedDay = -1;

  subscribeFiresAll((_tabId, record) => {
    const day = Math.floor(Date.now() / DAY_MS);
    if (day !== reportedDay) {
      reportedDay = day;
      reported.clear();
    }
    let type = typeByUid.get(record.ruleUid);
    if (type === undefined) {
      const rule = getRules().find((r) => r.uid === record.ruleUid);
      if (!rule) return;
      if (typeByUid.size >= MAX_CACHED_RULE_TYPES) typeByUid.clear();
      typeByUid.set(record.ruleUid, rule.type);
      type = rule.type;
    }
    if (reported.has(type)) return;
    reported.add(type);
    trackProductTelemetryEvent({ name: 'rule_matched', ruleType: type });
  });
}

/**
 * `storage-quota` (S17): the host storage adapter classifies a
 * quota-exceeded write and signals through its injected observer; this
 * is the one place that maps it onto the typed beacon. Today a quota'd
 * write is silent data loss — the beacon makes its frequency visible.
 */
export function installProductTelemetryStorageBeacon(): void {
  setStorageQuotaObserver(() => {
    trackProductTelemetryEvent({ name: 'error_beacon', code: 'storage-quota' });
  });
}

/**
 * `cdp-attach-failed` (S17): a real `chrome.debugger.attach` rejection
 * (not a tolerated already-attached race) — the same fault the status
 * pill turns red on. Edge-detected by fault identity so re-emissions of
 * unchanged state stay silent; the session latch dedupes per day anyway.
 */
export function installProductTelemetryCdpBeacon(cdpAttach: CdpAttachObservable): void {
  let lastFault: CdpAttachFault | null = cdpAttach.getState().lastFault;
  cdpAttach.onChange((state) => {
    const fault = state.lastFault;
    if (fault !== lastFault && fault?.kind === 'attach-failed') {
      trackProductTelemetryEvent({ name: 'error_beacon', code: 'cdp-attach-failed' });
    }
    lastFault = fault;
  });
}
