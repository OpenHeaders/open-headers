/**
 * useWorkspaceServer — the `workspace-server` role's live state for the
 * active workspace: the workspace's Org binding names its providing
 * backend record (`getOrgBackendBindings`), the record reads as a
 * place by the place law (`backendPlace` — the desktop app's loopback
 * port from a browser host is the desktop app, never a server), and
 * the record's sync slot says whether the wire is up. The home Org
 * has no binding and no server; a bound Org whose record is gone has
 * none either. The backend id rides along for the send's explicit
 * target (never the default wire).
 */

import { getOrgBackendBindings, type IdentitySnapshot } from '@openheaders/core/identity';
import type { BackendConnection, BackendSyncStatusSnapshot } from '@openheaders/core/types';
import { backendPlace, useBackends } from '@openheaders/ui/shared/backend';
import { useWorkspaces } from '@openheaders/ui/shared/hooks/readers/useWorkspaces';
import { useBackendSyncStatus } from '@openheaders/ui/shared/hooks/useBackendSyncStatus';
import { useIdentitySnapshot } from '@openheaders/ui/shared/hooks/useIdentitySnapshot';
import { getCurrentHost, type Host } from '@openheaders/ui/shared/host-vocabulary';
import { useMemo } from 'react';

export interface WorkspaceServer {
  backendId: string;
  /** The place's name — null when the record is nameless. */
  name: string | null;
  connected: boolean;
}

/** Pure derivation — the hook's whole rule, pinned on its own. */
export function deriveWorkspaceServer(
  host: Host,
  orgId: string | null,
  snapshot: IdentitySnapshot | null,
  bindings: ReadonlyMap<string, string>,
  backends: readonly BackendConnection[],
  slots: BackendSyncStatusSnapshot,
): WorkspaceServer | null {
  if (orgId === null) return null;
  const backendId = bindings.get(orgId);
  if (backendId === undefined) return null;
  const record = backends.find((b) => b.id === backendId);
  if (record === undefined) return null;
  const orgName = snapshot?.orgs.get(orgId)?.name;
  const place = backendPlace(host, record, orgName !== undefined ? [orgName] : []);
  if (place.kind !== 'server') return null;
  return { backendId, name: place.name, connected: record.enabled && slots[backendId]?.state === 'green' };
}

export function useWorkspaceServer(): WorkspaceServer | null {
  const snapshot = useIdentitySnapshot();
  const backends = useBackends();
  const { snapshot: slots } = useBackendSyncStatus();
  const { activeWorkspace } = useWorkspaces();
  const orgId = activeWorkspace?.orgId ?? null;
  const host = getCurrentHost();
  return useMemo(
    () => deriveWorkspaceServer(host, orgId, snapshot, getOrgBackendBindings(), backends, slots),
    [host, orgId, snapshot, backends, slots],
  );
}
