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
 *     `allowHttp2`, `resolveToAddress`, and the client-certificate
 *     fields route the send through a dispatcher carrying exactly
 *     those options — knobs browser fetch can never honor. The TLS
 *     options ride the agent's TLS connector;
 *     `allowHttp2` maps to the agent's `allowH2`, which adds h2 to the
 *     ALPN offer on TLS connects (the server picks the protocol; plain
 *     http:// stays HTTP/1.1 — undici fetch has no h2c);
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
  type TransportRequest,
  type TransportResponse,
} from '@openheaders/oracle/live/request-exec/transport';
import {
  Agent,
  type Dispatcher,
  FormData,
  getSetCookies,
  Headers,
  ProxyAgent,
  fetch as undiciFetch,
  request as undiciRequest,
} from 'undici';
import { type CookieJar, cookieJarFor, type SetCookieInput } from './cookie-jar';

/** The fetch pipeline behind the transport — undici's fetch in
 *  production; injectable so tests observe the exact init (including
 *  the dispatcher) without stubbing globals. */
export type NodeFetchFn = typeof undiciFetch;

/** The slice of an undici `request()` result the transport consumes —
 *  the seam is typed to it so tests can hand back plain readables. */
export interface NodeRequestResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: Readable;
}

/** The spec-free pipeline behind GET/HEAD-with-body hops — undici's
 *  `request()` in production; injectable like {@link NodeFetchFn} and
 *  typed to exactly what the transport sends and reads. */
export type NodeRequestFn = (
  url: string,
  options: {
    method: 'GET' | 'HEAD';
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
 * Shared dispatchers keyed by the canonical connection-option tuple.
 * Default sends (no dispatcher-affecting option set) ride undici's
 * global default dispatcher (no override); every send carrying the
 * SAME option tuple shares ONE dispatcher, built on first use —
 * minting one per send would leak a connection pool each time. The
 * value is a plain `Agent` for direct sends and a `ProxyAgent` (a
 * different dispatcher CLASS, not an `Agent` option) for proxied
 * ones — both close gracefully on eviction.
 */
const agentCache = new Map<string, Dispatcher>();

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

function dispatcherFor(request: TransportRequest): Dispatcher | undefined {
  const insecure = request.sslVerification === false;
  const allowH2 = request.allowHttp2 === true;
  const { tlsMinVersion, tlsMaxVersion, tlsCipherSuites, resolveToAddress, clientCertificateRef, proxyUrl } = request;
  const { unixSocketPath } = request;
  if (
    !insecure &&
    !allowH2 &&
    tlsMinVersion === undefined &&
    tlsMaxVersion === undefined &&
    tlsCipherSuites === undefined &&
    resolveToAddress === undefined &&
    clientCertificateRef === undefined &&
    proxyUrl === undefined &&
    unixSocketPath === undefined
  ) {
    return undefined;
  }
  const key = [
    insecure ? 'insecure' : '',
    tlsMinVersion ?? '',
    tlsMaxVersion ?? '',
    tlsCipherSuites ?? '',
    allowH2 ? 'h2' : '',
    resolveToAddress ?? '',
    clientCertKeySegment(request),
    proxyUrl ?? '',
    proxyUrl !== undefined ? proxyCredKeySegment(request) : '',
    unixSocketPath ?? '',
  ].join('|');
  const cached = agentCache.get(key);
  if (cached) return cached;
  const connect = connectOptionsFor(request);
  const dispatcher =
    proxyUrl !== undefined ? buildProxyAgent(proxyUrl, request, connect, allowH2) : buildAgent(connect, allowH2);
  if (agentCache.size >= MAX_AGENTS) {
    const oldest = agentCache.entries().next().value;
    if (oldest) {
      agentCache.delete(oldest[0]);
      void oldest[1].close();
    }
  }
  agentCache.set(key, dispatcher);
  return dispatcher;
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

function buildAgent(connect: ConnectOptions, allowH2: boolean): Agent {
  // `allowH2` is an Agent option, NOT a `connect` option — it sits
  // beside the connector and switches the ALPN offer to h2+http/1.1.
  return new Agent({ connect, ...(allowH2 ? { allowH2: true } : {}) });
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
}

/** True when the hop's method forbids a fetch() body — the WHATWG rule
 *  for GET/HEAD — while the hop still carries one. Those hops take the
 *  `request()` wire path, which enforces no such rule. */
function bodylessMethodWithBody(hop: HopState): boolean {
  const method = hop.method.toUpperCase();
  return (method === 'GET' || method === 'HEAD') && hop.body.kind !== 'none';
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
  const retryResponse = await wireHop(fetchFn, requestFn, request, sendHop, deadline, dispatcher);
  const jarCaptured = jar !== undefined ? captureJarCookies(jar, authorizedHop.url, retryResponse.headers) : [];
  return {
    hop: authorizedHop,
    response: retryResponse,
    ...(jarAttached !== undefined ? { jarAttached } : {}),
    jarCaptured,
  };
}

export function createNodeRequestTransport(options: NodeRequestTransportOptions = {}): RequestTransport {
  const fetchFn = options.fetchFn ?? undiciFetch;
  const requestFn = options.requestFn ?? undiciRequest;
  return {
    async send(request: TransportRequest): Promise<TransportResponse> {
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
      if (request.proxyUrl !== undefined) {
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
      const deadline = startDeadline(request.timeoutMs);
      // ONE dispatcher per send — the connection options can't change
      // across hops, and the cache lookup here keeps `fetchHop` the
      // single place a dispatcher is applied.
      const dispatcher = dispatcherFor(request);
      // ONE jar per send, looked up by the request's key — absent key
      // means no cookies attached, Set-Cookie discarded.
      const jar = request.cookieJarKey !== undefined ? cookieJarFor(request.cookieJarKey) : undefined;
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
          let response = await wireHop(fetchFn, requestFn, request, hop, deadline, dispatcher);
          if (jar !== undefined && jarActivity !== undefined) {
            jarActivity.cookiesCaptured.push(...captureJarCookies(jar, hop.url, response.headers));
          }
          // Digest second leg — manual mode owns REDIRECT policy, not
          // auth, so the challenge dance runs here too.
          const retry = await digestRetryHop(fetchFn, requestFn, request, hop, response, deadline, dispatcher, jar);
          if (retry !== null) {
            response = retry.response;
            if (jarActivity !== undefined) {
              if (jarActivity.cookieHeaderAttached === undefined && retry.jarAttached !== undefined) {
                jarActivity.cookieHeaderAttached = retry.jarAttached;
              }
              jarActivity.cookiesCaptured.push(...retry.jarCaptured);
            }
          }
          return await finalizeResponse(response, request, hop.url, deadline, false, jarActivity);
        }
        return await followRedirectChain(fetchFn, requestFn, request, deadline, dispatcher, jar);
      } finally {
        deadline?.clear();
      }
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
): Promise<TransportResponse> {
  const maxRedirects = request.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  let hop: HopState = { url: request.url, method: request.method, headers: request.headers, body: request.body };
  let authorizationForwarded = false;
  let redirects = 0;
  let jarActivity: JarActivity | undefined = jar !== undefined ? { cookiesCaptured: [] } : undefined;
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
    let response = await wireHop(fetchFn, requestFn, request, sendHop, deadline, dispatcher);
    if (jar !== undefined && jarActivity !== undefined) {
      jarActivity.cookiesCaptured.push(...captureJarCookies(jar, hop.url, response.headers));
    }
    // Digest second leg — per hop, so a challenge behind a redirect is
    // answered for THAT hop's method + target. The authorized hop
    // replaces the current one, and a 401 on the resend flows on as a
    // normal (final) response — at most one auth retry per hop by
    // construction.
    const retry = await digestRetryHop(fetchFn, requestFn, request, hop, response, deadline, dispatcher, jar);
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
      return finalizeResponse(response, request, hop.url, deadline, authorizationForwarded, jarActivity);
    await response.body?.cancel();
    if (redirects >= maxRedirects) {
      throw new TransportError(`Stopped after ${maxRedirects} redirects — the request's redirect limit.`);
    }
    redirects++;
    const next = nextHop(hop, response.status, location, request);
    authorizationForwarded ||= next.authorizationForwarded;
    hop = next.hop;
  }
}

/**
 * Derive the next hop from a redirect response: resolve the (possibly
 * relative) `Location` against the current URL, apply the spec's
 * method/body demotion (301/302 POST→GET, 303 any-non-GET/HEAD→GET;
 * 307/308 always preserve) unless `followOriginalHttpMethod` keeps it,
 * and strip `Authorization` when the hop crosses origin unless
 * `followAuthorizationHeader` keeps it — in which case the re-send is
 * reported so the response surface can mark it.
 */
function nextHop(
  prev: HopState,
  status: number,
  location: string,
  request: TransportRequest,
): { hop: HopState; authorizationForwarded: boolean } {
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
  let authorizationForwarded = false;
  const crossOrigin = new URL(prev.url).origin !== nextUrl.origin;
  if (crossOrigin && headers.some((h) => h.key.toLowerCase() === 'authorization')) {
    if (request.followAuthorizationHeader === true) {
      authorizationForwarded = true;
    } else {
      headers = headers.filter((h) => h.key.toLowerCase() !== 'authorization');
    }
  }
  return { hop: { url: nextUrl.toString(), method, headers, body }, authorizationForwarded };
}

/** One wire round-trip for a hop, on whichever pipeline can carry it:
 *  fetch for every ordinary hop, `request()` for a GET/HEAD hop with a
 *  body (fetch refuses to construct those). */
async function wireHop(
  fetchFn: NodeFetchFn,
  requestFn: NodeRequestFn,
  request: TransportRequest,
  hop: HopState,
  deadline: Deadline,
  dispatcher: Dispatcher | undefined,
): Promise<HopResponse> {
  if (bodylessMethodWithBody(hop)) return requestHop(requestFn, request, hop, deadline, dispatcher);
  return fetchHop(fetchFn, request, hop, deadline, dispatcher);
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
 * One wire round-trip for a GET/HEAD hop that carries a body. WHATWG
 * fetch refuses to construct such a request (spec rule), but HTTP
 * itself allows it and real APIs use it — undici's `request()` puts
 * the body on the wire, riding the same dispatcher, deadline, and
 * error classification as the fetch path. `request()` never follows
 * redirects on its own, matching the fetch path's `redirect: 'manual'`.
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
      method: hop.method.toUpperCase() === 'HEAD' ? 'HEAD' : 'GET',
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

/**
 * Map an undici `request()` result onto the hop surface: headers
 * re-minted as fetch `Headers` (`set-cookie` arrays preserved
 * entry-wise for the jar), the body's Node stream bridged to a web
 * stream for the capped read, and the reason phrase from the canonical
 * status table (`request()` does not surface one).
 */
function adaptRequestResponse(url: string, response: NodeRequestResponse): HopResponse {
  const headers = new Headers();
  for (const [key, value] of Object.entries(response.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.append(key, value);
    }
  }
  return {
    status: response.statusCode,
    statusText: STATUS_CODES[response.statusCode] ?? '',
    url,
    headers,
    body: Readable.toWeb(response.body),
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
 *  intermediate 3xx bodies are canceled, not read. */
async function finalizeResponse(
  response: HopResponse,
  request: TransportRequest,
  finalUrl: string,
  deadline: Deadline,
  authorizationForwarded: boolean,
  jarActivity?: JarActivity,
): Promise<TransportResponse> {
  const headers: TransportHeader[] = [];
  response.headers.forEach((value, key) => {
    headers.push({ key, value });
  });
  let read: Awaited<ReturnType<typeof readCappedBody>>;
  try {
    read = await readCappedBody(response, request.maxBodyBytes);
  } catch (err) {
    if (deadline?.expired()) throw timeoutError(request.timeoutMs);
    throw err;
  }
  return {
    status: response.status,
    statusText: response.statusText,
    url: response.url || finalUrl,
    headers,
    body: read.body,
    ...(read.bodyEncoding ? { bodyEncoding: read.bodyEncoding } : {}),
    bodyBytes: read.bodyBytes,
    bodyTruncated: read.bodyTruncated,
    ...(authorizationForwarded ? { authorizationForwarded: true } : {}),
    ...(jarActivity?.cookieHeaderAttached !== undefined
      ? { cookieHeaderAttached: jarActivity.cookieHeaderAttached }
      : {}),
    ...(jarActivity !== undefined && jarActivity.cookiesCaptured.length > 0
      ? { cookiesCaptured: jarActivity.cookiesCaptured }
      : {}),
  };
}

/** Arm an abort deadline for the round-trip; `null` when no timeout is set. */
function startDeadline(timeoutMs: number | undefined) {
  if (timeoutMs === undefined) return null;
  const controller = new AbortController();
  let expired = false;
  const timer = setTimeout(() => {
    expired = true;
    controller.abort();
  }, timeoutMs);
  return {
    signal: controller.signal,
    expired: () => expired,
    clear: () => clearTimeout(timer),
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
async function readCappedBody(
  response: HopResponse,
  maxBodyBytes: number,
): Promise<{ body: string; bodyEncoding?: 'base64'; bodyBytes: number; bodyTruncated: boolean }> {
  const stream = response.body;
  if (!stream) {
    // No readable stream (empty body / HEAD) — nothing to bound.
    return { body: '', bodyBytes: 0, bodyTruncated: false };
  }
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let bytesRead = 0;
  let truncated = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      parts.push(value);
      bytesRead += value.byteLength;
      if (bytesRead > maxBodyBytes) {
        truncated = true;
        await reader.cancel();
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }
  return decodeCapped(parts, bytesRead, maxBodyBytes, truncated);
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
      return `Connection to ${host} was reset.`;
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
