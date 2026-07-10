/**
 * Peer-facing daemon-admin plane — fronts the shared `oh.daemon.*`
 * handler table (`admin-channels.ts`) with the per-frame RBAC law:
 * every call resolves the PEER's identity snapshot fresh (never
 * cached — a revocation bites the very next frame), gates on the
 * `daemon.admin` CAPABILITY (never the operator identity, so a future
 * claims-mapping slice can grant admin to a directory user without
 * reopening this plane), and audits every enforcement decision. A
 * denied call answers a uniform in-band error — identical for every
 * admin channel, so the deny leaks nothing about which channels exist.
 *
 * The one deliberate exception is the visibility probe
 * (`oh.daemon.admin.status`): it answers `{ admin }` from the same
 * capability resolution but emits NO audit row — it is a question the
 * UI asks on every connect, not an enforcement decision, and auditing
 * it would bury real deny rows in noise.
 */

import { emitAuditEntry, hasCapability, resolveDaemonPeerIdentitySnapshot } from '@openheaders/core/identity';
import type { WsPeerRpcContext, WsPeerRpcHooks } from '../host-runtime/ws-server';
import { ADMIN_STATUS_CHANNEL, type AdminChannelHandler } from './admin-channels';

/** Uniform in-band deny — byte-identical for every admin channel. */
export const ADMIN_DENIED_MESSAGE = 'daemon-admin: permission denied';

export interface PeerAdminRpcOptions {
  channels: ReadonlyMap<string, AdminChannelHandler>;
}

export function createPeerAdminRpc(options: PeerAdminRpcOptions): WsPeerRpcHooks {
  const { channels } = options;

  return {
    owns(type: string): boolean {
      return channels.has(type);
    },
    async dispatch(message: Record<string, unknown>, peer: WsPeerRpcContext): Promise<unknown> {
      const snapshot = await resolveDaemonPeerIdentitySnapshot(peer.userId);
      const decision = hasCapability(snapshot, 'daemon.admin');

      const type = message.type as string;
      if (type === ADMIN_STATUS_CHANNEL) {
        return { admin: decision.allow };
      }

      emitAuditEntry({ actorUserId: peer.userId, capability: 'daemon.admin', decision });
      if (!decision.allow) {
        throw new Error(ADMIN_DENIED_MESSAGE);
      }
      const handler = channels.get(type);
      if (!handler) {
        // Unreachable by construction — `owns` gated entry. Fail loudly
        // (and uniformly) if routing and ownership ever drift.
        throw new Error(ADMIN_DENIED_MESSAGE);
      }
      return await handler(message);
    },
  };
}
