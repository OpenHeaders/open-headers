/**
 * Publish targets — the joined Orgs a workspace can be published into
 * (PUBLISH_TARGET_PICKER.md). Publish is Duplicate-into pointed at a
 * joined Org: targets are Orgs, not backends, labeled with the same
 * "via <backend>" provenance the workspace dropdown uses. The home Org
 * is never a target (it has no binding — publishing to yourself is
 * Duplicate), and an unhealthy target stays visible but unselectable:
 * Publish promises arrival, and a disabled / disconnected / re-pairing
 * backend can't currently receive. A connecting backend stays
 * selectable — the wire is coming up and sync delivers once green.
 */

import { getOrgBackendBindings, type IdentitySnapshot } from '@openheaders/core/identity';
import type { BackendConnection, BackendSyncStatusSnapshot } from '@openheaders/core/types';
import { useBackendSyncStatus } from '../hooks/useBackendSyncStatus';
import { useIdentitySnapshot } from '../hooks/useIdentitySnapshot';
import { useBackends } from './backend-registry';
import { deriveOrgSyncAnnotation, type OrgSyncAnnotation } from './org-sync-annotation';

export interface PublishTarget {
  orgId: string;
  orgName: string;
  /** False when the providing backend can't currently receive — the picker lists it disabled. */
  healthy: boolean;
  /** The "via <backend>" provenance wording, warning-toned when unhealthy. */
  annotation: OrgSyncAnnotation;
}

/**
 * Pure derivation: every joined Org as a publish target, sorted by name.
 * One entry per binding — the home Org never appears (it carries no
 * binding), and health folds out of the annotation ladder: warning tone
 * (off / disconnected / re-pair needed / record removed) means the
 * target can't currently receive.
 */
export function derivePublishTargets(
  snapshot: IdentitySnapshot | null,
  bindings: ReadonlyMap<string, string>,
  backends: readonly BackendConnection[],
  slots: BackendSyncStatusSnapshot,
): PublishTarget[] {
  if (!snapshot) return [];
  const targets: PublishTarget[] = [];
  for (const orgId of bindings.keys()) {
    const org = snapshot.orgs.get(orgId);
    if (!org) continue;
    const annotation = deriveOrgSyncAnnotation(orgId, bindings, backends, slots);
    if (!annotation) continue;
    targets.push({
      orgId,
      orgName: org.name,
      healthy: annotation.tone === 'quiet',
      annotation,
    });
  }
  targets.sort((a, b) => a.orgName.localeCompare(b.orgName) || a.orgId.localeCompare(b.orgId));
  return targets;
}

export function usePublishTargets(): PublishTarget[] {
  const snapshot = useIdentitySnapshot();
  const backends = useBackends();
  const { snapshot: slots } = useBackendSyncStatus();
  return derivePublishTargets(snapshot, getOrgBackendBindings(), backends, slots);
}
