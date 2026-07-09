import { setBackendReach } from '@openheaders/core/backends';
import {
  type InboundFrameHandler,
  registerInboundFrameHandler,
  subscribeOnWebSocketClose,
  subscribeOnWebSocketOpen,
  subscribeWireLifecycle,
} from './backend-connection-manager';
import {
  type BackendWireHandshakeDeps,
  createSyncHandshakeForWire,
  type SyncHandshakeHandles,
} from './backend-wire-handshake';
import { handleIncomingMutationFrame } from './mutation-receiver';

export interface HandshakeLifecycleEvent {
  readonly kind: 'created' | 'removed';
  readonly backendId: string;
  readonly handles: SyncHandshakeHandles;
}

/**
 * The per-connection sync wiring's aggregate face — the host boot and
 * the status reporters consume the N handshake coordinators through
 * this instead of the retired singleton handle.
 */
export interface SyncWiring {
  get(backendId: string): SyncHandshakeHandles | null;
  /** Any wire's backend actively rejecting this peer (audit X-1). */
  isAnyBackendEvicting(): boolean;
  /** Re-check deferred join-adoption against the workspace store, on every wire. */
  tryAdoptPendingWorkspaces(): void;
  /** Re-enumerate consumed workspaces on every wire (U6.4 late fan-out). */
  refreshFanOut(): void;
  /** Observe per-wire handshake creation/removal. */
  subscribeHandshakeLifecycle(cb: (event: HandshakeLifecycleEvent) => void): () => void;
}

export interface BackendSyncPlaneDeps extends BackendWireHandshakeDeps {
  /**
   * Host-owned inbound frame handlers registered after the shared pair
   * (per-wire handshake, mutation receiver) — the extension passes its
   * awareness receiver here. Anything unclaimed drops silently.
   */
  readonly extraInboundHandlers?: readonly InboundFrameHandler[];
}

/**
 * Install the per-wire sync plane: one handshake coordinator per
 * backend wire (created/removed with the wire), inbound frame routing
 * (each wire's HELLO-flow frames go to its OWN initiator; the mutation
 * receiver and the host's extra handlers claim theirs with the
 * delivering wire attached), and the open/close hooks that re-run the
 * handshake per socket.
 */
export function installBackendSyncPlane(deps: BackendSyncPlaneDeps): SyncWiring {
  const handshakes = new Map<string, SyncHandshakeHandles>();
  const lifecycleSubscribers = new Set<(event: HandshakeLifecycleEvent) => void>();

  const fireLifecycle = (event: HandshakeLifecycleEvent): void => {
    for (const cb of [...lifecycleSubscribers]) cb(event);
  };

  subscribeWireLifecycle((event) => {
    if (event.kind === 'created') {
      const handles = createSyncHandshakeForWire(event.wire, deps);
      handshakes.set(event.wire.backendId, handles);
      fireLifecycle({ kind: 'created', backendId: event.wire.backendId, handles });
      return;
    }
    const handles = handshakes.get(event.wire.backendId);
    if (!handles) return;
    handles.initiator.reset();
    handshakes.delete(event.wire.backendId);
    fireLifecycle({ kind: 'removed', backendId: event.wire.backendId, handles });
  });

  // Each wire's handshake initiator claims HELLO-flow frames first; the
  // mutation receiver and the host's extra handlers claim their own;
  // anything else drops silently.
  registerInboundFrameHandler(async (frame, wire) => {
    const handles = handshakes.get(wire.backendId);
    if (!handles?.initiator.handles(frame)) return false;
    await handles.initiator.handle(frame);
    return true;
  });
  registerInboundFrameHandler(handleIncomingMutationFrame);
  for (const handler of deps.extraInboundHandlers ?? []) {
    registerInboundFrameHandler(handler);
  }

  subscribeOnWebSocketOpen((wire) => {
    const handles = handshakes.get(wire.backendId);
    if (!handles) return;
    // A fresh transport socket is a fresh handshake session — reset
    // first so a prior socket's terminal state can't wedge this one.
    handles.initiator.reset();
    void handles.initiator.start();
  });
  subscribeOnWebSocketClose((wire) => {
    handshakes.get(wire.backendId)?.initiator.reset();
    // Only this wire's entry — the other backends' tiers stay live.
    void setBackendReach(wire.backendId, null).catch(() => {
      /* best-effort — next WELCOME re-converges it */
    });
  });

  return {
    get: (backendId) => handshakes.get(backendId) ?? null,
    isAnyBackendEvicting: () => [...handshakes.values()].some((h) => h.isBackendEvicting()),
    tryAdoptPendingWorkspaces: () => {
      for (const handles of handshakes.values()) handles.tryAdoptPendingWorkspace();
    },
    refreshFanOut: () => {
      for (const handles of handshakes.values()) handles.initiator.refreshFanOut();
    },
    subscribeHandshakeLifecycle: (cb) => {
      lifecycleSubscribers.add(cb);
      return () => lifecycleSubscribers.delete(cb);
    },
  };
}
