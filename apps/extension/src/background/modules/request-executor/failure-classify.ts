/**
 * Fetch-failure classification for the executor's error snapshots.
 *
 * `fetch()` opaques every network failure into `TypeError: Failed to
 * fetch` — the JS surface never sees the underlying net-stack error.
 * But the webRequest layer DOES see it (`onErrorOccurred.error`, e.g.
 * `'net::ERR_NAME_NOT_RESOLVED'`), and the executor's wire capture
 * recovers it for the extension's own fetches. Classification runs in
 * two tiers:
 *
 *   1. A recovered net code — authoritative. The message leads with
 *      the raw code (exactly what the browser's own Network panel
 *      shows for the request) followed by guidance for the code's
 *      family. Codes outside the known families pass through verbatim.
 *   2. No net code (channel unavailable, join ambiguous, non-Chromium
 *      spelling) — fall back to the protocol/host heuristics.
 *
 * Certificate-family failures carry an `open-in-tab` hint: fetch
 * cannot bypass certificate validation and there is no interstitial in
 * a service worker, but opening the URL in a regular tab lets the user
 * accept the certificate — the browser remembers the exception for
 * that host:port and a retry succeeds.
 */

import type { ExecutedRequestErrorHint } from '@openheaders/core/types';

export interface ClassifiedFailure {
  message: string;
  hint?: ExecutedRequestErrorHint;
}

/** Hostnames the browser/OS resolves locally rather than via public DNS. */
function looksLocalHostname(hostname: string): boolean {
  return (
    /^(localhost|127\.)/.test(hostname) ||
    hostname === '::1' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.localhost') ||
    (!hostname.includes('.') && !hostname.includes(':'))
  );
}

function defaultPort(protocol: string): string {
  return protocol === 'https:' ? '443' : '80';
}

/**
 * Certificate-family detection across engine spellings. Chromium:
 * `net::ERR_CERT_*` / `net::ERR_SSL_*`. Firefox (webRequest surfaces
 * NSS names, often wrapped like `NS_ERROR_GENERATE_FAILURE(
 * NS_ERROR_MODULE_SECURITY, MOZILLA_PKIX_ERROR_SELF_SIGNED_CERT)`):
 * `MOZILLA_PKIX_ERROR_*`, `SEC_ERROR_*`, `SSL_ERROR_*`.
 */
function isCertFamilyCode(code: string): boolean {
  return (
    code.includes('CERT_') ||
    code.includes('SSL_') ||
    code.includes('MOZILLA_PKIX') ||
    code.includes('SEC_ERROR') ||
    code.includes('NS_ERROR_MODULE_SECURITY')
  );
}

/**
 * The searchable token for the title line. Chromium codes pass through
 * verbatim; Firefox's wrapped spelling reduces to its inner-most
 * segment (`…, MOZILLA_PKIX_ERROR_SELF_SIGNED_CERT)` → that token) so
 * the code beside the title stays one readable word.
 */
function compactNetCode(code: string): string {
  const inner = code.match(/\(([^()]*)\)/)?.[1];
  if (!inner) return code;
  const last = inner
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .pop();
  return last ?? code;
}

/**
 * Map a recovered net-stack code to an actionable message. The code
 * itself is always included verbatim — it is the ground truth the
 * browser's own Network panel shows, and searchable as-is.
 */
function describeNetError(code: string, parsed: URL, hint: ExecutedRequestErrorHint | undefined): ClassifiedFailure {
  const host = parsed.hostname;
  const port = parsed.port || defaultPort(parsed.protocol);
  const local = looksLocalHostname(host);

  if (code.includes('NAME_NOT_RESOLVED') || code.includes('UNKNOWN_HOST')) {
    return { message: `Could not resolve ${host} (${code}). The hostname does not exist in DNS — check the URL.` };
  }
  if (code.includes('CONNECTION_REFUSED')) {
    return {
      message: `${host} refused the connection on port ${port} (${code}). Nothing is listening there — is the service running, and on this port?`,
    };
  }
  if (code.includes('TIMED_OUT')) {
    return {
      message: `Connection to ${host}:${port} timed out (${code}). The host may be unreachable, or a firewall may be dropping the traffic.`,
    };
  }
  if (code.includes('SSL_PROTOCOL_ERROR')) {
    return {
      message: `${host}:${port} did not answer with HTTPS (${code}). The port likely serves plain HTTP — try http://${host}:${port}.`,
    };
  }
  if (isCertFamilyCode(code)) {
    const localNote = local
      ? ' Local dev servers usually run with a self-signed certificate, which the browser rejects before the request is sent.'
      : '';
    // With a hint attached the response pane renders the trust-steps
    // walkthrough and shows the code beside the title (hint.netError),
    // so the message stays factual; without one the guidance rides in
    // prose. The message still carries everything for non-UI consumers
    // (status pill, logs).
    const guidance = hint ? '' : ' Open the URL in a new tab, accept the certificate warning, then retry.';
    return {
      message: `${host} presented an untrusted or invalid certificate (${code}).${localNote}${guidance}`,
      ...(hint ? { hint: { ...hint, certificate: true, netError: compactNetCode(code) } } : {}),
    };
  }
  if (code.includes('CONNECTION_RESET') || code.includes('CONNECTION_CLOSED') || code.includes('EMPTY_RESPONSE')) {
    return {
      message: `${host} closed the connection without a response (${code}). The service may not speak this protocol on port ${port}, or a proxy dropped the request.`,
    };
  }
  if (code.includes('INTERNET_DISCONNECTED') || code.includes('ADDRESS_UNREACHABLE')) {
    return { message: `Network unreachable — could not reach ${host} (${code}). Check your connection.` };
  }
  if (code.includes('BLOCKED_BY_CLIENT')) {
    return {
      message: `The request was blocked inside the browser (${code}) — usually another extension (e.g. an ad blocker) or a blocking rule.`,
    };
  }
  if (code.includes('BLOCKED_BY_ADMINISTRATOR') || code.includes('BLOCKED_BY_POLICY')) {
    return {
      message: `The request was blocked by browser policy (${code}) — this machine's enterprise configuration.`,
    };
  }
  // Unknown family: the raw code is still far better than "Failed to
  // fetch" — pass it through with the host for context.
  return { message: `Request to ${host} failed at the network layer (${code}).`, ...(hint ? { hint } : {}) };
}

/**
 * Produce a user-actionable error for a failed fetch. `netError` is
 * the webRequest-recovered net-stack code when the wire capture could
 * join the fetch to its chain; absent, the protocol/host heuristics
 * produce a likely-cause breakdown instead.
 */
export function classifyFetchFailure(url: string, rawMessage: string, netError?: string): ClassifiedFailure {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { message: `${rawMessage} — invalid URL "${url}"` };
  }
  const hostname = parsed.hostname;
  const isHttps = parsed.protocol === 'https:';
  const hint: ExecutedRequestErrorHint | undefined = isHttps ? { kind: 'open-in-tab', url } : undefined;

  if (netError !== undefined && netError.length > 0) {
    return describeNetError(netError, parsed, hint);
  }

  // Offline is handled by the executor's pre-flight check; if we got
  // here with navigator.onLine=false the signal flipped during the
  // fetch. Still worth surfacing cleanly.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { message: `Network offline — could not reach ${hostname}.` };
  }
  const looksLocal = looksLocalHostname(hostname);
  if (looksLocal && isHttps) {
    // Hint always set on this branch (https), marked as a certificate
    // rejection even without a recovered code — local HTTPS failing at
    // fetch is overwhelmingly the self-signed case, and the UI renders
    // the same compact trust-steps presentation as the code-confirmed
    // path (minus the code beside the title).
    return {
      message:
        `Could not reach ${hostname} over HTTPS. Local HTTPS endpoints usually fail here because the ` +
        'development certificate is self-signed — the browser rejects untrusted certificates before the ' +
        'request is sent. If the URL loads cleanly in a tab, check that the service is running and serves ' +
        'HTTPS on this port.',
      ...(hint ? { hint: { ...hint, certificate: true } } : {}),
    };
  }
  if (looksLocal) {
    return {
      message: `Could not reach ${hostname} (http). Is the service running and listening on this port? If it only serves HTTPS, change the URL to https://.`,
    };
  }
  return {
    message:
      `Could not reach ${hostname}. Possible causes: host not found (DNS), connection refused, ` +
      'TLS certificate error, or missing host permission. Check the URL and retry.',
    ...(hint ? { hint } : {}),
  };
}
