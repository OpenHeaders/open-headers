/**
 * Active-org accessor — the persisted "which Org am I working in?"
 * pointer (Phase U5.9, the org switcher).
 *
 * Orthogonal to the active-workspace pointer (`OH.runtimeActive`): the
 * active Org scopes which workspaces the switcher lists, the active
 * workspace is the one whose rules apply. A consume-only join (U5)
 * adopts the backend by writing this slot to the joined Org.
 *
 * Host-neutral — reads + writes go through the `HostStorage` proxy, so
 * the extension SW, desktop main, and the renderer surfaces all share
 * one accessor. The pure home-org fallback lives in `resolveActiveOrgId`
 * (org-catalogue) — this module only owns persistence.
 */

import { hostStorage } from '../storage/host-storage';
import { OH } from '../storage/keys';

/** Read the persisted active-Org id. `null` when the slot is unset. */
export async function getActiveOrgId(): Promise<string | null> {
  return (await hostStorage.get(OH.activeOrgId)) ?? null;
}

/** Persist the active-Org id. */
export async function setActiveOrgId(orgId: string): Promise<void> {
  await hostStorage.set(OH.activeOrgId, orgId);
}
