/**
 * Human-friendly HTTP-version labels.
 *
 * HAR entries expose `httpVersion` as the raw ALPN protocol ID or
 * wire label: `HTTP/1.1`, `h2`, `h3`, `h3-29`, `h3-Q050`,
 * `http/2+quic/99` (old Chrome), etc. Showing `h3` in the UI prompts
 * a fair "what's h3?" from users, so we map to the plain-English
 * name. The raw value stays available as a tooltip for anyone who
 * needs the exact on-wire identifier.
 *
 * Keep this UI-only — exports (cURL, HAR) must preserve the raw
 * string so downstream tools can reproduce the request faithfully.
 */

/** Returns a human-readable label (`HTTP/3`) for any known version. */
export function formatHttpVersion(raw: string | undefined | null): string {
  if (!raw) return '';
  const s = raw.trim();
  if (!s) return '';
  const lower = s.toLowerCase();
  // Chrome's legacy QUIC labels are actually HTTP/3 on the wire
  // (e.g. `http/2+quic/99`). Check before the generic `HTTP/`
  // passthrough so those don't render as "HTTP/2+QUIC/99".
  if (lower.includes('quic')) return 'HTTP/3';
  // Anything starting with `HTTP/` is already human-readable — pass
  // through (covers `HTTP/1.0`, `HTTP/1.1`, `HTTP/2`, `HTTP/3`).
  if (lower.startsWith('http/')) return s.toUpperCase();
  // ALPN IDs for HTTP/2 and HTTP/3 (various draft tags).
  if (lower === 'h2' || lower === 'h2c') return 'HTTP/2';
  if (lower === 'h3' || lower.startsWith('h3-') || lower.startsWith('h3/')) return 'HTTP/3';
  // SPDY (deprecated but still occasionally seen in the wild).
  if (lower.startsWith('spdy/')) return `SPDY (${s})`;
  return s;
}
