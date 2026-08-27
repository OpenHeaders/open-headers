/**
 * The host's User-Agent slot — the same install idiom as the
 * system-proxy resolver: the daemon spine registers the product token
 * for the running version at boot (`OpenHeaders/<app version>`, both
 * the desktop's in-process spine and the server), and every node dial
 * — HTTP, the WebSocket handshake, gRPC — seats it unless the request
 * carries a User-Agent of its own. Consulted at SEND time, so
 * registration order against transport creation never matters; an
 * unregistered host sends the bare product name, never the runtime's
 * anonymous default.
 */

import { productUserAgent } from '@openheaders/core/utils';

/** The `{ key, value }` shape every node transport's header list shares. */
interface WireHeader {
  key: string;
  value: string;
}

const USER_AGENT = 'user-agent';

let registered: string | undefined;

export function registerHostUserAgent(token: string): void {
  registered = token;
}

/** Clear a registration back to the bare product name (test hygiene). */
export function resetHostUserAgent(): void {
  registered = undefined;
}

export function hostUserAgent(): string {
  return registered ?? productUserAgent();
}

/** The request's headers with the host token seated when no row of the
 *  user's names the header — a user row always wins. */
export function withHostUserAgent(headers: ReadonlyArray<WireHeader>): ReadonlyArray<WireHeader> {
  return headers.some((h) => h.key.toLowerCase() === USER_AGENT)
    ? headers
    : [...headers, { key: USER_AGENT, value: hostUserAgent() }];
}
