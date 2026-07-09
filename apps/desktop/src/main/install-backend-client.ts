/**
 * Desktop install of the host-neutral backend client plane
 * (`@openheaders/oracle/sync/client/*`) — the desktop app joining daemon
 * backends as a client through the same plane the extension SW uses
 * (MULTI_BACKEND_PLAN.md §5). The desktop stays a *server* on its own
 * bind (the spine's WS server); this module is the outbound role only.
 *
 * Node-bound edges installed here:
 *
 *   - sockets: Node's global `WebSocket` (undici) — same WHATWG surface
 *     the shared transport FSM drives in the browser hosts.
 *   - reachability probe: scheme-preserving `fetch` with a short abort.
 *   - reliability knobs: plain-values reads off `OH.settingsUser`
 *     (same idiom as `web-app-root.ts`), kept live by a storage
 *     subscription — no renderer settings store runs in main.
 *   - status roll-up: non-empty client roll-ups write the shared `sync`
 *     Status subsystem. The zero-backend case stays silent — on desktop
 *     the spine's server-side reporter (bind lifecycle + peers) owns the
 *     subsystem's baseline entry.
 *   - agent/role: `desktop` HELLO role, `@openheaders/desktop@<version>`.
 *
 * Awareness over client wires is deliberately not wired yet — this
 * slice ships the sync plane; presence follows as its own row.
 */

import { refreshBackendsFromHostStorage, watchBackendsInHostStorage } from '@openheaders/core/backends';
import { HANDSHAKE_ROLES } from '@openheaders/core/protocol';
import type { HostStorage } from '@openheaders/core/storage';
import { OH } from '@openheaders/core/storage';
import {
  connectWebSocket,
  installBackendConnectionManager,
  restartAllPings,
} from '@openheaders/oracle/sync/client/backend-connection-manager';
import { installBackendSyncPlane, type SyncWiring } from '@openheaders/oracle/sync/client/backend-sync-plane';
import { setPendingOutQueue } from '@openheaders/oracle/sync/client/mutation-forwarder';
import { setSyncStatusRollupSink } from '@openheaders/oracle/sync/client/sync-status-aggregate';
import { getSyncPersistenceProvider } from '@openheaders/oracle/sync/sync-persistence-provider';
import { onWorkspaceStoreChange } from '@openheaders/oracle/workspace/extension-workspace-store';
import { report as reportStatus } from '@openheaders/ui/shared/status/store';

interface ReliabilityKnobs {
  reconnectDelayMs: number;
  maxReconnectDelayMs: number;
  pingIntervalMs: number;
}

/** The reliability knobs off a raw `OH.settingsUser` record, with the schema defaults. */
export function readReliabilityKnobs(values: Record<string, unknown> | undefined): ReliabilityKnobs {
  const num = (key: string, fallback: number): number => {
    const raw = values?.[key];
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback;
  };
  return {
    reconnectDelayMs: num('backend.reconnectDelayMs', 1000),
    maxReconnectDelayMs: num('backend.maxReconnectDelayMs', 6000),
    pingIntervalMs: num('backend.pingIntervalMs', 30000),
  };
}

const PROBE_TIMEOUT_MS = 500;

async function checkServerReachable(wsUrl: string): Promise<boolean> {
  try {
    // Scheme-preserving probe: a wss:// backend (TLS-terminating reverse
    // proxy) must be probed over https, or fetch rejects the URL outright
    // and the wire never dials.
    const httpUrl = wsUrl.replace(/^ws:/i, 'http:').replace(/^wss:/i, 'https:');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    await fetch(httpUrl, { method: 'GET', signal: controller.signal });
    clearTimeout(timeoutId);
    return true;
  } catch {
    return false;
  }
}

export interface InstallBackendClientConfig {
  /** The composed host storage the spine already installed process-wide. */
  hostStorage: HostStorage;
  /** Desktop app version — the HELLO agent string. */
  appVersion: string;
}

/**
 * Install the client plane and hydrate the backend registry mirror.
 * Called once after the daemon spine boots (the sync persistence
 * provider and workspace store must be live). Returns the sync wiring
 * so the caller can compose further probes off it.
 */
export async function installBackendClient(config: InstallBackendClientConfig): Promise<SyncWiring> {
  let knobs = readReliabilityKnobs((await config.hostStorage.get(OH.settingsUser)) ?? undefined);
  config.hostStorage.subscribe(OH.settingsUser, (next) => {
    const prevPing = knobs.pingIntervalMs;
    knobs = readReliabilityKnobs(next);
    // Ping cadence changes take effect on the next tick without a reconnect.
    if (knobs.pingIntervalMs !== prevPing) restartAllPings();
  });

  installBackendConnectionManager({
    probeReachable: checkServerReachable,
    createSocket: (url) => new WebSocket(url),
    getReconnectDelayMs: () => knobs.reconnectDelayMs,
    getMaxReconnectDelayMs: () => knobs.maxReconnectDelayMs,
    getPingIntervalMs: () => knobs.pingIntervalMs,
  });

  const syncWiring = installBackendSyncPlane({
    role: HANDSHAKE_ROLES.DESKTOP,
    getAgent: () => `@openheaders/desktop@${config.appVersion}`,
  });

  // The spine's server-side reporter owns the `sync` subsystem's
  // baseline (bind lifecycle + peer set); the client roll-up overlays it
  // only while backend connections exist. Latest-write-wins between the
  // two — the same temporal semantics the per-wire reporters already
  // have among themselves.
  setSyncStatusRollupSink((entry) => {
    if (!entry) return;
    reportStatus({ subsystem: 'sync', state: entry.state, message: entry.message, context: entry.context });
  });

  // One log, one cursor per backend (routing invariant 3) on the same
  // SQLite persistence the spine installed.
  setPendingOutQueue(getSyncPersistenceProvider().createPendingOutQueue?.() ?? null);

  // The `__global__` workspace list lands as MUTATION frames applied
  // asynchronously — re-enumerate consumed workspaces (and re-check the
  // deferred join-adoption) on every store change so a late-arriving
  // consumed workspace still gets its catch-up on the current socket.
  onWorkspaceStoreChange(() => {
    syncWiring.tryAdoptPendingWorkspaces();
    syncWiring.refreshFanOut();
  });

  // Hydrate the registry mirror LAST — the reconcile pass this triggers
  // dials the enabled records, and every per-wire service above must be
  // attached before the first frame can arrive.
  await refreshBackendsFromHostStorage();
  watchBackendsInHostStorage();
  await connectWebSocket();

  return syncWiring;
}
