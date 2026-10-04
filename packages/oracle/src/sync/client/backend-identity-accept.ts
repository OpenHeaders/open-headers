/**
 * Accepting a backend's new identity — the person's half of the
 * refused branch in `backend-wire-handshake.ts`. An authenticated wire
 * whose WELCOME names a different Org than the record is bound to is
 * not joined; the connections list shows the change and offers this.
 *
 * Accepting forgets the record's previous identity (its joined-Org rows
 * — the workspaces under them stay as local copies, the same outcome
 * as removing the record with Keep) and re-dials the wire so the fresh
 * WELCOME claims the new Org as a first join: the catch-up pulls its
 * workspaces and the pending identity-change row resolves on that
 * success. Host-neutral: the extension SW and the desktop main process
 * both answer the `oh.backendIdentity.accept` channel with it.
 */

import { pruneJoinedOrgsForBackend } from '@openheaders/core/identity';
import { reconnectBackend } from './backend-connection-manager';

export interface AcceptBackendIdentityChangeResult {
  /** True when the record had a live wire to re-dial; false leaves the join to the record's next Connect. */
  reconnected: boolean;
}

export async function acceptBackendIdentityChange(backendId: string): Promise<AcceptBackendIdentityChangeResult> {
  await pruneJoinedOrgsForBackend(backendId);
  return { reconnected: reconnectBackend(backendId) };
}
