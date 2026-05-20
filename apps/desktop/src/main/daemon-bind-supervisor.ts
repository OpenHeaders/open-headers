/**
 * Desktop daemon WS-bind supervisor — Phase U3.1
 * (`UNIFIED_ORACLE_MODEL.md` §4.2 / `DATA_PLANE_TOPOLOGIES.md` §11.4).
 *
 * Owns the {@link OracleWsServer} handle and reacts to the user-controlled
 * `backend.bindAddress` setting (`'127.0.0.1'` by default, `'0.0.0.0'`
 * when the "Allow LAN peers" toggle is on). On change, tears the
 * server down and starts a fresh one on the new bind — no app restart.
 *
 * The bind only controls reachability, not auth: the ws-server decides
 * `evaluateHello`'s `requireAuth` per-connection from each socket's
 * remote address, so a `0.0.0.0` bind still serves same-machine
 * loopback clients trust-by-process and gates only LAN peers. The
 * supervisor doesn't read or enforce auth itself — it only owns the
 * lifecycle so the rest of the wire (handshake, forwarder, broadcasts)
 * always sees a single up-to-date `OracleWsServer` reference.
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import { hostStorage, OH } from '@openheaders/core/storage';
import {
  type OracleWsServer,
  type OracleWsServerOptions,
  startOracleWsServer,
} from '@openheaders/oracle/host-runtime/ws-server';

const SCOPE = 'DaemonBindSupervisor';

const LOOPBACK: BindAddress = '127.0.0.1';
const ALL_INTERFACES: BindAddress = '0.0.0.0';

type BindAddress = '127.0.0.1' | '0.0.0.0';

interface SupervisorOptions {
  /** Identity announced in WELCOME frames; passes straight through to `startOracleWsServer`. */
  handshakeIdentity: OracleWsServerOptions['handshakeIdentity'];
  /**
   * Optional sibling HTTP handler — invoked on every non-upgrade
   * request that hits the bound socket. Passes straight through to
   * `startOracleWsServer`; the supervisor owns the lifecycle but does
   * not interpret the handler. Used by the U3.3 pairing surface.
   */
  httpRequestHandler?: OracleWsServerOptions['httpRequestHandler'];
  /**
   * Receives every up-to-date server handle (or null while a rebind is
   * in flight). Wires onto `setMutationForwarderWsServer` and the
   * boot-wiring's local `wsServer` reference.
   */
  onServerChange: (server: OracleWsServer | null) => void;
}

export interface DaemonBindSupervisor {
  /** Stop reacting to setting changes and close the current server. */
  dispose(): Promise<void>;
}

function readBindAddressFromSettings(values: Record<string, unknown> | undefined): BindAddress {
  const raw = values?.['backend.bindAddress'];
  return raw === ALL_INTERFACES ? ALL_INTERFACES : LOOPBACK;
}

/**
 * Start the WS server, subscribe to `backend.bindAddress` changes, and
 * rebind in place whenever it flips. Resolves once the initial bind is
 * listening; later rebinds are serialized through an internal queue so
 * a rapid toggle can't race two `startOracleWsServer` calls onto the
 * same port.
 */
export async function startDaemonBindSupervisor(options: SupervisorOptions): Promise<DaemonBindSupervisor> {
  const initialSettings = (await hostStorage.get(OH.settingsUser)) ?? {};
  let desiredBind: BindAddress = readBindAddressFromSettings(initialSettings);
  let currentBind: BindAddress | null = null;
  let currentServer: OracleWsServer | null = null;
  let inflight: Promise<void> = Promise.resolve();
  let disposed = false;

  function setServer(next: OracleWsServer | null): void {
    currentServer = next;
    options.onServerChange(next);
  }

  async function reconcile(): Promise<void> {
    if (disposed) return;
    if (currentBind === desiredBind && currentServer) return;
    const target = desiredBind;
    if (currentServer) {
      logger.info(SCOPE, `rebinding from ${currentBind} → ${target}`);
      const closing = currentServer;
      setServer(null);
      try {
        await closing.close();
      } catch (err) {
        logger.warn(SCOPE, 'previous server close failed; continuing with rebind', err);
      }
    }
    if (disposed) return;
    try {
      const next = await startOracleWsServer({
        host: target,
        handshakeIdentity: options.handshakeIdentity,
        httpRequestHandler: options.httpRequestHandler,
      });
      if (disposed) {
        await next.close().catch(() => undefined);
        return;
      }
      currentBind = target;
      setServer(next);
      // If the desired bind flipped again while we were starting, fall
      // through one more reconcile pass so the user-visible state always
      // converges to whatever the setting says now.
      if (desiredBind !== currentBind) {
        await reconcile();
      }
    } catch (err) {
      logger.error(SCOPE, `failed to bind on ${target}; daemon is offline until the setting is corrected`, err);
      currentBind = null;
      setServer(null);
    }
  }

  function schedule(): void {
    inflight = inflight.catch(() => undefined).then(() => reconcile());
  }

  const unsubscribe = hostStorage.subscribe(OH.settingsUser, (next) => {
    const nextBind = readBindAddressFromSettings(next);
    if (nextBind === desiredBind) return;
    desiredBind = nextBind;
    schedule();
  });

  schedule();
  await inflight;

  return {
    async dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      // Drain whatever rebind is in flight before tearing the final
      // server down, so we don't race a half-started server into a
      // dangling listening socket.
      await inflight.catch(() => undefined);
      if (currentServer) {
        const closing = currentServer;
        setServer(null);
        await closing.close().catch(() => undefined);
      }
    },
  };
}
