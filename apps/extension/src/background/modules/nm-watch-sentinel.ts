/**
 * NM auto-connect sentinel — POLICY layer over the watch wire
 * (`@/shared/nm-watch`): the extension attaches to the desktop app the
 * instant it comes up instead of waiting out the reconnect alarm's
 * floor. While a loopback backend is WANTED but DISCONNECTED, one
 * watch port stays open; the host polls the loopback address and posts
 * the up-signal the moment the verified desktop app appears, and the
 * sentinel dials — the transport fast-forwards any pending backoff.
 *
 * Always-on while wanting-but-disconnected, no TTL (ratified S22): the
 * kill switches are the backend record's `enabled` flag and the
 * `backend.nmAutoJoin` consent plane — the same gate as the rest of
 * the silent NM plane; the sentinel mints nothing, it only accelerates
 * a dial the record's `autoConnect` already consents to. The port is
 * torn down the moment the loopback wire opens and re-armed on close,
 * all driven by the connection manager's own events — no polling here.
 *
 * The host's ~25s heartbeats keep the service worker alive across the
 * wait, so the sub-second attach survives MV3 eviction; hosts without
 * the watch verb (an outdated install) answer one frame and exit,
 * which the sentinel treats as dead-on-arrival and suppresses until
 * the next external trigger (registry change, socket event, or the
 * `wsReconnect` alarm tick) — a broken host costs one spawn per
 * trigger, never a tight respawn loop. Browsers without the NM plane
 * (Safari) and consent-off installs never arm, degrading to today's
 * alarm cadence by construction.
 */

import { getBackends, isLoopbackBackendUrl, subscribeBackends } from '@openheaders/core/backends';
import {
  connectWebSocket,
  isBackendConnected,
  subscribeOnWebSocketClose,
  subscribeOnWebSocketOpen,
} from '@openheaders/oracle/sync/client/backend-connection-manager';
import { get as getSetting, subscribeKey } from '@openheaders/ui/workbench/settings/store';
import { logger } from '@utils/logger';
import { type ConnectNative, type NmWatchHandle, nativeWatchAvailable, openNmWatch } from '../../shared/nm-watch';

const SCOPE = 'NmWatchSentinel';

export interface NmWatchSentinelDeps {
  /** Test seam — defaults to `chrome.runtime.connectNative`. */
  readonly connectNative?: ConnectNative;
  /** Test seam — defaults to the real availability probe. */
  readonly watchAvailable?: () => boolean;
  /** Test seam — defaults to the connection manager's ensure-dial. */
  readonly requestConnect?: () => void;
  /** Test seam — defaults to the manager's per-backend wire truth. */
  readonly isConnected?: (backendId: string) => boolean;
}

interface ArmedWatch {
  readonly url: string;
  sawUp: boolean;
  /** Assigned right after `openNmWatch` — the hooks close over the entry. */
  handle: NmWatchHandle | null;
}

let sentinelDeps: NmWatchSentinelDeps = {};
let armed: ArmedWatch | null = null;
// Dead-on-arrival latch: the port closed without ever signaling up
// (outdated host, spawn failure). No re-arm until an external trigger
// clears it — that trigger cadence (registry / socket events, the 30s
// alarm tick) IS the retry policy for broken hosts.
let suppressed = false;
let installed = false;

export function resetNmWatchSentinelForTests(): void {
  armed?.handle?.disconnect();
  armed = null;
  suppressed = false;
  sentinelDeps = {};
  // Registry test resets clear that module's listeners — drop the
  // latch so the next install re-subscribes.
  installed = false;
}

/**
 * The loopback URL a watch is wanted for, or null: NM plane present,
 * consent on, an enabled auto-connect loopback record exists, and its
 * wire is not currently connected.
 */
function wantedWatchUrl(): string | null {
  const available = sentinelDeps.watchAvailable ?? nativeWatchAvailable;
  if (!available()) return null;
  if (!getSetting('backend.nmAutoJoin')) return null;
  const loopback = getBackends().find(
    (b) => b.enabled && b.autoConnect && b.url.length > 0 && isLoopbackBackendUrl(b.url),
  );
  if (!loopback) return null;
  const isConnected = sentinelDeps.isConnected ?? isBackendConnected;
  if (isConnected(loopback.id)) return null;
  return loopback.url;
}

function teardown(): void {
  if (!armed) return;
  armed.handle?.disconnect();
  armed = null;
}

function arm(url: string): void {
  const watch: ArmedWatch = { url, sawUp: false, handle: null };
  const handle = openNmWatch(
    url,
    {
      onUp: () => {
        watch.sawUp = true;
        logger.info(SCOPE, `desktop app is up at ${url} — dialing`);
        const requestConnect = sentinelDeps.requestConnect ?? (() => void connectWebSocket());
        requestConnect();
      },
      onDisconnect: (detail) => {
        if (armed !== watch) return;
        armed = null;
        if (!watch.sawUp) {
          suppressed = true;
          const reason = detail ? ` (${detail})` : '';
          logger.info(SCOPE, `watch host closed without an up-signal${reason} — suppressed until the next trigger`);
          return;
        }
        evaluateNmWatchSentinel();
      },
    },
    sentinelDeps.connectNative,
  );
  if (handle === null) return;
  watch.handle = handle;
  armed = watch;
}

/**
 * Reconcile the watch port against current intent. External triggers
 * (registry / socket / settings events, the reconnect alarm tick)
 * clear the dead-host suppression; the port's own death does not.
 */
export function evaluateNmWatchSentinel(options: { clearSuppression?: boolean } = {}): void {
  if (options.clearSuppression) suppressed = false;
  const url = wantedWatchUrl();
  if (url === null) {
    teardown();
    return;
  }
  if (armed !== null) {
    if (armed.url === url) return;
    teardown();
  }
  if (suppressed) return;
  arm(url);
}

/**
 * Install the sentinel's triggers: any registry change, every wire
 * open/close, and the consent setting. Idempotent; hosts call it once
 * at boot after settings + registry hydration.
 */
export function installNmWatchSentinel(deps: NmWatchSentinelDeps = {}): void {
  sentinelDeps = deps;
  if (!installed) {
    installed = true;
    subscribeBackends(() => evaluateNmWatchSentinel({ clearSuppression: true }));
    subscribeOnWebSocketOpen(() => evaluateNmWatchSentinel({ clearSuppression: true }));
    subscribeOnWebSocketClose(() => evaluateNmWatchSentinel({ clearSuppression: true }));
    subscribeKey('backend.nmAutoJoin', () => evaluateNmWatchSentinel({ clearSuppression: true }));
  }
  evaluateNmWatchSentinel({ clearSuppression: true });
}
