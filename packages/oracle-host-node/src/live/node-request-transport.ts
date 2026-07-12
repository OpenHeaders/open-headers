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
 *     {@link proxyCredKeySegment}). Dispatchers are cached per
 *     distinct option tuple (see
 *     {@link dispatcherFor}) so pooled connections are shared, never
 *     minted per send. `fetch` + `Agent` come from the same undici
 *     package so the dispatcher and the fetch pipeline are one stack,
 *     one version.
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

import { createHash } from 'node:crypto';
import { isIP, type LookupFunction } from 'node:net';
import type { SecureVersion } from 'node:tls';
import {
  type RequestTransport,
  type TransportBody,
  TransportError,
  type TransportHeader,
  type TransportRequest,
  type TransportResponse,
} from '@openheaders/oracle/live/request-exec/transport';
import { Agent, type Dispatcher, FormData, ProxyAgent, fetch as undiciFetch } from 'undici';

/** The fetch pipeline behind the transport — undici's fetch in
 *  production; injectable so tests observe the exact init (including
 *  the dispatcher) without stubbing globals. */
export type NodeFetchFn = typeof undiciFetch;

/** undici's RequestInit — carries the `dispatcher` slot the DOM-shaped
 *  init type doesn't know about. */
type NodeRequestInit = NonNullable<Parameters<NodeFetchFn>[1]>;

export interface NodeRequestTransportOptions {
  fetchFn?: NodeFetchFn;
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
interface ConnectOptions {
  rejectUnauthorized?: boolean;
  minVersion?: SecureVersion;
  maxVersion?: SecureVersion;
  ciphers?: string;
  lookup?: LookupFunction;
  cert?: string;
  key?: string;
  passphrase?: string;
  allowH2?: boolean;
}

function dispatcherFor(request: TransportRequest): Dispatcher | undefined {
  const insecure = request.sslVerification === false;
  const allowH2 = request.allowHttp2 === true;
  const { tlsMinVersion, tlsMaxVersion, tlsCipherSuites, resolveToAddress, clientCertificateRef, proxyUrl } = request;
  if (
    !insecure &&
    !allowH2 &&
    tlsMinVersion === undefined &&
    tlsMaxVersion === undefined &&
    tlsCipherSuites === undefined &&
    resolveToAddress === undefined &&
    clientCertificateRef === undefined &&
    proxyUrl === undefined
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
  ].join('|');
  const cached = agentCache.get(key);
  if (cached) return cached;
  const connect: ConnectOptions = {};
  if (insecure) connect.rejectUnauthorized = false;
  if (tlsMinVersion !== undefined) connect.minVersion = TLS_VERSION_TOKEN[tlsMinVersion];
  if (tlsMaxVersion !== undefined) connect.maxVersion = TLS_VERSION_TOKEN[tlsMaxVersion];
  if (tlsCipherSuites !== undefined) connect.ciphers = tlsCipherSuites;
  if (resolveToAddress !== undefined) connect.lookup = pinnedLookup(resolveToAddress);
  if (request.clientCertificatePem !== undefined) connect.cert = request.clientCertificatePem;
  if (request.clientCertificateKeyPem !== undefined) connect.key = request.clientCertificateKeyPem;
  if (request.clientCertificatePassphrase !== undefined) connect.passphrase = request.clientCertificatePassphrase;
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

/** Abort deadline over a whole send — see {@link startDeadline}. */
type Deadline = ReturnType<typeof startDeadline>;

export function createNodeRequestTransport(options: NodeRequestTransportOptions = {}): RequestTransport {
  const fetchFn = options.fetchFn ?? undiciFetch;
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
      try {
        if (request.redirect === 'manual') {
          // Single-shot: surface the first response verbatim, 3xx included.
          const hop: HopState = {
            url: request.url,
            method: request.method,
            headers: request.headers,
            body: request.body,
          };
          const response = await fetchHop(fetchFn, request, hop, deadline, dispatcher);
          return await finalizeResponse(response, request, hop.url, deadline, false);
        }
        return await followRedirectChain(fetchFn, request, deadline, dispatcher);
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
  request: TransportRequest,
  deadline: Deadline,
  dispatcher: Dispatcher | undefined,
): Promise<TransportResponse> {
  const maxRedirects = request.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  let hop: HopState = { url: request.url, method: request.method, headers: request.headers, body: request.body };
  let authorizationForwarded = false;
  let redirects = 0;
  while (true) {
    const response = await fetchHop(fetchFn, request, hop, deadline, dispatcher);
    const location = REDIRECT_STATUSES.has(response.status) ? response.headers.get('location') : null;
    if (location === null) return finalizeResponse(response, request, hop.url, deadline, authorizationForwarded);
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

/** One wire round-trip for a hop. Always `redirect: 'manual'` — the
 *  chain is chased (or surfaced) by the caller, never by undici. */
async function fetchHop(
  fetchFn: NodeFetchFn,
  request: TransportRequest,
  hop: HopState,
  deadline: Deadline,
  dispatcher: Dispatcher | undefined,
): Promise<Awaited<ReturnType<NodeFetchFn>>> {
  const init: NodeRequestInit = {
    method: hop.method,
    headers: buildHeaders(hop.headers),
    redirect: 'manual',
    // No ambient cookie jar in the main process, so `credentials` has
    // nothing to ride — Node fetch never attaches cookies by default.
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
  response: Awaited<ReturnType<NodeFetchFn>>,
  request: TransportRequest,
  finalUrl: string,
  deadline: Deadline,
  authorizationForwarded: boolean,
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
    bodyBytes: read.bodyBytes,
    bodyTruncated: read.bodyTruncated,
    ...(authorizationForwarded ? { authorizationForwarded: true } : {}),
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
  response: Awaited<ReturnType<NodeFetchFn>>,
  maxBodyBytes: number,
): Promise<{ body: string; bodyBytes: number; bodyTruncated: boolean }> {
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

/** Concatenate the retained chunks, cap to `maxBodyBytes`, and decode as
 *  UTF-8. Shared cap arithmetic so the byte count + truncation flag stay
 *  consistent with what's actually decoded. */
function decodeCapped(
  parts: ReadonlyArray<Uint8Array>,
  bytesRead: number,
  maxBodyBytes: number,
  truncated: boolean,
): { body: string; bodyBytes: number; bodyTruncated: boolean } {
  const retained = Math.min(bytesRead, maxBodyBytes);
  const buf = new Uint8Array(retained);
  let offset = 0;
  for (const part of parts) {
    if (offset >= retained) break;
    const take = Math.min(part.byteLength, retained - offset);
    buf.set(part.subarray(0, take), offset);
    offset += take;
  }
  return { body: new TextDecoder().decode(buf), bodyBytes: retained, bodyTruncated: truncated };
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
    case 'multipart': {
      const form = new FormData();
      for (const part of body.parts) {
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
    default: {
      const _exhaustive: never = body;
      void _exhaustive;
      return undefined;
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
 * pin do this?"); handshake failures name the TLS settings only when
 * they are tuned; certificate-demand alerts, cert-material load
 * failures, and mid-handshake closes name the client-certificate
 * setting when one is configured.
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
