/**
 * Daemon-admin RPC channels — one handler table for the `oh.daemon.*`
 * surface (pairing, tokens, users, grants, the admin probe), shared by
 * BOTH dispatch planes:
 *
 *   - the host-side `dispatchRpc` (desktop renderer over IPC, the
 *     daemon's own surfaces), where the caller IS the operator by
 *     construction — no gate;
 *   - the peer-facing WS plane (`peer-admin-rpc.ts`), which fronts the
 *     same table with a per-frame `daemon.admin` capability gate.
 *
 * One implementation, two admission postures — a handler change can
 * never drift between the local and remote admin surfaces.
 */

import {
  createDaemonUser,
  type DaemonPairingService,
  deactivateDaemonUser,
  grantWorkspaceRole,
  listDaemonAuthTokens,
  listDaemonUsers,
  listWorkspaceRolesForPrincipal,
  mintDaemonAuthToken,
  revokeDaemonAuthToken,
  revokeWorkspaceRole,
} from '@openheaders/core/identity';
import { getWorkspace } from '@openheaders/oracle/workspace/extension-workspace-store';
import type { OracleWsServer } from '../host-runtime/ws-server';
import { listLanIpv4Addresses } from './lan-addresses';

/** The admin-visibility probe channel — see `peer-admin-rpc.ts`. */
export const ADMIN_STATUS_CHANNEL = 'oh.daemon.admin.status';

export interface AdminChannelDeps {
  pairing: DaemonPairingService;
  /** The port the WS server is actually bound on right now. */
  getBoundPort(): number;
  /** Live server slot — null until the supervisor's first bind resolves. */
  getWsServer(): OracleWsServer | null;
}

export type AdminChannelHandler = (message: Record<string, unknown>) => Promise<unknown> | unknown;

/**
 * Build the `oh.daemon.*` handler table. Handlers answer in-band
 * `{ ok: false, error }` shapes on domain refusals (unknown user, bad
 * role, …) — the transport-level uniform deny for ungated peers lives
 * in the peer plane, not here.
 */
export function createAdminChannelHandlers(deps: AdminChannelDeps): ReadonlyMap<string, AdminChannelHandler> {
  const { pairing } = deps;
  const handlers = new Map<string, AdminChannelHandler>();

  // Visibility probe. This table is only ever dispatched for an
  // admitted admin subject: local surfaces are the operator by
  // construction, and the peer plane answers the probe from its own
  // capability resolution before reaching the table. So `true` here is
  // a fact, not a bypass.
  handlers.set(ADMIN_STATUS_CHANNEL, () => ({ admin: true }));

  handlers.set('oh.daemon.pairing.start', (message) => {
    try {
      const deviceLabel = typeof message.deviceLabel === 'string' ? message.deviceLabel.trim() || undefined : undefined;
      const userId = typeof message.userId === 'string' ? message.userId.trim() || undefined : undefined;
      const { code, expiresAt } = pairing.startPair({ deviceLabel, ...(userId ? { userId } : {}) });
      const boundPort = deps.getBoundPort();
      const addresses = listLanIpv4Addresses();
      const pairingUrls = [
        { host: '127.0.0.1', url: `http://127.0.0.1:${boundPort}/pair/${code}` },
        ...addresses.map((a) => ({
          host: a.host,
          iface: a.iface,
          url: `http://${a.host}:${boundPort}/pair/${code}`,
        })),
      ];
      return { ok: true, code, expiresAt, port: boundPort, pairingUrls };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  handlers.set('oh.daemon.pairing.list', () => ({
    pairs: pairing.list().map((p) => ({
      code: p.code,
      deviceLabel: p.deviceLabel,
      createdAt: p.createdAt,
      expiresAt: p.expiresAt,
      status: p.status,
    })),
  }));

  handlers.set('oh.daemon.pairing.cancel', (message) => {
    const code = typeof message.code === 'string' ? message.code : '';
    if (code) pairing.cancel(code);
    return { ok: true };
  });

  handlers.set('oh.daemon.tokens.connected', () => {
    // Live ws-server state, not hostStorage — projected for the
    // "Known devices" admin surface (U3.4). Empty while loopback-only
    // (`wsServer` non-null but no LAN peers) or mid-rebind (null).
    const ids = deps.getWsServer()?.connectedTokenIds();
    return { tokenIds: ids ? [...ids] : [] };
  });

  handlers.set('oh.daemon.tokens.mint', async (message) => {
    // Mint in the host process so the persist shares this realm's
    // token-store mutex with HELLO validation (a surface's separate
    // mutex can't).
    try {
      const label = typeof message.label === 'string' ? message.label.trim() || undefined : undefined;
      const userId = typeof message.userId === 'string' ? message.userId.trim() || undefined : undefined;
      const minted = await mintDaemonAuthToken({ label, ...(userId ? { userId } : {}) });
      return { ok: true, tokenId: minted.record.id, secret: minted.secret };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  handlers.set('oh.daemon.tokens.revoke', async (message) => {
    const tokenId = typeof message.tokenId === 'string' ? message.tokenId : '';
    if (!tokenId) return { ok: false, error: 'missing tokenId' };
    try {
      // Persist the revoke BEFORE evicting the live socket: a peer that
      // reconnects in the eviction window then re-validates against the
      // already-revoked ledger and is rejected, rather than slipping a
      // fresh connection past a not-yet-written revoke.
      await revokeDaemonAuthToken(tokenId);
      deps.getWsServer()?.closePeersByTokenId(tokenId);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  handlers.set('oh.daemon.users.create', async (message) => {
    const displayName = typeof message.displayName === 'string' ? message.displayName : '';
    const email = typeof message.email === 'string' ? message.email.trim() || undefined : undefined;
    try {
      const created = await createDaemonUser({ displayName, ...(email ? { email } : {}) });
      return created.ok ? { ok: true, userId: created.record.user.id } : { ok: false, error: created.reason };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  handlers.set('oh.daemon.users.list', async () => {
    const users = await listDaemonUsers();
    return {
      users: await Promise.all(
        users.map(async (r) => ({
          userId: r.user.id,
          displayName: r.user.displayName,
          email: r.userIdentity.kind === 'email' ? r.userIdentity.value : null,
          createdAt: r.createdAt,
          deactivatedAt: r.deactivatedAt,
          grants: (await listWorkspaceRolesForPrincipal(r.principal.id)).map((wra) => ({
            workspaceId: wra.workspaceId,
            role: wra.role,
          })),
        })),
      ),
    };
  });

  handlers.set('oh.daemon.users.grant', async (message) => {
    const userId = typeof message.userId === 'string' ? message.userId : '';
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
    const role = typeof message.role === 'string' ? message.role : '';
    if (!userId || !workspaceId) return { ok: false, error: 'missing userId or workspaceId' };
    if (role !== 'owner' && role !== 'editor' && role !== 'viewer') {
      return { ok: false, error: 'role must be owner, editor or viewer' };
    }
    const record = (await listDaemonUsers()).find((r) => r.user.id === userId);
    if (!record) return { ok: false, error: 'unknown user' };
    if (record.deactivatedAt !== null) return { ok: false, error: 'user is deactivated' };
    // Validate against the live workspace set — a grant for a
    // non-existent workspace would only be silently dropped by the
    // next WRA reconcile; refuse it up front instead.
    if (!getWorkspace(workspaceId)) return { ok: false, error: 'unknown workspace' };
    try {
      const result = await grantWorkspaceRole({ principalId: record.principal.id, workspaceId, role });
      return result.ok ? { ok: true, updated: result.updated } : { ok: false, error: result.reason };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  handlers.set('oh.daemon.users.revokeGrant', async (message) => {
    const userId = typeof message.userId === 'string' ? message.userId : '';
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
    if (!userId || !workspaceId) return { ok: false, error: 'missing userId or workspaceId' };
    const record = (await listDaemonUsers()).find((r) => r.user.id === userId);
    if (!record) return { ok: false, error: 'unknown user' };
    try {
      const result = await revokeWorkspaceRole(record.principal.id, workspaceId);
      return result.ok ? { ok: true } : { ok: false, error: result.reason };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  handlers.set('oh.daemon.users.deactivate', async (message) => {
    const userId = typeof message.userId === 'string' ? message.userId : '';
    if (!userId) return { ok: false, error: 'missing userId' };
    try {
      const result = await deactivateDaemonUser(userId);
      if (!result.ok) return { ok: false, error: result.reason };
      // Kill the user's access now, not on their next HELLO: revoke
      // every token bound to the user, then evict live peers riding
      // them — same persist-before-evict ordering as tokens.revoke.
      const tokens = await listDaemonAuthTokens();
      for (const token of tokens) {
        if (token.userId !== userId || token.revokedAt !== null) continue;
        await revokeDaemonAuthToken(token.id);
        deps.getWsServer()?.closePeersByTokenId(token.id);
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  return handlers;
}
