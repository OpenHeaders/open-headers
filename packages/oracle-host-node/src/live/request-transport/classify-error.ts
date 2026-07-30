/**
 * Wire-failure classification — the thrown error's `cause` chain turned
 * into a user-actionable message naming the setting that most likely
 * caused it. Shared by all four wire pipelines; the HTTP/3 helper's
 * closed-set error codes get their own mapping before the cause-chain
 * classification.
 */

import type { TransportRequest } from '@openheaders/oracle/live/request-exec/transport';
import { H3HelperFailure } from '../h3-helper/helper-process';
import { H2_NOT_NEGOTIATED_CODE } from '../instrumented-connector';
import { proxyConnectRejectedStatus } from './connect-tunnel';

/** Whether this request carries any TLS version / cipher tuning — the
 *  error classifier only points at those settings when they exist. */
function tlsTuned(request: TransportRequest): boolean {
  return (
    request.tlsMinVersion !== undefined || request.tlsMaxVersion !== undefined || request.tlsCipherSuites !== undefined
  );
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
/**
 * Turn an HTTP/3 helper failure (a protocol ERROR frame's closed-set
 * code, or a client-minted `helper-*` code) into a user-actionable
 * message. QUIC failure shapes differ from TCP's: there is no
 * RST-style refusal — a dial nobody answers times out, which on a
 * pinned `'3'` send almost always means the target speaks no HTTP/3
 * (or UDP is blocked), so the message names the setting.
 */
function classifyH3Failure(host: string, err: H3HelperFailure, request: TransportRequest): string {
  const certRef = request.clientCertificateRef;
  const pinned = request.resolveToAddress;
  switch (err.code) {
    case 'dns':
      return `Could not resolve host ${host} (DNS lookup failed). Check the URL and your network.`;
    case 'connect-timeout':
      return pinned !== undefined
        ? `${pinned} did not answer the QUIC handshake — the request's resolve-to-address setting points ${host} there, and its "HTTP version" setting pins this send to HTTP/3. The target may not speak HTTP/3 on that address, or UDP may be blocked; set the HTTP version to Auto to negotiate over TCP instead.`
        : `${host} did not answer the QUIC handshake — it may not speak HTTP/3 on this port, or UDP may be blocked on the path. The request's "HTTP version" setting pins this send to HTTP/3; set it to Auto to negotiate over TCP instead.`;
    case 'connect-refused':
      return `No route to ${host} for the QUIC dial. The request's "HTTP version" setting pins this send to HTTP/3.`;
    case 'tls-verify':
      return `TLS certificate verification failed reaching ${host} over HTTP/3: ${err.message}. The HTTP/3 pipeline verifies against the bundled Mozilla roots — for a self-signed or private-CA target, turn off the request's SSL-verification setting.`;
    case 'tls-handshake': {
      const base = `TLS handshake with ${host} failed over HTTP/3: ${err.message}`;
      if (certRef !== undefined) {
        return `${base}. The request presents the client certificate from vault entry "${certRef}" — the server may not accept it.`;
      }
      // A restricted offer the server shares no suite with dies as a
      // handshake alert — name the setting that narrowed the offer.
      if (request.tlsCipherSuites !== undefined) {
        return `${base}. The request's "TLS cipher suites" setting restricts the offer to the listed TLS 1.3 suites — the server may not accept any of them.`;
      }
      return base;
    }
    case 'reset':
      return `${host} reset the HTTP/3 exchange: ${err.message}`;
    case 'idle-timeout':
      return `The HTTP/3 connection to ${host} went idle past its ceiling: ${err.message}`;
    case 'quic-transport':
    case 'h3-protocol':
      return `HTTP/3 exchange with ${host} failed: ${err.message}. The request's "HTTP version" setting pins this send to HTTP/3; set it to Auto to negotiate the version instead.`;
    case 'helper-crashed':
    case 'helper-no-hello':
    case 'helper-spawn-failed':
    case 'helper-corrupt-stream':
    case 'helper-protocol-mismatch':
    case 'helper-disposed':
      return `The HTTP/3 helper failed before ${host} answered: ${err.message}`;
    default:
      return `HTTP/3 exchange with ${host} failed (${err.code}): ${err.message}`;
  }
}

export function classifyFetchFailure(url: string, err: unknown, request: TransportRequest): string {
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
  if (err instanceof H3HelperFailure) return classifyH3Failure(host, err, request);
  const chain = causeChain(err);
  const code = chain.find((link) => link.code !== undefined && link.code !== '')?.code;
  const cause = err && typeof err === 'object' && 'cause' in err ? (err as { cause: unknown }).cause : undefined;
  if (proxied !== undefined) {
    // A rejected CONNECT is a normal proxy RESPONSE undici turns into
    // an abort — the status only survives in the wrapped message. The
    // hand-rolled tunnel dial (pinned pipelines) carries the status on
    // its own error instead.
    const tunnel = chain
      .map((link) => (link.message !== undefined ? /Proxy response \((\d+)\) !== 200/.exec(link.message) : null))
      .find((match) => match !== null);
    const rejectedStatus = proxyConnectRejectedStatus(err) ?? (tunnel ? Number(tunnel[1]) : undefined);
    if (rejectedStatus !== undefined) {
      const status = rejectedStatus;
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
