/**
 * Daemon WS-bind supervisor — Phase U3.1
 * (`UNIFIED_ORACLE_MODEL.md` §4.2 / `DATA_PLANE_TOPOLOGIES.md` §11.4).
 *
 * Owns the {@link OracleWsServer} handle and reacts to the user-controlled
 * `backend.bindAddress` setting (`'127.0.0.1'` by default, `'0.0.0.0'`
 * when the "Allow LAN peers" toggle is on) and `backend.bindPort`
 * (`WS_PORT` by default). On either change, tears the server down and
 * starts a fresh one on the new host:port bind — no app restart.
 *
 * The bind only controls reachability, not auth: the ws-server requires
 * a paired token on every connection regardless of bind or remote
 * address (loopback included — trust-by-process is not a sound floor on
 * a shared box). The supervisor doesn't read or enforce auth itself — it
 * only owns the lifecycle so the rest of the wire (handshake, forwarder,
 * broadcasts) always sees a single up-to-date `OracleWsServer` reference.
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import { WS_PORT } from '@openheaders/core/protocol';
import { hostStorage, OH } from '@openheaders/core/storage';
import { validatePort } from '@openheaders/core/utils';
import { type OracleWsServer, type OracleWsServerOptions, startOracleWsServer } from '../host-runtime/ws-server';

const SCOPE = 'DaemonBindSupervisor';

const LOOPBACK: BindAddress = '127.0.0.1';
const ALL_INTERFACES: BindAddress = '0.0.0.0';

type BindAddress = '127.0.0.1' | '0.0.0.0';

/** The full bind target — address (who can reach) + port (where). */
interface BindTarget {
  host: BindAddress;
  port: number;
}

function bindTargetsEqual(a: BindTarget, b: BindTarget): boolean {
  return a.host === b.host && a.port === b.port;
}

function describeBind(target: BindTarget | null): string {
  return target ? `${target.host}:${target.port}` : 'none';
}

/**
 * Bind lifecycle transition reported through {@link SupervisorOptions.onBindStateChange}.
 * Distinct from {@link SupervisorOptions.onServerChange}, which only
 * carries the server handle: `onServerChange(null)` fires both during a
 * healthy rebind (transient) and on a terminal bind failure, so it can't
 * tell a status reporter which one happened. This signal disambiguates:
 *
 *   - `binding` — a bind attempt is in flight (initial boot or a rebind
 *     after the `backend.bindAddress` / `backend.bindPort` setting changed).
 *   - `bound`   — the socket is listening on `host:port`.
 *   - `failed`  — the bind threw (port held by another instance / process);
 *     the daemon stays offline until the setting changes and a new bind
 *     is attempted. `error` carries the underlying cause for diagnostics.
 */
export type DaemonBindState =
  | { kind: 'binding'; host: BindAddress; port: number }
  | { kind: 'bound'; host: BindAddress; port: number }
  | { kind: 'failed'; host: BindAddress; port: number; error: unknown };

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
   * Optional admission seam (Phase 3) — Origin/Host matrix + brute-force
   * limiter applied to every WS upgrade. Passes straight through to
   * `startOracleWsServer` on every bind the supervisor opens.
   */
  admission?: OracleWsServerOptions['admission'];
  /**
   * Optional peer-facing RPC seam (admin-console slice). Passes straight
   * through to `startOracleWsServer` on every bind the supervisor opens.
   */
  peerRpc?: OracleWsServerOptions['peerRpc'];
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

function readBindTargetFromSettings(values: Record<string, unknown> | undefined): BindTarget {
  const rawHost = values?.['backend.bindAddress'];
  const host: BindAddress = rawHost === ALL_INTERFACES ? ALL_INTERFACES : LOOPBACK;
  return { host, port: readBindPortFromSettings(values) };
}

/**
 * The user-chosen daemon port, falling back to {@link WS_PORT} when the
 * stored value is absent or unbindable. A `reject`-level verdict
 * (privileged / out-of-range) can only reach storage via an imported
 * config the UI never validated, so the supervisor refuses it rather
 * than throwing EADDRINUSE/EACCES at bind time; an ephemeral-range
 * `warn` port is risky but bindable, so it's honored.
 */
function readBindPortFromSettings(values: Record<string, unknown> | undefined): number {
  const raw = values?.['backend.bindPort'];
  if (typeof raw !== 'number' || validatePort(raw).level === 'reject') return WS_PORT;
  return raw;
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
  let desiredBind: BindTarget = readBindTargetFromSettings(initialSettings);
  let currentBind: BindTarget | null = null;
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
    if (currentBind && bindTargetsEqual(currentBind, desiredBind) && currentServer) return;
    const target = desiredBind;
    if (currentServer) {
      logger.info(SCOPE, `rebinding from ${describeBind(currentBind)} → ${describeBind(target)}`);
      const closing = currentServer;
      setServer(null);
      try {
        await closing.close();
      } catch (err) {
        logger.warn(SCOPE, 'previous server close failed; continuing with rebind', err);
      }
    }
    if (disposed) return;
    emitBindState({ kind: 'binding', host: target.host, port: target.port });
    try {
      const next = await startOracleWsServer({
        host: target.host,
        port: target.port,
        handshakeIdentity: options.handshakeIdentity,
        httpRequestHandler: options.httpRequestHandler,
        admission: options.admission,
        peerRpc: options.peerRpc,
      });
      if (disposed) {
        await next.close().catch(() => undefined);
        return;
      }
      currentBind = target;
      setServer(next);
      emitBindState({ kind: 'bound', host: target.host, port: target.port });
      // If the desired bind flipped again while we were starting, fall
      // through one more reconcile pass so the user-visible state always
      // converges to whatever the setting says now.
      if (!bindTargetsEqual(desiredBind, target)) {
        await reconcile();
      }
    } catch (err) {
      logger.error(
        SCOPE,
        `failed to bind on ${describeBind(target)}; daemon is offline until the setting is corrected`,
        err,
      );
      currentBind = null;
      setServer(null);
      emitBindState({ kind: 'failed', host: target.host, port: target.port, error: err });
    }
  }

  function schedule(): void {
    inflight = inflight.catch(() => undefined).then(() => reconcile());
  }

  const unsubscribe = hostStorage.subscribe(OH.settingsUser, (next) => {
    const nextBind = readBindTargetFromSettings(next);
    if (bindTargetsEqual(nextBind, desiredBind)) return;
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
