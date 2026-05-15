/**
 * Boot-time wiring: register the desktop renderer's IPC adapters for the
 * awareness lifeline + peer navigation seams.
 *
 * Lifeline transport: every renderer surface (currently just Workbench;
 * popup/devpanel/sidepanel slots wire identically when they land) calls
 * `lifelineTransport.connect(name)` once on mount via
 * `hostBridge.presence(name)` and lets `disconnect()` fire on unmount.
 * The transport is implemented over `window.oh.lifeline.*` IPC plumbed
 * through `apps/desktop/src/preload.ts`; the main side's
 * `installLifelineServer` (`@openheaders/core/awareness`'s
 * `setLifelineServer`) treats disconnects (renderer-initiated or
 * webContents-destroyed) as the canonical "this surface is gone" signal,
 * which feeds `setupAwarenessLifelinePorts` in oracle.
 *
 * Peer navigator: single-window desktop has no cross-tab navigation, but
 * the `desktop-window` handle kind is reserved for Mode 2/3 multi-window
 * configurations. Today this is a permissive no-op that returns
 * `canNavigate: false` for every handle kind — the awareness pill will
 * fall back to "open peer surface unsupported" affordance per the UI
 * design.
 */

import {
  type LifelinePort,
  type LifelineTransport,
  type PeerNavigator,
  setLifelineTransport,
  setPeerNavigator,
} from '@openheaders/core/awareness';
import type { NavigationHandle } from '@openheaders/core/protocol';
import { hostLogger as logger } from '@openheaders/core/logger';

const SCOPE = 'IpcLifelineTransport';

interface OhLifelineApi {
  open(req: { portId: string; name: string }): Promise<{ ok: boolean; error?: string }>;
  message(req: { portId: string; message: unknown }): void;
  close(req: { portId: string }): void;
  onHostMessage(handler: (envelope: { portId: string; message: unknown }) => void): () => void;
  onHostDisconnect(handler: (envelope: { portId: string; errorMessage?: string }) => void): () => void;
}

function api(): OhLifelineApi {
  const oh = (globalThis as { oh?: { lifeline?: OhLifelineApi } }).oh;
  if (!oh?.lifeline) {
    throw new Error('IpcLifelineTransport: window.oh.lifeline is not exposed (preload script did not run)');
  }
  return oh.lifeline;
}

// Generate a renderer-side portId. Uses crypto.randomUUID() — available
// in the Electron renderer (Chromium) without import.
function nextPortId(): string {
  return globalThis.crypto.randomUUID();
}

type MessageHandler = (message: unknown) => void;
type DisconnectHandler = (info: { errorMessage?: string }) => void;

interface LocalPortState {
  portId: string;
  messageHandlers: Set<MessageHandler>;
  disconnectHandlers: Set<DisconnectHandler>;
  closed: boolean;
}

const localPorts = new Map<string, LocalPortState>();
let upstreamWired = false;
let unsubscribeHostMessage: (() => void) | null = null;
let unsubscribeHostDisconnect: (() => void) | null = null;

function ensureUpstreamWired(): void {
  if (upstreamWired) return;
  upstreamWired = true;
  unsubscribeHostMessage = api().onHostMessage((envelope) => {
    const state = localPorts.get(envelope.portId);
    if (!state || state.closed) return;
    for (const handler of state.messageHandlers) {
      try {
        handler(envelope.message);
      } catch (err) {
        logger.warn(SCOPE, `onMessage handler threw for port ${envelope.portId}`, err);
      }
    }
  });
  unsubscribeHostDisconnect = api().onHostDisconnect((envelope) => {
    closeLocalPort(envelope.portId, { errorMessage: envelope.errorMessage });
  });
}

function closeLocalPort(portId: string, info: { errorMessage?: string }): void {
  const state = localPorts.get(portId);
  if (!state || state.closed) return;
  state.closed = true;
  for (const handler of state.disconnectHandlers) {
    try {
      handler(info);
    } catch (err) {
      logger.warn(SCOPE, `onDisconnect handler threw for port ${portId}`, err);
    }
  }
  localPorts.delete(portId);
  // We never tear down the upstream listeners — surfaces churn
  // connections rapidly; keeping them stable is cheaper than re-wiring
  // and matches the host-bridge/host-storage upstream-subscription
  // pattern.
}

const ipcLifelineTransport: LifelineTransport = {
  connect(name: string): LifelinePort {
    ensureUpstreamWired();
    const portId = nextPortId();
    const state: LocalPortState = {
      portId,
      messageHandlers: new Set(),
      disconnectHandlers: new Set(),
      closed: false,
    };
    localPorts.set(portId, state);

    // Fire the open invoke. If it fails we synthesize a disconnect on
    // the next tick so consumers' reconnect loops fire.
    void api()
      .open({ portId, name })
      .then((res) => {
        if (!res.ok) {
          logger.warn(SCOPE, `open(${name}) rejected: ${res.error ?? 'unknown'}`);
          closeLocalPort(portId, { errorMessage: res.error });
        }
      })
      .catch((err) => {
        logger.warn(SCOPE, `open(${name}) failed`, err);
        closeLocalPort(portId, { errorMessage: (err as Error)?.message });
      });

    return {
      postMessage(message: unknown): void {
        if (state.closed) return;
        try {
          api().message({ portId, message });
        } catch (err) {
          logger.warn(SCOPE, `postMessage(${name}) failed`, err);
        }
      },
      onMessage<T = unknown>(handler: (message: T) => void): void {
        state.messageHandlers.add(handler as MessageHandler);
      },
      onDisconnect(handler: DisconnectHandler): void {
        state.disconnectHandlers.add(handler);
        // If the port closed before this handler attached (e.g. open
        // rejected synchronously), fire immediately. localPorts.delete
        // already happened in closeLocalPort, so guard on state.closed.
        if (state.closed) {
          try {
            handler({});
          } catch (err) {
            logger.warn(SCOPE, `onDisconnect handler threw for port ${portId}`, err);
          }
        }
      },
      disconnect(): void {
        if (state.closed) return;
        try {
          api().close({ portId });
        } catch (err) {
          logger.warn(SCOPE, `close(${name}) failed`, err);
        }
        // Local-side eager close so the consumer doesn't wait on an
        // ack. Mirrors chrome.runtime.Port.disconnect semantics.
        closeLocalPort(portId, {});
      },
    };
  },
};

const desktopPeerNavigator: PeerNavigator = {
  navigate(_handle: NavigationHandle): Promise<boolean> {
    // Single-window desktop today. The `desktop-window` handle kind
    // exists in core for Mode 2/3, but the desktop main process doesn't
    // yet route windows by it. Returning false surfaces the awareness
    // pill's "open peer surface unsupported" affordance.
    return Promise.resolve(false);
  },
  canNavigate(_handle: NavigationHandle | undefined): boolean {
    return false;
  },
};

setLifelineTransport(ipcLifelineTransport);
setPeerNavigator(desktopPeerNavigator);

// Hook for tests / hot-reload scenarios — tear down the upstream
// subscriptions if the renderer ever unmounts the host (it doesn't
// today, but keeping the symmetry costs nothing).
export function __teardownIpcLifelineForTests(): void {
  unsubscribeHostMessage?.();
  unsubscribeHostDisconnect?.();
  upstreamWired = false;
  for (const portId of [...localPorts.keys()]) {
    closeLocalPort(portId, { errorMessage: 'teardown' });
  }
}
