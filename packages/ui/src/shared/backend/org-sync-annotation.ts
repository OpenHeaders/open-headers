/**
 * useOrgSyncAnnotations — per-Org sync provenance for workspace-picker
 * surfaces (the multi-backend plan §4, "via <backend>"): which backend
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
import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { useBackendSyncStatus } from '../hooks/useBackendSyncStatus';
import { useIdentitySnapshot } from '../hooks/useIdentitySnapshot';
import { useBackends } from './backend-registry';

/** Which provenance state the annotation words — render sites translate. */
export type OrgSyncAnnotationKind =
  | 'removed'
  | 'off'
  | 'connecting'
  | 'synced'
  | 'repair'
  | 'disconnected'
  | 'orphaned';

export interface OrgSyncAnnotation {
  /** `quiet` renders tertiary; `warning` renders in the warning tone. */
  tone: 'quiet' | 'warning';
  kind: OrgSyncAnnotationKind;
  /** Providing backend's display label (label, or URL fallback) — raw data. */
  backendLabel?: string;
}

const ANNOTATION_KEYS: Record<OrgSyncAnnotationKind, MessageKey> = {
  removed: 'shared.org.sync.removed',
  off: 'shared.org.sync.off',
  connecting: 'shared.org.sync.connecting',
  synced: 'shared.org.sync.synced',
  repair: 'shared.org.sync.repair',
  disconnected: 'shared.org.sync.disconnected',
  orphaned: 'shared.org.sync.orphaned',
};

/** Render-side wording for an annotation — the backend label rides raw. */
export function orgSyncAnnotationText(t: Translate, annotation: OrgSyncAnnotation): string {
  return t(ANNOTATION_KEYS[annotation.kind], { label: annotation.backendLabel ?? '' });
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
    return { tone: 'warning', kind: 'removed' };
  }
  const backendLabel = record.label.trim() || record.url;
  if (!record.enabled) return { tone: 'warning', kind: 'off', backendLabel };
  const slot = snapshot[backendId];
  if (!slot) return { tone: 'quiet', kind: 'connecting', backendLabel };
  if (slot.state === 'green') return { tone: 'quiet', kind: 'synced', backendLabel };
  if (slot.state === 'red') {
    const kind = slot.context?.reason === 'auth-required' ? 'repair' : 'disconnected';
    return { tone: 'warning', kind, backendLabel };
  }
  return { tone: 'quiet', kind: 'connecting', backendLabel };
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
  return { tone: 'warning', kind: 'orphaned' };
}
