/**
 * The page realm's wire for a delegated socket — the delegating
 * session transports' seam in the extension workbench (the Execution
 * Place plan's socket family). The realm holds no backend wire; the
 * service worker does. So an OPEN or a rider rides the
 * `delegatedSocketCall` bridge RPC to the worker, which forwards it on
 * the named backend, and the place's events arrive as the worker's
 * `delegatedSocketEvent` broadcast, filtered here by the socket id the
 * transport minted.
 */

import type { DelegatedSocketWire } from '@openheaders/oracle/live/delegated-socket/wire';
import { chromeBridge } from '@/utils/bridge';

export function pageDelegatedSocketWireFor(backendId: string): DelegatedSocketWire {
  return {
    call: (frame) => chromeBridge.call('delegatedSocketCall', { backendId, frame }),
    subscribe: (socketId, onEvent) =>
      chromeBridge.subscribe('delegatedSocketEvent', (event) => {
        if (event.socketId === socketId) onEvent(event);
      }),
  };
}
