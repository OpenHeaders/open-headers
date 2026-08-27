/**
 * MQTT byte-stream transport seam — the host-specific port the
 * host-neutral MQTT session executor calls out to for one live
 * session. A deliberate SIBLING of the frame-shaped {@link WsTransport}
 * (never an extension of it): MQTT speaks a raw BYTE stream — packets
 * span TCP chunks, and WebSocket frame boundaries do not delimit them
 * either — so the seam carries bytes and nothing else. The transport
 * is protocol-blind by construction: every MQTT packet is encoded and
 * decoded executor-side by `@openheaders/core/mqtt`, and the same
 * incremental stream decoder runs over both wire families (the
 * ratified fork-3 posture).
 *
 * The transport owns the platform socket ceremony for the scheme the
 * URL carries: mqtt(s):// dials `node:net`/`node:tls` on node hosts
 * (TLS verification policy, the connect deadline, dial-error truth
 * captured at the socket), ws(s):// rides the platform WebSocket stack
 * with the `mqtt` subprotocol and binary frames. Same seam discipline
 * as the siblings: plain data in both directions, so the contract
 * holds whether the transport is in-process or behind a forwarding
 * wire later.
 */

import type { WsProxyRoute } from '../ws-exec/transport';

export interface MqttTransportRequest {
  /** Full session URL — `mqtt://`, `mqtts://`, `ws://` or `wss://`;
   *  the scheme picks the wire family. */
  url: string;
  /** Verify the broker certificate against the system roots. Absent =
   *  verify (the safe default); `false` accepts self-signed brokers.
   *  Meaningful for `mqtts:` and `wss:`. */
  sslVerification?: boolean;
  /** Workspace trusted roots (PEM), appended behind the runtime bundle
   *  on the TLS dial — see the HTTP transport's `trustedRootsPem`. */
  trustedRootsPem?: string[];
  /**
   * Dial deadline (ms): the connection (TCP connect + TLS handshake,
   * or the WebSocket upgrade) must establish inside it or the attempt
   * aborts with a classified error. An OPEN session has no ceiling —
   * it lives until a close, Stop, or Disconnect. The CONNECT/CONNACK
   * exchange above the byte stream is the EXECUTOR's concern.
   */
  timeoutMs?: number;
  /** Vault `client-certificate` entry NAME the request asks to present
   *  (mqtts/wss). Always passes through when set — even unresolved —
   *  so the host fails the dial loudly instead of silently connecting
   *  without a certificate; the PEM pair rides only when the entry
   *  resolved on this device. */
  clientCertificateRef?: string;
  clientCertificatePem?: string;
  clientCertificateKeyPem?: string;
  clientCertificatePassphrase?: string;
  /** SNI server name for `mqtts:` dials. Absent = the URL host. */
  sniServerName?: string;
  /** ALPN protocol offered on `mqtts:` dials. Absent = no offer. */
  alpnProtocol?: string;
}

/**
 * Thrown (via `onEnd`) when the byte stream never established —
 * DNS/connect failure, TLS handshake, upgrade rejection, dial
 * deadline. `message` is the host's classified, user-actionable
 * string — the executor surfaces it verbatim on the snapshot's
 * `error` (unless a CONNACK refusal already told a better story).
 */
export class MqttTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MqttTransportError';
  }
}

/**
 * Observer for one session's byte stream, plain data per callback.
 * Delivery discipline: `onConnect` at most once (the byte stream is
 * up — the executor sends CONNECT then), then `onData` per wire chunk
 * IN ORDER (chunk boundaries carry no meaning — the executor's
 * incremental decoder reassembles packets), and `onEnd` EXACTLY once
 * on every path — remote close, local close, abort, deadline, severed
 * connection. An `onEnd` without a prior `onConnect` carries the
 * classified dial failure.
 */
export interface MqttStreamCallbacks {
  /** `proxyRoute` rides along when the transport's host decided an
   *  egress route (ws-scheme dials consult the system plane; raw tcp
   *  dials are direct in v1 and omit it). */
  onConnect(proxyRoute?: WsProxyRoute): void;
  onData(chunk: Uint8Array): void;
  onEnd(error?: MqttTransportError): void;
}

/**
 * The client side of an established byte stream. Writes after close
 * are quiet no-ops — the executor's registry unregisters on settle,
 * so a late rider already answers "no such session".
 */
export interface MqttStreamWriter {
  /** Write wire bytes verbatim, in call order. */
  write(bytes: Uint8Array): void;
  /** Close the stream gracefully after pending writes flush — the
   *  clean Disconnect's tail (DISCONNECT bytes written first). */
  end(): void;
}

export interface MqttByteTransport {
  /**
   * Open one byte stream. `signal` aborts it at any point (the Stop
   * hook): before the stream establishes it settles through `onEnd`
   * with a classified error; after `onConnect` it tears the socket
   * down and still settles through `onEnd()` with no error, so the
   * executor records what arrived.
   */
  connect(request: MqttTransportRequest, callbacks: MqttStreamCallbacks, signal?: AbortSignal): MqttStreamWriter;
}
