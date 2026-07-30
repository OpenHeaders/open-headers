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

/**
 * Parse one configured proxy value into an entry, or `null` when the
 * value is empty or unusable. SOCKS schemes come back as
 * `kind: 'socks'` carrying the raw value — the transport owns the
 * honest failure.
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
  const scheme = url.protocol.replace(/:$/, '').toLowerCase();
  if (
    scheme === 'socks' ||
    scheme === 'socks4' ||
    scheme === 'socks4a' ||
    scheme === 'socks5' ||
    scheme === 'socks5h'
  ) {
    return { kind: 'socks', raw: trimmed };
  }
  if (scheme !== 'http' && scheme !== 'https') return null;
  if (url.hostname === '') return null;
  const port = url.port !== '' ? url.port : scheme === 'https' ? '443' : '80';
  const credential =
    url.username !== '' ? `${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}` : undefined;
  return {
    kind: 'proxy',
    url: `${scheme}://${url.hostname}:${port}`,
    ...(credential !== undefined ? { credential } : {}),
  };
}
