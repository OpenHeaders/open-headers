/**
 * NO_PROXY bypass matching, curl semantics: a comma-separated list of
 * host suffixes (`example.com` matches the host and every subdomain,
 * dot-boundary aligned; a leading dot is tolerated), optional
 * `host:port` forms (the port narrows the match to that port only),
 * IPv4 CIDR blocks against IP-literal targets, and the `*` wildcard
 * that bypasses everything. No implicit loopback bypass — curl has
 * none, and an explicit `localhost,127.0.0.1` entry is the honest way
 * to ask for one. The full curl-parity table tests ride P4; this
 * matcher is the shared implementation they will pin.
 */

import { isIP } from 'node:net';

/** Whether `hostname:port` is bypassed by the NO_PROXY value. */
export function isBypassedByNoProxy(hostname: string, port: number, noProxy: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  for (const rawEntry of noProxy.split(',')) {
    const entry = rawEntry.trim().toLowerCase();
    if (entry === '') continue;
    if (entry === '*') return true;
    if (entry.includes('/') && matchesCidr(host, entry)) return true;
    const { entryHost, entryPort } = splitHostPort(entry);
    if (entryPort !== null && entryPort !== port) continue;
    const suffix = entryHost.replace(/^\./, '');
    if (suffix === '') continue;
    if (host === suffix || host.endsWith(`.${suffix}`)) return true;
  }
  return false;
}

/** Split a NO_PROXY entry into host + optional port. IPv6 literals may
 *  be bracketed (`[::1]:8080`); an unbracketed IPv6 entry has no port
 *  (every colon belongs to the address). */
function splitHostPort(entry: string): { entryHost: string; entryPort: number | null } {
  const bracketed = /^\[([^\]]+)\](?::(\d+))?$/.exec(entry);
  if (bracketed !== null) {
    return { entryHost: bracketed[1], entryPort: bracketed[2] !== undefined ? Number(bracketed[2]) : null };
  }
  if (isIP(entry) === 6) return { entryHost: entry, entryPort: null };
  const colon = entry.lastIndexOf(':');
  if (colon === -1) return { entryHost: entry, entryPort: null };
  const portText = entry.slice(colon + 1);
  if (!/^\d+$/.test(portText)) return { entryHost: entry, entryPort: null };
  return { entryHost: entry.slice(0, colon), entryPort: Number(portText) };
}

/** IPv4 CIDR match against an IPv4-literal target host. */
function matchesCidr(host: string, entry: string): boolean {
  if (isIP(host) !== 4) return false;
  const [network, prefixText] = entry.split('/', 2);
  if (isIP(network) !== 4 || !/^\d+$/.test(prefixText)) return false;
  const prefix = Number(prefixText);
  if (prefix < 0 || prefix > 32) return false;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipv4ToInt(host) & mask) === (ipv4ToInt(network) & mask);
}

function ipv4ToInt(address: string): number {
  return address.split('.').reduce((acc, octet) => ((acc << 8) | Number(octet)) >>> 0, 0);
}
