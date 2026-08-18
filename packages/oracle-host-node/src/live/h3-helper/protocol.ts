/**
 * The framed stdio protocol's TypeScript twin — frame type ids and
 * control payload shapes. The contract is
 * the request-engine H3-protocol design; the Rust twin is
 * `native/h3-helper/src/protocol.rs`. Any wire-shape change bumps
 * {@link H3_PROTOCOL_VERSION} on both sides — no negotiation, both
 * sides ship from one repo.
 */

export const H3_PROTOCOL_VERSION = 3;

/** The `'3'` pipeline's entire legal cipher vocabulary — QUIC is TLS
 *  1.3-only and the helper's provider carries exactly these three
 *  suites, so the pre-wire gate admits these IANA names and nothing
 *  else (no OpenSSL-format lists, no other TLS 1.3 names). */
export const H3_TLS13_CIPHER_SUITES = [
  'TLS_AES_128_GCM_SHA256',
  'TLS_AES_256_GCM_SHA384',
  'TLS_CHACHA20_POLY1305_SHA256',
] as const;

export const H3_FRAME = {
  HELLO: 0x01,
  REQUEST: 0x10,
  REQUEST_BODY: 0x11,
  REQUEST_END: 0x12,
  CANCEL: 0x1f,
  RESPONSE_HEAD: 0x20,
  RESPONSE_BODY: 0x21,
  RESPONSE_TRAILERS: 0x22,
  RESPONSE_END: 0x23,
  ERROR: 0x2e,
} as const;

export type H3HeaderPair = [name: string, value: string];

export interface H3Hello {
  protocol: number;
  helper: string;
}

export interface H3ClientCert {
  certPem: string;
  /** PKCS#8 PEM, already decrypted node-side — a passphrase never
   *  crosses the protocol (rustls cannot decrypt encrypted PEM). */
  keyPem: string;
}

export interface H3RequestHead {
  /** https:// only — the transport guards cleartext pre-wire. */
  url: string;
  method: string;
  /** User-set Host header, already folded out of `headers` — overrides
   *  the URL's host as `:authority` (the h2 pipeline's contract). */
  authority?: string;
  /** Wire order, repeats allowed; connection-specific fields already
   *  stripped node-side (the h2 hygiene rule). */
  headers: H3HeaderPair[];
  /** Announced body length. 0 = the head is complete by itself;
   *  otherwise REQUEST_BODY frames totalling exactly this, then
   *  REQUEST_END. */
  bodyBytes: number;
  /** `sslVerification: false` — the helper accepts any certificate. */
  insecure?: true;
  clientCert?: H3ClientCert;
  /** resolveToAddress pin — the helper dials this IP; SNI and
   *  certificate verification keep the URL's host. */
  connectAddress?: string;
  /** TLS 1.3 IANA suite names restricting the handshake's offer —
   *  members of {@link H3_TLS13_CIPHER_SUITES} only, gated pre-wire. */
  cipherSuites?: string[];
  /** QUIC max-idle ceiling; helper default 30 000. */
  idleTimeoutMs?: number;
  /** `captureNetwork` (v3) — the helper dials a fresh instrumented
   *  connection (never a pooled one) and reports its socket facts +
   *  dial timings on RESPONSE_HEAD. */
  captureNetwork?: true;
}

/** Endpoints of the instrumented dial's socket (v3) — the UDP socket
 *  the QUIC connection rides. */
export interface H3SocketFacts {
  localAddress: string;
  localPort: number;
  remoteAddress: string;
  remotePort: number;
}

/** Phase durations of the instrumented dial (v3). QUIC merges
 *  transport establishment and TLS into ONE handshake, so there is no
 *  TCP-connect leg — `handshakeMs` is the whole of it. */
export interface H3DialTimings {
  /** Absent when `connectAddress` pinned the dial — nothing resolved. */
  dnsMs?: number;
  handshakeMs: number;
}

export interface H3ResponseHead {
  status: number;
  headers: H3HeaderPair[];
  /** v3, present only on a `captureNetwork` head's instrumented dial. */
  socket?: H3SocketFacts;
  /** v3, present only on a `captureNetwork` head's instrumented dial. */
  timings?: H3DialTimings;
}

/** Helper-side codes are a closed set per protocol version; the node
 *  classifier maps them and falls back generically on any it doesn't
 *  know (forward-compatibility across a version bump in dev). */
export interface H3ErrorFrame {
  code: string;
  message: string;
}
