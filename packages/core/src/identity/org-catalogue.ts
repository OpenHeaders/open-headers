/**
 * Org-catalogue helpers — the pure projection from an {@link IdentitySnapshot}
 * to the set of Orgs a workspace can be bound to, and the human-facing
 * classification each Org carries (UNIFIED_ORACLE_MODEL.md §6.2 / §6.4).
 *
 * `Workspace.orgId` is a raw UUID; the workspace org-binding UI (the
 * "where does this live?" badge + sync-scope picker + two-personal-Orgs
 * onboarding) needs to resolve it to a label, a colour, and a scope
 * class. That resolution is a pure function of identity state — no mode
 * checks, just the §6.2 classification table over (`hostKind`,
 * `isHome`, `isPrivate`).
 *
 * The model is multi-org-native on every host (extension SW included):
 * `snapshot.orgs` is a set, every helper here is pure over it, and there
 * are no single-org code branches. V5 simply happens to seed one Org row
 * (the private home Org) until a daemon-join flow adds more Orgs — at
 * which point every consumer lights up without a code change.
 */

import type { BackendReach } from '../protocol';
import type { HostKind, Org } from '../types';
import type { IdentitySnapshot } from './resolver';

/**
 * The §6.2 sync-scope classification of an Org.
 *
 *   local    — the host's private home Org. "Stuff I keep on this
 *              specific device"; never crosses any wire.
 *   personal — a single-user Org backed by a host (the user's own
 *              desktop / personal daemon). "Stuff on my devices,
 *              synced between them."
 *   team     — a multi-user daemon Org. Shared, ACL-governed.
 */
export type OrgScopeKind = 'local' | 'personal' | 'team';

/** Resolved, display-ready view of one Org from the catalogue. */
export interface OrgDescriptor {
  id: string;
  name: string;
  scopeKind: OrgScopeKind;
  /** The kind of host process that minted the Org — drives the identity label + icon. */
  hostKind: HostKind;
  /** True iff the Org has no backend hosting it (stays on this device). */
  isPrivate: boolean;
  /** True for the user's home-org — the default binding for new workspaces. */
  isHome: boolean;
}

/**
 * Classify a single Org into its §6.2 scope kind from `(hostKind, isHome,
 * isPrivate)`:
 *
 *   - home Org with `isPrivate: true` → `local`
 *     (no backend hosts it, stays on this device)
 *   - any Org with `hostKind === 'daemon'` → `team`
 *     (a daemon is multi-user by definition — §5.6 / Session-44 design)
 *   - everything else → `personal`
 *     (a single-user host: the user's own browser / desktop seen from
 *     here or from a joined peer of theirs)
 *
 * The `(isPrivate, !isHome)` cell is structurally unreachable —
 * `recordJoinedOrg` stamps `isPrivate: false` on every joined Org at the
 * receiver boundary, because anything that crossed a wire is no longer
 * "stays on this device" by definition. The classifier doesn't carry a
 * defensive case for it; if one shows up, that's a registry-boundary
 * bug, not a classifier concern.
 */
function classifyOrg(org: Org, homeOrgId: string): OrgScopeKind {
  const isHome = org.id === homeOrgId;
  if (isHome && org.isPrivate) return 'local';
  if (org.hostKind === 'daemon') return 'team';
  return 'personal';
}

const SCOPE_ORDER: Record<OrgScopeKind, number> = { local: 0, personal: 1, team: 2 };

function toDescriptor(org: Org, homeOrgId: string): OrgDescriptor {
  return {
    id: org.id,
    name: org.name,
    scopeKind: classifyOrg(org, homeOrgId),
    hostKind: org.hostKind,
    isPrivate: org.isPrivate,
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
 * the name. `isPrivate` plays no part in the label — it records
 * whether a backend hosts the Org, not whose Org it is.
 */
export function orgIdentityLabel(descriptor: OrgDescriptor): string {
  return descriptor.name;
}

/**
 * Second-person host-kind hint for the *home* Org — "This browser" /
 * "This device" / "Local server" / "Remote server" — shown as a
 * secondary sub-label beneath {@link orgIdentityLabel} where space
 * allows. `null` for a joined Org: a backend the user joined isn't
 * "this" anything.
 *
 * Daemon hosts disambiguate by `reach` ({@link BackendReach}):
 * `wan` → "Remote server" (a public deployment), anything else →
 * "Local server" (loopback / LAN bind). The two non-daemon kinds
 * ignore `reach`; they read the same regardless of binding.
 */
const HOST_KIND_HINT: Record<Exclude<HostKind, 'daemon'>, string> = {
  browser: 'This browser',
  desktop: 'This device',
};

export function orgHostKindHint(descriptor: OrgDescriptor, reach?: BackendReach | null): string | null {
  if (!descriptor.isHome) return null;
  if (descriptor.hostKind === 'daemon') {
    return reach === 'wan' ? 'Remote server' : 'Local server';
  }
  return HOST_KIND_HINT[descriptor.hostKind];
}

/**
 * Full single-line label combining {@link orgHostKindHint} with the Org's
 * stored name — `"This browser: Chrome"`, `"This device: my-mac"`. Used
 * by surfaces (workspace dropdown, workspace manager) where there is room
 * to spell out which machine the home Org represents, instead of just
 * the rename-able name. Joined Orgs (no hint) fall through to the name.
 */
export function orgFullLabel(descriptor: OrgDescriptor, reach?: BackendReach | null): string {
  const hint = orgHostKindHint(descriptor, reach);
  return hint ? `${hint}: ${descriptor.name}` : descriptor.name;
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
