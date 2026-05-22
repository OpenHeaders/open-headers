/**
 * Org-catalogue helpers — the pure projection from an {@link IdentitySnapshot}
 * to the set of Orgs a workspace can be bound to, and the human-facing
 * classification each Org carries (UNIFIED_ORACLE_MODEL.md §6.2 / §6.4).
 *
 * `Workspace.orgId` is a raw UUID; the workspace org-binding UI (the
 * "where does this live?" badge + sync-scope picker + two-personal-Orgs
 * onboarding) needs to resolve it to a label, a colour, and a scope
 * class. That resolution is a pure function of identity state — no mode
 * checks, no `isSynthetic` gating beyond the §6.2 classification table.
 *
 * The model is multi-org-native on every host (extension SW included):
 * `snapshot.orgs` is a set, every helper here is pure over it, and there
 * are no single-org code branches. V5 simply happens to seed one Org row
 * (the synthetic home-org) until a daemon-join flow adds real Orgs — at
 * which point every consumer lights up without a code change.
 */

import type { HostKind, Org } from '../types';
import type { IdentitySnapshot } from './resolver';

/**
 * The §6.2 sync-scope classification of an Org.
 *
 *   local    — the host's synthetic local-org. "Stuff I keep on this
 *              specific machine"; never crosses any wire.
 *   personal — a real single-user Org. "Stuff on my account, synced
 *              across my devices."
 *   team     — a real multi-user Org. Shared, ACL-governed.
 */
export type OrgScopeKind = 'local' | 'personal' | 'team';

/** Resolved, display-ready view of one Org from the catalogue. */
export interface OrgDescriptor {
  id: string;
  name: string;
  scopeKind: OrgScopeKind;
  /** The kind of host process that minted the Org — drives the identity label + icon. */
  hostKind: HostKind;
  isSynthetic: boolean;
  /** True for the user's home-org — the default binding for new workspaces. */
  isHome: boolean;
}

/**
 * Classify a single Org into its §6.2 scope kind, derived purely from
 * identity state — no static mode flag on the Org row:
 *
 *   - synthetic Org              → `local`  (the host-local org)
 *   - real Org, the user's home  → `personal` (synced across their devices)
 *   - real Org, not their home   → `team`   (shared with other members)
 */
function classifyOrg(org: Org, homeOrgId: string): OrgScopeKind {
  if (org.isSynthetic) return 'local';
  return org.id === homeOrgId ? 'personal' : 'team';
}

const SCOPE_ORDER: Record<OrgScopeKind, number> = { local: 0, personal: 1, team: 2 };

function toDescriptor(org: Org, homeOrgId: string): OrgDescriptor {
  return {
    id: org.id,
    name: org.name,
    scopeKind: classifyOrg(org, homeOrgId),
    hostKind: org.hostKind,
    isSynthetic: org.isSynthetic,
    isHome: org.id === homeOrgId,
  };
}

/**
 * The ordered list of Orgs this identity can bind a workspace to.
 * Sorted local → personal → team so the picker and badge legend read
 * in escalating-reach order.
 */
export function orgCatalogue(snapshot: IdentitySnapshot | null): OrgDescriptor[] {
  if (!snapshot) return [];
  const descriptors: OrgDescriptor[] = [];
  for (const org of snapshot.orgs.values()) {
    descriptors.push(toDescriptor(org, snapshot.user.homeOrgId));
  }
  descriptors.sort((a, b) => {
    const byScope = SCOPE_ORDER[a.scopeKind] - SCOPE_ORDER[b.scopeKind];
    return byScope !== 0 ? byScope : a.name.localeCompare(b.name);
  });
  return descriptors;
}

/**
 * Resolve a single `Workspace.orgId` to its descriptor. Returns `null`
 * for an org-id outside the authorized set — including the
 * `PRE_BOOTSTRAP_ORG_ID` sentinel carried by envelopes minted before
 * identity hydration. Callers render an "unknown / unsynced" fallback.
 */
export function describeOrg(snapshot: IdentitySnapshot | null, orgId: string): OrgDescriptor | null {
  if (!snapshot) return null;
  const org = snapshot.orgs.get(orgId);
  if (!org) return null;
  return toDescriptor(org, snapshot.user.homeOrgId);
}

/**
 * The identity label for an Org — its display name. The home Org and a
 * joined Org both read by their stored `name`; the user renames the home
 * Org through `renameHomeOrg`. Home-ness is conveyed separately by the
 * Org icon and the {@link orgHostKindHint} sub-label, never baked into
 * the name. `isSynthetic` plays no part — it records trust-by-process,
 * not whose Org it is.
 */
export function orgIdentityLabel(descriptor: OrgDescriptor): string {
  return descriptor.name;
}

/**
 * Second-person host-kind hint for the *home* Org — "This browser" /
 * "This computer" / "This server" — shown as a secondary sub-label
 * beneath {@link orgIdentityLabel} where space allows. `null` for a
 * joined Org: a backend the user joined isn't "this" anything.
 */
const HOST_KIND_HINT: Record<HostKind, string> = {
  browser: 'This browser',
  desktop: 'This computer',
  daemon: 'This server',
};

export function orgHostKindHint(descriptor: OrgDescriptor): string | null {
  return descriptor.isHome ? HOST_KIND_HINT[descriptor.hostKind] : null;
}

/**
 * Reach of a host kind — how far the workspaces bound to its Org travel.
 * A browser Org is single-profile; a desktop Org reaches one machine; a
 * daemon Org reaches a LAN/WAN server. Higher = wider reach.
 */
const HOST_KIND_REACH: Record<HostKind, number> = {
  browser: 0,
  desktop: 1,
  daemon: 2,
};

/**
 * The widest-reach Org the identity holds. Ties (two Orgs of the same
 * host kind) resolve to a joined Org over the home-org — the user
 * connected to it on purpose — then lexically for determinism.
 */
function highestReachOrgId(snapshot: IdentitySnapshot): string {
  let best: Org | null = null;
  for (const org of snapshot.orgs.values()) {
    if (!best) {
      best = org;
      continue;
    }
    const delta = HOST_KIND_REACH[org.hostKind] - HOST_KIND_REACH[best.hostKind];
    if (delta > 0) {
      best = org;
      continue;
    }
    if (delta < 0) continue;
    const bestIsHome = best.id === snapshot.user.homeOrgId;
    const orgIsHome = org.id === snapshot.user.homeOrgId;
    if (bestIsHome !== orgIsHome) {
      if (bestIsHome) best = org;
      continue;
    }
    if (org.id < best.id) best = org;
  }
  return best ? best.id : snapshot.user.homeOrgId;
}

/**
 * The Org id a newly-created workspace should bind to: the user's stored
 * default when it is still a member of the authorized catalogue,
 * otherwise the widest-reach Org. Connecting to a desktop / LAN / WAN
 * backend is a deliberate act — new workspaces follow the user up to the
 * highest-reach host rather than staying pinned to the local browser.
 * Returns `null` for a null snapshot so the caller can fall back to its
 * own sentinel.
 */
export function defaultNewWorkspaceOrgId(
  snapshot: IdentitySnapshot | null,
  storedDefault: string | null,
): string | null {
  if (!snapshot) return null;
  if (storedDefault && snapshot.orgs.has(storedDefault)) return storedDefault;
  return highestReachOrgId(snapshot);
}
