/**
 * useOrgPlace — the place resolver for every surface that heads or
 * lists Orgs (the workspace switcher, the Sync page's placement row,
 * Manage workspaces). Joins the Org → backend bindings (identity
 * snapshot) with the `OH.backends` registry so a joined Org's header
 * follows its record — a relabel or a re-addressed record shows through
 * without a reload — and reads the host's own bind tier for the home
 * Org's hint. Returns a resolver; the home Org needs no lookup.
 */

import { getOrgBackendBindings, type OrgDescriptor } from '@openheaders/core/identity';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useBackends } from '../backend';
import { backendPlace } from '../backend/backend-place';
import { useBackendReach } from '../hooks/useBackendReach';
import { useIdentitySnapshot } from '../hooks/useIdentitySnapshot';
import { getCurrentHost } from '../host-vocabulary';
import { orgPlaceText } from './org-copy';

export function useOrgPlace(): (descriptor: OrgDescriptor) => string {
  const t = useT();
  // Subscribes to identity re-installs — the bindings mirror updates
  // together with the snapshot, so the read below is never stale for
  // longer than one render.
  useIdentitySnapshot();
  const backends = useBackends();
  const { self: reach } = useBackendReach();
  const host = getCurrentHost();
  return (descriptor) => {
    if (descriptor.isHome) return orgPlaceText(t, descriptor, reach, null);
    const backendId = getOrgBackendBindings().get(descriptor.id);
    const record = backendId ? (backends.find((b) => b.id === backendId) ?? null) : null;
    return orgPlaceText(t, descriptor, reach, backendPlace(host, record, [descriptor.name]));
  };
}
