/**
 * Request transport seam — the one host-specific port the host-neutral
 * chain request executor calls out to for the actual network round-trip.
 *
 * The seam carries ONLY plain data in both directions: a normalized
 * {@link TransportRequest} in, a {@link TransportResponse} out (or a
 * {@link TransportError} thrown). It never traffics platform fetch
 * objects (`Request` / `Response` / `RequestInit` / `Headers` /
 * `FormData`). Two reasons:
 *
 *   1. **Type isolation.** `@openheaders/oracle` compiles under the
 *      `node` lib; the browser SW under the DOM lib. A `Response` that
 *      crossed the seam would be a different nominal type on each side.
 *      Plain records unify cleanly.
 *   2. **Out-of-process survival.** When the engine later runs in a
 *      daemon / remote VM (see the public/private split), the transport
 *      becomes the host's local network capability — each host owns its
 *      own `fetch`. A data-only seam is the same contract whether the
 *      transport is in-process or behind an RPC.
 *
 * Body construction (URLSearchParams / FormData / raw string), the
 * offline pre-flight, host-access gating, and error classification are
 * all the transport's concern — they differ per host (the browser SW
 * gets `navigator.onLine` + `chrome.permissions`; Node gets a richer
 * `err.cause` it can classify precisely). The executor stays blind to
 * all of it.
 */

/** A single header on the wire. Repeated keys are allowed (the host
 *  appends them in order). */
export interface TransportHeader {
  key: string;
  value: string;
}

/**
 * Normalized request body. The executor resolves the domain
 * `RequestBody` union down to this wire shape — including reading file
 * blobs to bytes — so the transport only has to materialize host fetch
 * primitives from plain data.
 */
export type TransportBody =
  | { kind: 'none' }
  /** Pre-serialized text payload (json / xml / text / graphql). The
   *  Content-Type is already on `headers` when the user didn't set one. */
  | { kind: 'raw'; content: string }
  /** `application/x-www-form-urlencoded` — the host builds URLSearchParams
   *  and lets it set the Content-Type. */
  | { kind: 'urlencoded'; fields: ReadonlyArray<{ name: string; value: string }> }
  /** `multipart/form-data` — the host builds FormData and lets it set the
   *  Content-Type WITH the generated boundary (any user-set multipart
   *  Content-Type is already stripped from `headers`). */
  | { kind: 'multipart'; parts: ReadonlyArray<TransportMultipartPart> };

export type TransportMultipartPart =
  | { kind: 'text'; name: string; value: string }
  | { kind: 'file'; name: string; filename: string; mimeType: string; bytes: Uint8Array<ArrayBuffer> };

export interface TransportRequest {
  method: string;
  /** Scheme-normalized, query-appended, ready to hit the wire. */
  url: string;
  headers: ReadonlyArray<TransportHeader>;
  body: TransportBody;
  /** `'manual'` surfaces the first 3xx verbatim; `'follow'` chases it. */
  redirect: 'follow' | 'manual';
  /** Cookie-jar policy. `'omit'` unless the request opted into `'include'`. */
  credentials: 'omit' | 'include';
  /**
   * Hard ceiling (bytes) on the response body the transport reads off the
   * wire. The transport MUST stream the body and abort once it has read
   * past this cap rather than buffering the whole response and slicing
   * after — on the always-on desktop host an unbounded read of a hostile
   * or misconfigured endpoint's multi-gigabyte response OOMs the shared
   * main process. The executor sets this to its own byte cap (the same
   * limit it would otherwise slice at), so a streamed abort discards only
   * bytes the executor would have dropped anyway.
   */
  maxBodyBytes: number;
  /**
   * Whether the transport verifies the server's TLS certificate chain.
   * Absent / `true` → verify (the runtime default). `false` → send
   * without verification — a per-request explicit opt-in for
   * self-signed / private-CA targets. Transports whose network stack
   * cannot relax verification (the browser SW) ignore it and always
   * verify.
   */
  sslVerification?: boolean;
  /**
   * Lowest TLS protocol version the transport may negotiate. Absent →
   * the runtime default floor (TLS 1.2). `'1.0'` / `'1.1'` LOWER the
   * floor below the runtime default — a per-request explicit opt-in
   * for legacy servers, recorded on the executed-run snapshot.
   * Transports whose network stack fixes its protocol window (the
   * browser SW) ignore it.
   */
  tlsMinVersion?: '1.0' | '1.1' | '1.2' | '1.3';
  /**
   * Highest TLS protocol version the transport may negotiate. Absent →
   * the runtime default ceiling (TLS 1.3). Same transport caveat as
   * {@link tlsMinVersion}.
   */
  tlsMaxVersion?: '1.0' | '1.1' | '1.2' | '1.3';
  /**
   * Cipher suites offered during the TLS handshake, as ONE
   * OpenSSL-format colon-joined list (TLS ≤1.2 suites and TLS 1.3
   * suites both ride it). Absent → the runtime's default list. The
   * server still picks the suite from what's offered. Transports whose
   * network stack owns cipher negotiation ignore it.
   */
  tlsCipherSuites?: string;
  /**
   * Offer HTTP/2 alongside HTTP/1.1 on secure connections. The server
   * picks the protocol from the ALPN offer; plain `http://` targets
   * stay HTTP/1.1 regardless. Absent / `false` → HTTP/1.1 only (the
   * runtime default). Pure configuration — the negotiated protocol is
   * not reported back. Transports whose network stack owns protocol
   * negotiation (the browser SW) ignore it.
   */
  allowHttp2?: boolean;
  /**
   * IPv4/IPv6 address the URL's hostname resolves to at connect time
   * instead of asking DNS — while SNI, the Host header, and certificate
   * verification all keep the ORIGINAL hostname (that preservation is
   * the point: with verification on, the certificate must still match
   * the URL's host). The URL keeps its own port. The pin applies to
   * every hop of a redirect chain, cross-host hops included. Plain
   * data — the transport mints its own resolver from it. Transports
   * whose network stack owns resolution (the browser SW) ignore it.
   */
  resolveToAddress?: string;
  /**
   * Optional per-attempt wall-clock ceiling in milliseconds. The
   * transport MUST abort the whole round-trip — connection, response,
   * and body read — once this elapses, surfacing a
   * {@link TransportError} that names the timeout so the failure is
   * actionable (and retry-eligible upstream). Absent = no ceiling
   * beyond the host network stack's own. Under `redirect: 'follow'`
   * ONE deadline spans the entire redirect chain, not each hop.
   */
  timeoutMs?: number;
  /**
   * Cap on the number of redirects followed under `redirect: 'follow'`.
   * Absent → the runtime default (20). `0` is meaningful: fail on any
   * redirect. Exceeding the cap surfaces a {@link TransportError}
   * naming the configured limit. Meaningless under `'manual'`;
   * transports that can't cap their redirect chain (the browser SW)
   * ignore it.
   */
  maxRedirects?: number;
  /**
   * Keep the original HTTP method + body across 301/302/303 redirects
   * instead of the spec's demotion to GET. 307/308 preserve the method
   * regardless. Meaningless under `'manual'`; transports that can't
   * control their redirect chain ignore it.
   */
  followOriginalHttpMethod?: boolean;
  /**
   * Keep the `Authorization` header when a redirect hop crosses origin
   * (scheme + host + port) instead of the default strip. A trust-
   * relaxing per-request opt-in — the transport reports an actual
   * cross-origin re-send via
   * {@link TransportResponse.authorizationForwarded}. Transports that
   * can't control their redirect chain ignore it.
   */
  followAuthorizationHeader?: boolean;
}

export interface TransportResponse {
  status: number;
  statusText: string;
  /** Final URL after any redirects. */
  url: string;
  headers: ReadonlyArray<TransportHeader>;
  /**
   * Response body as text, already capped at {@link TransportRequest.maxBodyBytes}
   * by the transport (it streams + aborts past the cap to bound memory).
   * The executor surfaces this verbatim — it does NOT re-slice.
   */
  body: string;
  /** True when the upstream body exceeded `maxBodyBytes` and the read was
   *  aborted — i.e. `body` is the capped prefix, not the whole response. */
  bodyTruncated: boolean;
  /** Bytes retained in `body` (== `maxBodyBytes` when `bodyTruncated`). */
  bodyBytes: number;
  /**
   * Present (`true`) when {@link TransportRequest.followAuthorizationHeader}
   * actually FIRED — the chain crossed origin on some hop and the
   * `Authorization` header was re-sent to the new origin. Absent when
   * the knob was off, no cross-origin hop happened, or no Authorization
   * header was in play — attribution records what the send did, not
   * what was configured.
   */
  authorizationForwarded?: true;
}

/**
 * Thrown by a transport when the request never produced a response
 * (DNS failure, connection refused, offline, abort, missing host
 * permission). `message` is the host's already-classified,
 * user-actionable string — the executor surfaces it verbatim on the
 * snapshot's `error` field. A 4xx / 5xx is NOT an error here: the
 * transport resolves normally so extractors can read error bodies and
 * status-code gates can branch.
 */
export class TransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransportError';
  }
}

export interface RequestTransport {
  send(request: TransportRequest): Promise<TransportResponse>;
}
