/**
 * The web tab's own HTTP send — the Execution Place plan's Phase W:
 * the tab is a CONTEXT. `executeRequest` / `executeGraphqlRequest`
 * resolve IN the tab against its synced mirrors (the workspace, its
 * environment pointer, its live values, its files, its own vault),
 * the request rides the host-neutral step runner exactly as the
 * daemon's Send does, and only the socket moves: the delegating
 * transport ships the resolved frame to the serving daemon — the
 * workspace's server place by construction — over the tab's one wire
 * (`delegated-wire.ts`), the daemon's live frames feed the runner's
 * observer and the tab's own emitter re-broadcasts them under the
 * caller's send id. The cookie jar is the tab's (in memory, per
 * workspace, gone with the tab — the jar key never rides), so the jar
 * inspection trio answers here too. Scripts do not run in the tab
 * until the sandbox slice lands — the Settings tab's fact sheet says
 * so; the step runner is scriptless by construction.
 *
 * Result discipline is the daemon's: a run that fails before or on
 * the wire resolves `success: true` with an error SNAPSHOT (the
 * daemon's opt-in refusal rides the transport's classified failure
 * and lands there verbatim); `success: false` is reserved for missing
 * input and unexpected throws. A Stop hits the in-tab registry first;
 * a miss forwards up the wire for a forwarded gRPC invoke's exchange.
 */

import { GraphqlRequestSchema } from '@openheaders/core/schemas';
import type { ExecutedRequestSnapshot, GraphqlRequest, Request } from '@openheaders/core/types';
import { getRequest } from '@openheaders/oracle/entity/request-store';
import { compileGraphqlRequest } from '@openheaders/oracle/live/graphql-exec/execute';
import { cookieJarFor, peekCookieJar } from '@openheaders/oracle/live/request-exec/cookie-jar';
import { createDelegatingRequestTransport } from '@openheaders/oracle/live/request-exec/delegating-transport';
import { type ExecuteStreamOptions, errorSnapshot } from '@openheaders/oracle/live/request-exec/execute';
import { buildRefreshOAuthHook } from '@openheaders/oracle/live/request-exec/oauth-refresh';
import { runStepRequest } from '@openheaders/oracle/live/request-exec/run-step-request';
import { stopActiveSend } from '@openheaders/oracle/live/request-exec/send-stream';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import { peekActiveWorkspaceId } from '@openheaders/oracle/workspace/extension-workspace-store';
import { webDelegatedWire } from './delegated-wire';
import { broadcastLocal } from './web-broadcast';
import { callWireRpc } from './wire-rpc';

const TAB_CHANNELS = [
  'executeRequest',
  'executeGraphqlRequest',
  'abortRequestSend',
  'getCookieJarSummary',
  'clearCookieJar',
  'deleteCookieJarEntry',
] as const;

export function isTabRequestsChannel(type: unknown): type is (typeof TAB_CHANNELS)[number] {
  return typeof type === 'string' && (TAB_CHANNELS as readonly string[]).includes(type);
}

export interface ExecuteRequestRpcResult {
  success: boolean;
  snapshot?: ExecutedRequestSnapshot;
  error?: string;
}

/** The tab's live-frame sink — the in-tab fan-out `useLiveSendStream` reads. */
function emitStreamFrameLocally(event: unknown): void {
  broadcastLocal('requestStreamEvent', event);
}

/**
 * Dispatch one tab-answered request channel. Only call for channels
 * {@link isTabRequestsChannel} owns.
 */
export async function dispatchTabRequestsRpc(
  type: (typeof TAB_CHANNELS)[number],
  message: Record<string, unknown>,
): Promise<unknown> {
  switch (type) {
    case 'executeRequest':
      return handleExecuteRequestRpc(message);
    case 'executeGraphqlRequest':
      return handleExecuteGraphqlRequestRpc(message);
    case 'abortRequestSend':
      return handleAbortRequestSendRpc(message);
    case 'getCookieJarSummary':
      return { cookies: peekCookieJar(jarKeyOf(message))?.list() ?? [] };
    case 'clearCookieJar':
      peekCookieJar(jarKeyOf(message))?.clear();
      return { success: true };
    case 'deleteCookieJarEntry': {
      if (typeof message.name === 'string' && typeof message.domain === 'string' && typeof message.path === 'string') {
        peekCookieJar(jarKeyOf(message))?.delete(message.name, message.domain, message.path);
      }
      return { success: true };
    }
  }
}

/** The jar a channel means — the stated workspace, else the tab's
 *  active one (the key an unpinned send runs under). */
function jarKeyOf(message: Record<string, unknown>): string {
  return typeof message.workspaceId === 'string' ? message.workspaceId : (peekActiveWorkspaceId() ?? 'default');
}

export async function handleExecuteRequestRpc(message: Record<string, unknown>): Promise<ExecuteRequestRpcResult> {
  const requestUid = typeof message.requestUid === 'string' ? message.requestUid : undefined;
  const draft = message.draft as Request | undefined;
  let request: Request | undefined;
  if (requestUid) {
    const loaded = getRequest(requestUid);
    if (!loaded) return { success: true, snapshot: errorSnapshot(`Request ${requestUid} not found`) };
    request = loaded;
  } else {
    request = draft;
  }
  if (!request) return { success: false, error: 'No request or draft provided' };
  return runTabRequest(request, message);
}

export async function handleExecuteGraphqlRequestRpc(
  message: Record<string, unknown>,
): Promise<ExecuteRequestRpcResult> {
  const graphqlRequestUid = typeof message.graphqlRequestUid === 'string' ? message.graphqlRequestUid : undefined;
  const draft = message.draft as GraphqlRequest | undefined;
  const operationName = typeof message.operationName === 'string' ? message.operationName : undefined;
  try {
    let entity: GraphqlRequest | undefined;
    if (graphqlRequestUid) {
      const workspaceId = peekActiveWorkspaceId();
      if (workspaceId === null) return { success: true, snapshot: errorSnapshot('No active workspace') };
      const all = await hostStorage.getValidatedArray(wsKeys(workspaceId).graphqlRequests, GraphqlRequestSchema);
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
    return await runTabRequest(compiled, message);
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * The run leg: unpinned against the tab's Active-bound mirrors (the
 * active environment pointer rides them; an explicit `null` on the
 * frame is the caller's "No environment" and pins the active
 * workspace env-free, the daemon's rule), the delegating transport
 * toward the serving daemon with the tab's jar, the refresh hook, the
 * live frames under the caller's send id.
 */
async function runTabRequest(request: Request, message: Record<string, unknown>): Promise<ExecuteRequestRpcResult> {
  const activeWorkspaceId = peekActiveWorkspaceId();
  if (activeWorkspaceId === null) return { success: true, snapshot: errorSnapshot('No active workspace') };
  const sendId = typeof message.sendId === 'string' ? message.sendId : undefined;
  const stream: ExecuteStreamOptions | undefined =
    sendId !== undefined ? { sendId, emitFrame: emitStreamFrameLocally } : undefined;
  const environmentId =
    typeof message.environmentId === 'string' || message.environmentId === null ? message.environmentId : undefined;
  const workspaceId = environmentId === null ? activeWorkspaceId : null;
  const transport = createDelegatingRequestTransport({
    wire: webDelegatedWire,
    workspaceId: activeWorkspaceId,
    jars: cookieJarFor,
  });
  try {
    const refreshOAuth = buildRefreshOAuthHook(workspaceId ?? undefined, transport);
    const snapshot = await runStepRequest(request, {
      workspaceId,
      environmentId,
      transport,
      refreshOAuth,
      ...(stream !== undefined ? { stream } : {}),
    });
    return { success: true, snapshot };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/** Stop — the in-tab send by its caller-minted id first; a miss is a
 *  forwarded gRPC invoke whose exchange lives on the daemon. */
async function handleAbortRequestSendRpc(message: Record<string, unknown>): Promise<{ success: boolean }> {
  const sendId = typeof message.sendId === 'string' ? message.sendId : undefined;
  if (sendId === undefined) return { success: false };
  if (stopActiveSend(sendId)) return { success: true };
  try {
    const result = await callWireRpc({ type: 'abortRequestSend', sendId });
    return result && typeof result === 'object' && (result as { success?: unknown }).success === true
      ? { success: true }
      : { success: false };
  } catch {
    return { success: false };
  }
}
