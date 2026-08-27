/**
 * Workbench `executeMqttRequest` route — the node host's user-facing
 * Connect, the `execute-websocket-request-rpc.ts` sibling for the
 * MqttRequest entity kind. Same result discipline: a session that
 * fails before or on the wire still resolves `success: true` with a
 * failed-outcome SNAPSHOT (the session pane renders the outcome's
 * error — a CONNACK refusal reason rides it verbatim); `success:
 * false` is
 * reserved for missing input and unexpected throws. The RPC resolves
 * when the session SETTLES — broker close or DISCONNECT, Disconnect
 * rider, Stop-abort, or a pre-open failure.
 *
 * Same workspace/environment semantics as `executeRequest`: unpinned
 * (`workspaceId: null`) when the caller's workspace is this host's
 * runtime-Active one, pinned for a forwarded frame, and an explicit
 * `environmentId: null` forces the pinned dispatch (the caller's "No
 * environment" state).
 *
 * The entity loads from the workspace's storage slots — the same
 * validated reads the sync caches hydrate from. No scripts on MQTT
 * sessions (the recorded WS precedent), so the executor is called
 * directly.
 */

import { hostBridge, type MqttStreamEventWire } from '@openheaders/core/bridge';
import { MqttRequestSchema } from '@openheaders/core/schemas';
import type { ExecutedMqttSnapshot, MqttRequest } from '@openheaders/core/types';
import { errorMqttSnapshot, executeMqttSession } from '@openheaders/oracle/live/mqtt-exec/execute';
import type { MqttByteTransport } from '@openheaders/oracle/live/mqtt-exec/transport';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import { getActiveWorkspaceId } from '@openheaders/oracle/workspace/extension-workspace-store';
import { createNodeMqttTransport } from '../live/node-mqtt-transport';

export interface ExecuteMqttRequestRpcResult {
  success: boolean;
  snapshot?: ExecutedMqttSnapshot;
  error?: string;
}

// Stateless — the transport opens one socket per session, so there is
// no pool to share; one instance keeps the seam symmetric with the
// WS handler's.
const nodeMqttTransport = createNodeMqttTransport();

/** Default live-frame sink for an in-process caller — the host's local
 *  broadcast, the `execute-websocket-request-rpc.ts` twin. */
function broadcastMqttStreamFrameLocally(event: MqttStreamEventWire): void {
  hostBridge.broadcast('mqttStreamEvent', event);
}

/** Handle one `executeMqttRequest` bridge message. `mqttRequestUid`
 *  takes precedence over `draft` (the channel contract); `sendId` is
 *  required — the session is interactive. */
export async function handleExecuteMqttRequestRpc(
  message: Record<string, unknown>,
  transport: MqttByteTransport = nodeMqttTransport,
  emitStreamEvent: (event: MqttStreamEventWire) => void = broadcastMqttStreamFrameLocally,
): Promise<ExecuteMqttRequestRpcResult> {
  const mqttRequestUid = typeof message.mqttRequestUid === 'string' ? message.mqttRequestUid : undefined;
  const draft = message.draft as MqttRequest | undefined;
  const sendId = typeof message.sendId === 'string' ? message.sendId : undefined;
  const environmentId =
    typeof message.environmentId === 'string' || message.environmentId === null ? message.environmentId : undefined;
  const requestedWorkspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : undefined;
  const trustedRootsDraft = Array.isArray(message.trustedRootsDraft)
    ? message.trustedRootsDraft.filter((pem): pem is string => typeof pem === 'string')
    : undefined;

  if (sendId === undefined) return { success: false, error: 'No sendId provided — a session needs one' };

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

    let request: MqttRequest | undefined;
    if (mqttRequestUid) {
      const all = await hostStorage.getValidatedArray(wsKeys(readWorkspaceId).mqttRequests, MqttRequestSchema);
      const loaded = all.find((r) => r.uid === mqttRequestUid);
      if (!loaded) {
        return { success: true, snapshot: errorMqttSnapshot(`MQTT request ${mqttRequestUid} not found`) };
      }
      request = loaded;
    } else {
      request = draft;
    }
    if (!request) return { success: false, error: 'No MQTT request or draft provided' };

    const snapshot = await executeMqttSession(request, {
      workspaceId,
      environmentId,
      transport,
      trustedRootsDraft,
      sendId,
      emitStreamEvent,
    });
    return { success: true, snapshot };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
