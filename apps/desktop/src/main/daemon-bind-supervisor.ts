/**
 * Desktop daemon WS-bind supervisor — Phase U3.1
 * (`UNIFIED_ORACLE_MODEL.md` §4.2 / `DATA_PLANE_TOPOLOGIES.md` §11.4).
 *
 * Owns the {@link OracleWsServer} handle and reacts to the user-controlled
 * `backend.bindAddress` setting (`'127.0.0.1'` by default, `'0.0.0.0'`
 * when the "Allow LAN peers" toggle is on). On change, tears the
 * server down and starts a fresh one on the new bind — no app restart.
 *
 * The bind only controls reachability, not auth: the ws-server requires
 * a paired token on every connection regardless of bind or remote
 * address (loopback included — trust-by-process is not a sound floor on
 * a shared box). The supervisor doesn't read or enforce auth itself — it
 * only owns the lifecycle so the rest of the wire (handshake, forwarder,
 * broadcasts) always sees a single up-to-date `OracleWsServer` reference.
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import { hostStorage, OH } from '@openheaders/core/storage';
import {
  type OracleWsServer,
  type OracleWsServerOptions,
  startOracleWsServer,
} from '@openheaders/oracle-host-node/host-runtime/ws-server';

const SCOPE = 'DaemonBindSupervisor';

const LOOPBACK: BindAddress = '127.0.0.1';
const ALL_INTERFACES: BindAddress = '0.0.0.0';

type BindAddress = '127.0.0.1' | '0.0.0.0';

/**
 * Bind lifecycle transition reported through {@link SupervisorOptions.onBindStateChange}.
 * Distinct from {@link SupervisorOptions.onServerChange}, which only
 * carries the server handle: `onServerChange(null)` fires both during a
 * healthy rebind (transient) and on a terminal bind failure, so it can't
 * tell a status reporter which one happened. This signal disambiguates:
 *
 *   - `binding` — a bind attempt is in flight (initial boot or a rebind
 *     after the `backend.bindAddress` setting flipped).
 *   - `bound`   — the socket is listening on `host`.
 *   - `failed`  — the bind threw (port held by another instance / process);
 *     the daemon stays offline until the setting changes and a new bind
 *     is attempted. `error` carries the underlying cause for diagnostics.
 */
export type DaemonBindState =
  | { kind: 'binding'; host: BindAddress }
  | { kind: 'bound'; host: BindAddress }
  | { kind: 'failed'; host: BindAddress; error: unknown };

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
  /**
   * Receives every bind lifecycle transition. Unlike `onServerChange`,
   * this distinguishes a transient rebind from a terminal failure so a
   * status reporter can show "reconnecting" vs "offline" correctly.
   * Optional — callers that only need the server handle can omit it.
   */
  onBindStateChange?: (state: DaemonBindState) => void;
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

  function emitBindState(state: DaemonBindState): void {
    options.onBindStateChange?.(state);
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
    emitBindState({ kind: 'binding', host: target });
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
      emitBindState({ kind: 'bound', host: target });
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
      emitBindState({ kind: 'failed', host: target, error: err });
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
