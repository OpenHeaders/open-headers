/**
 * Connection dialing for the node transport — the hand-rolled connector
 * behind `captureNetwork` instrumentation and the pinned-HTTP/2 ALPN
 * offer, plus a light recording wrap of undici's own connector for the
 * always-on negotiated-protocol report.
 *
 * undici exposes no per-request socket timings on either result
 * surface, and its `diagnostics_channel` events carry no per-send
 * correlation (probed on 7.24.6) — but an `Agent` minted for exactly
 * one send makes correlation trivial: every connection its connector
 * dials belongs to that send. The connector here mirrors undici's own
 * (`lib/core/connect.js`) for the option set the transport uses —
 * `tls.connect` / `net.connect` with servername, ALPN, socket path,
 * keep-alive, no-delay, and a connect timeout — minus the TLS session
 * cache (a send-local agent never re-dials the same origin) and the
 * `httpSocket` upgrade seat (proxied sends never take this path).
 *
 * The same connector also carries the `'2'`-pinned dial: undici's
 * `buildConnector` hard-codes its ALPN list from `allowH2`, so an
 * h2-ONLY offer needs this hand-rolled dial. A pinned dial that
 * negotiates anything but h2 is destroyed and fails the send — the
 * seam's contract is honest failure, never a silent downgrade — and a
 * cleartext dial under the pin fails outright (no ALPN without TLS).
 *
 * What the instrumentation observes per connection, straight off the
 * socket's own lifecycle events:
 *   - `'lookup'`        → DNS resolution done (absent for IP literals
 *                          and socket-path dials, which resolve nothing)
 *   - `'connect'`       → TCP established
 *   - `'secureConnect'` → TLS handshake done (TLS dials only)
 * plus, at readiness: the negotiated `alpnProtocol` and the socket's
 * local/remote endpoints. A TLSSocket extends `net.Socket` and dials
 * TCP itself when not handed an existing socket, so all three events
 * fire on the one object.
 *
 * The instrumented agent trades pooling for observability — the
 * executor opts in per interactive send only, and the transport closes
 * the agent when the send settles. Shared agents keep pooling: pinned
 * ones ride {@link createDialConnector} with an `onConnection` sink,
 * unpinned ones ride {@link createRecordingConnector}, which keeps
 * undici's connector (TLS session cache included) and only reads the
 * ready socket's negotiated protocol.
 */

import * as net from 'node:net';
import { isIP } from 'node:net';
import * as tls from 'node:tls';
import { Agent, buildConnector, errors } from 'undici';
import { dialConnectTunnel, type ProxyTunnel } from './request-transport/connect-tunnel';
import type { ConnectOptions } from './request-transport/seam';

/** Marks + facts for one dialed connection, `performance.now()` clock
 *  (the transport's phase-mark clock). */
export interface ConnectionRecord {
  /** `hostname:port` as dialed — matched against the final hop's URL
   *  to attribute the facts. Socket-path dials record the path. */
  origin: string;
  tlsUsed: boolean;
  startAt: number;
  dnsEndAt?: number;
  tcpEndAt?: number;
  /** Socket ready (TLS handshake done, or TCP established for
   *  cleartext). Absent when the dial failed. */
  readyAt?: number;
  /** Negotiated ALPN protocol (`'h2'` / `'http/1.1'`). Cleartext dials
   *  report `'http/1.1'` — the only protocol undici fetch speaks
   *  without TLS. */
  alpnProtocol?: string;
  localAddress?: string;
  localPort?: number;
  remoteAddress?: string;
  remotePort?: number;
}

/**
 * How a dial offers and enforces the HTTP version — derived from the
 * seam's `httpVersion` knob by the transport (`httpVersionPolicy`).
 * `alpnProtocols` is the TLS offer; `pinH2` marks the `'2'` pin, under
 * which a non-h2 negotiation (or a cleartext dial) fails the dial.
 */
export interface AlpnPolicy {
  alpnProtocols: string[];
  pinH2: boolean;
}

export interface InstrumentedDial {
  agent: Agent;
  /** Every connection the agent dialed, in dial order. */
  connections: ConnectionRecord[];
}

/** undici's connect-timeout default, mirrored. */
const CONNECT_TIMEOUT_MS = 10_000;

type Connector = ReturnType<typeof buildConnector>;
type ConnectorCallback = Parameters<Connector>[1];

/** Code carried by a pinned dial's honest failure — the transport's
 *  error classifier names the HTTP version setting when it sees it. */
export const H2_NOT_NEGOTIATED_CODE = 'OH_ERR_H2_NOT_NEGOTIATED';

function h2NotNegotiatedError(message: string): Error {
  return Object.assign(new Error(message), { code: H2_NOT_NEGOTIATED_CODE });
}

/** SNI servername for a dial — the URL's hostname unless it's an IP
 *  literal (RFC 6066 forbids IPs in SNI; Node warns and ignores). */
export function servernameFor(hostname: string): string | undefined {
  return isIP(hostname) === 0 ? hostname : undefined;
}

/**
 * The hand-rolled dial. `connect` is the same option bag the shared
 * dispatcher path builds (`connectOptionsFor`), so every per-request
 * connection knob — TLS window, ciphers, pinned lookup, client
 * certificate, socket path — rides the dial unchanged. Every
 * connection's lifecycle lands in a {@link ConnectionRecord} handed to
 * `onConnection` AT DIAL START (marks fill in as the socket
 * progresses), and a `pinH2` dial that can't negotiate h2 fails with
 * {@link H2_NOT_NEGOTIATED_CODE} instead of proceeding.
 *
 * With `proxy` set the dial rides the shared CONNECT tunnel
 * (`dialConnectTunnel`): the tunnel opens first, then the SAME
 * target-leg TLS — connection policy, servername, and the pinned ALPN
 * offer intact — wraps the tunnel socket, so the pin stays enforced by
 * this dial's own handshake, never delegated to a proxy agent's
 * connector.
 */
export function createDialConnector(
  connect: ConnectOptions,
  alpn: AlpnPolicy,
  onConnection: (record: ConnectionRecord) => void,
  onReady?: (record: ConnectionRecord) => void,
  proxy?: ProxyTunnel,
): Connector {
  const { socketPath, lookup, ...tlsOpts } = connect;

  return ((opts, callback: ConnectorCallback) => {
    const { hostname, protocol, port } = opts;
    const secure = protocol === 'https:';
    const targetPort = port !== undefined && port !== '' ? Number(port) : secure ? 443 : 80;
    const record: ConnectionRecord = {
      origin: socketPath ?? `${hostname}:${targetPort}`,
      tlsUsed: secure,
      startAt: performance.now(),
    };
    onConnection(record);

    if (!secure && alpn.pinH2) {
      // No TLS, no ALPN — a cleartext hop can never NEGOTIATE the
      // pinned h2 (ALPN is a TLS extension), so fail the dial instead
      // of speaking http/1.1. Cleartext h2 exists only as
      // prior-knowledge framing, which is its own knob value.
      callback(
        h2NotNegotiatedError(
          `Plain http:// target ${record.origin} cannot negotiate HTTP/2 — ALPN needs a TLS connection. For cleartext HTTP/2, pick "HTTP/2 (prior knowledge)".`,
        ),
        null,
      );
      return;
    }

    let settled = false;
    const fail = (err: Error): void => {
      if (!settled) {
        settled = true;
        callback(err, null);
      }
    };

    const markReady = (socket: net.Socket | tls.TLSSocket, negotiated: string): void => {
      record.readyAt = performance.now();
      record.alpnProtocol = negotiated;
      if (socket.localAddress !== undefined) record.localAddress = socket.localAddress;
      if (socket.localPort !== undefined) record.localPort = socket.localPort;
      if (socket.remoteAddress !== undefined) record.remoteAddress = socket.remoteAddress;
      if (socket.remotePort !== undefined) record.remotePort = socket.remotePort;
      onReady?.(record);
      if (!settled) {
        settled = true;
        callback(null, socket);
      }
    };

    // Shared readiness/error handling for a dialing socket — direct or
    // the target-leg TLS wrap over an established tunnel.
    const establish = (socket: net.Socket | tls.TLSSocket): void => {
      socket.setKeepAlive(true, 60_000);
      socket.setNoDelay(true);

      socket.once('lookup', () => {
        record.dnsEndAt = performance.now();
      });
      socket.once('connect', () => {
        record.tcpEndAt = performance.now();
      });

      const timeout = setTimeout(() => {
        socket.destroy(new errors.ConnectTimeoutError(`Connect Timeout Error (attempted address: ${record.origin})`));
      }, CONNECT_TIMEOUT_MS);

      socket.once(secure ? 'secureConnect' : 'connect', () => {
        clearTimeout(timeout);
        const alpnRaw = secure ? (socket as tls.TLSSocket).alpnProtocol : null;
        // A TLS server that negotiated no ALPN speaks HTTP/1.1 — the
        // same assumption undici's h1 client makes.
        const negotiated = typeof alpnRaw === 'string' && alpnRaw !== '' ? alpnRaw : 'http/1.1';
        if (secure && alpn.pinH2 && negotiated !== 'h2') {
          // The pinned offer was h2-only; a server that ignored ALPN and
          // carried on speaks http/1.1 here — honoring that would be the
          // silent downgrade the pin forbids.
          socket.destroy();
          fail(h2NotNegotiatedError(`${record.origin} negotiated ${negotiated} instead of the pinned HTTP/2.`));
          return;
        }
        markReady(socket, negotiated);
      });
      socket.once('error', (err) => {
        clearTimeout(timeout);
        fail(err);
      });
    };

    if (proxy !== undefined) {
      dialConnectTunnel({ hostname, port: targetPort }, { proxy })
        .then((tunnel) => {
          record.tcpEndAt = performance.now();
          if (!secure) {
            // The tunnel socket IS the connection for a cleartext
            // target — it already connected, so readiness is now.
            markReady(tunnel, 'http/1.1');
            return;
          }
          establish(
            tls.connect({
              ...tlsOpts,
              socket: tunnel,
              servername: servernameFor(hostname),
              ALPNProtocols: alpn.alpnProtocols,
            }),
          );
        })
        .catch((err: unknown) => fail(err instanceof Error ? err : new Error(String(err))));
      return;
    }

    if (secure) {
      establish(
        tls.connect({
          ...tlsOpts,
          ...(lookup !== undefined ? { lookup } : {}),
          ...(socketPath !== undefined ? { path: socketPath } : {}),
          servername: servernameFor(hostname),
          ALPNProtocols: alpn.alpnProtocols,
          port: targetPort,
          host: hostname,
        }),
      );
    } else {
      establish(
        net.connect({
          ...(lookup !== undefined ? { lookup } : {}),
          ...(socketPath !== undefined ? { path: socketPath } : {}),
          port: targetPort,
          host: hostname,
        }),
      );
    }
  }) as Connector;
}

/**
 * Wrap undici's own `buildConnector` so every READY socket reports its
 * negotiated protocol into `onAlpn`, keyed by the dialed origin — the
 * always-on protocol report for shared, unpinned agents. undici's
 * connector keeps its TLS session cache and full option handling; the
 * wrap only observes the callback. Cleartext sockets report
 * `'http/1.1'` (the only protocol undici fetch speaks without TLS),
 * matching the instrumented dial's convention.
 */
export function createRecordingConnector(
  connect: ConnectOptions & { allowH2?: boolean },
  onAlpn: (origin: string, alpnProtocol: string) => void,
): Connector {
  const inner = buildConnector(connect);
  return ((opts, callback: ConnectorCallback) => {
    const { hostname, protocol, port } = opts;
    const secure = protocol === 'https:';
    const origin = connect.socketPath ?? `${hostname}:${port || (secure ? 443 : 80)}`;
    inner(opts, (err: Error | null, socket: net.Socket | tls.TLSSocket | null) => {
      if (err !== null || socket === null) {
        callback(err ?? new Error('Connector yielded neither a socket nor an error.'), null);
        return;
      }
      const alpnRaw = socket instanceof tls.TLSSocket ? socket.alpnProtocol : null;
      onAlpn(origin, typeof alpnRaw === 'string' && alpnRaw !== '' ? alpnRaw : 'http/1.1');
      callback(null, socket);
    });
  }) as Connector;
}

/**
 * Mint the send-local instrumented agent for `captureNetwork` sends —
 * {@link createDialConnector} with the records collected per send. The
 * agent's h2 seat follows the offer: it speaks h2 whenever the dial
 * may negotiate it.
 */
export function createInstrumentedDial(connect: ConnectOptions, alpn: AlpnPolicy): InstrumentedDial {
  const connections: ConnectionRecord[] = [];
  const connector = createDialConnector(connect, alpn, (record) => connections.push(record));
  const allowH2 = alpn.alpnProtocols.includes('h2');
  return { agent: new Agent({ connect: connector, ...(allowH2 ? { allowH2: true } : {}) }), connections };
}
