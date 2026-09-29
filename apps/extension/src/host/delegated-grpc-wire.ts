/**
 * The page realm's wire for a delegated gRPC call — the delegating
 * gRPC transport's seam in the extension workbench (the Execution
 * Place plan's gRPC leg). The realm holds no backend wire; the service
 * worker does. So the unary invoke, an OPEN, a rider and the Stop ride
 * the `delegatedSocketCall` bridge RPC to the worker, which forwards
 * them on the named backend (the invoke deadline-free, the rest on the
 * socket call's wait), and the place's events arrive as the worker's
 * `delegatedSocketEvent` broadcast, filtered here by the socket id the
 * transport minted.
 */

import type { DelegatedGrpcWire } from '@openheaders/oracle/live/grpc-exec/delegated-wire';
import { chromeBridge } from '@/utils/bridge';

export function pageDelegatedGrpcWireFor(backendId: string): DelegatedGrpcWire {
  return {
    invoke: (frame) => chromeBridge.call('delegatedSocketCall', { backendId, frame }),
    abort: (sendId) => {
      void chromeBridge
        .call('delegatedSocketCall', { backendId, frame: { type: 'abortRequestSend', sendId } })
        .catch(() => {});
    },
    call: (frame) => chromeBridge.call('delegatedSocketCall', { backendId, frame }),
    subscribe: (socketId, onEvent) =>
      chromeBridge.subscribe('delegatedSocketEvent', (event) => {
        if (event.socketId === socketId) onEvent(event);
      }),
  };
}
