/**
 * Org-choice policy for new workspaces (the server access plan A5, as
 * gated S12): on the JOINED web host every Org-choice surface offers
 * server Orgs only, and a stored preference naming the browser Org is
 * IGNORED, not deleted — the served tab is a replica, and a home-Org
 * workspace there is an island that structurally can never sync. The
 * extension and desktop keep the full catalogue (there the local host
 * IS the product), and the never-joined web host (the A8 offline
 * mount) holds only its local Org, so both fall through unchanged.
 *
 * On the web host a non-home Org can only be the serving daemon's —
 * the tab has exactly one wire and joins no other backend — so
 * "server Org" and "non-home Org" coincide by construction.
 */

import { defaultNewWorkspaceOrgId, type IdentitySnapshot, type OrgDescriptor } from '@openheaders/core/identity';
import { getCurrentHost } from '../host-vocabulary';

/**
 * The Orgs an Org-choice surface may offer: the full catalogue on
 * every host but the joined web tab, server Orgs only there.
 */
export function orgChoiceCatalogue(catalogue: OrgDescriptor[]): OrgDescriptor[] {
  if (getCurrentHost() !== 'web') return catalogue;
  const serverOrgs = catalogue.filter((descriptor) => !descriptor.isHome);
  return serverOrgs.length > 0 ? serverOrgs : catalogue;
}

/**
 * The Org id a new workspace binds to — `defaultNewWorkspaceOrgId`
 * with the clamp applied: on the joined web host a stored preference
 * naming the home Org is ignored, so the resolution falls through to
 * the widest-reach Org (the server).
 */
export function resolveNewWorkspaceOrgId(
  snapshot: IdentitySnapshot | null,
  storedDefault: string | null,
): string | null {
  const ignoreStored =
    getCurrentHost() === 'web' &&
    snapshot !== null &&
    storedDefault === snapshot.user.homeOrgId &&
    [...snapshot.orgs.keys()].some((orgId) => orgId !== snapshot.user.homeOrgId);
  return defaultNewWorkspaceOrgId(snapshot, ignoreStored ? null : storedDefault);
}
