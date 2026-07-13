/**
 * Compose several {@link WsPeerRpcHooks} planes into the single seam
 * the WS server accepts. Ownership is first-match in argument order;
 * planes never overlap by construction (each owns a disjoint channel
 * set), so order is a tiebreak that should never fire.
 *
 * Beyond the spine's fixed argument planes, a host shell can register
 * its OWN peer-facing planes through {@link registerPeerRpcPlane} —
 * channels the spine never learns (the migration pull's `getState`)
 * still answer over the peer wire without the shell reaching into the
 * spine's composition. Registered planes are consulted after the fixed
 * ones and share the disjoint-channel law.
 */

import type { WsPeerRpcContext, WsPeerRpcHooks } from '../host-runtime/ws-server';

const registeredPlanes = new Set<WsPeerRpcHooks>();

/**
 * Register a host-shell peer-RPC plane. Returns an unregister function
 * (tests; production shells register once for the process lifetime).
 */
export function registerPeerRpcPlane(plane: WsPeerRpcHooks): () => void {
  registeredPlanes.add(plane);
  return () => {
    registeredPlanes.delete(plane);
  };
}

export function composePeerRpc(...planes: readonly WsPeerRpcHooks[]): WsPeerRpcHooks {
  const allPlanes = (): WsPeerRpcHooks[] => [...planes, ...registeredPlanes];
  return {
    owns(type: string): boolean {
      return allPlanes().some((plane) => plane.owns(type));
    },
    async dispatch(message: Record<string, unknown>, peer: WsPeerRpcContext): Promise<unknown> {
      const type = message.type as string;
      const plane = allPlanes().find((p) => p.owns(type));
      if (!plane) {
        // Unreachable by construction — `owns` gated entry.
        throw new Error(`peer-rpc: no plane owns '${type}'`);
      }
      return await plane.dispatch(message, peer);
    },
  };
}
