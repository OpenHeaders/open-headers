/**
 * Compose several {@link WsPeerPushHooks} planes into the single seam
 * the WS server accepts — the push-plane twin of `compose-peer-rpc.ts`.
 * Ownership is first-match in argument order; planes never overlap by
 * construction (each owns a disjoint frame-type set), so order is a
 * tiebreak that should never fire.
 */

import type { PeerSummary, WsPeerPushHooks } from '../host-runtime/ws-server';

export function composePeerPush(...planes: readonly WsPeerPushHooks[]): WsPeerPushHooks {
  return {
    owns(type: string): boolean {
      return planes.some((plane) => plane.owns(type));
    },
    handle(message: Record<string, unknown>, peer: PeerSummary): void {
      const type = typeof message.type === 'string' ? message.type : '';
      planes.find((plane) => plane.owns(type))?.handle(message, peer);
    },
  };
}
