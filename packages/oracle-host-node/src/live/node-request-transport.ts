/**
 * Node request transport — the desktop main process's implementation of
 * the engine's {@link RequestTransport} seam, over undici's `fetch`.
 *
 * This entry module owns the per-send orchestration (pre-wire honesty
 * guards, the one-deadline/one-dispatcher/one-jar discipline, manual
 * mode's single shot) and the public surface; the layers live in
 * `request-transport/`: policy ABOVE the wire-hop seam
 * (`redirect-follower`, `digest-leg`, `jar-leg`, `capped-read`,
 * `finalize`, `classify-error`, `dispatcher`) and the four wire
 * pipelines BELOW it (`wire-hops`: undici fetch hop, undici
 * `request()` hop, prior-knowledge h2 hop, HTTP/3 helper hop).
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
 *     `node:http2` session pipeline (see `wire-hops.ts`), TLS and
 *     cleartext alike (the sanctioned cleartext-h2 route), with the
 *     same connection policy, redirect/digest/jar layer, and native
 *     trailers; `'3'` rides the HTTP/3 helper pipeline (a framed stdio
 *     exchange with the bundled Rust helper — see
 *     `docs/REQUEST_ENGINE_H3_PROTOCOL.md` and `h3-helper/`), one QUIC
 *     connection per hop with the TLS trust legs carried onto the
 *     helper's own TLS stack (cipher suites cross only as exact TLS
 *     1.3 IANA names — the helper's three-suite vocabulary), failing
 *     honestly PRE-wire on every knob the pipeline can't honor (plain
 *     http://, proxy, Unix socket, a sub-1.3 TLS ceiling,
 *     OpenSSL-format cipher lists, no helper binary on this install); `'2'` and `'2-prior-knowledge'` through a proxy
 *     ride the shared hand-rolled CONNECT tunnel (`connect-tunnel.ts`)
 *     — the pinned dial and the prior-knowledge session own their
 *     target leg over the tunnel socket, so the pin stays enforced and
 *     the preface stays raw (a `ProxyAgent` connector would own the
 *     ALPN offer instead);
 *     `resolveToAddress` maps to a pinned `connect.lookup` (see
 *     `dispatcher.ts`) that answers every hostname with the one
 *     address while SNI / Host / cert verification keep the URL's
 *     hostname; the client-certificate PEM pair rides `connect.cert` /
 *     `connect.key` (+ `passphrase`), keyed in the tuple by its vault
 *     ref + a content hash so
 *     rotation mints a fresh agent; `proxyUrl` swaps the dispatcher
 *     CLASS to a `ProxyAgent` that tunnels the send through an HTTP(S)
 *     proxy with CONNECT (end-to-end TLS still runs against the
 *     target; the other connection options ride the tunnel's target
 *     leg via `requestTls`), with
 *     credentials resolved from a vault ref; `unixSocketPath` pins the
 *     dial to a local Unix domain socket / Windows named pipe via
 *     `connect.socketPath` (the URL's host stays cosmetic for dialing;
 *     Host / SNI / cert verification keep it). Dispatchers are cached per
 *     distinct option tuple (see
 *     {@link dispatcherFor}) so pooled connections are shared, never
 *     minted per send. `fetch` + `Agent` come from the same undici
 *     package so the dispatcher and the fetch pipeline are one stack,
 *     one version.
 *   - **Two-plane proxy resolution.** An explicit request-plane proxy
 *     (`proxyUrl`) or opt-out (`proxyMode: 'direct'`) wins outright; a
 *     send that INHERITS (both absent — the default) asks the host's
 *     environment plane per target (`environment-proxy/` — the
 *     desktop's Chromium system resolver or the node tier's env-var
 *     default), walks its fallback chain (a dial failure reaching one
 *     proxy falls through to the next entry), and materializes the
 *     effective proxy onto the same seam fields the explicit knob uses
 *     — dispatcher tuple, tunnel legs, and error classification honor
 *     it with zero special cases. An inherited proxy STANDS DOWN
 *     (recorded with the reason) for explicit asks a tunnel can't
 *     honor — `unixSocketPath`, `resolveToAddress`, a pinned `'3'` —
 *     while the explicit-vs-explicit conflicts keep their pre-wire
 *     errors. The winning route lands on
 *     {@link TransportResponse.proxyRoute} as wire truth. See
 *     docs/REQUEST_ENGINE_PROXY_DESIGN.md.
 *   - **Always-on negotiated-protocol report.** Every direct send's
 *     dispatcher dials through a connector that observes the ready
 *     socket's ALPN result per origin (undici's own connector wrapped
 *     — session cache intact — or the hand-rolled pinned dial), so
 *     {@link TransportResponse.httpVersion} reports the wire's
 *     protocol on every send, not only under `captureNetwork`.
 *     Proxied sends on `ProxyAgent` report nothing (the tunnel's
 *     connector owns the dial) — the usual capability honesty; pinned
 *     proxied sends DO report, because their hand-rolled tunnel dial
 *     owns the target handshake.
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
 *     adapts back onto the fetch surface (see `wire-hops.ts`).
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

import {
  type RequestTransport,
  TransportError,
  type TransportRequest,
  type TransportResponse,
  type TransportStreamObserver,
} from '@openheaders/oracle/live/request-exec/transport';
import { fetch as undiciFetch, request as undiciRequest } from 'undici';
import { cookieJarFor } from './cookie-jar';
import { isSocks5ProxyUrl } from './environment-proxy/proxy-value';
import { environmentProxyResolver } from './environment-proxy/registry';
import type { EnvironmentProxyResolver } from './environment-proxy/types';
import { decryptedClientKeyPem } from './h3-helper/client-key';
import { resolveH3HelperBinary } from './h3-helper/helper-binary';
import { type H3HelperClient, sharedH3HelperClient } from './h3-helper/helper-process';
import { H3_TLS13_CIPHER_SUITES } from './h3-helper/protocol';
import { type ConnectionRecord, createInstrumentedDial } from './instrumented-connector';
import { WireExchangeError } from './request-transport/classify-error';
import { digestRetryHop } from './request-transport/digest-leg';
import { connectOptionsFor, dispatcherFor, httpVersionPolicy } from './request-transport/dispatcher';
import { finalizeResponse } from './request-transport/finalize';
import { captureJarCookies, type JarActivity, withJarCookie } from './request-transport/jar-leg';
import { materializeProxyAttempt, resolveProxyAttempts } from './request-transport/proxy-route';
import { followRedirectChain } from './request-transport/redirect-follower';
import {
  type Deadline,
  type HopState,
  type NodeFetchFn,
  type NodeRequestFn,
  type StreamingLeg,
  startDeadline,
  type WireLeg,
  withPinnedPipelineTimeout,
} from './request-transport/seam';
import { wireHop } from './request-transport/wire-hops';

export { connectOptionsFor, httpVersionPolicy } from './request-transport/dispatcher';
export type { ConnectOptions, NodeFetchFn, NodeRequestFn, NodeRequestResponse } from './request-transport/seam';

export interface NodeRequestTransportOptions {
  fetchFn?: NodeFetchFn;
  requestFn?: NodeRequestFn;
  /** The HTTP/3 helper client — injectable like the wire fns so tests
   *  drive `'3'` sends through a protocol-faithful fake; production
   *  falls back to the shared host-process client over the resolved
   *  helper binary. */
  h3Client?: H3HelperClient;
  /** The environment-plane resolver — injectable so unit rigs drive
   *  inherit-mode sends with fake resolvers. `null` turns the plane
   *  off for this transport; omitted = the host's registered resolver
   *  (see `environment-proxy/registry`). */
  environmentProxy?: EnvironmentProxyResolver | null;
}

/**
 * Dial-level failure codes REACHING a proxy — the only failures the
 * environment-plane chain walk falls through on. On a proxied send a
 * refused / unresolved / unroutable / timed-out CONNECT dial can only
 * be the proxy itself (target dialing happens at the proxy), which is
 * exactly Chromium's fall-through condition. CONNECT rejections (407
 * and friends) and target-leg failures surface instead — by then the
 * proxy answered, and the failure is meaningful.
 */
const PROXY_DIAL_FAILURE_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
]);

function isProxyDialFailure(err: unknown): err is WireExchangeError {
  return err instanceof WireExchangeError && err.causeCode !== undefined && PROXY_DIAL_FAILURE_CODES.has(err.causeCode);
}

export function createNodeRequestTransport(options: NodeRequestTransportOptions = {}): RequestTransport {
  const fetchFn = options.fetchFn ?? undiciFetch;
  const requestFn = options.requestFn ?? undiciRequest;
  // One attempt's full exchange — the request already carries its
  // EFFECTIVE proxy (an inherited environment-plane answer is
  // materialized onto the same seam fields the explicit knob uses, so
  // every layer below honors the route with zero special cases), and
  // the deadline is the walker's: ONE deadline spans every attempt of
  // a send, not each retry.
  const sendResolved = async (
    request: TransportRequest,
    streaming: StreamingLeg | null,
    deadline: Deadline,
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
    // A pinned HTTP/3 send rides the helper pipeline — every knob the
    // pipeline cannot honor fails BEFORE the wire, never quietly rides
    // another protocol (see docs/REQUEST_ENGINE_H3_PROTOCOL.md for the
    // TLS subset mapping).
    let h3Client: H3HelperClient | undefined;
    let h3ClientCert: { certPem: string; keyPem: string } | undefined;
    let h3CipherSuites: string[] | undefined;
    if (request.httpVersion === '3') {
      if (new URL(request.url).protocol !== 'https:') {
        throw new TransportError(
          'The request pins HTTP/3, but the URL is plain http:// — QUIC has TLS 1.3 built in, so HTTP/3 exists only for https:// targets. Set the HTTP version to Auto, or use https://.',
        );
      }
      if (request.proxyUrl !== undefined) {
        throw new TransportError(
          "The request pins HTTP/3 and routes through a proxy, but a proxy tunnel can't carry QUIC (UDP). Set the HTTP version to Auto, or clear the proxy.",
        );
      }
      if (request.unixSocketPath !== undefined) {
        throw new TransportError(
          'The request pins HTTP/3 and targets a Unix socket, but QUIC runs over UDP — there is no socket-path dial. Set the HTTP version to Auto, or clear the Unix-socket setting.',
        );
      }
      if (request.tlsMaxVersion !== undefined && request.tlsMaxVersion !== '1.3') {
        throw new TransportError(
          `The request pins HTTP/3 with a TLS ceiling of ${request.tlsMaxVersion}, but QUIC is TLS 1.3-only — the ceiling can't hold. Raise the "TLS max version" setting to 1.3 (or clear it), or pick another HTTP version.`,
        );
      }
      // The cipher knob crosses to the helper only as exact TLS 1.3
      // IANA names — QUIC is TLS 1.3-only, so the helper's three
      // suites are the entire legal vocabulary. An OpenSSL-format
      // list (aliases, `!aNULL`, pre-1.3 names) or an IANA name
      // outside the set fails HERE naming the requirement — never a
      // silent pass-through the helper would misread.
      if (request.tlsCipherSuites !== undefined) {
        const names = request.tlsCipherSuites
          .split(':')
          .map((name) => name.trim())
          .filter((name) => name !== '');
        if (names.length === 0) {
          throw new TransportError(
            'The request pins HTTP/3 with an empty "TLS cipher suites" setting. List exact TLS 1.3 IANA suite names, clear the setting, or pick another HTTP version.',
          );
        }
        const outsider = names.find((name) => !(H3_TLS13_CIPHER_SUITES as readonly string[]).includes(name));
        if (outsider !== undefined) {
          throw new TransportError(
            `The request pins HTTP/3, but "${outsider}" in the "TLS cipher suites" setting isn't a TLS 1.3 suite the HTTP/3 pipeline carries — it accepts exact IANA names only: ${H3_TLS13_CIPHER_SUITES.join(', ')} (QUIC is TLS 1.3-only, so OpenSSL-format lists and pre-1.3 suites can't apply). Fix the setting, or pick another HTTP version.`,
          );
        }
        h3CipherSuites = names;
      }
      // A passphrase-protected client key crosses the helper protocol
      // decrypted (rustls can't decrypt encrypted PEM) — bad material
      // fails HERE with the real problem, not as an opaque handshake.
      if (request.clientCertificatePem !== undefined && request.clientCertificateKeyPem !== undefined) {
        try {
          h3ClientCert = {
            certPem: request.clientCertificatePem,
            keyPem: decryptedClientKeyPem(request.clientCertificateKeyPem, request.clientCertificatePassphrase),
          };
        } catch (err) {
          throw new TransportError(
            `The client certificate from vault entry "${request.clientCertificateRef ?? ''}" could not be loaded for the HTTP/3 send: ${err instanceof Error ? err.message : String(err)}. Check that the entry's key is valid PEM and the passphrase is right.`,
          );
        }
      }
      h3Client = options.h3Client;
      if (h3Client === undefined) {
        const binary = resolveH3HelperBinary();
        if (binary === null) {
          throw new TransportError(
            "This install can't send HTTP/3 — the helper that speaks it isn't available on this platform yet. Pick another HTTP version.",
          );
        }
        h3Client = sharedH3HelperClient(binary);
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
      // A pinned h2 send tunnels through the hand-rolled HTTP CONNECT
      // dial, which a SOCKS5 proxy can't carry — the explicit
      // contradiction fails BEFORE the wire (an ambient SOCKS5 answer
      // never reaches here pinned: the proxy-route gate skips it).
      if (
        isSocks5ProxyUrl(request.proxyUrl) &&
        (request.httpVersion === '2' || request.httpVersion === '2-prior-knowledge')
      ) {
        throw new TransportError(
          'The request pins HTTP/2 and routes through a SOCKS5 proxy, but the pinned HTTP/2 pipeline tunnels through HTTP CONNECT only. Set the HTTP version to Auto, or use an http:// or https:// proxy.',
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
    // ONE dispatcher per send — the connection options can't change
    // across hops, and the cache lookup here keeps the wire hop the
    // single place a dispatcher is applied. A `captureNetwork` send
    // trades the shared pool for a send-local instrumented dial (the
    // only correlation-safe way to observe socket phases + endpoints);
    // proxied sends skip the instrumented dial — `ProxyAgent`'s
    // connector owns the socket, so there is no seat to observe.
    // A pinned-pipeline send (`'2-prior-knowledge'`, `'3'`) never
    // touches undici's wire — every hop rides its hand-rolled pipeline,
    // so no dispatcher — the per-send leg carries the pipeline's
    // connection/trust inputs plus the sink its spoken-protocol facts
    // report into. Under `captureNetwork` the prior-knowledge leg also
    // collects its session dials' connection records straight from the
    // pipeline (the session owns its socket end to end, tunnel legs
    // included — tunneled records describe the proxy leg), riding the
    // same merge as the instrumented undici dial; a `'3'` send asks the
    // helper for instrumented dials, whose socket facts + QUIC timings
    // come back on the response head and ride the same record merge.
    const priorKnowledge = request.httpVersion === '2-prior-knowledge';
    const instrumented =
      request.captureNetwork === true && request.proxyUrl === undefined && !priorKnowledge && h3Client === undefined
        ? createInstrumentedDial(connectOptionsFor(request), httpVersionPolicy(request.httpVersion))
        : null;
    const h2Capture: ConnectionRecord[] | undefined =
      priorKnowledge && request.captureNetwork === true ? [] : undefined;
    const h3Capture: ConnectionRecord[] | undefined =
      h3Client !== undefined && request.captureNetwork === true ? [] : undefined;
    const entry =
      instrumented === null && !priorKnowledge && h3Client === undefined ? dispatcherFor(request) : undefined;
    const dispatcher = instrumented?.agent ?? entry?.dispatcher;
    const spoken = priorKnowledge || h3Client !== undefined ? new Map<string, string>() : undefined;
    let leg: WireLeg | null = null;
    if (spoken !== undefined) {
      const onProtocol = (origin: string, alpnProtocol: string): void => {
        spoken.set(origin, alpnProtocol);
      };
      leg =
        h3Client !== undefined
          ? {
              kind: '3',
              client: h3Client,
              ...(request.sslVerification === false ? { insecure: true } : {}),
              ...(h3ClientCert !== undefined ? { clientCert: h3ClientCert } : {}),
              ...(request.resolveToAddress !== undefined ? { connectAddress: request.resolveToAddress } : {}),
              ...(h3CipherSuites !== undefined ? { cipherSuites: h3CipherSuites } : {}),
              ...(h3Capture !== undefined ? { captureNetwork: true } : {}),
              onProtocol,
              ...(h3Capture !== undefined
                ? {
                    onConnection: (record: ConnectionRecord): void => {
                      h3Capture.push(record);
                    },
                  }
                : {}),
            }
          : {
              kind: '2-prior-knowledge',
              connect: connectOptionsFor(request),
              ...(request.proxyUrl !== undefined
                ? {
                    proxy: {
                      url: request.proxyUrl,
                      ...(request.proxyCredential !== undefined ? { credential: request.proxyCredential } : {}),
                    },
                  }
                : {}),
              onProtocol,
              ...(h2Capture !== undefined
                ? {
                    onConnection: (record: ConnectionRecord): void => {
                      h2Capture.push(record);
                    },
                  }
                : {}),
            };
    }
    // The always-on negotiated-protocol source for this send: the
    // instrumented dial reports through its connection records; a
    // pinned-pipeline send reads its own leg's spoken-protocol log;
    // every other direct send reads its dispatcher's per-origin log.
    const negotiated = entry?.negotiatedByOrigin ?? spoken;
    // ONE jar per send, looked up by the request's key — absent key
    // means no cookies attached, Set-Cookie discarded.
    const jar = request.cookieJarKey !== undefined ? cookieJarFor(request.cookieJarKey) : undefined;
    // Phase marks for the snapshot's timing attribution — the send's
    // dispatch instant; the final hop's own dispatch is marked where
    // the loop fires it (see `finalize.ts`).
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
        let response = await wireHop(fetchFn, requestFn, request, hop, deadline, dispatcher, leg);
        if (jar !== undefined && jarActivity !== undefined) {
          jarActivity.cookiesCaptured.push(...captureJarCookies(jar, hop.url, response.headers));
        }
        // Digest second leg — manual mode owns REDIRECT policy, not
        // auth, so the challenge dance runs here too.
        const retry = await digestRetryHop(fetchFn, requestFn, request, hop, response, deadline, dispatcher, jar, leg);
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
          instrumented?.connections ?? h2Capture ?? h3Capture,
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
        instrumented?.connections ?? h2Capture ?? h3Capture,
        negotiated,
        leg,
      );
    } finally {
      // The send-local instrumented agent has nothing to pool for —
      // close releases its sockets (graceful: the settled response's
      // body is already read).
      if (instrumented !== null) void instrumented.agent.close();
    }
  };
  const dispatchSend = async (
    incoming: TransportRequest,
    streaming: StreamingLeg | null,
  ): Promise<TransportResponse> => {
    // A timeout-less pinned-pipeline send gets the seam's backstop
    // deadline — the hand-rolled pipelines have no library watchdog
    // behind them the way undici's own timers back the fetch paths.
    const request = withPinnedPipelineTimeout(incoming);
    // Two-plane proxy resolution (docs/REQUEST_ENGINE_PROXY_DESIGN.md):
    // an explicit request-plane setting wins outright; an inheriting
    // send asks the host's environment plane, whose answer is a
    // fallback chain of attempts. The injectable resolver seat is for
    // unit rigs; production reads the host's registered resolver (the
    // desktop's Chromium adapter, or the node tier's env-var default).
    const resolver = options.environmentProxy !== undefined ? options.environmentProxy : environmentProxyResolver();
    const attempts = await resolveProxyAttempts(request, resolver);
    // ONE deadline spans the whole send — every attempt, every hop of
    // a redirect chain, and the final body read; the abort also
    // cancels a body stream stalled mid-read, which a fetch-only
    // signal would miss. A streaming leg's caller signal (Stop) merges
    // onto the same abort, so both triggers cancel connection AND read
    // alike.
    const deadline = startDeadline(request.timeoutMs, streaming?.signal);
    try {
      let lastDialFailure: WireExchangeError | undefined;
      for (let i = 0; i < attempts.length; i += 1) {
        const attempt = attempts[i];
        try {
          const response = await sendResolved(materializeProxyAttempt(request, attempt), streaming, deadline);
          return attempt.meta !== undefined ? { ...response, proxyRoute: attempt.meta } : response;
        } catch (err) {
          // Chain walking: a dial-level failure REACHING an
          // environment-plane proxy falls through to the next chain
          // entry (Chromium's own fallback semantics). Everything else
          // — CONNECT rejections, target-leg failures, explicit
          // request-plane proxies — surfaces as-is. A streamed send
          // only ever retries before its head (a post-head failure
          // resolves partial instead of throwing), so the observer
          // never sees a double head.
          const nextExists = i < attempts.length - 1;
          if (attempt.environmentChain === true && nextExists && isProxyDialFailure(err)) {
            lastDialFailure = err;
            continue;
          }
          throw err;
        }
      }
      // Unreachable while the attempt list is non-empty (the last
      // attempt never falls through) — defensive for the type system.
      throw lastDialFailure ?? new TransportError('The proxy fallback chain produced no attempt to send.');
    } finally {
      deadline?.clear();
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
