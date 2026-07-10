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
 * Map a recovered net-stack code to an actionable message. The code
 * itself is always included verbatim — it is the ground truth the
 * browser's own Network panel shows, and searchable as-is.
 */
function describeNetError(
  code: string,
  parsed: URL,
  hint: ExecutedRequestErrorHint | undefined,
): ClassifiedFailure {
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
  if (code.includes('CERT_') || code.includes('SSL_')) {
    const localNote = local
      ? ' Local dev servers usually run with a self-signed certificate, which the browser rejects before the request is sent.'
      : '';
    return {
      message: `${host} presented an untrusted or invalid certificate (${code}).${localNote} Open the URL in a new tab, accept the certificate warning, then retry.`,
      ...(hint ? { hint } : {}),
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
    return { message: `The request was blocked by browser policy (${code}) — this machine's enterprise configuration.` };
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
    return {
      message:
        `Could not reach ${hostname} over HTTPS. Local HTTPS endpoints usually fail here because the ` +
        'development certificate is self-signed — the browser rejects untrusted certificates before the ' +
        'request is sent. Open the URL in a new tab, accept the certificate warning, then retry. ' +
        'If the tab loads cleanly, check that the service is running and serves HTTPS on this port.',
      hint,
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
