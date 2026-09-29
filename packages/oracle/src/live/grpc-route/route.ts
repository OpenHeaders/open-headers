/**
 * The workbench gRPC route — `executeGrpcRequest` — the ONE
 * host-neutral answer every host that runs the call's EXECUTOR gives
 * (the daemon and the desktop app through the node spine, the web tab
 * as its own context), over the host seam in `host.ts`. Same result
 * discipline everywhere: a call that fails before or on the wire
 * still resolves `success: true` with an error SNAPSHOT (the response
 * surface renders `snapshot.error` — a place's refusal rides it
 * verbatim); `success: false` is reserved for missing input and
 * unexpected throws.
 *
 * The entity and its linked Protobuf spec load from the read
 * workspace's storage slots (the same validated reads the sync caches
 * hydrate from, so the invoke sees exactly what the workspace holds)
 * or the entity rides as the editor's live draft; the spec is the
 * CONTEXT's — the executor builds the registry and encodes the
 * message here, whatever place opens the session. The pin rules are
 * every execute route's (`execute-route-scope.ts`); a frame stamped
 * with a foreign workspace is a peer-forwarded call whose hooks run
 * Safe unconditionally. Where the session opens is the host's lease:
 * its own HTTP/2 stack, or a place's through the delegating transport,
 * the answering host stamped on the snapshot.
 */

import { GrpcRequestSchema, SpecSchema } from '@openheaders/core/schemas';
import type { ExecutedGrpcSnapshot, GrpcRequest, Spec } from '@openheaders/core/types';
import { hostStorage, wsKeys } from '../../storage';
import { executeRouteScope, NO_ACTIVE_WORKSPACE_MESSAGE, pinExecuteScope } from '../execute-route-scope';
import { errorGrpcSnapshot, executeGrpcInvoke } from '../grpc-exec/execute';
import { buildRefreshOAuthHook } from '../request-exec/oauth-refresh';
import type { GrpcRouteHost } from './host';

export interface ExecuteGrpcRequestRouteResult {
  success: boolean;
  snapshot?: ExecutedGrpcSnapshot;
  error?: string;
}

/** One `executeGrpcRequest` frame. `grpcRequestUid` takes precedence
 *  over `draft` (the channel contract). */
export async function executeGrpcRequestRoute(
  message: Record<string, unknown>,
  host: GrpcRouteHost,
): Promise<ExecuteGrpcRequestRouteResult> {
  const grpcRequestUid = typeof message.grpcRequestUid === 'string' ? message.grpcRequestUid : undefined;
  const draft = message.draft as GrpcRequest | undefined;
  try {
    const scope = executeRouteScope(message);
    const pinned = pinExecuteScope(scope);
    if (pinned === null) return { success: true, snapshot: errorGrpcSnapshot(NO_ACTIVE_WORKSPACE_MESSAGE) };
    const { workspaceId, readWorkspaceId, forwarded } = pinned;

    let request: GrpcRequest | undefined;
    if (grpcRequestUid) {
      const all = await hostStorage.getValidatedArray(wsKeys(readWorkspaceId).grpcRequests, GrpcRequestSchema);
      const loaded = all.find((r) => r.uid === grpcRequestUid);
      if (!loaded) {
        return { success: true, snapshot: errorGrpcSnapshot(`gRPC request ${grpcRequestUid} not found`) };
      }
      request = loaded;
    } else {
      request = draft;
    }
    if (!request) return { success: false, error: 'No gRPC request or draft provided' };

    let spec: Spec | null = null;
    const specUid = request.specLink?.specUid;
    if (specUid !== undefined) {
      const specs = await hostStorage.getValidatedArray(wsKeys(readWorkspaceId).specs, SpecSchema);
      spec = specs.find((s) => s.uid === specUid) ?? null;
    }

    const lease = host.transportFor(scope.placeBackendId, readWorkspaceId);
    const scriptHost =
      host.resolveScriptHost !== undefined
        ? await host.resolveScriptHost({ workspaceId: readWorkspaceId, forwarded })
        : null;
    const refreshTransport = host.refreshTransportFor?.(readWorkspaceId);
    const snapshot = await executeGrpcInvoke(request, {
      workspaceId,
      environmentId: scope.environmentId,
      transport: lease.transport,
      spec,
      ...(scope.sendId !== undefined ? { sendId: scope.sendId } : {}),
      emitStreamEvent: host.emitStreamEvent,
      ...(refreshTransport !== undefined
        ? { refreshOAuth: buildRefreshOAuthHook(workspaceId ?? undefined, refreshTransport) }
        : {}),
      ...(scriptHost !== null ? { scriptHost } : {}),
    });
    // The answering host's stamp — where the session opened.
    const executedOn = lease.executedOn();
    return { success: true, snapshot: executedOn !== null ? { ...snapshot, executedOn } : snapshot };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
