/**
 * Node request transport — the desktop main process's implementation of
 * the engine's {@link RequestTransport} seam, over undici's `fetch`.
 *
 * Differences from the browser SW transport:
 *   - **No offline pre-flight.** The always-on desktop has no
 *     `navigator.onLine`; a genuinely-offline send surfaces as a
 *     classified connect error below.
 *   - **No host-access gate.** There is no `chrome.permissions` model on
 *     the desktop — the process can reach any host its network allows.
 *   - **No DNR-bypass concern.** The desktop has no DNR engine, so the
 *     `X-OH-Live-Bypass` header is never stamped (the chain adapter omits
 *     `prepareRequest`).
 *   - **Rich error classification.** Unlike the browser's opaque
 *     `TypeError: Failed to fetch`, undici exposes `err.cause.code`
 *     (`ECONNREFUSED` / `ENOTFOUND` / …), so the message is precise.
 *   - **Per-request connection policy.** `sslVerification: false`,
 *     `tlsMinVersion` / `tlsMaxVersion`, `tlsCipherSuites`,
 *     `httpVersion`, `resolveToAddress`, and the client-certificate
 *     fields route the send through a dispatcher carrying exactly
 *     those options — knobs browser fetch can never honor. The TLS
 *     options ride the agent's TLS connector;
 *     `httpVersion` maps to the ALPN offer (see
 *     {@link httpVersionPolicy}): `'auto'` (the default) offers
 *     h2 + http/1.1 and the server picks; `'1.1'` offers http/1.1
 *     only; `'2'` offers h2 ONLY on a hand-rolled connector and fails
 *     honestly when the server negotiates anything else — never a
 *     silent downgrade (plain http:// can't ALPN at all, so a pinned
 *     cleartext hop fails too); `'2-prior-knowledge'` skips
 *     negotiation entirely — every hop rides the hand-rolled
 *     `node:http2` session pipeline (see {@link h2Hop}), TLS and
 *     cleartext alike (the sanctioned cleartext-h2 route), with the
 *     same connection policy, redirect/digest/jar layer, and native
 *     trailers; `'3'` fails honestly as not-yet-supported here, as do
 *     `'2'` and `'2-prior-knowledge'` through a proxy (the tunnel's
 *     connector owns the ALPN offer, and the tunnel leg for raw-h2
 *     framing isn't wired yet);
 *     `resolveToAddress` maps to a pinned `connect.lookup` (see
 *     {@link pinnedLookup}) that answers every hostname with the one
 *     address while SNI / Host / cert verification keep the URL's
 *     hostname; the client-certificate PEM pair rides `connect.cert` /
 *     `connect.key` (+ `passphrase`), keyed in the tuple by its vault
 *     ref + a content hash (see {@link clientCertKeySegment}) so
 *     rotation mints a fresh agent; `proxyUrl` swaps the dispatcher
 *     CLASS to a `ProxyAgent` that tunnels the send through an HTTP(S)
 *     proxy with CONNECT (end-to-end TLS still runs against the
 *     target; the other connection options ride the tunnel's target
 *     leg via `requestTls` — see {@link buildProxyAgent}), with
 *     credentials resolved from a vault ref (see
 *     {@link proxyCredKeySegment}); `unixSocketPath` pins the dial to
 *     a local Unix domain socket / Windows named pipe via
 *     `connect.socketPath` (the URL's host stays cosmetic for dialing;
 *     Host / SNI / cert verification keep it). Dispatchers are cached per
 *     distinct option tuple (see
 *     {@link dispatcherFor}) so pooled connections are shared, never
 *     minted per send. `fetch` + `Agent` come from the same undici
 *     package so the dispatcher and the fetch pipeline are one stack,
 *     one version.
 *   - **Always-on negotiated-protocol report.** Every direct send's
 *     dispatcher dials through a connector that observes the ready
 *     socket's ALPN result per origin (undici's own connector wrapped
 *     — session cache intact — or the hand-rolled pinned dial), so
 *     {@link TransportResponse.httpVersion} reports the wire's
 *     protocol on every send, not only under `captureNetwork`.
 *     Proxied sends report nothing (the tunnel's connector owns the
 *     dial) — the usual capability honesty.
 *   - **Opt-in cookie jar.** The main process has no ambient cookie
 *     jar; `cookieJarKey` opts a send into the transport-owned
 *     in-memory jar for that key (the workspace id — see
 *     {@link cookieJarFor}). Every hop stores its `Set-Cookie` values
 *     (parsed by undici's `getSetCookies`) and gets a matching
 *     `Cookie` header attached — unless the hop already carries a
 *     user-set one, which always wins. First-hop attachment and the
 *     stored names are reported on the response for snapshot
 *     attribution. Without the key, sends attach nothing and discard
 *     `Set-Cookie` — the historical behavior.
 *   - **GET/HEAD with a body goes on the wire.** WHATWG fetch refuses
 *     to construct such a request (the browser transport omits the body
 *     and stamps `requestBodyOmitted`), but HTTP itself allows it and
 *     real APIs use it (search endpoints taking a JSON query on GET).
 *     Hops matching that shape drop to undici's `request()` — same
 *     dispatcher, deadline, and error classification — and the response
 *     adapts back onto the fetch surface (see {@link requestHop}).
 *   - **gRPC hops surface HTTP trailers.** gRPC puts its
 *     `grpc-status`/`grpc-message` in trailers, which fetch drops on
 *     the floor (WHATWG removed trailers from its surface — probed on
 *     undici 7.24.6). Hops declaring `Content-Type: application/grpc*`
 *     ride the `request()` pipeline too, whose trailers object fills
 *     once the body is consumed; the final hop's trailers land on
 *     {@link TransportResponse.trailers} for snapshot attribution.
 *   - **HTTP digest second leg.** A hop answering 401 with a `Digest`
 *     challenge (RFC 7616 / 2617) gets ONE authorized resend when the
 *     request carries `digestAuth` credentials — computed per hop over
 *     that hop's method + target, riding the same dispatcher, deadline,
 *     and jar. The browser transport has no seat for the exchange and
 *     ignores the field (the target's 401 is the actionable signal).
 *   - **Hand-rolled redirect follow.** Every fetch goes out with
 *     `redirect: 'manual'` — server-side manual mode returns the REAL
 *     3xx with readable headers (no browser-style opaque filtering), so
 *     the transport chases `Location` itself instead of letting undici's
 *     internal follower. That ownership is what makes the per-request
 *     redirect knobs (`maxRedirects`, `followOriginalHttpMethod`,
 *     `followAuthorizationHeader`) honorable at all: the loop applies
 *     the spec's method/body demotion and cross-origin Authorization
 *     strip per hop, and the knobs relax exactly those two policies.
 */

import { createHash, randomBytes } from 'node:crypto';
import { STATUS_CODES } from 'node:http';
import { isIP, type LookupFunction } from 'node:net';
import { Readable } from 'node:stream';
import { createSecureContext, type SecureVersion } from 'node:tls';
import {
  buildDigestAuthorization,
  DigestError,
  type DigestHashFn,
  parseDigestChallenges,
  selectDigestChallenge,
} from '@openheaders/core/auth-signing';
import { materializeBody } from '@openheaders/oracle/live/request-exec/body-decode';
import {
  type RequestTransport,
  type TransportBody,
  TransportError,
  type TransportHeader,
  type TransportMultipartPart,
  type TransportNetworkFacts,
  type TransportRedirectHop,
  type TransportRequest,
  type TransportResponse,
  type TransportStreamObserver,
} from '@openheaders/oracle/live/request-exec/transport';
import {
  Agent,
  type Dispatcher,
  FormData,
  getSetCookies,
  Headers,
  ProxyAgent,
  Response,
  fetch as undiciFetch,
  request as undiciRequest,
} from 'undici';
import { type CookieJar, cookieJarFor, type SetCookieInput } from './cookie-jar';
import { h2PriorKnowledgeHop } from './h2-prior-knowledge';
import {
  type AlpnPolicy,
  type ConnectionRecord,
  createDialConnector,
  createInstrumentedDial,
  createRecordingConnector,
  H2_NOT_NEGOTIATED_CODE,
} from './instrumented-connector';

/** The fetch pipeline behind the transport — undici's fetch in
 *  production; injectable so tests observe the exact init (including
 *  the dispatcher) without stubbing globals. */
export type NodeFetchFn = typeof undiciFetch;

/** The slice of an undici `request()` result the transport consumes —
 *  the seam is typed to it so tests can hand back plain readables.
 *  `trailers` is undici's live view of the response's HTTP trailer
 *  fields — empty until the body has been consumed, populated after. */
export interface NodeRequestResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: Readable;
  trailers?: Record<string, string | string[] | undefined>;
}

/** The spec-free pipeline behind GET/HEAD-with-body and gRPC hops —
 *  undici's `request()` in production; injectable like
 *  {@link NodeFetchFn} and typed to exactly what the transport sends
 *  and reads. */
export type NodeRequestFn = (
  url: string,
  options: {
    method: string;
    headers: Headers;
    body?: string | FormData;
    dispatcher?: Dispatcher;
    signal?: AbortSignal;
  },
) => Promise<NodeRequestResponse>;

/** undici's RequestInit — carries the `dispatcher` slot the DOM-shaped
 *  init type doesn't know about. */
type NodeRequestInit = NonNullable<Parameters<NodeFetchFn>[1]>;

export interface NodeRequestTransportOptions {
  fetchFn?: NodeFetchFn;
  requestFn?: NodeRequestFn;
}

/** Seam value (`'1.2'`) → Node `tls.connect` version token (`'TLSv1.2'`). */
const TLS_VERSION_TOKEN: Record<string, SecureVersion> = {
  '1.0': 'TLSv1',
  '1.1': 'TLSv1.1',
  '1.2': 'TLSv1.2',
  '1.3': 'TLSv1.3',
};

/**
 * Ceiling on cached per-tuple agents. Distinct option tuples per
 * install are tiny in practice (a handful of dev targets), so a plain
 * Map with oldest-entry eviction is enough — an LRU would never see the
 * difference. Evicted agents close gracefully (in-flight requests
 * finish); a re-request of an evicted tuple just mints a fresh agent.
 */
const MAX_AGENTS = 32;

/**
 * A cached dispatcher plus the per-origin negotiated-protocol log its
 * connector reports into — the always-on twin of the instrumented
 * dial's facts. `negotiatedByOrigin` is absent for proxied
 * dispatchers: the tunnel's connector owns the dial and there is
 * nothing honest to observe.
 */
interface DispatcherEntry {
  dispatcher: Dispatcher;
  negotiatedByOrigin?: Map<string, string>;
}

/**
 * Ceiling on origins retained per dispatcher's negotiated-protocol
 * log. One dispatcher serves one option tuple, so this only bites a
 * tuple that fans out across hundreds of hosts (a cadence sweep) —
 * oldest-origin eviction keeps the map bounded; an evicted origin
 * merely loses its protocol fact until the next fresh dial.
 */
const MAX_NEGOTIATED_ORIGINS = 256;

function recordNegotiated(map: Map<string, string>, origin: string, alpnProtocol: string): void {
  if (!map.has(origin) && map.size >= MAX_NEGOTIATED_ORIGINS) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(origin, alpnProtocol);
}

/**
 * Shared dispatchers keyed by the canonical connection-option tuple.
 * EVERY direct send rides one — the fully-default tuple included
 * (keyed `''`), because the always-on negotiated-protocol report
 * needs a connector seat undici's global default dispatcher doesn't
 * offer. Every send carrying the SAME option tuple shares ONE
 * dispatcher, built on first use — minting one per send would leak a
 * connection pool each time. The value wraps a plain `Agent` for
 * direct sends and a `ProxyAgent` (a different dispatcher CLASS, not
 * an `Agent` option) for proxied ones — both close gracefully on
 * eviction.
 */
const agentCache = new Map<string, DispatcherEntry>();

/**
 * Resolver pinned to one address: answers EVERY hostname it is asked
 * about with `address`, in both callback shapes Node's `net.connect`
 * uses (`all: true` Happy-Eyeballs mode expects an address list; the
 * family-pinned path expects `(err, address, family)`). The connector
 * derives `servername` from the URL's hostname BEFORE dialing, so SNI,
 * the Host header, and certificate verification all keep the original
 * name — the pin only changes where the socket goes. Sharing one agent
 * between requests that pin DIFFERENT hosts to the SAME address is
 * correct by construction: the lookup pins everything the agent dials.
 */
function pinnedLookup(address: string): LookupFunction {
  const family = isIP(address);
  return (_hostname, options, callback) => {
    if (options.all) {
      callback(null, [{ address, family }]);
      return;
    }
    callback(null, address, family);
  };
}

/**
 * Client-certificate segment of the tuple key: the stable vault ref
 * plus a short content hash of the PEM material. The hash — never the
 * PEM itself — rides the key so ROTATING the vault entry under the
 * same name naturally mints a fresh agent (the S5 cache has no
 * invalidation input, and needs none). A hash of the material is not
 * the secret; the material itself must never sit in a Map key.
 */
function clientCertKeySegment(request: TransportRequest): string {
  if (request.clientCertificateRef === undefined) return '';
  const material = `${request.clientCertificatePem ?? ''}\n${request.clientCertificateKeyPem ?? ''}\n${request.clientCertificatePassphrase ?? ''}`;
  const hash = createHash('sha256').update(material).digest('hex').slice(0, 16);
  return `${request.clientCertificateRef}#${hash}`;
}

/**
 * Proxy-credential segment of the tuple key: the stable vault ref plus
 * a short content hash of the `user:password` value — same discipline
 * as {@link clientCertKeySegment}: rotating the vault entry under the
 * same name mints a fresh dispatcher, and the credential itself never
 * sits in a Map key. Only contributes while a proxy URL is set — a
 * credential without a proxy has nothing to authenticate against.
 */
function proxyCredKeySegment(request: TransportRequest): string {
  if (request.proxyCredentialRef === undefined) return '';
  const hash = createHash('sha256')
    .update(request.proxyCredential ?? '')
    .digest('hex')
    .slice(0, 16);
  return `${request.proxyCredentialRef}#${hash}`;
}

/** The TLS/connection option bag shared by the direct path (`Agent`'s
 *  `connect`) and the proxied path (`ProxyAgent`'s `requestTls` — the
 *  TARGET leg of the tunnel; `ProxyAgent` ignores a plain `connect`). */
export interface ConnectOptions {
  rejectUnauthorized?: boolean;
  minVersion?: SecureVersion;
  maxVersion?: SecureVersion;
  ciphers?: string;
  lookup?: LookupFunction;
  cert?: string;
  key?: string;
  passphrase?: string;
  allowH2?: boolean;
  socketPath?: string;
}

/**
 * The seam's `httpVersion` knob mapped to how a dial offers and
 * enforces the protocol. `'auto'` (and absent) offers h2 + http/1.1 —
 * the server picks; `'1.1'` offers http/1.1 only; `'2'` offers h2
 * only, pinned (the dial fails honestly on any other outcome). The
 * not-yet-supported tokens never reach this mapping — `dispatchSend`
 * rejects them before the wire.
 */
export function httpVersionPolicy(httpVersion: TransportRequest['httpVersion']): AlpnPolicy {
  switch (httpVersion) {
    case '1.1':
      return { alpnProtocols: ['http/1.1'], pinH2: false };
    case '2':
      return { alpnProtocols: ['h2'], pinH2: true };
    default:
      return { alpnProtocols: ['http/1.1', 'h2'], pinH2: false };
  }
}

/** Whether the policy's offer includes h2 — the undici `allowH2` seat
 *  (the CLIENT side: speak h2 whenever the dial may negotiate it). */
function offersH2(policy: AlpnPolicy): boolean {
  return policy.alpnProtocols.includes('h2');
}

function dispatcherFor(request: TransportRequest): DispatcherEntry {
  const insecure = request.sslVerification === false;
  const policy = httpVersionPolicy(request.httpVersion);
  const { tlsMinVersion, tlsMaxVersion, tlsCipherSuites, resolveToAddress, proxyUrl } = request;
  const { unixSocketPath } = request;
  const key = [
    insecure ? 'insecure' : '',
    tlsMinVersion ?? '',
    tlsMaxVersion ?? '',
    tlsCipherSuites ?? '',
    request.httpVersion === undefined || request.httpVersion === 'auto' ? '' : request.httpVersion,
    resolveToAddress ?? '',
    clientCertKeySegment(request),
    proxyUrl ?? '',
    proxyUrl !== undefined ? proxyCredKeySegment(request) : '',
    unixSocketPath ?? '',
  ].join('|');
  const cached = agentCache.get(key);
  if (cached) return cached;
  const connect = connectOptionsFor(request);
  const entry: DispatcherEntry =
    proxyUrl !== undefined
      ? { dispatcher: buildProxyAgent(proxyUrl, request, connect, offersH2(policy)) }
      : buildAgentEntry(connect, policy);
  if (agentCache.size >= MAX_AGENTS) {
    const oldest = agentCache.entries().next().value;
    if (oldest) {
      agentCache.delete(oldest[0]);
      void oldest[1].dispatcher.close();
    }
  }
  agentCache.set(key, entry);
  return entry;
}

/**
 * Cipher list a lowered TLS floor needs on THIS runtime's TLS stack,
 * probed once. OpenSSL 3 disallows the legacy signature algorithms a
 * TLS < 1.2 handshake needs at its default security level, so a lowered
 * floor alone can never negotiate 1.0/1.1 (probed live:
 * ERR_SSL_LEGACY_SIGALG_DISALLOWED_OR_UNSUPPORTED) — `@SECLEVEL=0` on
 * the default suites is what makes the knob honorable. BoringSSL
 * (Electron's stack) REJECTS the `@SECLEVEL` syntax outright
 * (ERR_SSL_INVALID_COMMAND) and has no security-level gate — a lowered
 * floor negotiates plain there (both probed live in each runtime).
 */
let legacyFloorCiphers: string | null | undefined;
function legacyFloorCipherDefault(): string | undefined {
  if (legacyFloorCiphers === undefined) {
    try {
      createSecureContext({ ciphers: 'DEFAULT@SECLEVEL=0' });
      legacyFloorCiphers = 'DEFAULT@SECLEVEL=0';
    } catch {
      legacyFloorCiphers = null;
    }
  }
  return legacyFloorCiphers ?? undefined;
}

/**
 * The connection-option bag a request's knobs map to — one place, pure,
 * so the mapping is testable without inspecting a minted `Agent`. The
 * caller keys the agent cache on the same request fields, so the bag is
 * deterministic per tuple.
 */
export function connectOptionsFor(request: TransportRequest): ConnectOptions {
  const { tlsMinVersion, tlsMaxVersion, tlsCipherSuites, resolveToAddress, unixSocketPath } = request;
  const connect: ConnectOptions = {};
  if (request.sslVerification === false) connect.rejectUnauthorized = false;
  if (tlsMinVersion !== undefined) connect.minVersion = TLS_VERSION_TOKEN[tlsMinVersion];
  if (tlsMaxVersion !== undefined) connect.maxVersion = TLS_VERSION_TOKEN[tlsMaxVersion];
  if (tlsCipherSuites !== undefined) {
    connect.ciphers = tlsCipherSuites;
  } else if (tlsMinVersion === '1.0' || tlsMinVersion === '1.1') {
    // Lowering the floor is the explicit opt-in; what the runtime's TLS
    // stack needs to honor it (see {@link legacyFloorCipherDefault})
    // rides along. An explicit cipher list above wins verbatim.
    const legacy = legacyFloorCipherDefault();
    if (legacy !== undefined) connect.ciphers = legacy;
  }
  if (resolveToAddress !== undefined) connect.lookup = pinnedLookup(resolveToAddress);
  if (request.clientCertificatePem !== undefined) connect.cert = request.clientCertificatePem;
  if (request.clientCertificateKeyPem !== undefined) connect.key = request.clientCertificateKeyPem;
  if (request.clientCertificatePassphrase !== undefined) connect.passphrase = request.clientCertificatePassphrase;
  // The connector passes `socketPath` as `path` into net.connect /
  // tls.connect, where it wins over host+port — the URL's host stays
  // cosmetic for dialing while Host / SNI / cert verification keep it.
  if (unixSocketPath !== undefined) connect.socketPath = unixSocketPath;
  return connect;
}

/**
 * Direct-send agent + its negotiated-protocol log. Unpinned tuples
 * wrap undici's own connector ({@link createRecordingConnector} —
 * session cache intact) so every ready socket reports its ALPN result
 * per origin; the `'2'` pin rides the hand-rolled dial
 * ({@link createDialConnector}), the only connector that can offer
 * h2-only and refuse a non-h2 negotiation. `allowH2` is an Agent
 * option, NOT a `connect` option — it sits beside the connector and
 * lets the client speak h2 when the dial negotiated it.
 */
function buildAgentEntry(connect: ConnectOptions, policy: AlpnPolicy): DispatcherEntry {
  const negotiatedByOrigin = new Map<string, string>();
  const allowH2 = offersH2(policy);
  const connector = policy.pinH2
    ? createDialConnector(
        connect,
        policy,
        () => {},
        (record) => {
          if (record.alpnProtocol !== undefined) {
            recordNegotiated(negotiatedByOrigin, record.origin, record.alpnProtocol);
          }
        },
      )
    : createRecordingConnector({ ...connect, ...(allowH2 ? { allowH2: true } : {}) }, (origin, alpnProtocol) =>
        recordNegotiated(negotiatedByOrigin, origin, alpnProtocol),
      );
  return {
    dispatcher: new Agent({ connect: connector, ...(allowH2 ? { allowH2: true } : {}) }),
    negotiatedByOrigin,
  };
}

/**
 * Proxied dispatcher. `ProxyAgent` tunnels the target connection
 * through the proxy with HTTP CONNECT, so the per-request connection
 * options apply to the TARGET leg via `requestTls` — a plain `connect`
 * option is silently overridden by the tunnel's own connector
 * (verified against a live CONNECT proxy). `allowH2` must ride BOTH
 * seats: inside `requestTls` it puts h2 in the ALPN offer on the
 * tunneled TLS connect; at the top level it keeps the inner client
 * h2-capable (Agent semantics). Credentials become the
 * `Proxy-Authorization` header via `token`, proxy leg only.
 */
function buildProxyAgent(
  proxyUrl: string,
  request: TransportRequest,
  connect: ConnectOptions,
  allowH2: boolean,
): ProxyAgent {
  const requestTls: ConnectOptions = { ...connect, ...(allowH2 ? { allowH2: true } : {}) };
  return new ProxyAgent({
    uri: proxyUrl,
    requestTls,
    ...(allowH2 ? { allowH2: true } : {}),
    ...(request.proxyCredential !== undefined
      ? { token: `Basic ${Buffer.from(request.proxyCredential).toString('base64')}` }
      : {}),
  });
}

/** Redirect-hop ceiling when the request carries no `maxRedirects`. */
const DEFAULT_MAX_REDIRECTS = 20;

/** 3xx statuses that redirect. 304 (and any 3xx without a `Location`
 *  header) is a final response, per the fetch spec. */
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** Request-body metadata headers dropped alongside the body when a
 *  301/302/303 hop demotes the method to GET (fetch-spec behavior). */
const BODY_HEADERS = new Set([
  'content-length',
  'content-type',
  'content-encoding',
  'content-language',
  'content-location',
]);

/** Mutable per-hop send state — what actually changes across a redirect
 *  chain. The body stays the data-only `TransportBody`; `buildBody`
 *  re-materializes a fresh `BodyInit` per hop (a consumed FormData /
 *  URLSearchParams is never reused). */
interface HopState {
  url: string;
  method: string;
  headers: ReadonlyArray<TransportHeader>;
  body: TransportBody;
}

/** What one wire round-trip yields to the redirect loop and the capped
 *  body read — the slice of the fetch `Response` surface they actually
 *  touch. A fetch hop returns its `Response` as-is; a `request()` hop
 *  (GET/HEAD with a body) adapts onto the same shape. */
type FetchResponse = Awaited<ReturnType<NodeFetchFn>>;
interface HopResponse {
  status: number;
  statusText: string;
  url: string;
  headers: FetchResponse['headers'];
  body: FetchResponse['body'];
  /** HTTP trailer fields, read AFTER the body is consumed — a thunk
   *  because undici populates its trailers object only once the body
   *  stream ends. Absent on the fetch path: WHATWG fetch dropped
   *  trailers from its surface entirely, so only `request()` hops can
   *  report them. */
  trailers?: () => TransportHeader[];
}

/** True when the hop's method forbids a fetch() body — the WHATWG rule
 *  for GET/HEAD — while the hop still carries one. Those hops take the
 *  `request()` wire path, which enforces no such rule. */
function bodylessMethodWithBody(hop: HopState): boolean {
  const method = hop.method.toUpperCase();
  return (method === 'GET' || method === 'HEAD') && hop.body.kind !== 'none';
}

/** True when the hop declares a gRPC exchange (`Content-Type:
 *  application/grpc*`). Those hops take the `request()` wire path too —
 *  the only pipeline that exposes HTTP trailers, where gRPC puts its
 *  `grpc-status`/`grpc-message` (probed: undici fetch surfaces no
 *  trailers at all). The trade — `request()` advertises no
 *  Accept-Encoding and applies no transparent decompression — is moot
 *  here: gRPC compresses per message frame, never the HTTP body. */
function grpcHop(hop: HopState): boolean {
  return hop.headers.some(
    (h) => h.key.toLowerCase() === 'content-type' && h.value.toLowerCase().startsWith('application/grpc'),
  );
}

/** Abort deadline over a whole send — see {@link startDeadline}. */
type Deadline = ReturnType<typeof startDeadline>;

/** What the jar did during one send — reported on the response so the
 *  executed-run snapshot can record it. */
interface JarActivity {
  /** `Cookie` header value attached to the FIRST hop, when any. */
  cookieHeaderAttached?: string;
  /** Names stored from `Set-Cookie` across the chain, arrival order. */
  cookiesCaptured: string[];
}

/**
 * A hop's headers with the jar's `Cookie` contribution appended — or
 * untouched when the jar matches nothing for this URL, or when the hop
 * already carries a Cookie header (a user-set header always wins; the
 * jar only fills the gap).
 */
function withJarCookie(jar: CookieJar, hop: HopState): { headers: ReadonlyArray<TransportHeader>; attached?: string } {
  if (hop.headers.some((h) => h.key.toLowerCase() === 'cookie')) return { headers: hop.headers };
  const value = jar.cookieHeaderFor(hop.url);
  if (value === undefined) return { headers: hop.headers };
  return { headers: [...hop.headers, { key: 'Cookie', value }], attached: value };
}

/**
 * Store a hop response's `Set-Cookie` values into the jar, returning
 * the names stored. undici's `getSetCookies` does the attribute
 * parsing (fetch `Headers` would otherwise join multiple `Set-Cookie`
 * values into one unsplittable string); the jar owns matching and
 * expiry.
 */
function captureJarCookies(jar: CookieJar, url: string, headers: Headers): string[] {
  const incoming: SetCookieInput[] = getSetCookies(headers).map((c) => ({
    name: c.name,
    value: c.value,
    ...(c.domain !== undefined && c.domain !== null ? { domain: c.domain } : {}),
    ...(c.path !== undefined && c.path !== null ? { path: c.path } : {}),
    ...(c.expires !== undefined && c.expires !== null
      ? { expires: c.expires instanceof Date ? c.expires : new Date(c.expires) }
      : {}),
    ...(c.maxAge !== undefined && c.maxAge !== null ? { maxAge: c.maxAge } : {}),
    ...(c.secure !== undefined && c.secure !== null ? { secure: c.secure } : {}),
  }));
  if (incoming.length === 0) return [];
  return jar.store(url, incoming);
}

// ── HTTP digest second leg ──────────────────────────────────────────

/** MD5 availability, probed once — `node:crypto` refuses the algorithm
 *  under FIPS policy, in which case MD5(-sess) challenges read as
 *  unsupported and only the SHA-256 family is answerable. */
let md5Supported: boolean | undefined;
function md5HashFn(): DigestHashFn | undefined {
  if (md5Supported === undefined) {
    try {
      createHash('md5');
      md5Supported = true;
    } catch {
      md5Supported = false;
    }
  }
  if (!md5Supported) return undefined;
  return (text) => createHash('md5').update(text, 'utf8').digest('hex');
}

/**
 * Wire body text for `qop=auth-int` — only bodies whose bytes are
 * deterministic ahead of dispatch (the same discipline as SigV4's
 * payload hash). Multipart returns `undefined`: the runtime picks the
 * boundary, so the entity bytes are unknowable and an auth-int-only
 * challenge fails with a clear error instead of a wrong hash.
 */
function digestBodyText(body: TransportBody): string | undefined {
  switch (body.kind) {
    case 'none':
      return '';
    case 'raw':
      return body.content;
    case 'urlencoded': {
      const params = new URLSearchParams();
      for (const f of body.fields) params.append(f.name, f.value);
      return params.toString();
    }
    case 'multipart':
      return undefined;
    default: {
      const _exhaustive: never = body;
      void _exhaustive;
      return undefined;
    }
  }
}

/**
 * Compute the `Authorization` answer to a 401's `Digest` challenges for
 * THIS hop, or `null` when the response carries nothing answerable (no
 * challenge, unsupported algorithms) — the 401 then surfaces verbatim.
 * An answerable-but-unsatisfiable challenge (auth-int-only against a
 * multipart body, MD5-only under FIPS) throws a {@link TransportError}
 * naming the reason.
 */
async function digestAuthorizationFor(
  digestAuth: { username: string; password: string },
  hop: HopState,
  response: HopResponse,
): Promise<string | null> {
  const headerValue = response.headers.get('www-authenticate');
  if (headerValue === null) return null;
  const md5 = md5HashFn();
  const challenge = selectDigestChallenge(parseDigestChallenges(headerValue), { md5Available: md5 !== undefined });
  if (challenge === null) return null;
  const url = new URL(hop.url);
  const body = digestBodyText(hop.body);
  try {
    return await buildDigestAuthorization(
      digestAuth,
      challenge,
      {
        method: hop.method,
        uri: `${url.pathname}${url.search}`,
        cnonce: randomBytes(16).toString('hex'),
        nonceCount: 1,
        ...(body !== undefined ? { body } : {}),
      },
      md5,
    );
  } catch (err) {
    if (err instanceof DigestError) {
      throw new TransportError(`Digest authentication with ${url.hostname} failed: ${err.message}`);
    }
    throw err;
  }
}

/** `hop.headers` with the digest `Authorization` set replace-not-append
 *  — a stale user-set value would combine into garbage on the wire. */
function withDigestAuthorization(headers: ReadonlyArray<TransportHeader>, value: string): TransportHeader[] {
  return [...headers.filter((h) => h.key.toLowerCase() !== 'authorization'), { key: 'Authorization', value }];
}

/**
 * The digest exchange for one hop: when the hop's response is a 401
 * with an answerable `Digest` challenge and the request carries digest
 * credentials, cancel the challenge body and resend THAT hop once with
 * the computed `Authorization` (fresh jar contribution included — the
 * challenge response may have set a session cookie). Returns the
 * authorized hop + its response, or `null` when no retry applies. The
 * caller continues from the returned hop, so a 401 on the authorized
 * resend is final by construction — it flows on as a normal response.
 */
async function digestRetryHop(
  fetchFn: NodeFetchFn,
  requestFn: NodeRequestFn,
  request: TransportRequest,
  hop: HopState,
  response: HopResponse,
  deadline: Deadline,
  dispatcher: Dispatcher | undefined,
  jar: CookieJar | undefined,
  h2: H2Leg | null,
): Promise<{ hop: HopState; response: HopResponse; jarAttached?: string; jarCaptured: string[] } | null> {
  if (request.digestAuth === undefined || response.status !== 401) return null;
  const authorization = await digestAuthorizationFor(request.digestAuth, hop, response);
  if (authorization === null) return null;
  await response.body?.cancel();
  const authorizedHop: HopState = { ...hop, headers: withDigestAuthorization(hop.headers, authorization) };
  let sendHop = authorizedHop;
  let jarAttached: string | undefined;
  if (jar !== undefined) {
    const { headers, attached } = withJarCookie(jar, authorizedHop);
    sendHop = { ...authorizedHop, headers };
    jarAttached = attached;
  }
  const retryResponse = await wireHop(fetchFn, requestFn, request, sendHop, deadline, dispatcher, h2);
  const jarCaptured = jar !== undefined ? captureJarCookies(jar, authorizedHop.url, retryResponse.headers) : [];
  return {
    hop: authorizedHop,
    response: retryResponse,
    ...(jarAttached !== undefined ? { jarAttached } : {}),
    jarCaptured,
  };
}

/** The streaming leg of one send — the observer live frames feed plus
 *  the caller's abort signal (Stop). `null` = buffered `send`. */
interface StreamingLeg {
  observer: TransportStreamObserver;
  signal?: AbortSignal;
}

export function createNodeRequestTransport(options: NodeRequestTransportOptions = {}): RequestTransport {
  const fetchFn = options.fetchFn ?? undiciFetch;
  const requestFn = options.requestFn ?? undiciRequest;
  const dispatchSend = async (
    request: TransportRequest,
    streaming: StreamingLeg | null,
  ): Promise<TransportResponse> => {
    // A configured client certificate whose vault entry didn't
    // resolve on this device fails BEFORE the wire — silently
    // dialing a mutual-TLS gateway without the certificate would
    // surface as an opaque handshake failure instead of the real
    // problem.
    if (request.clientCertificateRef !== undefined && request.clientCertificatePem === undefined) {
      throw new TransportError(
        `The request's client-certificate setting references the vault entry "${request.clientCertificateRef}", which doesn't exist on this device. Add a client-certificate entry with that name to the vault, or clear the setting.`,
      );
    }
    if (request.unixSocketPath !== undefined) {
      // A socket-pinned send never opens a TCP connection, so a
      // CONNECT tunnel has nowhere to run — silently picking one of
      // the two would downgrade the other.
      if (request.proxyUrl !== undefined) {
        throw new TransportError(
          "The request sets both a proxy and a Unix socket target, but a proxy tunnel can't dial a local socket. Clear one of the two settings.",
        );
      }
      // Likewise nothing is resolved on a socket dial — the address
      // pin can't apply.
      if (request.resolveToAddress !== undefined) {
        throw new TransportError(
          "The request sets both a Unix socket target and resolve-to-address, but a socket dial resolves no hostname — the address pin can't apply. Clear one of the two settings.",
        );
      }
    }
    // The not-yet-supported version pin fails BEFORE the wire — Phase
    // E (HTTP/3 over QUIC) honors it; until then a send that pins it
    // must fail honestly, never quietly ride another protocol.
    if (request.httpVersion === '3') {
      throw new TransportError('This runtime cannot send HTTP/3 yet. Pick another HTTP version.');
    }
    if (request.proxyUrl !== undefined) {
      // A pinned HTTP/2 send cannot be honored through a proxy — the
      // tunnel's connector owns the ALPN offer, so the pin would
      // silently degrade to an unenforced preference.
      if (request.httpVersion === '2') {
        throw new TransportError(
          "The request pins HTTP/2 and routes through a proxy, but the proxy tunnel owns protocol negotiation — the pin can't be enforced. Set the HTTP version to Auto, or clear the proxy.",
        );
      }
      // A CONNECT tunnel CAN carry raw h2 framing in principle, but
      // this runtime's prior-knowledge pipeline doesn't dial through
      // one yet — fail loudly rather than quietly negotiate via the
      // tunnel's own connector.
      if (request.httpVersion === '2-prior-knowledge') {
        throw new TransportError(
          "The request sends HTTP/2 with prior knowledge and routes through a proxy, but this runtime doesn't carry prior-knowledge HTTP/2 through a tunnel yet. Set the HTTP version to Auto, or clear the proxy.",
        );
      }
      // A resolve-to-address pin cannot be honored through a proxy —
      // the proxy resolves the hostname itself, and the target leg
      // rides the tunnel socket, never a local lookup. Silently
      // letting the proxy win would downgrade the pin.
      if (request.resolveToAddress !== undefined) {
        throw new TransportError(
          "The request sets both a proxy and resolve-to-address, but a proxy resolves the hostname itself — the address pin can't apply. Clear one of the two settings.",
        );
      }
      // Configured proxy credentials whose vault entry didn't resolve
      // on this device fail BEFORE the wire — silently dialing the
      // proxy unauthenticated would surface as an opaque 407 instead
      // of the real problem.
      if (request.proxyCredentialRef !== undefined && request.proxyCredential === undefined) {
        throw new TransportError(
          `The request's proxy-credentials setting references the vault entry "${request.proxyCredentialRef}", which doesn't exist on this device. Add a string entry with that name (holding user:password) to the vault, or clear the setting.`,
        );
      }
    }
    // ONE deadline spans the whole send — every hop of a redirect
    // chain plus the final body read; the abort also cancels a body
    // stream stalled mid-read, which a fetch-only signal would miss.
    // A streaming leg's caller signal (Stop) merges onto the same
    // abort, so both triggers cancel connection AND read alike.
    const deadline = startDeadline(request.timeoutMs, streaming?.signal);
    // ONE dispatcher per send — the connection options can't change
    // across hops, and the cache lookup here keeps `fetchHop` the
    // single place a dispatcher is applied. A `captureNetwork` send
    // trades the shared pool for a send-local instrumented dial (the
    // only correlation-safe way to observe socket phases + endpoints);
    // proxied sends stay on `ProxyAgent` — the tunnel's connector owns
    // the dial and there is nothing honest to observe.
    // A prior-knowledge send never touches undici's wire — every hop
    // rides the hand-rolled h2 session pipeline, so no dispatcher (and
    // no instrumented dial: socket facts for this pipeline are a
    // residual) — its per-send leg carries the same connection-option
    // bag plus the sink its spoken-protocol facts report into.
    const priorKnowledge = request.httpVersion === '2-prior-knowledge';
    const instrumented =
      request.captureNetwork === true && request.proxyUrl === undefined && !priorKnowledge
        ? createInstrumentedDial(connectOptionsFor(request), httpVersionPolicy(request.httpVersion))
        : null;
    const entry = instrumented === null && !priorKnowledge ? dispatcherFor(request) : undefined;
    const dispatcher = instrumented?.agent ?? entry?.dispatcher;
    const h2Spoken = priorKnowledge ? new Map<string, string>() : undefined;
    const h2: H2Leg | null =
      h2Spoken !== undefined
        ? {
            connect: connectOptionsFor(request),
            onProtocol: (origin, alpnProtocol) => h2Spoken.set(origin, alpnProtocol),
          }
        : null;
    // The always-on negotiated-protocol source for this send: the
    // instrumented dial reports through its connection records; a
    // prior-knowledge send reads its own leg's spoken-protocol log;
    // every other direct send reads its dispatcher's per-origin log.
    const negotiated = entry?.negotiatedByOrigin ?? h2Spoken;
    // ONE jar per send, looked up by the request's key — absent key
    // means no cookies attached, Set-Cookie discarded.
    const jar = request.cookieJarKey !== undefined ? cookieJarFor(request.cookieJarKey) : undefined;
    // Phase marks for the snapshot's timing attribution — the send's
    // dispatch instant; the final hop's own dispatch is marked where
    // the loop fires it (see {@link PhaseMarks}).
    const sentAt = performance.now();
    try {
      if (request.redirect === 'manual') {
        // Single-shot: surface the first response verbatim, 3xx included.
        let hop: HopState = {
          url: request.url,
          method: request.method,
          headers: request.headers,
          body: request.body,
        };
        let jarActivity: JarActivity | undefined;
        if (jar !== undefined) {
          const { headers, attached } = withJarCookie(jar, hop);
          hop = { ...hop, headers };
          jarActivity = {
            ...(attached !== undefined ? { cookieHeaderAttached: attached } : {}),
            cookiesCaptured: [],
          };
        }
        const finalHopSentAt = performance.now();
        let response = await wireHop(fetchFn, requestFn, request, hop, deadline, dispatcher, h2);
        if (jar !== undefined && jarActivity !== undefined) {
          jarActivity.cookiesCaptured.push(...captureJarCookies(jar, hop.url, response.headers));
        }
        // Digest second leg — manual mode owns REDIRECT policy, not
        // auth, so the challenge dance runs here too.
        const retry = await digestRetryHop(fetchFn, requestFn, request, hop, response, deadline, dispatcher, jar, h2);
        if (retry !== null) {
          response = retry.response;
          if (jarActivity !== undefined) {
            if (jarActivity.cookieHeaderAttached === undefined && retry.jarAttached !== undefined) {
              jarActivity.cookieHeaderAttached = retry.jarAttached;
            }
            jarActivity.cookiesCaptured.push(...retry.jarCaptured);
          }
        }
        // Manual mode is single-shot — no chain to record.
        return await finalizeResponse(
          response,
          request,
          hop.url,
          deadline,
          false,
          jarActivity,
          undefined,
          { sentAt, finalHopSentAt },
          streaming,
          instrumented?.connections,
          negotiated,
        );
      }
      return await followRedirectChain(
        fetchFn,
        requestFn,
        request,
        deadline,
        dispatcher,
        jar,
        sentAt,
        streaming,
        instrumented?.connections,
        negotiated,
        h2,
      );
    } finally {
      deadline?.clear();
      // The send-local instrumented agent has nothing to pool for —
      // close releases its sockets (graceful: the settled response's
      // body is already read).
      if (instrumented !== null) void instrumented.agent.close();
    }
  };
  return {
    send(request: TransportRequest): Promise<TransportResponse> {
      return dispatchSend(request, null);
    },
    sendStreaming(
      request: TransportRequest,
      observer: TransportStreamObserver,
      signal?: AbortSignal,
    ): Promise<TransportResponse> {
      return dispatchSend(request, { observer, ...(signal !== undefined ? { signal } : {}) });
    },
  };
}

/**
 * The hand-rolled redirect follower. Fetches each hop with
 * `redirect: 'manual'`, applies the fetch spec's method/body demotion
 * and cross-origin Authorization strip (each relaxable by its knob),
 * resolves relative `Location`s against the current hop, and caps the
 * chain at the request's `maxRedirects` (default 20; 0 = fail on any
 * redirect). Intermediate 3xx bodies are canceled so their connections
 * return to the pool; only the FINAL response's body is read.
 */
async function followRedirectChain(
  fetchFn: NodeFetchFn,
  requestFn: NodeRequestFn,
  request: TransportRequest,
  deadline: Deadline,
  dispatcher: Dispatcher | undefined,
  jar: CookieJar | undefined,
  sentAt: number,
  streaming: StreamingLeg | null,
  capture: ReadonlyArray<ConnectionRecord> | undefined,
  negotiated: ReadonlyMap<string, string> | undefined,
  h2: H2Leg | null,
): Promise<TransportResponse> {
  const maxRedirects = request.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  let hop: HopState = { url: request.url, method: request.method, headers: request.headers, body: request.body };
  let authorizationForwarded = false;
  let redirects = 0;
  let jarActivity: JarActivity | undefined = jar !== undefined ? { cookiesCaptured: [] } : undefined;
  // Per-hop attribution for the snapshot — one record per hop that
  // REDIRECTED (the final response is the snapshot itself). The loop
  // owns the chain, so only this transport can record it.
  const redirectChain: TransportRedirectHop[] = [];
  while (true) {
    // The jar contributes per hop, computed fresh against the CURRENT
    // hop's URL — a cookie set mid-chain rides the next hop, and a
    // cookie that doesn't domain/path-match a cross-origin hop stays
    // home (the jar's matching IS the cross-origin discipline). The
    // contribution never joins the persistent hop state, so it can't
    // masquerade as a user-set header on later hops.
    let sendHop = hop;
    if (jar !== undefined && jarActivity !== undefined) {
      const { headers, attached } = withJarCookie(jar, hop);
      sendHop = { ...hop, headers };
      if (redirects === 0 && attached !== undefined) jarActivity = { ...jarActivity, cookieHeaderAttached: attached };
    }
    // Marked per iteration so the surviving value is the FINAL hop's
    // dispatch instant — the boundary between the redirect and waiting
    // phases (a digest second leg stays inside this hop's wait).
    const hopSentAt = performance.now();
    let response = await wireHop(fetchFn, requestFn, request, sendHop, deadline, dispatcher, h2);
    if (jar !== undefined && jarActivity !== undefined) {
      jarActivity.cookiesCaptured.push(...captureJarCookies(jar, hop.url, response.headers));
    }
    // Digest second leg — per hop, so a challenge behind a redirect is
    // answered for THAT hop's method + target. The authorized hop
    // replaces the current one, and a 401 on the resend flows on as a
    // normal (final) response — at most one auth retry per hop by
    // construction.
    const retry = await digestRetryHop(fetchFn, requestFn, request, hop, response, deadline, dispatcher, jar, h2);
    if (retry !== null) {
      response = retry.response;
      hop = retry.hop;
      if (jarActivity !== undefined) {
        if (redirects === 0 && jarActivity.cookieHeaderAttached === undefined && retry.jarAttached !== undefined) {
          jarActivity = { ...jarActivity, cookieHeaderAttached: retry.jarAttached };
        }
        jarActivity.cookiesCaptured.push(...retry.jarCaptured);
      }
    }
    const location = REDIRECT_STATUSES.has(response.status) ? response.headers.get('location') : null;
    if (location === null)
      return finalizeResponse(
        response,
        request,
        hop.url,
        deadline,
        authorizationForwarded,
        jarActivity,
        redirectChain,
        { sentAt, finalHopSentAt: hopSentAt },
        streaming,
        capture,
        negotiated,
      );
    await response.body?.cancel();
    if (redirects >= maxRedirects) {
      throw new TransportError(`Stopped after ${maxRedirects} redirects — the request's redirect limit.`);
    }
    redirects++;
    const next = nextHop(hop, response.status, location, request);
    authorizationForwarded ||= next.authorization === 'forwarded';
    redirectChain.push({
      url: hop.url,
      method: hop.method,
      status: response.status,
      statusText: response.statusText,
      location,
      ...(next.methodChangedTo !== undefined ? { methodChangedTo: next.methodChangedTo } : {}),
      ...(next.authorization !== undefined ? { authorization: next.authorization } : {}),
    });
    hop = next.hop;
  }
}

/**
 * Derive the next hop from a redirect response: resolve the (possibly
 * relative) `Location` against the current URL, apply the spec's
 * method/body demotion (301/302 POST→GET, 303 any-non-GET/HEAD→GET;
 * 307/308 always preserve) unless `followOriginalHttpMethod` keeps it,
 * and strip `Authorization` when the hop crosses origin unless
 * `followAuthorizationHeader` keeps it. What the derivation DID —
 * method demotion, Authorization strip/forward — is reported alongside
 * so the caller can record the hop and mark the response.
 */
function nextHop(
  prev: HopState,
  status: number,
  location: string,
  request: TransportRequest,
): { hop: HopState; methodChangedTo?: string; authorization?: 'stripped' | 'forwarded' } {
  let nextUrl: URL;
  try {
    nextUrl = new URL(location, prev.url);
  } catch {
    throw new TransportError(`Redirect points to an invalid URL: "${location}".`);
  }
  let method = prev.method;
  let body = prev.body;
  let headers = prev.headers;
  const demoteToGet =
    request.followOriginalHttpMethod !== true &&
    ((status === 303 && method !== 'GET' && method !== 'HEAD') ||
      ((status === 301 || status === 302) && method === 'POST'));
  if (demoteToGet) {
    method = 'GET';
    body = { kind: 'none' };
    headers = headers.filter((h) => !BODY_HEADERS.has(h.key.toLowerCase()));
  }
  let authorization: 'stripped' | 'forwarded' | undefined;
  const crossOrigin = new URL(prev.url).origin !== nextUrl.origin;
  if (crossOrigin && headers.some((h) => h.key.toLowerCase() === 'authorization')) {
    if (request.followAuthorizationHeader === true) {
      authorization = 'forwarded';
    } else {
      authorization = 'stripped';
      headers = headers.filter((h) => h.key.toLowerCase() !== 'authorization');
    }
  }
  return {
    hop: { url: nextUrl.toString(), method, headers, body },
    ...(demoteToGet ? { methodChangedTo: method } : {}),
    ...(authorization !== undefined ? { authorization } : {}),
  };
}

/**
 * Per-send prior-knowledge pipeline leg — present exactly when the
 * request pins `'2-prior-knowledge'`. Carries the connection-option
 * bag every hop's h2 session dials with (computed once, the
 * one-dispatcher-per-send discipline) and the sink the pipeline's
 * spoken-protocol facts report into — the always-on report's source
 * for sends that never touch a dispatcher.
 */
interface H2Leg {
  connect: ConnectOptions;
  onProtocol(origin: string, alpnProtocol: string): void;
}

/** One wire round-trip for a hop, on whichever pipeline can carry it:
 *  the prior-knowledge h2 session for EVERY hop of a
 *  `'2-prior-knowledge'` send (it carries GET/HEAD bodies and native
 *  trailers itself); otherwise fetch for every ordinary hop,
 *  `request()` for a GET/HEAD hop with a body (fetch refuses to
 *  construct those) and for gRPC hops (fetch exposes no trailers —
 *  see {@link grpcHop}). */
async function wireHop(
  fetchFn: NodeFetchFn,
  requestFn: NodeRequestFn,
  request: TransportRequest,
  hop: HopState,
  deadline: Deadline,
  dispatcher: Dispatcher | undefined,
  h2: H2Leg | null,
): Promise<HopResponse> {
  if (h2 !== null) return h2Hop(request, hop, deadline, h2);
  if (bodylessMethodWithBody(hop) || grpcHop(hop)) return requestHop(requestFn, request, hop, deadline, dispatcher);
  return fetchHop(fetchFn, request, hop, deadline, dispatcher);
}

/**
 * One wire round-trip over the prior-knowledge h2 pipeline — a fresh
 * `node:http2` session speaking the h2 preface from its first byte,
 * TLS and cleartext alike (see `h2-prior-knowledge.ts`). Rides the
 * same deadline and error classification as the other wire paths and
 * adapts onto the same hop surface via {@link adaptRequestResponse}
 * (the stream is the body; trailers fill after the capped read).
 */
async function h2Hop(request: TransportRequest, hop: HopState, deadline: Deadline, h2: H2Leg): Promise<HopResponse> {
  const { payload, contentType } = await buildH2Body(hop.body);
  const headers =
    contentType !== undefined && !hop.headers.some((h) => h.key.toLowerCase() === 'content-type')
      ? [...hop.headers, { key: 'content-type', value: contentType }]
      : hop.headers;
  try {
    const response = await h2PriorKnowledgeHop({
      url: hop.url,
      method: hop.method.toUpperCase(),
      headers,
      ...(payload !== undefined ? { payload } : {}),
      connect: h2.connect,
      ...(deadline ? { signal: deadline.signal } : {}),
      onProtocol: h2.onProtocol,
    });
    return adaptRequestResponse(hop.url, response);
  } catch (err) {
    if (deadline?.expired()) throw timeoutError(request.timeoutMs);
    throw new TransportError(classifyFetchFailure(hop.url, err, request));
  }
}

/** One wire round-trip over fetch. Always `redirect: 'manual'` — the
 *  chain is chased (or surfaced) by the caller, never by undici. */
async function fetchHop(
  fetchFn: NodeFetchFn,
  request: TransportRequest,
  hop: HopState,
  deadline: Deadline,
  dispatcher: Dispatcher | undefined,
): Promise<HopResponse> {
  const init: NodeRequestInit = {
    method: hop.method,
    headers: buildHeaders(hop.headers),
    redirect: 'manual',
    // No ambient cookie jar in the main process, so `credentials` has
    // nothing to ride — cookies only travel when the send's opt-in jar
    // attached a header upstream (see `withJarCookie`).
  };
  // The per-request connection policy rides EVERY hop of the chain.
  if (dispatcher !== undefined) init.dispatcher = dispatcher;
  const body = buildBody(hop.body);
  if (body !== undefined) init.body = body;
  if (deadline) init.signal = deadline.signal;
  try {
    return await fetchFn(hop.url, init);
  } catch (err) {
    if (deadline?.expired()) throw timeoutError(request.timeoutMs);
    throw new TransportError(classifyFetchFailure(hop.url, err, request));
  }
}

/**
 * One wire round-trip over undici `request()` — the pipeline for hops
 * fetch cannot carry faithfully: a GET/HEAD hop with a body (WHATWG
 * fetch refuses to construct one, but HTTP allows it and real APIs use
 * it) and gRPC hops (fetch exposes no HTTP trailers, where gRPC puts
 * its status). Rides the same dispatcher, deadline, and error
 * classification as the fetch path; never follows redirects on its
 * own, matching the fetch path's `redirect: 'manual'`.
 */
async function requestHop(
  requestFn: NodeRequestFn,
  request: TransportRequest,
  hop: HopState,
  deadline: Deadline,
  dispatcher: Dispatcher | undefined,
): Promise<HopResponse> {
  const { body, contentType } = buildRequestBody(hop.body);
  const headers = buildHeaders(hop.headers);
  if (contentType !== undefined && !headers.has('content-type')) headers.set('content-type', contentType);
  try {
    const response = await requestFn(hop.url, {
      method: hop.method.toUpperCase(),
      headers,
      ...(body !== undefined ? { body } : {}),
      ...(dispatcher !== undefined ? { dispatcher } : {}),
      ...(deadline ? { signal: deadline.signal } : {}),
    });
    return adaptRequestResponse(hop.url, response);
  } catch (err) {
    if (deadline?.expired()) throw timeoutError(request.timeoutMs);
    throw new TransportError(classifyFetchFailure(hop.url, err, request));
  }
}

/** Flatten undici's `Record<string, string | string[]>` field shape to
 *  seam headers, arrays entry-wise. */
function transportHeadersOf(record: Record<string, string | string[] | undefined>): TransportHeader[] {
  const out: TransportHeader[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) out.push({ key, value: v });
    } else {
      out.push({ key, value });
    }
  }
  return out;
}

/**
 * Map an undici `request()` result onto the hop surface: headers
 * re-minted as fetch `Headers` (`set-cookie` arrays preserved
 * entry-wise for the jar), the body's Node stream bridged to a web
 * stream for the capped read, the reason phrase from the canonical
 * status table (`request()` does not surface one), and trailers as a
 * thunk over undici's live trailers object — it fills only once the
 * body has been consumed, so the reader must ask after the capped read.
 */
function adaptRequestResponse(url: string, response: NodeRequestResponse): HopResponse {
  const headers = new Headers();
  for (const { key, value } of transportHeadersOf(response.headers)) headers.append(key, value);
  return {
    status: response.statusCode,
    statusText: STATUS_CODES[response.statusCode] ?? '',
    url,
    headers,
    body: Readable.toWeb(response.body),
    trailers: () => transportHeadersOf(response.trailers ?? {}),
  };
}

/** Whether this request carries any TLS version / cipher tuning — the
 *  error classifier only points at those settings when they exist. */
function tlsTuned(request: TransportRequest): boolean {
  return (
    request.tlsMinVersion !== undefined || request.tlsMaxVersion !== undefined || request.tlsCipherSuites !== undefined
  );
}

/** Read the final response's body under the cap and map it to the
 *  seam's `TransportResponse`. Only ever called on the LAST hop —
 *  intermediate 3xx bodies are canceled, not read. A streaming leg
 *  surfaces the head to the observer BEFORE the read (so status +
 *  headers render while the body streams) and rides its chunks through
 *  the capped read; a mid-body abort or connection failure then
 *  materializes the partial body with `streamEndedEarly` instead of
 *  throwing — once the head is in, arrived bytes are never discarded. */
/** Dispatch instants for the snapshot's phase timing — the send as a
 *  whole and the FINAL hop (the redirect/waiting boundary). Manual
 *  marks: undici exposes no per-request timings on either result
 *  surface, and its diagnostics_channel events carry no per-send
 *  correlation token (probed on 7.24.6) — so the transport measures
 *  the phases its own loop delimits. DNS/connect/TLS are not
 *  observable per send without an always-custom connector; they sit
 *  inside the waiting phase, and the view says so. */
interface PhaseMarks {
  sentAt: number;
  finalHopSentAt: number;
}

/** Clamp a mark delta to a non-negative tenth of a millisecond. */
function phaseMs(ms: number): number {
  return Math.max(0, Math.round(ms * 10) / 10);
}

/**
 * Socket phase legs from the send's FIRST instrumented dial — the one
 * connection a redirect-free send rides end to end. A chained send's
 * dial belongs to its first hop, inside the redirect phase, so the
 * legs are omitted rather than mis-attributed. `readyAt` hands the
 * caller the waiting phase's true near edge.
 */
function socketLegsOf(
  capture: ReadonlyArray<ConnectionRecord> | undefined,
  hadRedirects: boolean,
): { dnsMs?: number; connectMs: number; tlsMs?: number; readyAt: number } | undefined {
  if (hadRedirects || capture === undefined) return undefined;
  const first = capture[0];
  if (first === undefined || first.readyAt === undefined || first.tcpEndAt === undefined) return undefined;
  return {
    ...(first.dnsEndAt !== undefined ? { dnsMs: phaseMs(first.dnsEndAt - first.startAt) } : {}),
    connectMs: phaseMs(first.tcpEndAt - (first.dnsEndAt ?? first.startAt)),
    ...(first.tlsUsed ? { tlsMs: phaseMs(first.readyAt - first.tcpEndAt) } : {}),
    readyAt: first.readyAt,
  };
}

/**
 * Connection facts for the socket that served the FINAL hop: the last
 * completed dial whose `hostname:port` matches the final URL (a
 * redirect chain dials once per origin; the final response rides the
 * last match). Falls back to the last completed dial when the origin
 * can't be matched (socket-path dials record the path).
 */
/** `hostname:port` a URL's final hop dialed — the key connectors
 *  record their facts under (socket-path dials key by the path). */
function originOfUrl(finalUrl: string): string | undefined {
  try {
    const url = new URL(finalUrl);
    const port = url.port !== '' ? url.port : url.protocol === 'https:' ? '443' : '80';
    return `${url.hostname}:${port}`;
  } catch {
    return undefined;
  }
}

/**
 * The always-on negotiated protocol for a non-instrumented send: the
 * dispatcher's per-origin log entry for the connection that served
 * the final hop. Absent when the send had no log (proxied) or the
 * origin never completed a dial this dispatcher remembers.
 */
function negotiatedProtocolFor(
  negotiated: ReadonlyMap<string, string> | undefined,
  request: TransportRequest,
  finalUrl: string,
): string | undefined {
  if (negotiated === undefined) return undefined;
  if (request.unixSocketPath !== undefined) return negotiated.get(request.unixSocketPath);
  const origin = originOfUrl(finalUrl);
  return origin !== undefined ? negotiated.get(origin) : undefined;
}

function networkFactsOf(
  capture: ReadonlyArray<ConnectionRecord> | undefined,
  finalUrl: string,
): TransportNetworkFacts | undefined {
  if (capture === undefined) return undefined;
  const completed = capture.filter((c) => c.readyAt !== undefined);
  if (completed.length === 0) return undefined;
  const origin = originOfUrl(finalUrl);
  let record: ConnectionRecord | undefined;
  for (let i = completed.length - 1; i >= 0; i--) {
    if (completed[i]?.origin === origin) {
      record = completed[i];
      break;
    }
  }
  record ??= completed[completed.length - 1];
  if (record === undefined) return undefined;
  return {
    ...(record.alpnProtocol !== undefined ? { httpVersion: record.alpnProtocol } : {}),
    ...(record.localAddress !== undefined ? { localAddress: record.localAddress } : {}),
    ...(record.localPort !== undefined ? { localPort: record.localPort } : {}),
    ...(record.remoteAddress !== undefined ? { remoteAddress: record.remoteAddress } : {}),
    ...(record.remotePort !== undefined ? { remotePort: record.remotePort } : {}),
  };
}

async function finalizeResponse(
  response: HopResponse,
  request: TransportRequest,
  finalUrl: string,
  deadline: Deadline,
  authorizationForwarded: boolean,
  jarActivity: JarActivity | undefined,
  redirectChain: ReadonlyArray<TransportRedirectHop> | undefined,
  marks: PhaseMarks,
  streaming: StreamingLeg | null,
  capture?: ReadonlyArray<ConnectionRecord>,
  negotiated?: ReadonlyMap<string, string>,
): Promise<TransportResponse> {
  const headAt = performance.now();
  const headers: TransportHeader[] = [];
  response.headers.forEach((value, key) => {
    headers.push({ key, value });
  });
  streaming?.observer.onHead({
    status: response.status,
    statusText: response.statusText,
    url: response.url || finalUrl,
    headers,
  });
  let read: Awaited<ReturnType<typeof readCappedBody>>;
  try {
    read = await readCappedBody(
      response,
      request.maxBodyBytes,
      streaming !== null
        ? { onChunk: (bytes, totalBytes) => streaming.observer.onChunk(bytes, totalBytes), deadline }
        : undefined,
    );
  } catch (err) {
    if (deadline?.expired()) throw timeoutError(request.timeoutMs);
    throw err;
  }
  // The capped read just ended — the download phase's far edge.
  const readEndedAt = performance.now();
  // Trailers arrive after the body — ask only now that the capped read
  // has consumed it. Only `request()` hops carry the thunk (fetch
  // exposes no trailers); a truncated read may have canceled the
  // stream before they arrived, in which case the object is empty.
  const trailers = response.trailers?.() ?? [];
  const hadRedirects = redirectChain !== undefined && redirectChain.length > 0;
  // Instrumented sends split the socket legs out of Waiting; the
  // waiting phase then starts at socket readiness instead of dispatch.
  const legs = socketLegsOf(capture, hadRedirects);
  const network = networkFactsOf(capture, response.url || finalUrl);
  // The always-on protocol fact — from the instrumented dial's record
  // when the send had one, from the dispatcher's per-origin log
  // otherwise. Always the wire's answer, never the knob's.
  const wireVersion = network?.httpVersion ?? negotiatedProtocolFor(negotiated, request, response.url || finalUrl);
  return {
    status: response.status,
    statusText: response.statusText,
    url: response.url || finalUrl,
    headers,
    ...(trailers.length > 0 ? { trailers } : {}),
    ...(hadRedirects ? { redirectChain } : {}),
    phaseTimings: {
      ...(hadRedirects ? { redirectMs: phaseMs(marks.finalHopSentAt - marks.sentAt) } : {}),
      ...(legs !== undefined
        ? {
            ...(legs.dnsMs !== undefined ? { dnsMs: legs.dnsMs } : {}),
            connectMs: legs.connectMs,
            ...(legs.tlsMs !== undefined ? { tlsMs: legs.tlsMs } : {}),
          }
        : {}),
      waitingMs: phaseMs(headAt - (legs?.readyAt ?? marks.finalHopSentAt)),
      downloadMs: phaseMs(readEndedAt - headAt),
    },
    ...(network !== undefined ? { network } : {}),
    ...(wireVersion !== undefined ? { httpVersion: wireVersion } : {}),
    body: read.body,
    ...(read.bodyEncoding ? { bodyEncoding: read.bodyEncoding } : {}),
    bodyBytes: read.bodyBytes,
    bodyTruncated: read.bodyTruncated,
    ...(read.endedEarly !== undefined ? { streamEndedEarly: read.endedEarly } : {}),
    ...(authorizationForwarded ? { authorizationForwarded: true } : {}),
    ...(jarActivity?.cookieHeaderAttached !== undefined
      ? { cookieHeaderAttached: jarActivity.cookieHeaderAttached }
      : {}),
    ...(jarActivity !== undefined && jarActivity.cookiesCaptured.length > 0
      ? { cookiesCaptured: jarActivity.cookiesCaptured }
      : {}),
  };
}

/**
 * Arm an abort deadline for the round-trip; `null` when neither trigger
 * exists. A streaming leg's external signal (the executor's Stop hook)
 * merges onto the same controller so one signal spans connection and
 * body read for both triggers — `expired()` still names only the
 * timeout, which is how callers tell the two apart.
 */
function startDeadline(timeoutMs: number | undefined, externalSignal?: AbortSignal) {
  if (timeoutMs === undefined && externalSignal === undefined) return null;
  const controller = new AbortController();
  let expired = false;
  const timer =
    timeoutMs === undefined
      ? null
      : setTimeout(() => {
          expired = true;
          controller.abort();
        }, timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (externalSignal !== undefined) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', onExternalAbort);
  }
  return {
    signal: controller.signal,
    expired: () => expired,
    clear: () => {
      if (timer !== null) clearTimeout(timer);
      externalSignal?.removeEventListener('abort', onExternalAbort);
    },
  };
}

function timeoutError(timeoutMs: number | undefined): TransportError {
  return new TransportError(`Request timed out after ${timeoutMs} ms.`);
}

/**
 * Stream the response body, retaining at most `maxBodyBytes` and aborting
 * the read once the upstream overflows the cap. This is the load-bearing
 * memory bound on the always-on main process: `response.text()` would
 * buffer the *entire* upstream body — a multi-gigabyte or chunked-unbounded
 * response from a misconfigured/hostile cadence target OOMs the shared
 * process before any post-read cap could apply. We accumulate at most the
 * cap plus one in-flight chunk, then `cancel()` the stream.
 */
/** The streaming leg's slice of the capped read — per-chunk surfacing
 *  plus the merged deadline signal that classifies a read rejection
 *  (signal fired = aborted; anything else = mid-body failure). */
interface CappedReadStreaming {
  onChunk(bytes: Uint8Array, totalBytes: number): void;
  deadline: Deadline;
}

async function readCappedBody(
  response: HopResponse,
  maxBodyBytes: number,
  streaming?: CappedReadStreaming,
): Promise<{
  body: string;
  bodyEncoding?: 'base64';
  bodyBytes: number;
  bodyTruncated: boolean;
  endedEarly?: { reason: 'aborted' | 'error'; message?: string };
}> {
  const stream = response.body;
  if (!stream) {
    // No readable stream (empty body / HEAD) — nothing to bound.
    return { body: '', bodyBytes: 0, bodyTruncated: false };
  }
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let bytesRead = 0;
  let truncated = false;
  let endedEarly: { reason: 'aborted' | 'error'; message?: string } | undefined;
  try {
    while (true) {
      let result: Awaited<ReturnType<typeof reader.read>>;
      try {
        result = await reader.read();
      } catch (err) {
        // Buffered reads keep today's contract — the rejection
        // propagates (deadline expiry maps to the timeout error at the
        // caller). A streaming read materializes the partial instead:
        // an abort (Stop or deadline, told apart by the executor) and a
        // mid-body connection failure both settle with what arrived.
        if (streaming === undefined) throw err;
        const aborted = streaming.deadline?.signal.aborted === true;
        endedEarly = aborted
          ? { reason: 'aborted' }
          : { reason: 'error', message: err instanceof Error ? err.message : String(err) };
        break;
      }
      if (result.done) break;
      const value = result.value;
      if (!value || value.byteLength === 0) continue;
      const before = bytesRead;
      parts.push(value);
      bytesRead += value.byteLength;
      if (streaming !== undefined) {
        // Live chunks carry only cap-bounded bytes, so the tail never
        // shows bytes the materialized body won't keep.
        const allowed = Math.min(value.byteLength, Math.max(0, maxBodyBytes - before));
        if (allowed > 0) {
          streaming.onChunk(
            allowed === value.byteLength ? value : value.subarray(0, allowed),
            Math.min(bytesRead, maxBodyBytes),
          );
        }
      }
      if (bytesRead > maxBodyBytes) {
        truncated = true;
        try {
          await reader.cancel();
        } catch {
          // Upstream already failed — the retained bytes still stand.
        }
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }
  return {
    ...decodeCapped(parts, bytesRead, maxBodyBytes, truncated),
    ...(endedEarly !== undefined ? { endedEarly } : {}),
  };
}

/** Concatenate the retained chunks, cap to `maxBodyBytes`, and
 *  materialize losslessly: valid UTF-8 stays text, anything else goes
 *  base64 with the encoding marked. Shared cap arithmetic so the byte
 *  count + truncation flag stay consistent with what's materialized. */
function decodeCapped(
  parts: ReadonlyArray<Uint8Array>,
  bytesRead: number,
  maxBodyBytes: number,
  truncated: boolean,
): { body: string; bodyEncoding?: 'base64'; bodyBytes: number; bodyTruncated: boolean } {
  const retained = Math.min(bytesRead, maxBodyBytes);
  const buf = new Uint8Array(retained);
  let offset = 0;
  for (const part of parts) {
    if (offset >= retained) break;
    const take = Math.min(part.byteLength, retained - offset);
    buf.set(part.subarray(0, take), offset);
    offset += take;
  }
  return { ...materializeBody(buf, truncated), bodyBytes: retained, bodyTruncated: truncated };
}

function buildHeaders(headers: ReadonlyArray<TransportHeader>): Headers {
  const out = new Headers();
  for (const { key, value } of headers) out.append(key, value);
  return out;
}

/**
 * Materialize the data-only body into a Node fetch `BodyInit`. For
 * urlencoded / multipart the constructed object sets its own
 * Content-Type (with the multipart boundary), so we must NOT pre-set one
 * — the engine already stripped a user multipart Content-Type. Returns
 * `undefined` for `none` (no body attached).
 */
function buildBody(body: TransportBody): NodeRequestInit['body'] {
  switch (body.kind) {
    case 'none':
      return undefined;
    case 'raw':
      return body.content;
    case 'urlencoded': {
      const params = new URLSearchParams();
      for (const f of body.fields) params.append(f.name, f.value);
      return params;
    }
    case 'multipart':
      return buildFormData(body.parts);
    default: {
      const _exhaustive: never = body;
      void _exhaustive;
      return undefined;
    }
  }
}

function buildFormData(parts: ReadonlyArray<TransportMultipartPart>): FormData {
  const form = new FormData();
  for (const part of parts) {
    if (part.kind === 'text') {
      form.append(part.name, part.value);
      continue;
    }
    // Retype the bytes with the part's MIME so the multipart boundary
    // carries the right content-type rather than octet-stream.
    const blob = new Blob([part.bytes], { type: part.mimeType });
    form.append(part.name, blob, part.filename);
  }
  return form;
}

/**
 * Materialize the data-only body for undici `request()`, whose body
 * slot takes text / bytes / FormData but no URLSearchParams —
 * urlencoded serializes here, alongside the Content-Type fetch would
 * have let the object set (a user-set header wins at the call site).
 */
function buildRequestBody(body: TransportBody): { body?: string | FormData; contentType?: string } {
  switch (body.kind) {
    case 'none':
      return {};
    case 'raw':
      return { body: body.content };
    case 'urlencoded': {
      const params = new URLSearchParams();
      for (const f of body.fields) params.append(f.name, f.value);
      return { body: params.toString(), contentType: 'application/x-www-form-urlencoded;charset=UTF-8' };
    }
    case 'multipart':
      return { body: buildFormData(body.parts) };
    default: {
      const _exhaustive: never = body;
      void _exhaustive;
      return {};
    }
  }
}

/**
 * Materialize the data-only body for the prior-knowledge h2 pipeline,
 * which writes payload bytes straight onto its stream: text for raw /
 * urlencoded, and multipart serialized through undici's own encoder —
 * a `Response` over the built FormData yields the exact
 * boundary-framed bytes plus the Content-Type (boundary included)
 * fetch would have sent.
 */
async function buildH2Body(body: TransportBody): Promise<{ payload?: string | Uint8Array; contentType?: string }> {
  switch (body.kind) {
    case 'none':
      return {};
    case 'raw':
      return { payload: body.content };
    case 'urlencoded': {
      const params = new URLSearchParams();
      for (const f of body.fields) params.append(f.name, f.value);
      return { payload: params.toString(), contentType: 'application/x-www-form-urlencoded;charset=UTF-8' };
    }
    case 'multipart': {
      const serialized = new Response(buildFormData(body.parts));
      const contentType = serialized.headers.get('content-type');
      return {
        payload: new Uint8Array(await serialized.arrayBuffer()),
        ...(contentType !== null ? { contentType } : {}),
      };
    }
    default: {
      const _exhaustive: never = body;
      void _exhaustive;
      return {};
    }
  }
}

/** One link of a thrown error's `cause` chain — see {@link causeChain}. */
interface CauseLink {
  code?: string;
  message?: string;
}

/**
 * Flatten an error's `cause` chain (the error itself included) into
 * plain links. undici wraps failures in LAYERS: a direct connect error
 * is one `cause` deep, but a rejected proxy CONNECT is two — the first
 * cause carries a NUMERIC `code: 0` ("Request was cancelled.") and only
 * its own cause holds the meaningful `UND_ERR_ABORTED` + the
 * "Proxy response (N) !== 200" message (verified against a live
 * CONNECT proxy). Callers pick the first STRING code in the chain and
 * search every message. Depth-capped defensively.
 */
function causeChain(err: unknown): CauseLink[] {
  const links: CauseLink[] = [];
  let current: unknown = err;
  for (let depth = 0; depth < 8 && current !== null && typeof current === 'object'; depth++) {
    const record = current as { code?: unknown; message?: unknown; cause?: unknown };
    links.push({
      ...(typeof record.code === 'string' ? { code: record.code } : {}),
      ...(typeof record.message === 'string' ? { message: record.message } : {}),
    });
    current = record.cause;
  }
  return links;
}

/** `host:port` of the request's proxy URL, for error messages. */
function proxyHostOf(proxyUrl: string): string {
  try {
    return new URL(proxyUrl).host;
  } catch {
    return proxyUrl;
  }
}

/**
 * Turn a thrown Node `fetch` error into a user-actionable message.
 * undici wraps the OS error in a `cause` chain with a `code` — far
 * more precise than the browser's opaque "Failed to fetch". Proxied
 * sends distinguish WHICH hop failed: a refused/unresolved/timed-out
 * connect can only be the proxy itself (target dialing happens at the
 * proxy), and a rejected CONNECT surfaces the proxy's status — 407
 * names the proxy-credentials setting, anything else names the tunnel.
 * Connect-level failures on a send that pins its address name the
 * resolve-to-address setting (the user's first question is "did my
 * pin do this?"); a socket-pinned send names the Unix-socket setting
 * and the path on every dial-level failure (missing socket file =
 * `ENOENT` — an overlong path fails the same way; non-socket file =
 * `ENOTSOCK`; permissions = `EACCES`; nothing listening =
 * `ECONNREFUSED`; all probed against a live socket rig); handshake
 * failures name the TLS settings only when they are tuned;
 * certificate-demand alerts, cert-material load failures, and
 * mid-handshake closes name the client-certificate setting when one
 * is configured.
 */
function classifyFetchFailure(url: string, err: unknown, request: TransportRequest): string {
  const tuned = tlsTuned(request);
  const pinned = request.resolveToAddress;
  const certRef = request.clientCertificateRef;
  const proxied = request.proxyUrl;
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    // Fall through with an empty host — the raw message still helps.
  }
  const chain = causeChain(err);
  const code = chain.find((link) => link.code !== undefined && link.code !== '')?.code;
  const cause = err && typeof err === 'object' && 'cause' in err ? (err as { cause: unknown }).cause : undefined;
  if (proxied !== undefined) {
    // A rejected CONNECT is a normal proxy RESPONSE undici turns into
    // an abort — the status only survives in the wrapped message.
    const tunnel = chain
      .map((link) => (link.message !== undefined ? /Proxy response \((\d+)\) !== 200/.exec(link.message) : null))
      .find((match) => match !== null);
    if (tunnel) {
      const status = Number(tunnel[1]);
      if (status === 407) {
        return request.proxyCredentialRef !== undefined
          ? `The proxy at ${proxyHostOf(proxied)} rejected the credentials (407). Check the request's proxy-credentials setting — the vault entry "${request.proxyCredentialRef}" may hold the wrong user:password.`
          : `The proxy at ${proxyHostOf(proxied)} requires authentication (407). Set the request's proxy-credentials setting to a vault string entry holding user:password.`;
      }
      return `The proxy at ${proxyHostOf(proxied)} could not open a tunnel to ${host} (HTTP ${status}). The proxy is reachable — the failure is between the proxy and the target.`;
    }
  }
  // A socket-pinned send never dials TCP, so every dial-level failure
  // is about the socket itself — name the setting and the path. Codes
  // outside this set (TLS handshake, cert material, resets) fall
  // through to the shared classification below.
  const socketPath = request.unixSocketPath;
  if (socketPath !== undefined) {
    switch (code) {
      case 'ENOENT': {
        // An overlong path fails as ENOENT too — the OS truncates or
        // rejects anything past its sun_path limit (probed live).
        const lengthHint =
          socketPath.length > 100
            ? ' Paths longer than the OS limit on socket paths (~104 characters) also fail this way.'
            : '';
        return `No socket at ${socketPath} — the request's Unix-socket setting dials it. Is the service running and the path right?${lengthHint}`;
      }
      case 'ENOTSOCK':
        return `The path ${socketPath} exists but is not a socket — the request's Unix-socket setting dials it.`;
      case 'EACCES':
        return `Permission denied opening the socket at ${socketPath} — the request's Unix-socket setting dials it.`;
      case 'ECONNREFUSED':
        return `Connection refused on the socket at ${socketPath} — the request's Unix-socket setting dials it. Is the service still listening on that socket?`;
      case 'ETIMEDOUT':
      case 'UND_ERR_CONNECT_TIMEOUT':
        return `Connection on the socket at ${socketPath} timed out — the request's Unix-socket setting dials it.`;
    }
  }
  switch (code) {
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return proxied !== undefined
        ? `Could not resolve the proxy host ${proxyHostOf(proxied)} (DNS lookup failed). Check the request's proxy URL.`
        : `Could not resolve host ${host} (DNS lookup failed). Check the URL and your network.`;
    case 'ECONNREFUSED':
      if (proxied !== undefined) {
        return `Connection refused by the proxy at ${proxyHostOf(proxied)} — the request routes this send through it. Is the proxy running?`;
      }
      return pinned !== undefined
        ? `Connection refused at ${pinned} — the request's resolve-to-address setting points ${host} there. Is the service listening on that address and the URL's port?`
        : `Connection refused by ${host}. Is the service running on that host/port?`;
    case 'EHOSTUNREACH':
    case 'ENETUNREACH':
      if (proxied !== undefined) {
        return `No route to the proxy at ${proxyHostOf(proxied)} (${code}) — the request routes this send through it.`;
      }
      return pinned !== undefined
        ? `No route to ${pinned} (${code}) — the request's resolve-to-address setting points ${host} there.`
        : `No route to host ${host} (${code}).`;
    case 'ETIMEDOUT':
    case 'UND_ERR_CONNECT_TIMEOUT':
      if (proxied !== undefined) {
        return `Connection to the proxy at ${proxyHostOf(proxied)} timed out — the request routes this send through it.`;
      }
      return pinned !== undefined
        ? `Connection to ${host} timed out — the request's resolve-to-address setting points it at ${pinned}.`
        : `Connection to ${host} timed out.`;
    case 'ECONNRESET':
      // A prior-knowledge send opens with the h2 preface — servers
      // that don't speak HTTP/2 directly often just drop the
      // connection, so the reset points at the setting.
      return request.httpVersion === '2-prior-knowledge'
        ? `Connection to ${host} was reset. The request's "HTTP version" setting sends HTTP/2 with prior knowledge — servers that don't speak HTTP/2 directly often drop the connection. Set it to Auto to negotiate the version instead.`
        : `Connection to ${host} was reset.`;
    // ── Client-certificate handshake alerts (verified live on Node
    // 22.18 / undici 7.24.6 against a certificate-demanding server).
    // TLS 1.3 gateways send certificate_required; TLS 1.2 stacks send
    // a bare handshake_failure alert; a presented-but-rejected cert
    // surfaces as bad_certificate on either.
    case 'ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED':
      return certRef !== undefined
        ? `${host} requires a client certificate and rejected the handshake (${code}). The request presents the vault entry "${certRef}" — check that its certificate is one this server accepts.`
        : `${host} requires a client certificate (${code}). Pick one in the request's "Client certificate" setting.`;
    case 'ERR_SSL_SSLV3_ALERT_BAD_CERTIFICATE':
    case 'ERR_SSL_SSLV3_ALERT_CERTIFICATE_UNKNOWN':
      return certRef !== undefined
        ? `${host} rejected the presented client certificate (${code}). Check the request's client-certificate setting — the vault entry "${certRef}" may be expired, revoked, or signed by a CA this server doesn't trust.`
        : `${host} rejected a certificate during the TLS handshake (${code}).`;
    case 'CERT_HAS_EXPIRED':
    case 'DEPTH_ZERO_SELF_SIGNED_CERT':
    case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
      return `TLS certificate error reaching ${host} (${code}).`;
    case 'ERR_SSL_NO_CIPHER_MATCH':
      return `No usable cipher suite for ${host} (${code}). Check the request's "TLS cipher suites" setting — none of the listed suites could be used for this connection.`;
    // ── Pinned-HTTP/2 honest failures. The dial's own guard fails a
    // hop that negotiated something else (or a cleartext hop, which
    // has no ALPN seat at all); a server that refuses the h2-only
    // offer outright severs the handshake with a no-application-
    // protocol alert instead.
    case H2_NOT_NEGOTIATED_CODE: {
      const detail = chain.find((link) => link.code === H2_NOT_NEGOTIATED_CODE)?.message;
      return `${detail ?? `${host} did not negotiate HTTP/2.`} The request's "HTTP version" setting pins this send to HTTP/2 — set it to Auto to let the server choose.`;
    }
    case 'ERR_SSL_TLSV1_ALERT_NO_APPLICATION_PROTOCOL':
      if (request.httpVersion === '2') {
        return `${host} rejected the HTTP/2-only offer (${code}) — the server doesn't speak HTTP/2. The request's "HTTP version" setting pins this send to HTTP/2; set it to Auto to let the server choose.`;
      }
      // The prior-knowledge TLS dial still offers h2 via ALPN (Node's
      // http2 client always does) — a server alerting here doesn't
      // speak HTTP/2 at all.
      if (request.httpVersion === '2-prior-knowledge') {
        return `${host} rejected the HTTP/2 offer (${code}) — the server doesn't speak HTTP/2. The request's "HTTP version" setting sends HTTP/2 with prior knowledge; set it to Auto to let the server choose.`;
      }
      return `${host} rejected the offered application protocols (${code}).`;
    default: {
      // A mutual-TLS server that dislikes the presented client
      // certificate may simply sever the connection instead of sending
      // an alert — verified live: a Node-style TLS 1.3 server demanding
      // a certificate surfaces UND_ERR_SOCKET, not certificate_required.
      // Named only when a certificate IS configured; an unrelated
      // socket close keeps the generic message below.
      if (code === 'UND_ERR_SOCKET' && certRef !== undefined) {
        return `${host} closed the connection during the exchange. Servers requiring a client certificate close like this when they reject one — check the request's client-certificate setting (vault entry "${certRef}").`;
      }
      // Malformed vault material fails at connect time, before any
      // bytes go out (verified: bad PEM → ERR_OSSL_PEM_NO_START_LINE,
      // mismatched pair → ERR_OSSL_X509_KEY_VALUES_MISMATCH; a wrong
      // key passphrase is an ERR_OSSL_* decrypt error too).
      if (certRef !== undefined && code?.startsWith('ERR_OSSL_')) {
        return `The client certificate from vault entry "${certRef}" could not be loaded (${code}). Check that the entry's certificate and key are valid PEM, belong together, and that the passphrase is right.`;
      }
      // A prior-knowledge send speaks h2 framing from its first byte —
      // a server that answers the preface with anything else surfaces
      // as an HTTP/2 protocol error. Name the setting: the fix is
      // negotiating the version instead of assuming it.
      if (request.httpVersion === '2-prior-knowledge' && code?.startsWith('ERR_HTTP2_')) {
        return `${host} did not answer the HTTP/2 preface (${code}) — it doesn't appear to speak HTTP/2 directly. The request's "HTTP version" setting sends HTTP/2 with prior knowledge; set it to Auto to negotiate the version instead.`;
      }
      // Handshake-level failures (protocol version alerts, unsupported
      // protocol) surface as ERR_SSL_* / EPROTO. A TLS 1.2 server
      // demanding a client certificate sends a bare handshake_failure
      // alert (verified live), so name the client-certificate setting
      // when one is configured; otherwise, when the request tuned its
      // TLS options, name those — the mismatch is usually between the
      // configured version window and what the server accepts.
      if (code !== undefined && (code.startsWith('ERR_SSL_') || code === 'EPROTO')) {
        if (certRef !== undefined) {
          return `TLS handshake with ${host} failed (${code}). The request presents the client certificate from vault entry "${certRef}" — the server may not accept it${tuned ? ', or the TLS version and cipher suite settings may not match what the server accepts' : ''}.`;
        }
        return tuned
          ? `TLS handshake with ${host} failed (${code}). Check the request's TLS version and cipher suite settings against what the server accepts.`
          : `TLS handshake with ${host} failed (${code}).`;
      }
      const causeMsg = cause instanceof Error ? cause.message : undefined;
      if (causeMsg) return `Could not reach ${host}: ${causeMsg}`;
      return err instanceof Error ? err.message : String(err);
    }
  }
}
