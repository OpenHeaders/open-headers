/**
 * Org → workspace resolution (Phase U5.9, the org switcher).
 *
 * Org is the top-level container; each Org holds 1…n workspaces. When
 * the user switches the active Org, the runtime needs one workspace in
 * that Org to make globally active. `resolveOrgActiveWorkspace` is the
 * pure fallback chain that picks it:
 *
 *   1. the Org's remembered active workspace (`OH.orgActiveWorkspace`)
 *   2. the Org's default workspace (`OH.preferencesDefaultWorkspace`)
 *   3. the Org's first workspace in sort order
 *   4. `null` — the Org holds no workspaces (e.g. a freshly joined
 *      backend whose workspaces haven't synced down yet)
 *
 * Every candidate is validated to still be a live member of the Org, so
 * a stale `orgId → workspaceId` entry degrades cleanly to the next link.
 */

import type { ExtensionWorkspace } from '../types';

function compareWorkspaces(a: ExtensionWorkspace, b: ExtensionWorkspace): number {
  if (a.sortIndex !== b.sortIndex) return a.sortIndex - b.sortIndex;
  return a.createdAt.localeCompare(b.createdAt);
}

/**
 * The workspace an Org-switch should land on. `remembered` and
 * `defaults` are the `orgId → workspaceId` maps from
 * `OH.orgActiveWorkspace` / `OH.preferencesDefaultWorkspace`.
 */
export function resolveOrgActiveWorkspace(
  orgId: string,
  workspaces: readonly ExtensionWorkspace[],
  remembered: Readonly<Record<string, string>>,
  defaults: Readonly<Record<string, string>>,
): string | null {
  const inOrg = workspaces.filter((w) => w.orgId === orgId);
  if (inOrg.length === 0) return null;
  const livesInOrg = (id: string | undefined): id is string => !!id && inOrg.some((w) => w.id === id);
  if (livesInOrg(remembered[orgId])) return remembered[orgId];
  if (livesInOrg(defaults[orgId])) return defaults[orgId];
  return [...inOrg].sort(compareWorkspaces)[0].id;
}
