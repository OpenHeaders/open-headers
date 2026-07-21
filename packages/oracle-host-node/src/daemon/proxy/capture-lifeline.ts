/**
 * Lifeline acceptor for the proxy capture partition — the daemon-side
 * counterpart of the extension's `lifecycle-port-host/accept-port.ts`,
 * minus the browser-only concerns (tab-telemetry watching refs, CDP
 * provenance). On-demand bodies are served from the proxy body store via
 * the injected {@link ProxyBodyRequestHandler}.
 *
 * A workbench surface opens `oh-lifecycle:-59210` through the host's
 * lifeline server; this module attaches a hub sink on the consumer's
 * `subscribe` handshake and streams `LifecycleWireMessage` envelopes
 * back down the same port. ONLY the reserved proxy partition is served:
 * a Node host has no browser tabs, so any non-negative id (or a
 * negative id that is not the proxy sentinel) is left for other
 * acceptors — never half-answered.
 */

import { getLifelineServer, type IncomingLifelinePort } from '@openheaders/core/awareness';
import { PROXY_LIFECYCLE_TAB_ID } from '@openheaders/core/proxy';
import {
  type LifecycleConsumerMessage,
  type LifecycleWireMessage,
  parseLifecyclePortName,
} from '@openheaders/core/request-lifecycle';
import type { AttachmentHandle, RequestLifecycleHub, Sink } from '@openheaders/oracle/request-lifecycle-hub';

/** Sink that projects hub deliveries into wire envelopes on the port. */
function portSink(port: IncomingLifelinePort): Sink {
  const post = (message: LifecycleWireMessage): void => {
    port.postMessage(message);
  };
  return {
    deliverReady(tabId, watermarkMs, sessionToken) {
      post({ kind: 'ready', tabId, watermarkMs, ...(sessionToken !== undefined ? { sessionToken } : {}) });
    },
    deliverUpdate(update) {
      post({ kind: 'lifecycle-update', update });
    },
    deliverTabCleared(tabId) {
      post({ kind: 'tab-cleared', tabId });
    },
    close() {
      // Hub-initiated detach; the surface's reconnect loop re-subscribes.
    },
  };
}

/**
 * The consumer's on-demand body pull — the service resolves the retained
 * body and answers by applying an ordinary `body-attached` update to the
 * store (which streams to every attached sink). An unanswerable pull
 * (never captured, evicted) is silently dropped per the wire contract.
 */
export type ProxyBodyRequestHandler = (requestId: string, hopIndex: number) => void;

/**
 * Accept one incoming lifeline if it addresses the proxy partition.
 * Returns `true` when claimed (message/disconnect handlers installed).
 */
export function acceptProxyCaptureLifeline(
  hub: RequestLifecycleHub,
  port: IncomingLifelinePort,
  onRequestBody?: ProxyBodyRequestHandler,
): boolean {
  const tabId = parseLifecyclePortName(port.name);
  if (tabId !== PROXY_LIFECYCLE_TAB_ID) return false;
  const sink = portSink(port);

  let handle: AttachmentHandle | null = null;
  let disconnected = false;
  port.onMessage<LifecycleConsumerMessage>((msg) => {
    if (disconnected) return;
    if (msg?.kind === 'subscribe') {
      // Attach on the handshake; a repeated subscribe re-attaches in
      // place so the replay is the canonical view after a reconnect.
      handle?.detach();
      handle = hub.attach(tabId, sink);
      return;
    }
    if (msg?.kind === 'clear-session') {
      hub.resetSession(tabId);
      return;
    }
    if (msg?.kind === 'request-body' && onRequestBody !== undefined) {
      // Answered out-of-band: the handler applies a `body-attached`
      // update to the store, which streams back down this same port.
      onRequestBody(msg.requestId, msg.hopIndex);
    }
  });
  port.onDisconnect(() => {
    disconnected = true;
    handle?.detach();
    handle = null;
  });
  return true;
}

/**
 * Register the acceptor on the host's installed lifeline server. Call
 * once at spine boot; returns the unsubscribe for dispose. On a host
 * with no lifeline server (headless daemon today) the core seam's
 * default never fires — a clean no-op.
 */
export function installProxyCaptureLifeline(
  hub: RequestLifecycleHub,
  onRequestBody?: ProxyBodyRequestHandler,
): () => void {
  return getLifelineServer().onConnect((port) => {
    acceptProxyCaptureLifeline(hub, port, onRequestBody);
  });
}
