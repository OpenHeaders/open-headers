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
   * HTTP version policy for the send. Absent / `'auto'` → offer h2
   * alongside http/1.1 via ALPN on secure connections and let the
   * server pick (plain `http://` targets stay HTTP/1.1 — no h2c under
   * auto). `'1.1'` → offer http/1.1 only. `'2'` → offer h2 ONLY,
   * pinned: the honoring transport fails the send honestly when the
   * server negotiates anything else — never a silent downgrade.
   * `'2-prior-knowledge'` → no negotiation at all: the honoring
   * transport speaks h2 framing from the first byte, over TLS and
   * cleartext alike (the sanctioned cleartext-h2 route), failing
   * honestly when the server answers the preface with anything else.
   * Unhonored values (`'3'` everywhere for now; `'2-prior-knowledge'`
   * on transports that don't speak it) fail honestly, never quietly
   * ride another protocol. The negotiated protocol reported back on
   * {@link TransportResponse.httpVersion} always comes from the wire,
   * never from this knob. Transports whose network stack owns protocol
   * negotiation (the browser SW) ignore it.
   */
  httpVersion?: 'auto' | '1.1' | '2' | '2-prior-knowledge' | '3';
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
   * Vault `client-certificate` entry NAME the request presents during
   * the TLS handshake. The stable ref — never the PEM bytes — is what
   * keys any per-tuple connection cache. Rides alongside the resolved
   * material below; set whenever the request configured a client
   * certificate, even when the ref didn't resolve on this device (the
   * honoring transport fails that send loudly instead of silently
   * dialing without a certificate). Transports whose network stack
   * picks client certificates itself (the browser SW) ignore it.
   */
  clientCertificateRef?: string;
  /**
   * Client certificate (chain) in PEM form, resolved from the vault by
   * the executor — the transport cannot reach the vault. Plain data on
   * the seam; never part of a cache key.
   */
  clientCertificatePem?: string;
  /** Private key in PEM form. See {@link clientCertificatePem}. */
  clientCertificateKeyPem?: string;
  /** Passphrase for an encrypted private key, when the vault entry
   *  carries one. See {@link clientCertificatePem}. */
  clientCertificatePassphrase?: string;
  /**
   * HTTP(S) proxy the send tunnels through (HTTP CONNECT) instead of
   * connecting directly. End-to-end TLS and certificate verification
   * still run against the TARGET; the proxy sees the tunnel endpoint.
   * Applies to every hop of a redirect chain. Not honorable together
   * with {@link resolveToAddress} — the proxy resolves the hostname
   * itself, so the honoring transport fails a send carrying both
   * loudly. Transports whose network stack owns proxying (the browser
   * SW rides the browser's proxy settings) ignore it.
   */
  proxyUrl?: string;
  /**
   * Vault string entry NAME holding the proxy's `user:password`. The
   * stable ref — never the credential value — is what keys any
   * per-tuple connection cache (alongside a content hash of the
   * value, so a rotated credential mints a fresh connection). Set
   * whenever the request configured proxy credentials, even when the
   * ref didn't resolve on this device (the honoring transport fails
   * that send loudly instead of silently dialing unauthenticated).
   */
  proxyCredentialRef?: string;
  /**
   * The `user:password` pair resolved from the vault by the executor —
   * the transport cannot reach the vault. The transport encodes it as
   * a `Proxy-Authorization: Basic …` header for the proxy leg only.
   * Plain data on the seam; never part of a cache key.
   */
  proxyCredential?: string;
  /**
   * Local socket the send dials instead of opening a TCP connection —
   * an absolute Unix domain socket path or a Windows named pipe. The
   * URL's host stays cosmetic for dialing while the Host header, SNI,
   * and certificate verification keep using it. Rides every hop of a
   * redirect chain. Not honorable together with {@link proxyUrl} (a
   * CONNECT tunnel cannot dial a local socket) or
   * {@link resolveToAddress} (a socket dial resolves no hostname) —
   * the honoring transport fails a send carrying either pair loudly.
   * Transports without a socket seat (the browser SW) ignore it.
   */
  unixSocketPath?: string;
  /**
   * Key of the runtime-local cookie jar this send reads and writes —
   * present only when the request opted into the jar (`cookieJar:
   * true`); the value is the workspace id, so sessions never bleed
   * across workspaces. Plain data on the seam: the honoring transport
   * owns the jar itself (an in-memory, never-persisted store in the
   * executing process), attaching a matching `Cookie` header to every
   * hop that carries no user-set one and storing every hop's
   * `Set-Cookie`. Absent → no cookies attached, `Set-Cookie`
   * discarded. Transports whose network stack owns its own jar (the
   * browser SW) ignore it.
   */
  cookieJarKey?: string;
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
  /**
   * HTTP digest credentials (RFC 7616 / 2617), templates already
   * resolved by the executor. The honoring transport drives the
   * scheme's second leg itself: when a hop answers 401 with a
   * `Digest` challenge in `WWW-Authenticate`, it computes the
   * `Authorization` answer for THAT hop's method + target and resends
   * the hop once — a 401 on the authorized resend is final. Plain
   * data on the seam; never part of a cache key. Transports whose
   * network stack can't run a challenge/response exchange (the
   * browser SW) ignore it, and the target's 401 surfaces verbatim as
   * the actionable signal.
   */
  digestAuth?: { username: string; password: string };
  /**
   * Ask the transport to observe connection-level facts for THIS send
   * — socket phase timings (DNS / TCP / TLS), the negotiated ALPN
   * protocol, and the socket's local/remote addresses — reported via
   * {@link TransportResponse.network} and the socket legs of
   * {@link TransportResponse.phaseTimings}. The honoring transport
   * dials an instrumented, send-local connection instead of a pooled
   * one (observation needs the dial), so the executor sets this only
   * for interactive sends where the facts feed the response surface —
   * cadence/background sends keep shared pooling. Transports whose
   * network stack exposes no socket seat (the browser SW) ignore it.
   */
  captureNetwork?: boolean;
}

/**
 * One redirect hop a `redirect: 'follow'` send chased — the request as
 * it went on the wire and the 3xx it answered with, plus the policy
 * transitions applied deriving the next hop. Only a transport that owns
 * its redirect chain (the node host's hand-rolled follower) can record
 * these; browser fetch follows internally and surfaces nothing — that
 * host omits the field, the usual capability asymmetry. Pure
 * attribution for the executed-run snapshot.
 */
export interface TransportRedirectHop {
  /** URL this hop's request was sent to. */
  url: string;
  /** HTTP method sent on this hop. */
  method: string;
  /** The hop's redirect status (301/302/303/307/308). */
  status: number;
  statusText: string;
  /** The `Location` header value as answered — possibly relative. */
  location: string;
  /** Present when the spec's method demotion fired deriving the next
   *  hop — the value the method changed TO. */
  methodChangedTo?: string;
  /** What happened to a carried `Authorization` header when the next
   *  hop crossed origin: stripped (default) or forwarded (the
   *  `followAuthorizationHeader` opt-in). Absent when no Authorization
   *  was in play or the hop stayed same-origin. */
  authorization?: 'stripped' | 'forwarded';
}

/** Socket-level facts an instrumented dial observed — see
 *  {@link TransportResponse.network}. */
export interface TransportNetworkFacts {
  /** Protocol id the connection speaks (`'h2'` / `'http/1.1'` /
   *  `'h3'`) — negotiated ALPN on TLS dials; plain-http dials report
   *  `'http/1.1'` (the only protocol undici fetch speaks in
   *  cleartext), except under `'2-prior-knowledge'`, whose sessions
   *  speak `'h2'` from the first byte, negotiation-free; a pinned
   *  `'3'` send reports `'h3'` from its helper dial. */
  httpVersion?: string;
  localAddress?: string;
  localPort?: number;
  remoteAddress?: string;
  remotePort?: number;
}

export interface TransportResponse {
  status: number;
  statusText: string;
  /** Final URL after any redirects. */
  url: string;
  headers: ReadonlyArray<TransportHeader>;
  /**
   * HTTP trailer fields the FINAL response carried after its body —
   * gRPC status codes travel here. Present only when the host's
   * network stack exposes trailers (the node transport's `request()`
   * wire path does; browser fetch never surfaces them — that host
   * omits the field, the usual capability asymmetry) and the response
   * sent at least one. Pure attribution for the executed-run snapshot.
   */
  trailers?: ReadonlyArray<TransportHeader>;
  /**
   * The redirect hops this send followed before the final response, in
   * wire order — see {@link TransportRedirectHop}. Present only when
   * the transport owns its redirect chain and at least one redirect was
   * followed. Pure attribution for the executed-run snapshot.
   */
  redirectChain?: ReadonlyArray<TransportRedirectHop>;
  /**
   * Wall-clock phase marks the transport measured around its own
   * exchange — manual marks, not platform resource timing (probed:
   * undici exposes no per-request timings on either result surface,
   * and its diagnostics_channel events carry no per-send correlation).
   * `redirectMs` = time spent chasing redirect hops before the final
   * hop's dispatch (present only when the chain had hops); `waitingMs`
   * = final hop dispatch → response head (TTFB — includes any digest
   * second leg); `downloadMs` = head → end of the capped body read.
   * The socket legs — `dnsMs` / `connectMs` (TCP) / `tlsMs` — appear
   * only when the send ran with {@link TransportRequest.captureNetwork}
   * on an instrumented dial AND the chain had no redirect hops (a
   * chained send's dial belongs to its first hop, inside `redirectMs`).
   * A pinned `'3'` send's QUIC dial merges transport and TLS into one
   * handshake, which lands in `tlsMs` with `connectMs` absent;
   * when present, `waitingMs` starts at the socket's readiness, not
   * the dispatch instant. Present only on hosts that own the exchange
   * end to end (the browser SW rides its platform's resource timing
   * instead). Pure attribution for the executed-run snapshot.
   */
  phaseTimings?: {
    redirectMs?: number;
    dnsMs?: number;
    connectMs?: number;
    tlsMs?: number;
    waitingMs: number;
    downloadMs: number;
  };
  /**
   * Connection-level facts observed on the socket that served the
   * FINAL hop — present only when the send ran with
   * {@link TransportRequest.captureNetwork} and the transport could
   * observe its own dial (proxied sends tunnel through the proxy
   * agent's connector and report nothing; the browser SW has no socket
   * seat at all). A pinned `'2-prior-knowledge'` send reports even
   * through a proxy — its hand-rolled session owns the CONNECT tunnel
   * end to end, and the facts describe the proxy leg, the socket the
   * process actually holds. Pure attribution for the executed-run
   * snapshot.
   */
  network?: TransportNetworkFacts;
  /**
   * Negotiated protocol id of the connection that served the FINAL
   * hop (`'h2'` / `'http/1.1'`), reported from the WIRE — the
   * always-on twin of {@link TransportNetworkFacts.httpVersion},
   * present on every send whose transport owns its dial (no
   * `captureNetwork` opt-in required). Absent on proxied sends (the
   * tunnel's connector owns the dial) and on transports without a
   * socket seat (the browser SW). Never derived from
   * {@link TransportRequest.httpVersion}.
   */
  httpVersion?: string;
  /**
   * Response body as text, already capped at {@link TransportRequest.maxBodyBytes}
   * by the transport (it streams + aborts past the cap to bound memory).
   * The executor surfaces this verbatim — it does NOT re-slice.
   */
  body: string;
  /** Present (`'base64'`) when the wire bytes are not valid UTF-8, so
   *  `body` carries them base64-encoded, losslessly (see
   *  `body-decode.ts`). Absent = text verbatim. */
  bodyEncoding?: 'base64';
  /** True when the upstream body exceeded `maxBodyBytes` and the read was
   *  aborted — i.e. `body` is the capped prefix, not the whole response. */
  bodyTruncated: boolean;
  /**
   * Present ONLY on a {@link RequestTransport.sendStreaming} response
   * whose body read ended before the wire did: the caller's abort
   * signal fired mid-body (`'aborted'` — the executor knows whether
   * that was a user Stop or its deadline) or the connection failed
   * mid-body (`'error'`, with the failure text). Either way `body`
   * carries the partial bytes that arrived — a streamed read never
   * discards them into a thrown error once the head is in. Absent on
   * every buffered `send` response and on a streamed read that ended
   * naturally or at the byte cap.
   */
  streamEndedEarly?: { reason: 'aborted' | 'error'; message?: string };
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
  /**
   * The `Cookie` header value the transport's jar attached to the
   * FIRST hop — present only when {@link TransportRequest.cookieJarKey}
   * was set AND the jar actually contributed one (absent when the jar
   * was empty, matched nothing, or a user-set `Cookie` header won).
   * Recorded for reproducibility on the executed-run snapshot.
   */
  cookieHeaderAttached?: string;
  /**
   * Names of the cookies the transport's jar stored from this send's
   * `Set-Cookie` responses, across every hop in arrival order. Present
   * only when {@link TransportRequest.cookieJarKey} was set and at
   * least one cookie was stored.
   */
  cookiesCaptured?: string[];
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

/** Response head of an in-flight streamed send, pushed to the observer
 *  as soon as the FINAL hop's head arrives (redirect hops stay silent). */
export interface TransportStreamHead {
  status: number;
  statusText: string;
  /** Final URL after any redirects. */
  url: string;
  headers: ReadonlyArray<TransportHeader>;
}

/**
 * In-process observer for {@link RequestTransport.sendStreaming} — a
 * host capability, never a wire shape. Callbacks fire per network
 * chunk; batching for any broadcast is the CALLER's concern (the
 * executor's flush-batched emitter), so the transport stays dumb.
 */
export interface TransportStreamObserver {
  onHead(head: TransportStreamHead): void;
  /**
   * One cap-bounded slice of body bytes, in arrival order.
   * `totalBytes` is the cap-bounded running total — the tail never
   * shows bytes the snapshot won't keep.
   */
  onChunk(bytes: Uint8Array, totalBytes: number): void;
}

export interface RequestTransport {
  send(request: TransportRequest): Promise<TransportResponse>;
  /**
   * OPTIONAL streaming twin of `send` for the interactive Send: same
   * request in, same materialized {@link TransportResponse} out (capped,
   * downstream mapping unchanged) — but the response head and body
   * chunks additionally surface live through `observer` as they arrive,
   * and `signal` aborts the whole exchange (the Stop button). An abort
   * or connection failure AFTER the head arrived resolves with the
   * partial body and {@link TransportResponse.streamEndedEarly} instead
   * of throwing; before the head it throws a {@link TransportError}
   * exactly like `send`. Hosts without a streamable network stack omit
   * the method and interactive sends fall back to buffered `send`.
   */
  sendStreaming?(
    request: TransportRequest,
    observer: TransportStreamObserver,
    signal?: AbortSignal,
  ): Promise<TransportResponse>;
}
