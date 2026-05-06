/**
 * useRequests — context reader over `RequestsContext`.
 *
 * Per MWPT-FULL § 4.1 (Session #7): the bundled requests + request-
 * collections + request-folders state is owned by `RequestsProvider`,
 * which mounts with `activeWorkspaceIdOverride={editingScopeWorkspaceId}`
 * on workbench surfaces (override branch reads workspace-scoped data via
 * `wsKeys(workspaceId).requests` etc. + writes through Phase B) and
 * without override on system surfaces (popup / sidepanel / panel — legacy
 * RPC + broadcast path against the SW's runtime-Active workspace).
 *
 * Existing call sites consume the same API surface they did before the
 * Provider migration; the override branch is determined entirely by the
 * Provider mount.
 */

import { type RequestsContextValue, type RequestWriteResult, useRequestsContext } from '@context/RequestsContext';

export type { RequestWriteResult };

export type UseRequestsApi = RequestsContextValue;

export function useRequests(): UseRequestsApi {
  return useRequestsContext();
}
