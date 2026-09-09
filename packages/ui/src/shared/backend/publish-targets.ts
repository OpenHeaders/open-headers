/**
 * Publish targets — the joined Orgs a workspace can be copied into
 * (the publish-target picker design; "Copy to <place>" to the user —
 * the Backup and Sync UX plan §5.5). Publish is Duplicate-into pointed
 * at a joined Org: targets are Orgs, not backends, each read as the
 * place its providing record is (`useOrgPlace`, the switcher's
 * headers). The home Org is never a target (it has no binding —
 * publishing to yourself is Duplicate), and an unhealthy target stays
 * visible but unselectable: the copy promises arrival, and a disabled /
 * disconnected / re-pairing backend can't currently receive. A
 * connecting backend stays selectable — the wire is coming up and sync
 * delivers once green.
 */

import {
  getOrgBackendBindings,
  type IdentitySnapshot,
  type OrgDescriptor,
  orgCatalogue,
} from '@openheaders/core/identity';
import type { BackendConnection, BackendSyncStatusSnapshot } from '@openheaders/core/types';
import { useBackendSyncStatus } from '../hooks/useBackendSyncStatus';
import { useIdentitySnapshot } from '../hooks/useIdentitySnapshot';
import { useOrgPlace } from '../workspace-org/use-org-place';
import { useBackends } from './backend-registry';
import { deriveOrgSyncAnnotation, type OrgSyncAnnotation } from './org-sync-annotation';

export interface PublishTarget {
  orgId: string;
  orgName: string;
  /** The place the target reads as — "<label> · server", "This computer · desktop app". */
  place: string;
  /** False when the providing backend can't currently receive — the picker lists it disabled. */
  healthy: boolean;
  /** The provenance annotation; its warning kinds read beside the place through `orgStateText`. */
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
  placeOf: (descriptor: OrgDescriptor) => string,
): PublishTarget[] {
  if (!snapshot) return [];
  const descriptors = new Map(orgCatalogue(snapshot).map((descriptor) => [descriptor.id, descriptor]));
  const targets: PublishTarget[] = [];
  for (const orgId of bindings.keys()) {
    const org = snapshot.orgs.get(orgId);
    if (!org) continue;
    const annotation = deriveOrgSyncAnnotation(orgId, bindings, backends, slots);
    if (!annotation) continue;
    const descriptor = descriptors.get(orgId);
    targets.push({
      orgId,
      orgName: org.name,
      place: descriptor ? placeOf(descriptor) : org.name,
      healthy: annotation.tone === 'quiet',
      annotation,
    });
  }
  targets.sort((a, b) => a.place.localeCompare(b.place) || a.orgId.localeCompare(b.orgId));
  return targets;
}

export function usePublishTargets(): PublishTarget[] {
  const snapshot = useIdentitySnapshot();
  const backends = useBackends();
  const { snapshot: slots } = useBackendSyncStatus();
  const placeOf = useOrgPlace();
  return derivePublishTargets(snapshot, getOrgBackendBindings(), backends, slots, placeOf);
}
