/**
 * In-memory mirror of the persisted identity rows (`OH.syntheticIdentity`
 * + `OH.workspaceRoleAssignments`). The resolver reads from here
 * synchronously; the host's boot path keeps it warm by calling
 * `refreshIdentitySnapshotFromHostStorage` after each
 * `ensureSyntheticIdentity` / `ensureWorkspaceRoleAssignments` cycle.
 *
 * Lives in core (not oracle) so the UI can consult the same snapshot for
 * button-gating without depending on the engine package.
 */

import { hostStorage } from '../storage/host-storage';
import { OH } from '../storage/keys';
import type { Org, SyntheticIdentityRecord, WorkspaceRoleAssignment } from '../types';
import { createMutex } from '../utils/mutex';
import type { IdentitySnapshot } from './resolver';

let current: IdentitySnapshot | null = null;

export interface InstallIdentitySnapshotInput {
  record: SyntheticIdentityRecord;
  wras: ReadonlyArray<WorkspaceRoleAssignment>;
  /**
   * Orgs this host joined by connecting to other backends (Phase U5.2 —
   * "consume-first join"). Folded into `IdentitySnapshot.orgs` alongside
   * the synthetic home-org so `authorizedOrgIds` lets the joined
   * backend's workspaces sync down. Persisted under `OH.joinedOrgs`.
   */
  joinedOrgs?: ReadonlyArray<Org>;
}

/** Replace the in-memory snapshot. Called by the host after each ensure-*. */
export function installIdentitySnapshot(input: InstallIdentitySnapshotInput): IdentitySnapshot {
  const wraByWorkspaceId = new Map<string, WorkspaceRoleAssignment>();
  for (const wra of input.wras) {
    wraByWorkspaceId.set(wra.workspaceId, wra);
  }
  // Multi-org-native: `orgs` is a set on every host. The synthetic
  // home-org seeds it; Orgs joined via `recordJoinedOrg` fold in with no
  // change to the resolver or the org-catalogue helpers downstream. The
  // home-org row is written last so it always wins a same-id collision.
  const orgs = new Map<string, Org>();
  for (const org of input.joinedOrgs ?? []) {
    orgs.set(org.id, org);
  }
  orgs.set(input.record.org.id, input.record.org);
  current = {
    user: input.record.user,
    principal: input.record.principal,
    membership: input.record.membership,
    localAdmin: input.record.localAdmin,
    wraByWorkspaceId,
    orgs,
  };
  return current;
}

/** Read the current in-memory snapshot. Returns `null` before first install. */
export function getIdentitySnapshot(): IdentitySnapshot | null {
  return current;
}

/** Drop the in-memory snapshot. Test-only. */
export function clearIdentitySnapshot(): void {
  current = null;
}

/**
 * Serializes `refreshIdentitySnapshotFromHostStorage`. The refresh is a
 * three-`get`-then-`installIdentitySnapshot` sequence with no atomicity,
 * and all three snapshot writers — boot, the WRA reconcile, and
 * `recordJoinedOrg` — funnel into it. Two concurrent refreshes can
 * interleave: a refresh that read `OH.joinedOrgs` *before* a join write
 * landed can `installIdentitySnapshot` *after* the refresh that read it
 * correctly, reverting the in-memory snapshot to drop the joined Org —
 * `authorizedOrgIds` then loses that Org and the joined backend's
 * envelopes are filtered out. The mutex makes each refresh read-then-
 * install atomically, so the last refresh (always queued after its
 * writer's store write) installs the converged storage state.
 */
const refreshLock = createMutex();

/**
 * Refresh from `HostStorage` — useful when the snapshot is consumed in a
 * context that hasn't seen a boot-time install (e.g. a worker that
 * survives across SW restarts). Returns the resulting snapshot.
 */
export function refreshIdentitySnapshotFromHostStorage(): Promise<IdentitySnapshot | null> {
  return refreshLock(async () => {
    const record = await hostStorage.get(OH.syntheticIdentity);
    if (!record) {
      current = null;
      return null;
    }
    const wras = (await hostStorage.get(OH.workspaceRoleAssignments)) ?? [];
    const joinedOrgs = (await hostStorage.get(OH.joinedOrgs)) ?? [];
    return installIdentitySnapshot({ record, wras, joinedOrgs });
  });
}

/**
 * Serializes `OH.joinedOrgs` read-modify-write cycles. The slot is a
 * non-atomic `get`-then-`set`; two `recordJoinedOrg` calls racing the
 * same empty slot would each append over an independent read and the
 * last write would drop the other join.
 */
const withJoinedOrgsLock = createMutex();

/**
 * Record an Org joined by connecting to another backend (Phase U5.2).
 * Appends `org` to the persisted `OH.joinedOrgs` set (deduplicated by
 * id; the synthetic home-org is never stored here — it already rides
 * `OH.syntheticIdentity`), then rebuilds the in-memory snapshot so the
 * resolver's `authorizedOrgIds` immediately includes it and the joined
 * backend's workspaces sync down.
 *
 * Idempotent: re-joining the same backend (every reconnect re-sends
 * WELCOME) is a no-op once the Org is already on file. The `OH.joinedOrgs`
 * read-modify-write is serialized through {@link withJoinedOrgsLock} so
 * concurrent joins of distinct Orgs can't clobber each other.
 */
export async function recordJoinedOrg(org: Org): Promise<IdentitySnapshot | null> {
  const record = await hostStorage.get(OH.syntheticIdentity);
  if (record && record.org.id === org.id) {
    // The joiner's own home-org — nothing to record. Reached only if a
    // host somehow handshakes against itself; harmless to ignore.
    return refreshIdentitySnapshotFromHostStorage();
  }
  await withJoinedOrgsLock(async () => {
    const existing = (await hostStorage.get(OH.joinedOrgs)) ?? [];
    const known = existing.find((o) => o.id === org.id);
    if (!known) {
      await hostStorage.set(OH.joinedOrgs, [...existing, org]);
    } else if (known.name !== org.name || known.isSynthetic !== org.isSynthetic) {
      // The backend renamed its Org since the last join — keep the
      // freshest copy so the org-catalogue UI doesn't render a stale name.
      await hostStorage.set(
        OH.joinedOrgs,
        existing.map((o) => (o.id === org.id ? org : o)),
      );
    }
  });
  return refreshIdentitySnapshotFromHostStorage();
}

/** Longest accepted home-Org name; the rename UI caps its input to match. */
export const MAX_ORG_NAME_LENGTH = 60;

/** Outcome of {@link renameHomeOrg} — distinguishes the two failure modes from success. */
export type RenameHomeOrgResult = { ok: true } | { ok: false; reason: 'empty-name' | 'no-identity' };

/**
 * Serializes `OH.syntheticIdentity` rename writes. The slot is a
 * non-atomic `get`-then-`set`; the only other writer (`ensureSyntheticIdentity`)
 * runs once at boot before any rename is reachable, but the lock keeps
 * two racing renames from clobbering each other.
 */
const withHomeOrgLock = createMutex();

/**
 * Rename this host's own (home) Org. Edits `Org.name` inside the
 * persisted `OH.syntheticIdentity` blob — the home Org rides that record,
 * not `OH.joinedOrgs` — then refreshes the in-memory snapshot so the
 * resolver and the org-catalogue UI pick up the new name.
 *
 * Local-only: the extension is always a sync *client*, so no peer ever
 * joins its home Org and there is nothing to re-broadcast (a backend's
 * own rename re-propagates via the `recordJoinedOrg` rename-in-place
 * branch on the next reconnect's WELCOME).
 *
 * The trimmed name is capped to {@link MAX_ORG_NAME_LENGTH}; an
 * all-whitespace name is rejected rather than persisted. A no-op rename
 * (same name) still reports `ok` without a write.
 */
export function renameHomeOrg(name: string): Promise<RenameHomeOrgResult> {
  return withHomeOrgLock(async () => {
    const trimmed = name.trim().slice(0, MAX_ORG_NAME_LENGTH);
    if (trimmed.length === 0) {
      return { ok: false, reason: 'empty-name' };
    }
    const record = await hostStorage.get(OH.syntheticIdentity);
    if (!record) {
      return { ok: false, reason: 'no-identity' };
    }
    if (record.org.name === trimmed) {
      return { ok: true };
    }
    await hostStorage.set(OH.syntheticIdentity, {
      ...record,
      org: { ...record.org, name: trimmed },
    });
    await refreshIdentitySnapshotFromHostStorage();
    return { ok: true };
  });
}
