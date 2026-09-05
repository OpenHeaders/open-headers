/**
 * Workbench `executeGraphqlRequest` route — the node host's user-facing
 * Query, `execute-request-rpc.ts`'s sibling for the GraphqlRequest
 * entity kind. The entity loads from the workspace's storage slot (or
 * rides as the editor's live draft), compiles ONCE into its HTTP send
 * (`compileGraphqlRequest`: one POST, the SAME uid + path so the
 * ancestor chain resolves unchanged), and runs the exact run leg
 * `executeRequest` runs — the pin rules, the script capability gate,
 * the interactive pipeline with streaming, the mode stamp. The result
 * IS an HTTP snapshot; the response surface renders it as one, with
 * the auth / inherited-settings / script attribution it already knows.
 *
 * Same result discipline: a run that fails before or on the wire still
 * resolves `success: true` with an error snapshot; `success: false` is
 * reserved for missing input and unexpected throws.
 */

import type { RequestStreamEventWire } from '@openheaders/core/bridge';
import { GraphqlRequestSchema } from '@openheaders/core/schemas';
import type { GraphqlRequest } from '@openheaders/core/types';
import { compileGraphqlRequest } from '@openheaders/oracle/live/graphql-exec/execute';
import { errorSnapshot } from '@openheaders/oracle/live/request-exec/execute';
import type { RequestTransport } from '@openheaders/oracle/live/request-exec/transport';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import { getActiveWorkspaceId } from '@openheaders/oracle/workspace/extension-workspace-store';
import { type ExecuteRequestRpcResult, runRequestRpc } from './execute-request-rpc';

/** Handle one `executeGraphqlRequest` bridge message. `graphqlRequestUid`
 *  takes precedence over `draft`; `operationName` overrides the stored
 *  pick for this send (the channel contract). */
export async function handleExecuteGraphqlRequestRpc(
  message: Record<string, unknown>,
  transport?: RequestTransport,
  emitStreamFrame?: (event: RequestStreamEventWire) => void,
): Promise<ExecuteRequestRpcResult> {
  const graphqlRequestUid = typeof message.graphqlRequestUid === 'string' ? message.graphqlRequestUid : undefined;
  const draft = message.draft as GraphqlRequest | undefined;
  const operationName = typeof message.operationName === 'string' ? message.operationName : undefined;
  const requestedWorkspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : undefined;

  try {
    let entity: GraphqlRequest | undefined;
    if (graphqlRequestUid) {
      // Storage reads need a concrete workspace — the frame's, else this
      // host's runtime-Active one (the MQTT route's read rule).
      const readWorkspaceId = requestedWorkspaceId ?? getActiveWorkspaceId();
      const all = await hostStorage.getValidatedArray(wsKeys(readWorkspaceId).graphqlRequests, GraphqlRequestSchema);
      const loaded = all.find((r) => r.uid === graphqlRequestUid);
      if (!loaded) {
        return { success: true, snapshot: errorSnapshot(`GraphQL request ${graphqlRequestUid} not found`) };
      }
      entity = loaded;
    } else {
      entity = draft;
    }
    if (!entity) return { success: false, error: 'No GraphQL request or draft provided' };
    const compiled = compileGraphqlRequest(entity, operationName !== undefined ? { operationName } : {});
    return await runRequestRpc(compiled, message, transport, emitStreamFrame);
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
