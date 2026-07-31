/**
 * Per-request connection policy → the dispatcher that carries it.
 * Maps the seam's knobs (`sslVerification`, TLS window/ciphers,
 * `httpVersion`, `resolveToAddress`, client certificate, `proxyUrl`,
 * `unixSocketPath`) onto undici dispatchers cached per distinct option
 * tuple, each wired to a connector that feeds the always-on
 * negotiated-protocol log.
 */

import { createHash } from 'node:crypto';
import { isIP, type LookupFunction } from 'node:net';
import { createSecureContext, type SecureVersion } from 'node:tls';
import type { TransportRequest } from '@openheaders/oracle/live/request-exec/transport';
import { Agent, type Dispatcher, ProxyAgent, Socks5ProxyAgent } from 'undici';
import { type AlpnPolicy, createDialConnector, createRecordingConnector } from '../instrumented-connector';
import { isSocks5ProxyUrl } from '../system-proxy/proxy-value';
import type { ProxyTunnel } from './connect-tunnel';
import type { ConnectOptions } from './seam';

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
 * dispatchers riding undici's `ProxyAgent` or `Socks5ProxyAgent`
 * (`auto` / `'1.1'`): the tunnel's connector owns the dial and there
 * is nothing honest to observe. A PINNED proxied tuple rides the hand-rolled tunnel dial
 * instead, whose own handshake reports the negotiated protocol — so
 * its entry carries the log like a direct one.
 */
export interface DispatcherEntry {
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
 * sits in a Map key. An system-plane credential (inline in an env
 * var — no vault identity) keys as `inline` plus the same content
 * hash, so two ambient proxies at one URL with different credentials
 * never share a dispatcher. Only contributes while a proxy URL is set
 * — a credential without a proxy has nothing to authenticate against.
 */
function proxyCredKeySegment(request: TransportRequest): string {
  if (request.proxyCredentialRef === undefined && request.proxyCredential === undefined) return '';
  const hash = createHash('sha256')
    .update(request.proxyCredential ?? '')
    .digest('hex')
    .slice(0, 16);
  return `${request.proxyCredentialRef ?? 'inline'}#${hash}`;
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

export function dispatcherFor(request: TransportRequest): DispatcherEntry {
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
  // A pinned tuple through a proxy rides the hand-rolled tunnel dial —
  // `ProxyAgent`'s connector owns the ALPN offer, which would demote
  // the pin to an unenforced preference. Negotiating tuples keep
  // `ProxyAgent` (its tunnel handling, session cache, and h2 seats).
  // A socks5:// tuple rides undici's `Socks5ProxyAgent`; it never
  // arrives pinned — the transport's pre-wire guard and the
  // proxy-route pin gate both refuse that pairing before a dispatcher
  // is asked for.
  const proxy: ProxyTunnel | undefined =
    proxyUrl !== undefined
      ? { url: proxyUrl, ...(request.proxyCredential !== undefined ? { credential: request.proxyCredential } : {}) }
      : undefined;
  const entry: DispatcherEntry =
    proxy !== undefined && !policy.pinH2
      ? {
          dispatcher: isSocks5ProxyUrl(proxy.url)
            ? buildSocks5Agent(proxy, connect)
            : buildProxyAgent(proxy.url, request, connect, offersH2(policy)),
        }
      : buildAgentEntry(connect, policy, proxy);
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
 * lets the client speak h2 when the dial negotiated it. A `proxy`
 * route only ever arrives with the pinned dial (negotiating proxied
 * tuples ride `ProxyAgent`); the dial opens the CONNECT tunnel and
 * enforces the pin on the target leg itself.
 */
function buildAgentEntry(connect: ConnectOptions, policy: AlpnPolicy, proxy?: ProxyTunnel): DispatcherEntry {
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
        proxy,
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

/**
 * `requestTls` is honored by `Socks5ProxyAgent`'s tunnel connect at
 * runtime (target-leg TLS options, same seat `ProxyAgent` types) but
 * lags in the published option type — this widening states the real
 * contract instead of casting past it.
 */
interface Socks5AgentOptions extends Socks5ProxyAgent.Options {
  requestTls?: ConnectOptions;
}

/**
 * SOCKS5-proxied dispatcher. The agent CONNECTs through the SOCKS5
 * proxy (RFC 1928, username/password auth per RFC 1929 from the
 * `user:password` credential) and pools per origin; the per-request
 * connection options apply to the TARGET leg via `requestTls`, exactly
 * the `ProxyAgent` seat. The tunneled target leg negotiates http/1.1
 * (the agent's pools offer no h2) — reported protocol still comes from
 * the wire, never the knob. Exported for the WS dial, whose ambient
 * SOCKS5 answers ride the same agent seat per connect.
 */
export function buildSocks5Agent(proxy: ProxyTunnel, connect: ConnectOptions): Socks5ProxyAgent {
  const options: Socks5AgentOptions = { requestTls: connect };
  if (proxy.credential !== undefined) {
    const colon = proxy.credential.indexOf(':');
    options.username = colon === -1 ? proxy.credential : proxy.credential.slice(0, colon);
    if (colon !== -1) options.password = proxy.credential.slice(colon + 1);
  }
  return new Socks5ProxyAgent(proxy.url, options);
}
