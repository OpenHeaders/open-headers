/**
 * The web tab's single wire — the WS client joining the tab oracle to
 * the daemon that served it (Phase 4b slice B2).
 *
 * The tab knows its daemon: exactly one backend at
 * `wss://<location.host>` (scheme follows `location.protocol`). No
 * registry, no reconcile loop, no multi-wire aggregate — the transport
 * FSM, handshake coordinator, and catch-up driver are the same shared
 * client stack the extension runs per wire
 * (`@openheaders/oracle/sync/client`), instantiated once.
 *
 * Composition per socket lifetime:
 *
 *   transport open → initiator.start() → HELLO (token from the
 *   origin-scoped slot) → WELCOME accept folds the daemon's home Org
 *   under the fixed {@link WEB_DAEMON_BACKEND_ID} (consume-only join)
 *   → `__global__` catch-up → per-consumed-workspace fan-out → live
 *   mode. SYNCED prunes + flushes the pending-out queue; close resets
 *   the initiator so the next socket re-runs the handshake.
 *
 * Inbound frames route: handshake-flow → the initiator; migration pull
 * broadcasts → `wire-migration-mirror.ts`; live send-stream frames →
 * `wire-request-stream.ts`; mutation + awareness → `wire-inbound.ts`;
 * `pong` and anything else drop.
 */

import { getOrgBackendBindings, recordJoinedOrg } from '@openheaders/core/identity';
import { hostLogger as logger } from '@openheaders/core/logger';
import { HANDSHAKE_ROLES, type HandshakeRejectReason } from '@openheaders/core/protocol';
import { applyWorkspaceSnapshot, readWorkspaceStateVector, snapshotAwarenessPresence } from '@openheaders/oracle/sync';
import type { InitiatorState } from '@openheaders/oracle/sync/client/sync-handshake-initiator';
import { createSyncHandshakeInitiator } from '@openheaders/oracle/sync/client/sync-handshake-initiator';
import type { TransportState } from '@openheaders/oracle/sync/client/transport-connection';
import { createTransportConnection } from '@openheaders/oracle/sync/client/transport-connection';
import { getOrCreateWorkspaceService, releaseWorkspaceService } from '@openheaders/oracle/sync/service';
import {
  getWorkspace,
  listWorkspaces,
  onWorkspaceStoreChange,
  peekActiveWorkspaceId,
  setActiveWorkspaceById,
} from '@openheaders/oracle/workspace/extension-workspace-store';
import { report } from '@openheaders/ui/shared/status';
import { peekDaemonToken } from './daemon-token';
import { WEB_DAEMON_BACKEND_ID } from './web-backend-id';
import { handleInboundWireFrame } from './wire-inbound';
import { handleIncomingMigrationPullFrame } from './wire-migration-mirror';
import { applyPeerVectorToPendingOut, flushPendingOut, forwardAwarenessOverWire, setWireSender } from './wire-outbound';
import { handleIncomingGrpcStreamFrame } from './wire-grpc-stream';
import { handleIncomingRequestStreamFrame } from './wire-request-stream';
import { handleWireRpcResponseFrame, setWireRpcSender } from './wire-rpc';

const SCOPE = 'DaemonWire';

const RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 6000;
const PING_INTERVAL_MS = 30_000;
const PROBE_TIMEOUT_MS = 1500;

export interface DaemonWire {
  /** Latch the connect intent on and begin dialing. Idempotent. */
  start(): void;
  /** Tear down + redial — the login gate calls this after a token change. */
  reconnect(): void;
  isConnected(): boolean;
  transportState(): TransportState;
  handshakeState(): InitiatorState;
  rejectReason(): HandshakeRejectReason | null;
  subscribeHandshake(cb: (state: InitiatorState) => void): () => void;
  subscribeTransport(cb: (state: TransportState) => void): () => void;
}

/** `wss://<location.host>` when served over TLS, `ws://` otherwise. */
function daemonWsUrl(): string {
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${location.host}`;
}

/** Same-origin `/healthz` probe — the daemon composes it on every bind. */
async function probeDaemonReachable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const response = await fetch('/healthz', { method: 'GET', signal: controller.signal });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

function reportWireStatus(state: InitiatorState, rejectReason: HandshakeRejectReason | null): void {
  switch (state) {
    case 'synced':
      report({ subsystem: 'sync', state: 'green', message: 'Synced with the serving daemon' });
      return;
    case 'rejected':
      report({
        subsystem: 'sync',
        state: 'red',
        message:
          rejectReason === 'auth-required'
            ? 'The daemon requires a pairing token'
            : `Daemon refused the connection (${rejectReason ?? 'unknown'})`,
        context: { reason: rejectReason },
      });
      return;
    case 'failed':
    case 'timed-out':
      report({ subsystem: 'sync', state: 'yellow', message: 'Daemon sync interrupted — retrying' });
      return;
    default:
      return;
  }
}

let installed: DaemonWire | null = null;

/** Install the single wire. Idempotent — one wire per tab lifetime. */
export function installDaemonWire(): DaemonWire {
  if (installed) return installed;

  let wanted = false;
  const transportSubscribers = new Set<(state: TransportState) => void>();

  const initiator = createSyncHandshakeInitiator({
    send: (frame) => transport.send(frame as Record<string, unknown>),
    role: HANDSHAKE_ROLES.WEB,
    getActiveWorkspaceId: () => peekActiveWorkspaceId(),
    getNodeId: (workspaceId) => {
      const svc = getOrCreateWorkspaceService(workspaceId);
      try {
        return svc.context.nodeId;
      } finally {
        releaseWorkspaceService(workspaceId);
      }
    },
    getAgent: () => `@openheaders/web@${__APP_VERSION__}`,
    getAuthToken: () => peekDaemonToken(),
    readStateVector: (workspaceId) => readWorkspaceStateVector(workspaceId),
    applySnapshot: async (snapshot) => {
      const svc = getOrCreateWorkspaceService(snapshot.workspaceId);
      try {
        await svc.hydrated;
        await applyWorkspaceSnapshot(snapshot, { makeContext: () => svc.context.next() });
      } finally {
        releaseWorkspaceService(snapshot.workspaceId);
      }
    },
    // Only workspaces whose Org is bound to the serving daemon; the
    // adopted workspace is sequenced first so an interrupted fan-out
    // still leaves the user on a synced workspace.
    listConsumedWorkspaceIds: () => {
      const bindings = getOrgBackendBindings();
      const ids = listWorkspaces()
        .filter((ws) => bindings.get(ws.orgId) === WEB_DAEMON_BACKEND_ID)
        .map((ws) => ws.id);
      if (pendingAdoptWorkspaceId && ids.includes(pendingAdoptWorkspaceId)) {
        const adopt = pendingAdoptWorkspaceId;
        return [adopt, ...ids.filter((id) => id !== adopt)];
      }
      return ids;
    },
    onSynced: async (_scope, peerVector) => {
      await applyPeerVectorToPendingOut(peerVector);
      await flushPendingOut();
      tryAdoptPendingWorkspace();
      // Push the current presence snapshot so the daemon folds this
      // tab's surfaces immediately rather than on next activity.
      const workspaceId = peekActiveWorkspaceId();
      if (workspaceId) {
        forwardAwarenessOverWire({ workspaceId, presence: [...snapshotAwarenessPresence()] });
      }
    },
    onRejected: (reason, detail) => {
      logger.warn(SCOPE, `handshake rejected: ${reason}${detail ? ` — ${detail}` : ''}`);
    },
    // First-join only — a reconnect must not re-adopt over a local
    // active-workspace switch the user made since.
    onJoinedOrg: async (org, backendActiveWorkspaceId) => {
      const result = await recordJoinedOrg(org, WEB_DAEMON_BACKEND_ID);
      if (result.firstJoin && backendActiveWorkspaceId) {
        pendingAdoptWorkspaceId = backendActiveWorkspaceId;
        tryAdoptPendingWorkspace();
      }
      logger.info(SCOPE, `joined the daemon's Org ${org.id} — its workspaces will sync down`);
    },
  });

  // The daemon's active workspace from WELCOME, held until it syncs
  // down (the join fires before the joined Org's workspaces arrive).
  let pendingAdoptWorkspaceId: string | null = null;
  const tryAdoptPendingWorkspace = (): void => {
    if (!pendingAdoptWorkspaceId) return;
    if (!getWorkspace(pendingAdoptWorkspaceId)) return;
    const id = pendingAdoptWorkspaceId;
    pendingAdoptWorkspaceId = null;
    void setActiveWorkspaceById(id).catch((err: unknown) => {
      logger.warn(SCOPE, 'join → adopt: could not promote the daemon workspace to active', err);
    });
  };

  // Tail of the inbound processing chain — see onMessage below.
  let inboundTail: Promise<void> = Promise.resolve();

  async function routeFrame(frame: unknown): Promise<void> {
    try {
      if (initiator.handles(frame)) {
        await initiator.handle(frame);
        return;
      }
      // Wire RPC responses (admin + request channels) — synchronous
      // by-channel correlation, so check before the async
      // mutation/awareness path.
      if (handleWireRpcResponseFrame(frame)) return;
      // Migration pull broadcasts — synchronous claim into the in-tab
      // fan-out, same posture as the RPC responses.
      if (handleIncomingMigrationPullFrame(frame)) return;
      // Live send-stream frames for a forwarded Send — same posture.
      if (handleIncomingRequestStreamFrame(frame)) return;
      // Live gRPC stream frames for a forwarded Invoke — same posture.
      if (handleIncomingGrpcStreamFrame(frame)) return;
      const claimed = await handleInboundWireFrame(frame);
      if (claimed) return;
      const type = (frame as { type?: unknown })?.type;
      if (type !== 'pong') logger.debug(SCOPE, `unhandled frame ${String(type)}`);
    } catch (err) {
      logger.warn(SCOPE, 'inbound frame processing threw', err);
    }
  }

  const transport = createTransportConnection({
    getUrl: () => daemonWsUrl(),
    shouldConnect: () => wanted,
    getReconnectDelayMs: () => RECONNECT_DELAY_MS,
    getMaxReconnectDelayMs: () => MAX_RECONNECT_DELAY_MS,
    getPingIntervalMs: () => PING_INTERVAL_MS,
    probeReachable: () => probeDaemonReachable(),
    createSocket: (url) => new WebSocket(url),
    onOpen: () => {
      // A fresh socket is a fresh handshake session.
      initiator.reset();
      void initiator.start();
    },
    onClose: () => {
      initiator.reset();
    },
    onMessage: (data) => {
      let frame: unknown;
      try {
        frame = JSON.parse(data);
      } catch (err) {
        logger.warn(SCOPE, 'dropping unparseable frame', err);
        return;
      }
      // Frames are processed strictly in arrival order: a catch-up
      // replay streams one frame per logged mutation, and dispatching
      // them concurrently races every apply for the same entity onto
      // one FIFO Web Lock — anything queued past the lock timeout
      // throws and that mutation is dropped until a reconnect
      // redelivers it. routeFrame absorbs its own errors, so the chain
      // cannot latch into a failed state.
      inboundTail = inboundTail.then(() => routeFrame(frame));
    },
    onStateChange: (state) => {
      for (const cb of [...transportSubscribers]) {
        try {
          cb(state);
        } catch (err) {
          logger.warn(SCOPE, 'transport subscriber threw', err);
        }
      }
    },
  });

  setWireSender((frame) => transport.send(frame));
  setWireRpcSender((frame) => transport.send(frame));

  initiator.subscribe((state) => {
    reportWireStatus(state, initiator.rejectReason());
  });

  // The `__global__` workspace list lands as MUTATION frames applied
  // asynchronously — re-enumerate consumed workspaces (and re-check the
  // deferred adoption) on every store change so a late-arriving
  // workspace still gets its catch-up on the current socket.
  onWorkspaceStoreChange(() => {
    tryAdoptPendingWorkspace();
    initiator.refreshFanOut();
  });

  installed = {
    start: () => {
      wanted = true;
      transport.ensureConnected();
    },
    reconnect: () => {
      wanted = true;
      transport.reconnect();
    },
    isConnected: () => transport.isConnected(),
    transportState: () => transport.state(),
    handshakeState: () => initiator.state(),
    rejectReason: () => initiator.rejectReason(),
    subscribeHandshake: (cb) => initiator.subscribe(cb),
    subscribeTransport: (cb) => {
      transportSubscribers.add(cb);
      return () => {
        transportSubscribers.delete(cb);
      };
    },
  };
  return installed;
}
