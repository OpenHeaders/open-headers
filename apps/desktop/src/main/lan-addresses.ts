/**
 * Enumerate every non-loopback IPv4 address bound to a local interface
 * so the pairing modal (U3.3) can show every URL a peer might reach
 * this daemon at. We don't try to pick "the" best one — different
 * peers see different LANs (Wi-Fi vs Ethernet vs VPN), and the admin
 * is in the best position to know which network the peer is on.
 *
 * Loopback (`127.0.0.1`) is always included as a fallback so the
 * admin can also pair a same-machine browser without flipping the
 * daemon bind off loopback.
 */

import * as os from 'node:os';

export interface LanAddress {
  /** Numeric address string suitable for an HTTP URL host segment. */
  readonly host: string;
  /** Interface name (e.g. `en0`, `eth0`, `wlan0`) for the admin's reference. */
  readonly iface: string;
}

export function listLanIpv4Addresses(): readonly LanAddress[] {
  const seen = new Set<string>();
  const out: LanAddress[] = [];
  const interfaces = os.networkInterfaces();
  for (const [iface, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family !== 'IPv4') continue;
      if (addr.internal) continue;
      if (seen.has(addr.address)) continue;
      seen.add(addr.address);
      out.push({ host: addr.address, iface });
    }
  }
  return out;
}
