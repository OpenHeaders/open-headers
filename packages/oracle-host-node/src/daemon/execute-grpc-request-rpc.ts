/**
 * Workbench `executeGrpcRequest` route — the node host's user-facing
 * gRPC Invoke, the `execute-request-rpc.ts` sibling for the GrpcRequest
 * entity kind. Same result discipline: a call that fails before or on
 * the wire still resolves `success: true` with an error SNAPSHOT (the
 * response surface renders `snapshot.error`); `success: false` is
 * reserved for missing input and unexpected throws.
 *
 * Same workspace/environment semantics as `executeRequest`: unpinned
 * (`workspaceId: null`) when the caller's workspace is this host's
 * runtime-Active one, pinned for a forwarded frame, and an explicit
 * `environmentId: null` forces the pinned dispatch (the caller's "No
 * environment" state).
 *
 * The entity and its linked Protobuf spec load from the workspace's
 * storage slots — the same validated reads the sync caches hydrate
 * from, so the invoke sees exactly what the workspace holds. No
 * scripts in this phase (the gRPC Scripts tab is a Phase G parity
 * decision), so there is no interactive/step pipeline split — the
 * executor is called directly.
 */

import { type GrpcStreamEventWire, hostBridge } from '@openheaders/core/bridge';
import { GrpcRequestSchema, SpecSchema } from '@openheaders/core/schemas';
import type { ExecutedGrpcSnapshot, GrpcRequest, Spec } from '@openheaders/core/types';
import { errorGrpcSnapshot, executeGrpcInvoke } from '@openheaders/oracle/live/grpc-exec/execute';
import type { GrpcTransport } from '@openheaders/oracle/live/grpc-exec/transport';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import { getActiveWorkspaceId } from '@openheaders/oracle/workspace/extension-workspace-store';
import { createNodeGrpcTransport } from '../live/node-grpc-transport';

export interface ExecuteGrpcRequestRpcResult {
  success: boolean;
  snapshot?: ExecutedGrpcSnapshot;
  error?: string;
}

// Stateless — the transport opens one HTTP/2 session per invoke, so
// there is no pool to share; one instance keeps the seam symmetric
// with the HTTP handler's.
const nodeGrpcTransport = createNodeGrpcTransport();

/**
 * Default live-frame sink for an in-process caller — the host's local
 * broadcast, the `execute-request-rpc.ts` twin. A peer-forwarded
 * invoke passes its own sink instead (Phase F).
 */
function broadcastGrpcStreamFrameLocally(event: GrpcStreamEventWire): void {
  hostBridge.broadcast('grpcStreamEvent', event);
}

/** Handle one `executeGrpcRequest` bridge message. `grpcRequestUid`
 *  takes precedence over `draft` (the channel contract). */
export async function handleExecuteGrpcRequestRpc(
  message: Record<string, unknown>,
  transport: GrpcTransport = nodeGrpcTransport,
  emitStreamEvent: (event: GrpcStreamEventWire) => void = broadcastGrpcStreamFrameLocally,
): Promise<ExecuteGrpcRequestRpcResult> {
  const grpcRequestUid = typeof message.grpcRequestUid === 'string' ? message.grpcRequestUid : undefined;
  const draft = message.draft as GrpcRequest | undefined;
  const sendId = typeof message.sendId === 'string' ? message.sendId : undefined;
  const environmentId =
    typeof message.environmentId === 'string' || message.environmentId === null ? message.environmentId : undefined;
  const requestedWorkspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : undefined;

  try {
    const activeWorkspaceId = getActiveWorkspaceId();
    // Pin rules verbatim from `executeRequest`: a foreign workspace or
    // an explicit "No environment" runs pinned; otherwise the run
    // resolves against the Active-bound module mirrors.
    const workspaceId =
      requestedWorkspaceId !== undefined && requestedWorkspaceId !== activeWorkspaceId
        ? requestedWorkspaceId
        : environmentId === null
          ? activeWorkspaceId
          : null;
    // Storage reads need a concrete workspace either way.
    const readWorkspaceId = requestedWorkspaceId ?? activeWorkspaceId;

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

    const snapshot = await executeGrpcInvoke(request, {
      workspaceId,
      environmentId,
      transport,
      spec,
      ...(sendId !== undefined ? { sendId } : {}),
      emitStreamEvent,
    });
    return { success: true, snapshot };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
