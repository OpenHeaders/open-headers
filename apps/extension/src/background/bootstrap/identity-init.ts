import {
  ensureSyntheticIdentity,
  ensureWorkspaceRoleAssignments,
  getIdentitySnapshot,
  refreshIdentitySnapshotFromHostStorage,
  setAuditSink,
} from '@openheaders/core/identity';
import { getHostStorage, OH } from '@openheaders/core/storage';
import { EXTENSION_WORKSPACE_GLOBAL_SCOPE, setWorkspaceOrgResolver } from '@openheaders/core/sync';
import { IdbAuditLog } from '@openheaders/oracle-host-browser/sync/idb-audit-log';
import { isChrome, isEdge, isFirefox, isSafari } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { getWorkspace, listWorkspaces } from '../modules/workspace-store';

function browserDisplayName(): string {
  if (isFirefox) return 'Firefox';
  if (isChrome) return 'Chrome';
  if (isEdge) return 'Edge';
  if (isSafari) return 'Safari';
  return 'Browser';
}

export async function bootstrapIdentity(): Promise<void> {
  await ensureSyntheticIdentity({ hostKind: 'browser', orgName: browserDisplayName() }).catch((err: unknown) => {
    logger.warn('Background', 'ensureSyntheticIdentity failed', err);
  });
  await ensureWorkspaceRoleAssignments(listWorkspaces().map((w) => w.id)).catch((err: unknown) => {
    logger.warn('Background', 'ensureWorkspaceRoleAssignments failed', err);
  });
  await refreshIdentitySnapshotFromHostStorage().catch((err: unknown) => {
    logger.warn('Background', 'refreshIdentitySnapshotFromHostStorage failed', err);
  });

  getHostStorage()?.subscribe(OH.syntheticIdentity, () => {
    void refreshIdentitySnapshotFromHostStorage().catch((err: unknown) => {
      logger.warn('Background', 'identity snapshot refresh after rename failed', err);
    });
  });

  setWorkspaceOrgResolver((workspaceId) => {
    const snapshot = getIdentitySnapshot();
    if (workspaceId === EXTENSION_WORKSPACE_GLOBAL_SCOPE) {
      return snapshot?.user.homeOrgId;
    }
    return getWorkspace(workspaceId)?.orgId ?? snapshot?.user.homeOrgId;
  });

  const auditLog = new IdbAuditLog();
  setAuditSink((entry) => {
    void auditLog
      .append({
        orgId: entry.orgId,
        actorUserId: entry.actorUserId,
        capability: entry.capability,
        ...(entry.workspaceId ? { workspaceId: entry.workspaceId } : {}),
        decision: entry.decision,
        occurredAt: entry.occurredAt,
      })
      .catch((err: unknown) => {
        logger.warn('Background', 'audit log append failed', err);
      });
  });
}
