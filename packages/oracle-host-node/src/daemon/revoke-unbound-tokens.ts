/**
 * O3 — retire the bootstrap credential: every unbound token dies the
 * moment a real admin provably exists. Two callers, one arc: the server
 * claim (the front-door plan §4.2 — the first admin is created) and the
 * OIDC declared-admin promotion (the server-access plan A3 — the first
 * IdP login that resolves to a declared admin). An unbound token
 * resolves to the operator and therefore to full admin; leaving them
 * alive past either moment is a standing backdoor around the admin just
 * established.
 *
 * Persist the revoke BEFORE evicting the socket, the ordering
 * `tokens.revoke` established: a peer racing the eviction re-reads an
 * already-revoked ledger instead of slipping a fresh connection past a
 * not-yet-written revoke. Each revocation is stamped with the same
 * `daemon.admin` allow row an administrative act over the peer plane
 * would carry.
 */

import { emitAuditEntry, listDaemonAuthTokens, revokeDaemonAuthToken } from '@openheaders/core/identity';

export async function revokeUnboundTokens(
  actorUserId: string,
  orgId: string,
  closePeersByTokenId: (tokenId: string) => void,
): Promise<number> {
  let revoked = 0;
  for (const token of await listDaemonAuthTokens()) {
    if (token.userId !== undefined || token.revokedAt !== null) continue;
    await revokeDaemonAuthToken(token.id);
    closePeersByTokenId(token.id);
    emitAuditEntry({ actorUserId, capability: 'daemon.admin', decision: { allow: true }, orgId });
    revoked += 1;
  }
  return revoked;
}
