/**
 * Live WS-server slot — the one place host code outside the boot spine
 * reaches connected peers. The spine's bind supervisor writes it on
 * every server change (through `setMutationForwarderWsServer`, its
 * long-standing setter); consumers re-read at send time so
 * bind-supervisor swaps flow through, exactly like the mutation
 * forwarder's own queue does.
 *
 * `null` whenever no server is bound (before the first bind, after a
 * failed rebind, after dispose) — consumers treat that as "no peers".
 */

import type { OracleWsServer } from '../host-runtime/ws-server';

let server: OracleWsServer | null = null;

export function setWsPeerServer(next: OracleWsServer | null): void {
  server = next;
}

export function getWsPeerServer(): OracleWsServer | null {
  return server;
}
