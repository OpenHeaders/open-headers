/**
 * Join URLs — the addresses a client dials this daemon at, derived from
 * a bind. Shared by `ohd show-token` (where a fresh secret is paired
 * with the URLs to use it at) and `ohd status` (where a LAN bind names
 * the addresses clients on the network actually reach).
 *
 * Loopback is always offered; the LAN interfaces only mean anything on
 * a `0.0.0.0` bind, so they are enumerated exactly there. The scheme is
 * `ws://` throughout — the daemon has no native TLS, and a deployment
 * behind a TLS proxy is addressed by the proxy's own name, which this
 * host cannot know.
 */

import { listLanIpv4Addresses } from '@openheaders/oracle-host-node/daemon/lan-addresses';

export interface JoinUrl {
  readonly host: string;
  readonly iface?: string;
  readonly url: string;
}

/** Every non-loopback IPv4 address of this host, as join URLs. */
export function lanJoinUrls(port: number): JoinUrl[] {
  return listLanIpv4Addresses().map((address) => ({
    host: address.host,
    iface: address.iface,
    url: `ws://${address.host}:${port}`,
  }));
}

/** Loopback first, plus the LAN addresses when the bind reaches them. */
export function joinUrlsFor(bindAddress: string, port: number): JoinUrl[] {
  const urls: JoinUrl[] = [{ host: '127.0.0.1', url: `ws://127.0.0.1:${port}` }];
  if (bindAddress === '0.0.0.0') urls.push(...lanJoinUrls(port));
  return urls;
}
