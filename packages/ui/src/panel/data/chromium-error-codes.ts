/**
 * Lookup table for Chromium `net::ERR_*` and Gecko `NS_ERROR_*` codes
 * surfaced by `chrome.webRequest.onErrorOccurred`.
 *
 *   - `reason` is the short label shown in the status column —
 *     `blocked`, `failed`, `canceled`, `timed out`, etc. Mirrors how
 *     Chrome's own Network tab abbreviates these codes.
 *   - `description` is one sentence the detail pane shows to explain
 *     what the user typically did (or what the page did) to trip it.
 *
 * Source: <https://source.chromium.org/chromium/chromium/src/+/main:net/base/net_error_list.h>
 * Firefox docs: <https://searchfox.org/mozilla-central/source/xpcom/base/ErrorList.h>
 *
 * Only the codes users actually see in real captures are listed —
 * anything not in the table falls back to the generic `failed` label.
 */

export interface ErrorCodeInfo {
  /** Short status-column label. */
  reason: string;
  /** One-sentence explanation for the detail pane. */
  description: string;
}

const TABLE: Record<string, ErrorCodeInfo> = {
  // ── Chromium (Chrome / Edge / Brave / Opera) ─────────────────────
  'net::ERR_BLOCKED_BY_CLIENT': {
    reason: 'blocked',
    description: 'A browser extension (typically an ad / tracker blocker) prevented this request from being sent.',
  },
  'net::ERR_BLOCKED_BY_RESPONSE': {
    reason: 'blocked:CORS',
    description: 'The response was blocked by Cross-Origin-Resource-Policy, Cross-Origin-Opener-Policy, or a CORS check.',
  },
  'net::ERR_BLOCKED_BY_CSP': {
    reason: 'blocked:CSP',
    description: 'The page\'s Content-Security-Policy disallowed this request.',
  },
  'net::ERR_BLOCKED_BY_XSS_AUDITOR': {
    reason: 'blocked:XSS',
    description: 'The browser\'s XSS auditor flagged the response and blocked it.',
  },
  'net::ERR_BLOCKED_BY_ADMINISTRATOR': {
    reason: 'blocked:policy',
    description: 'An enterprise policy blocked this request.',
  },
  'net::ERR_ABORTED': {
    reason: 'canceled',
    description: 'The request was canceled — typically because the user navigated away or another script aborted it.',
  },
  'net::ERR_FAILED': {
    reason: 'failed',
    description: 'The request failed for an unspecified reason. Often a service-worker `respondWith` error or a network-stack edge case.',
  },
  'net::ERR_CONNECTION_RESET': {
    reason: 'failed',
    description: 'The TCP connection was reset by the server or an intermediary.',
  },
  'net::ERR_CONNECTION_REFUSED': {
    reason: 'failed',
    description: 'The server refused to accept a connection on the requested port.',
  },
  'net::ERR_CONNECTION_CLOSED': {
    reason: 'failed',
    description: 'The server closed the connection without sending any data.',
  },
  'net::ERR_CONNECTION_ABORTED': {
    reason: 'failed',
    description: 'The connection was aborted before the response completed.',
  },
  'net::ERR_INTERNET_DISCONNECTED': {
    reason: 'offline',
    description: 'The browser has no network connectivity.',
  },
  'net::ERR_NAME_NOT_RESOLVED': {
    reason: 'failed:DNS',
    description: 'The hostname could not be resolved via DNS.',
  },
  'net::ERR_TIMED_OUT': {
    reason: 'timed out',
    description: 'The request timed out before a response was received.',
  },
  'net::ERR_EMPTY_RESPONSE': {
    reason: 'failed',
    description: 'The server closed the connection without sending any response data.',
  },
  'net::ERR_TOO_MANY_REDIRECTS': {
    reason: 'failed',
    description: 'The request hit the browser\'s redirect limit.',
  },
  'net::ERR_INVALID_RESPONSE': {
    reason: 'failed',
    description: 'The response was malformed and could not be parsed.',
  },
  'net::ERR_HTTP2_PROTOCOL_ERROR': {
    reason: 'failed',
    description: 'An HTTP/2 protocol error occurred during the exchange.',
  },
  'net::ERR_QUIC_PROTOCOL_ERROR': {
    reason: 'failed',
    description: 'A QUIC protocol error occurred during the exchange.',
  },
  'net::ERR_SSL_PROTOCOL_ERROR': {
    reason: 'blocked:cert',
    description: 'A TLS protocol error occurred during the handshake.',
  },
  'net::ERR_CERT_AUTHORITY_INVALID': {
    reason: 'blocked:cert',
    description: 'The server\'s TLS certificate was issued by an authority the browser does not trust.',
  },
  'net::ERR_CERT_COMMON_NAME_INVALID': {
    reason: 'blocked:cert',
    description: 'The server\'s TLS certificate does not match the requested hostname.',
  },
  'net::ERR_CERT_DATE_INVALID': {
    reason: 'blocked:cert',
    description: 'The server\'s TLS certificate is expired or not yet valid.',
  },
  'net::ERR_CACHE_MISS': {
    reason: 'failed:cache',
    description: 'A cache-only fetch missed the cache.',
  },
  'net::ERR_NETWORK_CHANGED': {
    reason: 'failed',
    description: 'The network connection changed while the request was in flight.',
  },
  'net::ERR_UNSAFE_REDIRECT': {
    reason: 'blocked',
    description: 'The redirect target was deemed unsafe (e.g. to a privileged scheme) and the browser refused to follow it.',
  },

  // ── Gecko (Firefox) ──────────────────────────────────────────────
  'NS_ERROR_ABORT': {
    reason: 'canceled',
    description: 'The request was canceled.',
  },
  'NS_ERROR_NET_RESET': {
    reason: 'failed',
    description: 'The connection was reset before the response could be received.',
  },
  'NS_ERROR_NET_TIMEOUT': {
    reason: 'timed out',
    description: 'The request timed out before a response was received.',
  },
  'NS_ERROR_NET_INTERRUPT': {
    reason: 'failed',
    description: 'The connection was interrupted while the response was being read.',
  },
  'NS_ERROR_CONNECTION_REFUSED': {
    reason: 'failed',
    description: 'The server refused to accept a connection on the requested port.',
  },
  'NS_ERROR_UNKNOWN_HOST': {
    reason: 'failed:DNS',
    description: 'The hostname could not be resolved via DNS.',
  },
  'NS_ERROR_OFFLINE': {
    reason: 'offline',
    description: 'The browser is in offline mode and refused to fetch.',
  },
  'NS_BINDING_ABORTED': {
    reason: 'canceled',
    description: 'The channel was canceled before completion.',
  },
};

/**
 * Look up reason + description for a network error code. Returns a
 * synthesized fallback if the code isn't in the table — derived from
 * the code's substring so even brand-new codes degrade gracefully.
 */
export function lookupErrorCode(code: string): ErrorCodeInfo {
  const hit = TABLE[code];
  if (hit) return hit;
  const lower = code.toLowerCase();
  if (lower.includes('blocked')) {
    return { reason: 'blocked', description: `Request blocked: ${code}.` };
  }
  if (lower.includes('cert') || lower.includes('ssl') || lower.includes('tls')) {
    return { reason: 'blocked:cert', description: `TLS/certificate failure: ${code}.` };
  }
  if (lower.includes('abort') || lower.includes('cancel')) {
    return { reason: 'canceled', description: `Request canceled: ${code}.` };
  }
  if (lower.includes('timeout') || lower.includes('timed_out')) {
    return { reason: 'timed out', description: `Request timed out: ${code}.` };
  }
  if (lower.includes('dns') || lower.includes('unknown_host') || lower.includes('name_not_resolved')) {
    return { reason: 'failed:DNS', description: `DNS lookup failed: ${code}.` };
  }
  return { reason: 'failed', description: `Network error: ${code}.` };
}
