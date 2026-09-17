/**
 * The workbench `executeMqttRequest` route — the `ws-route.ts`
 * sibling for the MqttRequest entity kind, the ONE host-neutral
 * answer every host that runs the session's executor gives over the
 * host seam in `host.ts`. Same result discipline: a session that
 * fails before or on the wire resolves `success: true` with a
 * failed-outcome SNAPSHOT (a CONNACK refusal reason and a place's
 * refusal ride it verbatim); `success: false` is reserved for missing
 * input and unexpected throws. The RPC resolves when the session
 * SETTLES — broker close or DISCONNECT, Disconnect rider, Stop-abort,
 * or a pre-open failure. The entity loads from the workspace's
 * storage slot or rides as the editor's live draft; where the byte
 * stream opens is the host's lease — its own dial, or a place's
 * through the delegating transport (the mqtt(s):// dial no browser
 * page can make), the answering host stamped on the snapshot.
 */

import { MqttRequestSchema } from '@openheaders/core/schemas';
import type { ExecutedMqttSnapshot, MqttRequest } from '@openheaders/core/types';
import { hostStorage, wsKeys } from '../../storage';
import {
  executeRouteScope,
  NO_ACTIVE_WORKSPACE_MESSAGE,
  NO_SEND_ID_MESSAGE,
  pinExecuteScope,
} from '../execute-route-scope';
import { errorMqttSnapshot, executeMqttSession } from '../mqtt-exec/execute';
import type { SessionRouteHost } from './host';

export interface ExecuteMqttSessionRouteResult {
  success: boolean;
  snapshot?: ExecutedMqttSnapshot;
  error?: string;
}

/** One `executeMqttRequest` frame. `mqttRequestUid` takes precedence
 *  over `draft` (the channel contract); `sendId` is required — the
 *  session is interactive. */
export async function executeMqttRequestRoute(
  message: Record<string, unknown>,
  host: SessionRouteHost,
): Promise<ExecuteMqttSessionRouteResult> {
  const mqttRequestUid = typeof message.mqttRequestUid === 'string' ? message.mqttRequestUid : undefined;
  const draft = message.draft as MqttRequest | undefined;
  const scope = executeRouteScope(message);
  if (scope.sendId === undefined) return { success: false, error: NO_SEND_ID_MESSAGE };
  try {
    const pinned = pinExecuteScope(scope);
    if (pinned === null) return { success: true, snapshot: errorMqttSnapshot(NO_ACTIVE_WORKSPACE_MESSAGE) };
    const { workspaceId, readWorkspaceId, forwarded } = pinned;

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

    const lease = host.mqttTransportFor(scope.placeBackendId, readWorkspaceId);
    const scriptHost =
      host.resolveScriptHost !== undefined
        ? await host.resolveScriptHost({ workspaceId: readWorkspaceId, forwarded })
        : null;
    const snapshot = await executeMqttSession(request, {
      workspaceId,
      environmentId: scope.environmentId,
      transport: lease.transport,
      sendId: scope.sendId,
      emitStreamEvent: host.emitMqttStreamEvent,
      ...(scriptHost !== null ? { scriptHost } : {}),
    });
    const executedOn = lease.executedOn();
    return { success: true, snapshot: executedOn !== null ? { ...snapshot, executedOn } : snapshot };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
