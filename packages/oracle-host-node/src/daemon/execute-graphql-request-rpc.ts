/**
 * Workbench `executeGraphqlRequest` route — `execute-request-rpc.ts`'s
 * sibling for the GraphqlRequest entity kind: the shared route over
 * the node host's seam. The entity loads from the read workspace's
 * storage slot (or rides as the editor's live draft), compiles ONCE
 * into its HTTP send and runs the exact run leg `executeRequest` runs
 * — the pin rules, the script capability gate, the interactive
 * pipeline with streaming, the mode stamp. The result IS an HTTP
 * snapshot; the response surface renders it as one.
 */

import type { RequestStreamEventWire } from '@openheaders/core/bridge';
import type { RequestTransport } from '@openheaders/oracle/live/request-exec/transport';
import { executeGraphqlRequestRoute } from '@openheaders/oracle/live/request-route/route';
import { createNodeRequestRouteHost, type ExecuteRequestRpcResult } from './execute-request-rpc';

/** Handle one `executeGraphqlRequest` bridge message. `graphqlRequestUid`
 *  takes precedence over `draft`; `operationName` overrides the stored
 *  pick for this send (the channel contract). */
export function handleExecuteGraphqlRequestRpc(
  message: Record<string, unknown>,
  transport?: RequestTransport,
  emitStreamFrame?: (event: RequestStreamEventWire) => void,
): Promise<ExecuteRequestRpcResult> {
  return executeGraphqlRequestRoute(
    message,
    createNodeRequestRouteHost({ ownTransport: transport, emitStreamEvent: emitStreamFrame }),
  );
}
