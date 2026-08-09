/**
 * Capture-feedback host — the extension side of the in-browser capture
 * badge (AGENT_TRAFFIC_PLAN.md §4).
 *
 * The desktop owns the capture truth (the tap's armed-source registry);
 * this host only FEEDS it into the captured-tab ledger. Each state
 * frame carries the COMPLETE set of this browser's capture-armed
 * tabIds — the ledger replaces, never folds deltas, so a missed frame
 * can never strand a badge. A closing wire drops that backend's set:
 * with the desktop gone, agents can no longer read anything, and the
 * badge would be a lie.
 *
 * Boot race: a cold service worker HELLOs before this host registers
 * its frame handlers, so a connect-time push can land unhandled. The
 * host closes it by PULLING — `oh.traffic.capture.hello` on every wire
 * already up at start — while the daemon's peer-connect push covers
 * every later reconnect (the proxy-routing host's exact posture).
 *
 * Privacy gate: capture frames are honored from SAME-DEVICE (loopback)
 * wires only — agents read the LOCAL tap; a remote daemon's word about
 * this browser's tabs can never be right. Claimed and dropped, the
 * telemetry plane's posture.
 */

import { TRAFFIC_CAPTURE_HELLO_TYPE, TRAFFIC_CAPTURE_STATE_TYPE } from '@openheaders/core/protocol';
import {
  listConnectedWires,
  registerInboundFrameHandler,
  subscribeOnWebSocketClose,
} from '@openheaders/oracle/sync/client/backend-connection-manager';
import { capturedTabsDropBackend, capturedTabsReplace } from './captured-tabs';

export interface CaptureFeedbackHostOptions {
  /** Test seams — default to the real connection manager. */
  readonly registerInbound?: typeof registerInboundFrameHandler;
  readonly listWires?: typeof listConnectedWires;
  readonly subscribeClose?: typeof subscribeOnWebSocketClose;
}

export interface CaptureFeedbackHost {
  dispose(): void;
}

function parseTabIds(frame: unknown): number[] | null {
  const tabIds = (frame as { tabIds?: unknown }).tabIds;
  if (!Array.isArray(tabIds)) return null;
  return tabIds.filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && id >= 0);
}

export function startCaptureFeedbackHost(options: CaptureFeedbackHostOptions = {}): CaptureFeedbackHost {
  const registerInbound = options.registerInbound ?? registerInboundFrameHandler;
  const listWires = options.listWires ?? listConnectedWires;
  const subscribeClose = options.subscribeClose ?? subscribeOnWebSocketClose;

  const unregisterInbound = registerInbound((frame, wire) => {
    if (!frame || typeof frame !== 'object') return false;
    if ((frame as { type?: unknown }).type !== TRAFFIC_CAPTURE_STATE_TYPE) return false;
    // Same-device wires only — claimed and dropped otherwise.
    if (wire.isLoopback()) {
      const tabIds = parseTabIds(frame);
      if (tabIds !== null) capturedTabsReplace(wire.backendId, tabIds);
    }
    return true;
  });

  const unsubscribeClose = subscribeClose((wire) => {
    capturedTabsDropBackend(wire.backendId);
  });

  // Pull the current set on every wire already up — the cold-start
  // closer; later reconnects are covered by the daemon's connect push.
  for (const wire of listWires()) {
    if (wire.isLoopback()) wire.send({ type: TRAFFIC_CAPTURE_HELLO_TYPE });
  }

  return {
    dispose(): void {
      unregisterInbound();
      unsubscribeClose();
    },
  };
}
