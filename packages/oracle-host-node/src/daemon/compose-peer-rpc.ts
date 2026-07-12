/**
 * Compose several {@link WsPeerRpcHooks} planes into the single seam
 * the WS server accepts. Ownership is first-match in argument order;
 * planes never overlap by construction (each owns a disjoint channel
 * set), so order is a tiebreak that should never fire.
 */

import type { WsPeerRpcContext, WsPeerRpcHooks } from '../host-runtime/ws-server';

export function composePeerRpc(...planes: readonly WsPeerRpcHooks[]): WsPeerRpcHooks {
  return {
    owns(type: string): boolean {
      return planes.some((plane) => plane.owns(type));
    },
    async dispatch(message: Record<string, unknown>, peer: WsPeerRpcContext): Promise<unknown> {
      const type = message.type as string;
      const plane = planes.find((p) => p.owns(type));
      if (!plane) {
        // Unreachable by construction — `owns` gated entry.
        throw new Error(`peer-rpc: no plane owns '${type}'`);
      }
      return await plane.dispatch(message, peer);
    },
  };
}
