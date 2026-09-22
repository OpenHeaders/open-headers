/**
 * One server address, however the administrator wrote it down. A person
 * is told a host, a `host:port`, or the URL of the server's web tab —
 * never a scheme and a port as separate facts — so the wizard takes one
 * string and this parser normalizes it into the canonical `ws://` /
 * `wss://` socket URL every dialer reads.
 *
 *   - `192.168.1.20`            → `ws://192.168.1.20:8137`   (a bare host takes the product's default port)
 *   - `oh.example.com:19337`    → `ws://oh.example.com:19337`
 *   - `::1`, `[::1]:8137`       → `ws://[::1]:8137`
 *   - `http://…` / `ws://…`     → `ws://…`                    (a typed scheme keeps its own default port)
 *   - `https://…` / `wss://…`   → `wss://…`
 *
 * A path, query or fragment is dropped: the socket lives at the origin.
 * Anything else (credentials, another scheme, no host) is null.
 */

/** The daemon's and the desktop app's default bind port. */
export const DEFAULT_BACKEND_PORT = 8137;

const SOCKET_SCHEMES: Readonly<Record<string, 'ws' | 'wss'>> = {
  'ws:': 'ws',
  'http:': 'ws',
  'wss:': 'wss',
  'https:': 'wss',
};

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

export function parseBackendAddress(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const hasScheme = HAS_SCHEME.test(text);
  let candidate = text;
  if (!hasScheme) {
    // A bare IPv6 literal carries more than one colon and no brackets;
    // the URL parser needs it wrapped to tell it from `host:port`.
    const bareIpv6 = !text.startsWith('[') && (text.match(/:/g) ?? []).length > 1;
    candidate = `ws://${bareIpv6 ? `[${text}]` : text}`;
  }
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }
  const scheme = SOCKET_SCHEMES[parsed.protocol];
  if (scheme === undefined || parsed.hostname === '' || parsed.username !== '' || parsed.password !== '') {
    return null;
  }
  const port = parsed.port !== '' ? parsed.port : hasScheme ? '' : String(DEFAULT_BACKEND_PORT);
  return port ? `${scheme}://${parsed.hostname}:${port}` : `${scheme}://${parsed.hostname}`;
}
