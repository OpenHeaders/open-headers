/**
 * Workbench `executeRequest` route — the node host's user-facing Send.
 * Answers the same bridge channel the extension SW handles, over the
 * same host-neutral orchestration every node send rides
 * (`runStepRequest`: resolve → TOTP cooldown gate → wire → cooldown
 * record), so every per-request knob and the cookie jar behave
 * identically to a chain or MCP send.
 *
 * Deliberately scriptless: no node-side sandbox exists for pre/post
 * request scripts, so `snapshot.scripts` stays null and the response
 * surface degrades cleanly. OAuth refresh-on-expired is likewise
 * omitted — like every node path today, the last-synced bundle attaches
 * as-is and the target's 401 is the actionable signal. No rate limiter:
 * a user-initiated Send is deliberate, matching the extension's
 * user-facing executor (the refresh token bucket is for agent and
 * scheduled traffic).
 *
 * Runs unpinned (`workspaceId: null`) — the run resolves against the
 * runtime-Active workspace's mirrors, which is what carries the active
 * environment pointer and the Active live registry for `{{live.*}}`.
 */

import type { ExecutedRequestSnapshot, Request } from '@openheaders/core/types';
import { getRequest } from '@openheaders/oracle/entity/request-store';
import { errorSnapshot } from '@openheaders/oracle/live/request-exec/execute';
import { runStepRequest } from '@openheaders/oracle/live/request-exec/run-step-request';
import type { RequestTransport } from '@openheaders/oracle/live/request-exec/transport';
import { createNodeRequestTransport } from '../live/node-request-transport';

export interface ExecuteRequestRpcResult {
  success: boolean;
  snapshot?: ExecutedRequestSnapshot;
  error?: string;
}

// Stateless wrapper — the dispatcher cache and cookie-jar registry are
// module-global in the transport layer, so this instance shares every
// agent tuple and jar with the chain runner's and the MCP tools'.
const nodeTransport = createNodeRequestTransport();

/**
 * Handle one `executeRequest` bridge message. `requestUid` takes
 * precedence over `draft` (the channel contract); a run that fails
 * before or on the wire still resolves `success: true` with an error
 * snapshot — the response surface renders `snapshot.error` — and
 * `success: false` is reserved for missing input and unexpected throws,
 * mirroring the extension SW handler.
 */
export async function handleExecuteRequestRpc(
  message: Record<string, unknown>,
  transport: RequestTransport = nodeTransport,
): Promise<ExecuteRequestRpcResult> {
  const requestUid = typeof message.requestUid === 'string' ? message.requestUid : undefined;
  const draft = message.draft as Request | undefined;
  const environmentId = typeof message.environmentId === 'string' ? message.environmentId : null;

  let request: Request | undefined;
  if (requestUid) {
    const loaded = getRequest(requestUid);
    if (!loaded) return { success: true, snapshot: errorSnapshot(`Request ${requestUid} not found`) };
    request = loaded;
  } else {
    request = draft;
  }
  if (!request) return { success: false, error: 'No request or draft provided' };

  try {
    const snapshot = await runStepRequest(request, { workspaceId: null, environmentId, transport });
    return { success: true, snapshot };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
