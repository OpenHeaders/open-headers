/**
 * Parser for Chromium's `session.resolveProxy` answer — the PAC-format
 * fallback chain (`PROXY a:8080; HTTPS b:443; SOCKS5 c:1080; DIRECT`).
 * Pure, so the desktop's Chromium adapter stays a thin Electron
 * wrapper and this mapping is unit-testable without a browser.
 *
 * Token mapping: `DIRECT` terminates the chain with a direct entry;
 * `PROXY` is an `http://` proxy (port defaults to 80 when Chromium
 * omits it); `HTTPS` is a proxy reached over TLS (`https://`, default
 * 443); the SOCKS family is carried as `kind: 'socks'` verbatim for
 * the transport's honest failure. Unknown tokens are skipped — a
 * future PAC vocabulary must not break the chain walk.
 */

import type { EnvironmentProxyEntry } from './types';

export function parsePacProxyList(answer: string): EnvironmentProxyEntry[] {
  const entries: EnvironmentProxyEntry[] = [];
  for (const rawPart of answer.split(';')) {
    const part = rawPart.trim();
    if (part === '') continue;
    const [token, ...rest] = part.split(/\s+/);
    const keyword = token.toUpperCase();
    if (keyword === 'DIRECT') {
      entries.push({ kind: 'direct' });
      continue;
    }
    const target = rest.join(' ').trim();
    if (target === '') continue;
    if (keyword === 'PROXY' || keyword === 'HTTP') {
      entries.push({ kind: 'proxy', url: `http://${withDefaultPort(target, 80)}` });
    } else if (keyword === 'HTTPS') {
      entries.push({ kind: 'proxy', url: `https://${withDefaultPort(target, 443)}` });
    } else if (keyword === 'SOCKS' || keyword === 'SOCKS4' || keyword === 'SOCKS5') {
      entries.push({ kind: 'socks', raw: part });
    }
  }
  return entries;
}

/** Append the scheme's default port when the PAC answer omitted one.
 *  Bracketed IPv6 literals keep their brackets. */
function withDefaultPort(hostPort: string, defaultPort: number): string {
  if (/^\[[^\]]+\]$/.test(hostPort)) return `${hostPort}:${defaultPort}`;
  if (/^\[[^\]]+\]:\d+$/.test(hostPort)) return hostPort;
  const colon = hostPort.lastIndexOf(':');
  if (colon !== -1 && /^\d+$/.test(hostPort.slice(colon + 1))) return hostPort;
  return `${hostPort}:${defaultPort}`;
}
