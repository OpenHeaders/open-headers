// ── Reach classification ────────────────────────────────────────────

import { BACKEND_REACH, type BackendReach } from '@openheaders/core/protocol';

/**
 * True when an incoming socket's remote address is a loopback address —
 * the peer is a process on this same machine. This is a
 * **reporting + reach** classifier only; it does NOT gate auth. Since A1
 * every peer presents a paired token regardless of origin (loopback is
 * reachable cross-user on a shared box and TCP blocks OS peer-cred, so
 * trust-by-process isn't a sound floor). The classification still matters
 * downstream: a same-device (loopback) peer is the only one allowed to
 * receive same-device-only secrets (the WS-B vault reach gate), and admin
 * surfaces distinguish a loopback peer from a LAN one. IPv4-mapped IPv6
 * loopback (`::ffff:127.0.0.1`) is normalized before the check.
 */
export function isLoopbackRemote(remoteAddress: string | undefined): boolean {
  if (!remoteAddress) return false;
  const addr = remoteAddress.startsWith('::ffff:') ? remoteAddress.slice('::ffff:'.length) : remoteAddress;
  return addr === '::1' || addr.startsWith('127.');
}

/**
 * Classify this server's *bind* address into a {@link BackendReach}
 * tier. Loopback binds (`127.*` / `::1` / `localhost`) only ever serve
 * this machine; any broader bind is reachable by LAN peers. `wan` is not
 * inferred here — a process can't tell NAT / public reachability from
 * its bind alone; a wide-area daemon deployment sets that explicitly.
 */
export function bindReach(host: string): BackendReach {
  if (host === '::1' || host === 'localhost' || host.startsWith('127.')) return BACKEND_REACH.LOOPBACK;
  return BACKEND_REACH.LAN;
}
