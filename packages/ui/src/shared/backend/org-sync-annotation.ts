/**
 * useOrgSyncAnnotations — per-Org sync provenance for workspace-picker
 * surfaces (MULTI_BACKEND_PLAN.md §4, "via <backend>"): which backend
 * provides an Org, and whether it is currently syncing. Joins the Org →
 * backend bindings (identity snapshot), the `OH.backends` registry, and
 * the per-backend sync slot feed, so every workbench tab / popup sees a
 * disable, outage, or re-pair on the Org group itself — not only on the
 * Settings row.
 *
 * Returns a resolver: `null` for an unbound Org (the home Org — nothing
 * to say), an annotation for a bound one. `orphaned` marks a workspace
 * group whose Org left the snapshot entirely (its backend record was
 * removed with local copies kept).
 */

import { getOrgBackendBindings, isPinnedBackendId } from '@openheaders/core/identity';
import type { BackendConnection, BackendSyncStatusSnapshot } from '@openheaders/core/types';
import { useBackendSyncStatus } from '../hooks/useBackendSyncStatus';
import { useIdentitySnapshot } from '../hooks/useIdentitySnapshot';
import { useBackends } from './backend-registry';

export interface OrgSyncAnnotation {
  /** `quiet` renders tertiary; `warning` renders in the warning tone. */
  tone: 'quiet' | 'warning';
  text: string;
}

/**
 * Pure derivation: one Org's annotation from the bindings map, the
 * registry list, and the per-backend slot snapshot.
 */
export function deriveOrgSyncAnnotation(
  orgId: string,
  bindings: ReadonlyMap<string, string>,
  backends: readonly BackendConnection[],
  snapshot: BackendSyncStatusSnapshot,
  isPinnedBackend: (backendId: string) => boolean = () => false,
): OrgSyncAnnotation | null {
  const backendId = bindings.get(orgId);
  if (!backendId) return null;
  const record = backends.find((b) => b.id === backendId);
  if (!record) {
    // A pinned backend (the web host's serving daemon) is present by
    // construction and carries no `OH.backends` record on purpose — its
    // sync rides the wire, so it is NOT a removed backend. Nothing to
    // annotate, exactly like the home Org.
    if (isPinnedBackend(backendId)) return null;
    return { tone: 'warning', text: 'no longer syncing' };
  }
  const label = record.label.trim() || record.url;
  if (!record.enabled) return { tone: 'warning', text: `via ${label} — off, not syncing` };
  const slot = snapshot[backendId];
  if (!slot) return { tone: 'quiet', text: `via ${label} — connecting…` };
  if (slot.state === 'green') return { tone: 'quiet', text: `via ${label}` };
  if (slot.state === 'red') {
    const text =
      slot.context?.reason === 'auth-required' ? `via ${label} — re-pair needed` : `via ${label} — disconnected`;
    return { tone: 'warning', text };
  }
  return { tone: 'quiet', text: `via ${label} — connecting…` };
}

export function useOrgSyncAnnotations(): (orgId: string) => OrgSyncAnnotation | null {
  // Subscribes this component to identity re-installs — the bindings
  // mirror updates together with the snapshot, so the fresh read below
  // is never stale for longer than one render.
  useIdentitySnapshot();
  const backends = useBackends();
  const { snapshot } = useBackendSyncStatus();
  const bindings = getOrgBackendBindings();

  return (orgId: string) => deriveOrgSyncAnnotation(orgId, bindings, backends, snapshot, isPinnedBackendId);
}

/** Annotation for a workspace group whose Org left the identity snapshot. */
export function orphanedOrgAnnotation(): OrgSyncAnnotation {
  return { tone: 'warning', text: 'back-end removed — local copies' };
}
