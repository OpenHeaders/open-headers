/**
 * Proxy routing host — the extension side of scoped browser routing
 * (the observability plan §5.1).
 *
 * The desktop owns the routing truth (decrypt scope + capture port +
 * toggle, folded with the proxy's run state); this host applies each
 * pushed verdict through the browser's proxy-config surface and acks
 * what actually happened. The extension never carries traffic — it
 * sets config; the browser's own stack CONNECTs to the capture port.
 *
 * Boot race: a cold service worker HELLOs before this host registers
 * its frame handlers, so a connect-time push can land unhandled. The
 * host closes it by PULLING — `oh.proxy.routing.hello` on every wire
 * already up at start — while the daemon's peer-connect push covers
 * every later reconnect.
 *
 * Persistence: the last pushed state lands in `chrome.storage.local`
 * so Firefox's standing `proxy.onRequest` listener answers correctly
 * on a cold start before any wire is back, and routing survives wire
 * flaps (ratified: DIRECT failover covers a dead port; only an
 * explicit disabled push clears the config).
 *
 * Privacy gate: routing frames are honored from SAME-DEVICE (loopback)
 * wires only — the capture port is loopback-bound, so an off-device
 * daemon's routing instruction can never be right. Claimed and
 * dropped, the telemetry plane's posture.
 */

import {
  PROXY_ROUTING_ACK_TYPE,
  PROXY_ROUTING_HELLO_TYPE,
  PROXY_ROUTING_STATE_TYPE,
  type ProxyRoutingStateMessage,
} from '@openheaders/core/protocol';
import {
  listConnectedWires,
  registerInboundFrameHandler,
} from '@openheaders/oracle/sync/client/backend-connection-manager';
import { isFirefox, isSafari, storage } from '@utils/browser-api';
import { logger } from '@utils/logger';
import {
  createChromiumRoutingAdapter,
  createFirefoxRoutingAdapter,
  createUnsupportedRoutingAdapter,
  INACTIVE_ROUTING_STATE,
  type ProxyRoutingAdapter,
  type ProxyRoutingState,
} from './apply';

const SCOPE = 'ProxyRoutingHost';

const STORAGE_KEY = 'oh.proxyRouting';

export interface ProxyRoutingHostOptions {
  /** Test seams — default to the real connection manager + browser adapters. */
  readonly adapter?: ProxyRoutingAdapter;
  readonly registerInbound?: typeof registerInboundFrameHandler;
  readonly listWires?: typeof listConnectedWires;
  readonly loadState?: () => Promise<ProxyRoutingState | null>;
  readonly saveState?: (state: ProxyRoutingState) => Promise<void>;
}

export interface ProxyRoutingHost {
  dispose(): void;
}

function parseStateMessage(frame: ProxyRoutingStateMessage): ProxyRoutingState | null {
  const { enabled, port, scopePatterns } = frame;
  if (typeof enabled !== 'boolean' || !Array.isArray(scopePatterns)) return null;
  if (port !== null && (typeof port !== 'number' || !Number.isInteger(port))) return null;
  return {
    enabled,
    port,
    scopePatterns: scopePatterns.filter((p): p is string => typeof p === 'string'),
  };
}

function isPersistedState(value: unknown): value is ProxyRoutingState {
  const candidate = value as { enabled?: unknown; port?: unknown; scopePatterns?: unknown } | null;
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    typeof candidate.enabled === 'boolean' &&
    (candidate.port === null || typeof candidate.port === 'number') &&
    Array.isArray(candidate.scopePatterns)
  );
}

async function loadPersistedState(): Promise<ProxyRoutingState | null> {
  return new Promise((resolve) => {
    try {
      storage.local.get(STORAGE_KEY, (items) => {
        const value = items?.[STORAGE_KEY];
        resolve(isPersistedState(value) ? value : null);
      });
    } catch {
      resolve(null);
    }
  });
}

async function savePersistedState(state: ProxyRoutingState): Promise<void> {
  await new Promise<void>((resolve) => {
    try {
      storage.local.set({ [STORAGE_KEY]: state }, () => resolve());
    } catch {
      resolve();
    }
  });
}

export function startProxyRoutingHost(options: ProxyRoutingHostOptions = {}): ProxyRoutingHost {
  const registerInbound = options.registerInbound ?? registerInboundFrameHandler;
  const listWires = options.listWires ?? listConnectedWires;
  const loadState = options.loadState ?? loadPersistedState;
  const saveState = options.saveState ?? savePersistedState;

  let current: ProxyRoutingState = INACTIVE_ROUTING_STATE;
  let disposed = false;

  // Hydration must resolve before Firefox's per-request listener can
  // answer, and before the first pushed state overwrites the mirror.
  const hydrated: Promise<void> = loadState()
    .then((persisted) => {
      if (persisted !== null && current === INACTIVE_ROUTING_STATE) current = persisted;
    })
    .catch(() => {});
  const readState = async (): Promise<ProxyRoutingState> => {
    await hydrated;
    return current;
  };

  // The Firefox adapter registers its standing `proxy.onRequest`
  // listener HERE — this host must start during module eval so the
  // event page wakes for proxy decisions.
  const adapter =
    options.adapter ??
    (isFirefox
      ? createFirefoxRoutingAdapter(readState)
      : isSafari
        ? createUnsupportedRoutingAdapter()
        : createChromiumRoutingAdapter());

  // One apply at a time, in arrival order — a stale apply must never
  // overwrite a newer verdict's browser config.
  let applyTail: Promise<void> = Promise.resolve();

  function handleStateFrame(frame: ProxyRoutingStateMessage, send: (data: Record<string, unknown>) => boolean): void {
    const state = parseStateMessage(frame);
    if (state === null) return;
    applyTail = applyTail.then(async () => {
      if (disposed) return;
      await hydrated;
      current = state;
      await saveState(state).catch(() => {});
      const result = await adapter.apply(state).catch((err: unknown) => ({
        applied: false,
        error: err instanceof Error ? err.message : String(err),
      }));
      if (disposed) return;
      if (!result.applied && result.error !== undefined) {
        logger.warn(SCOPE, `routing apply failed: ${result.error}`);
      }
      send({
        type: PROXY_ROUTING_ACK_TYPE,
        applied: result.applied,
        mode: adapter.mode,
        ...(result.error !== undefined ? { error: result.error } : {}),
      });
    });
  }

  const unregisterInbound = registerInbound((frame, wire) => {
    if (!frame || typeof frame !== 'object') return false;
    const type = (frame as { type?: unknown }).type;
    if (type !== PROXY_ROUTING_STATE_TYPE) return false;
    // Same-device wires only — claimed and dropped otherwise.
    if (wire.isLoopback()) handleStateFrame(frame as ProxyRoutingStateMessage, (data) => wire.send(data));
    return true;
  });

  // Pull the current state on every wire already up — the cold-start
  // closer; later reconnects are covered by the daemon's connect push.
  for (const wire of listWires()) {
    if (wire.isLoopback()) wire.send({ type: PROXY_ROUTING_HELLO_TYPE });
  }

  return {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      unregisterInbound();
    },
  };
}
