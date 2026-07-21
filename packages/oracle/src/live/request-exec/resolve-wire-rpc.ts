/**
 * `resolveRequestWire` route — resolve a persisted request or draft to
 * its concrete wire shape (templates substituted, auth folded, params
 * in the URL) WITHOUT dispatching it. Powers the workbench "Copy as
 * cURL / fetch" actions: the caller renders the returned shape with the
 * pure formatters in `@openheaders/core/snippet`.
 *
 * Host-neutral — the extension SW and the node spine answer the same
 * bridge channel through this one handler, over the same
 * {@link resolveRequest} every Send rides, so the copied command carries
 * exactly what a Send would put on the wire. Node hosts inject their
 * OAuth refresh hook via `makeRefreshOAuth` so an expired bundle
 * refreshes before attaching, exactly like their Send path; the
 * extension answers hookless and the last-synced bundle attaches as-is.
 *
 * Workspace / environment pinning mirrors `execute-request-rpc`: a
 * frame stamped with a foreign workspace resolves pinned against it,
 * and an explicit `environmentId: null` forces the pinned env-free
 * dispatch even for the active workspace.
 */

import type { WireSnippetRequest } from '@openheaders/core/snippet';
import type { Request } from '@openheaders/core/types';
import { getRequest } from '../../entity/request-store';
import { getActiveWorkspaceId } from '../../workspace/extension-workspace-store';
import { type OAuthRefreshFn, resolveRequest } from './resolve-request';

export interface ResolveRequestWireRpcResult {
  success: boolean;
  wire?: WireSnippetRequest;
  error?: string;
}

export async function handleResolveRequestWireRpc(
  message: Record<string, unknown>,
  makeRefreshOAuth?: (workspaceId: string | undefined) => OAuthRefreshFn | undefined,
): Promise<ResolveRequestWireRpcResult> {
  const requestUid = typeof message.requestUid === 'string' ? message.requestUid : undefined;
  const draft = message.draft as Request | undefined;
  const environmentId =
    typeof message.environmentId === 'string' || message.environmentId === null ? message.environmentId : undefined;
  const requestedWorkspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : undefined;
  const workspaceId =
    requestedWorkspaceId !== undefined && requestedWorkspaceId !== getActiveWorkspaceId()
      ? requestedWorkspaceId
      : environmentId === null
        ? getActiveWorkspaceId()
        : null;

  let request: Request | undefined;
  if (requestUid) {
    const loaded = getRequest(requestUid);
    if (!loaded) return { success: false, error: `Request ${requestUid} not found` };
    request = loaded;
  } else {
    request = draft;
  }
  if (!request) return { success: false, error: 'No request or draft provided' };

  try {
    const refreshOAuth = makeRefreshOAuth?.(workspaceId ?? undefined);
    const { resolved } = await resolveRequest(request, {
      ...(workspaceId !== null ? { workspaceId } : {}),
      ...(environmentId !== undefined ? { environmentId } : {}),
      ...(refreshOAuth ? { refreshOAuth } : {}),
    });
    return {
      success: true,
      wire: {
        method: resolved.method,
        url: resolved.url,
        headers: resolved.headers.map((h) => ({ key: h.key, value: h.value })),
        body: resolved.body,
        ...(resolved.awsSigV4 ? { awsSigV4: resolved.awsSigV4 } : {}),
        ...(resolved.digest ? { digest: resolved.digest } : {}),
      },
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
