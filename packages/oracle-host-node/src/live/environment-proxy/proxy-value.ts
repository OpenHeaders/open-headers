/**
 * Normalization of one configured proxy value (`corp:8080`,
 * `http://user:pass@corp:8080`, `socks5://corp:1080`) into an
 * environment-plane entry. Shared by the env-var adapter and — for its
 * scheme handling — the PAC-answer parser.
 *
 * The ecosystem norm for env-var proxies allows a bare `host:port`
 * (implied `http://`) and inline `user:password@` credentials; both
 * are normalized here so the entry's `url` is always a clean
 * `scheme://host:port` the dispatcher tuple can key on, with the
 * credential carried separately (it must never sit in a cache key or a
 * recorded route).
 */

import type { EnvironmentProxyEntry } from './types';

/** Whether a normalized proxy URL names a SOCKS5 proxy — the transport
 *  layers that must pick the SOCKS dial (or refuse a pin it can't
 *  carry) branch on this, never on ad-hoc scheme string checks. */
export function isSocks5ProxyUrl(url: string): boolean {
  return url.toLowerCase().startsWith('socks5://');
}

/**
 * Parse one configured proxy value into an entry, or `null` when the
 * value is empty or unusable. The SOCKS5 family (`socks5://`,
 * `socks://`, `socks5h://` — DNS-at-proxy is SOCKS5's default, so the
 * `h` variant normalizes away) comes back as a dialable
 * `socks5://host:port` entry; the SOCKS4 family the engine does not
 * speak comes back as `kind: 'socks'` carrying the raw value — the
 * transport owns the honest failure.
 */
export function parseProxyValue(value: string): EnvironmentProxyEntry | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed) ? trimmed : `http://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  const rawScheme = url.protocol.replace(/:$/, '').toLowerCase();
  if (rawScheme === 'socks4' || rawScheme === 'socks4a') {
    return { kind: 'socks', raw: trimmed };
  }
  const scheme = rawScheme === 'socks' || rawScheme === 'socks5h' ? 'socks5' : rawScheme;
  if (scheme !== 'http' && scheme !== 'https' && scheme !== 'socks5') return null;
  if (url.hostname === '') return null;
  const port = url.port !== '' ? url.port : scheme === 'https' ? '443' : scheme === 'socks5' ? '1080' : '80';
  const credential =
    url.username !== '' ? `${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}` : undefined;
  return {
    kind: 'proxy',
    url: `${scheme}://${url.hostname}:${port}`,
    ...(credential !== undefined ? { credential } : {}),
  };
}
