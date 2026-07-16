/**
 * Workbench request channels over the web tab's single wire —
 * `executeRequest` (and its `abortRequestSend` stop counterpart) and
 * the cookie-jar channels travel to the serving daemon and answer from
 * its spine (the tab oracle has no network transport and no jar). The
 * daemon's live `requestStreamEvent` frames for a forwarded send come
 * back down the same wire — `wire-request-stream.ts` claims them.
 *
 * The daemon resolves an unstated workspace to ITS runtime-Active one
 * and an unstated environment to ITS active pointer — both host-local
 * state that can differ from this tab's. So the forwarding seam stamps
 * the TAB's active workspace id and active environment id before the
 * frame leaves; the daemon runs unpinned when the stamped workspace
 * matches its own active one and pinned (the chain-dispatch path)
 * otherwise. The environment stamp is verbatim tri-state: the tab's
 * pointer is `string | null`, and `null` — the selectable "No
 * environment" state — rides the frame explicitly so the daemon runs
 * env-free instead of deferring to its own pointer. Only a tab that
 * doesn't know its workspace omits both stamps (full defer).
 *
 * Degradation is per surface: a refused/failed Send resolves as an
 * error SNAPSHOT (`success: true` + `snapshot.error`, the S13 error
 * contract) so the response panel states what happened — the daemon's
 * opt-in refusal rides here verbatim. The jar channels rethrow instead:
 * `CookieJarRow` hides itself on rejection by design.
 */

import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
import { getActiveEnvironmentId } from '@openheaders/oracle/entity/environment-store';
import { errorSnapshot } from '@openheaders/oracle/live/request-exec/execute';
import { peekActiveWorkspaceId } from '@openheaders/oracle/workspace/extension-workspace-store';
import { callWireRpc, registerWireRpcChannels } from './wire-rpc';

/** Wire wait for a forwarded Send when the draft carries no timeout knob. */
const EXECUTE_DEFAULT_TIMEOUT_MS = 120_000;
/** Slack past the request's own timeout for daemon-side resolve + transit. */
const EXECUTE_TIMEOUT_MARGIN_MS = 15_000;

const FORWARDED_CHANNELS = [
  'executeRequest',
  'abortRequestSend',
  'getCookieJarSummary',
  'clearCookieJar',
  'deleteCookieJarEntry',
] as const;

registerWireRpcChannels(FORWARDED_CHANNELS);

export function isForwardedRequestsChannel(type: unknown): type is (typeof FORWARDED_CHANNELS)[number] {
  return typeof type === 'string' && (FORWARDED_CHANNELS as readonly string[]).includes(type);
}

/** Stamp the tab's active workspace unless the caller already scoped one. */
function withWorkspaceStamp(message: Record<string, unknown>): Record<string, unknown> {
  if (typeof message.workspaceId === 'string') return message;
  const workspaceId = peekActiveWorkspaceId();
  return workspaceId ? { ...message, workspaceId } : message;
}

interface ExecuteRequestResult {
  success: boolean;
  snapshot?: ExecutedRequestSnapshot;
  error?: string;
}

async function forwardExecuteRequest(message: Record<string, unknown>): Promise<ExecuteRequestResult> {
  const stamped = { ...withWorkspaceStamp(message) };
  // Verbatim tri-state stamp: the tab's pointer is string | null, and
  // null (No environment) must reach the daemon explicitly. The pointer
  // only has meaning relative to a workspace, so a frame with no
  // workspace scope omits the env stamp too — full defer.
  if (stamped.environmentId === undefined && typeof stamped.workspaceId === 'string') {
    stamped.environmentId = getActiveEnvironmentId();
  }
  const draft = stamped.draft as { timeoutMs?: number } | undefined;
  const timeoutMs =
    (typeof draft?.timeoutMs === 'number' ? draft.timeoutMs : EXECUTE_DEFAULT_TIMEOUT_MS) + EXECUTE_TIMEOUT_MARGIN_MS;
  try {
    return (await callWireRpc(stamped, { timeoutMs })) as ExecuteRequestResult;
  } catch (err) {
    // Honest degrade on the Send surface: the daemon's refusal (opt-in
    // off, permission denied) or a dead wire renders as the response
    // panel's error state, never a silent null.
    return { success: true, snapshot: errorSnapshot((err as Error).message) };
  }
}

/**
 * Forward one workbench request channel up the wire. Only call for
 * channels {@link isForwardedRequestsChannel} owns.
 */
export async function forwardRequestsRpc(message: Record<string, unknown>): Promise<unknown> {
  if (message.type === 'executeRequest') {
    return forwardExecuteRequest(message);
  }
  return callWireRpc(withWorkspaceStamp(message));
}
