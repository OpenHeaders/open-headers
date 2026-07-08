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
import { type JoinedOrgRecord, OH } from '../storage/keys';
import type { Org, SyntheticIdentityRecord, WorkspaceRoleAssignment } from '../types';
import { createMutex } from '../utils/mutex';
import type { IdentitySnapshot } from './resolver';

let current: IdentitySnapshot | null = null;

/**
 * Org-id → `OH.backends` record id for every joined Org the snapshot
 * folds (same presence filter as the fold itself). This is the routing
 * key of the multi-backend connection plane (MULTI_BACKEND_PLAN.md §3):
 * outbound envelopes go to exactly the backend bound to their `orgId`,
 * and each connection's inbound gate accepts only its own Orgs. Kept in
 * lockstep with the snapshot by the refresh path — every joined-org
 * writer funnels through it.
 */
let orgBackendBindings: ReadonlyMap<string, string> = new Map();

/** Synchronous read of the joined-Org → backend-record bindings. */
export function getOrgBackendBindings(): ReadonlyMap<string, string> {
  return orgBackendBindings;
}

/**
 * Backend ids that exist on this host by construction rather than as
 * `OH.backends` records. The fold-by-presence filter treats them as
 * always present, and {@link claimJoinedOrg} never classifies a binding
 * to one of them as stale.
 *
 * The web host is the motivating case: its single backend is the daemon
 * that served the tab — there is nothing to configure and nothing to
 * remove, so no registry record represents it. `OH.backends` is also a
 * sensitive slot, unreadable on a cipher-less host, which would
 * otherwise unfold every joined Org on refresh.
 */
let pinnedBackendIds: ReadonlySet<string> = new Set();

/** Declare the host's by-construction backend ids. Host boot wiring only. */
export function setPinnedBackendIds(ids: readonly string[]): void {
  pinnedBackendIds = new Set(ids);
}

export interface InstallIdentitySnapshotInput {
  record: SyntheticIdentityRecord;
  wras: ReadonlyArray<WorkspaceRoleAssignment>;
  /**
   * Orgs this host joined by connecting to other backends (Phase U5.2 —
   * "consume-first join"). Folded into `IdentitySnapshot.orgs` alongside
   * the private home Org so `authorizedOrgIds` lets the joined
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
  // Multi-org-native: `orgs` is a set on every host. The private
  // home Org seeds it; Orgs joined via `recordJoinedOrg` fold in with no
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
  orgBackendBindings = new Map();
  pinnedBackendIds = new Set();
}

/**
 * Serializes `refreshIdentitySnapshotFromHostStorage`. The refresh is a
 * multi-`get`-then-`installIdentitySnapshot` sequence with no atomicity,
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
      orgBackendBindings = new Map();
      return null;
    }
    const wras = (await hostStorage.get(OH.workspaceRoleAssignments)) ?? [];
    const joinedRecords = (await hostStorage.get(OH.joinedOrgs)) ?? [];
    const backendIds = new Set(((await hostStorage.get(OH.backends)) ?? []).map((b) => b.id));
    for (const id of pinnedBackendIds) backendIds.add(id);
    // Fold-by-presence: an Org stays folded while its backend record
    // exists in `OH.backends`, enabled or not — the kill switch stops
    // the wire, never the local usability of already-synced workspaces.
    // Unbinding is the deliberate remove flow, which deletes the record
    // (and Phase 3 prunes the joined rows with it). Rows whose backend
    // is gone — or malformed pre-provenance rows — are not folded.
    const foldedRows = joinedRecords.filter((row) => row?.org && backendIds.has(row.backendId));
    orgBackendBindings = new Map(foldedRows.map((row) => [row.org.id, row.backendId]));
    return installIdentitySnapshot({ record, wras, joinedOrgs: foldedRows.map((row) => row.org) });
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
 * Outcome of {@link recordJoinedOrg}. `firstJoin` is true only when the
 * Org was not already on file — it lets the join-adopt wiring inherit
 * the backend's active workspace once (on the first join) without
 * re-adopting on every reconnect's WELCOME.
 */
export interface RecordJoinedOrgResult {
  snapshot: IdentitySnapshot | null;
  /** True iff this Org was newly recorded — a first join, not a reconnect. */
  firstJoin: boolean;
}

/**
 * Record an Org joined by connecting to another backend (Phase U5.2).
 * Appends `org` to the persisted `OH.joinedOrgs` set (deduplicated by
 * id; the private home Org is never stored here — it already rides
 * `OH.syntheticIdentity`), then rebuilds the in-memory snapshot so the
 * resolver's `authorizedOrgIds` immediately includes it and the joined
 * backend's workspaces sync down.
 *
 * **Joined Orgs are never private.** `Org.isPrivate` records "no backend
 * hosts this Org" — true for a freshly-bootstrapped home Org, false the
 * moment a backend connects. A joined Org has, by definition, crossed a
 * wire to get here, so its `isPrivate` is false regardless of what the
 * sender stamped on it. We normalize at the registry boundary
 * (`{ ...org, isPrivate: false }`) so every downstream consumer
 * (`classifyOrg`, the org-scope vocabulary, the badge/picker UI) reads a
 * single honest signal — no defensive `(isPrivate, !isHome)` branches
 * downstream.
 *
 * Idempotent: re-joining the same backend (every reconnect re-sends
 * WELCOME) is a no-op once the Org is already on file — `firstJoin` is
 * then false. A previously-stored row that carries the wrong
 * `isPrivate: true` (legacy / pre-normalization) is corrected on the
 * next reconnect via the same drift-update branch that catches a
 * renamed Org. The `OH.joinedOrgs` read-modify-write is serialized
 * through {@link withJoinedOrgsLock} so concurrent joins of distinct
 * Orgs can't clobber each other.
 *
 * `backendId` is the `OH.backends` record the WELCOME arrived over —
 * the Org's provenance (MULTI_BACKEND_PLAN.md §2). This writer does NOT
 * enforce Org uniqueness — a differing stored `backendId` is
 * drift-updated in place. WELCOME processing goes through
 * {@link claimJoinedOrg}, which layers the uniqueness guard on top.
 */
export async function recordJoinedOrg(org: Org, backendId: string): Promise<RecordJoinedOrgResult> {
  const record = await hostStorage.get(OH.syntheticIdentity);
  if (record && record.org.id === org.id) {
    // The joiner's own home-org — nothing to record, not a join. Reached
    // only if a host somehow handshakes against itself; harmless to ignore.
    return { snapshot: await refreshIdentitySnapshotFromHostStorage(), firstJoin: false };
  }
  // Normalize: joined Orgs are never private by definition.
  const normalized: Org = org.isPrivate ? { ...org, isPrivate: false } : org;
  const nextRow: JoinedOrgRecord = { org: normalized, backendId };
  let firstJoin = false;
  await withJoinedOrgsLock(async () => {
    firstJoin = await upsertJoinedOrgRowLocked(nextRow);
  });
  return { snapshot: await refreshIdentitySnapshotFromHostStorage(), firstJoin };
}

/**
 * Upsert one `OH.joinedOrgs` row. Caller MUST hold
 * {@link withJoinedOrgsLock}. Returns true when the Org was newly
 * recorded (a first join, not a reconnect).
 */
async function upsertJoinedOrgRowLocked(nextRow: JoinedOrgRecord): Promise<boolean> {
  const existing = (await hostStorage.get(OH.joinedOrgs)) ?? [];
  const known = existing.find((row) => row?.org?.id === nextRow.org.id);
  if (!known) {
    await hostStorage.set(OH.joinedOrgs, [...existing, nextRow]);
    return true;
  }
  if (
    known.org.name !== nextRow.org.name ||
    known.org.isPrivate !== nextRow.org.isPrivate ||
    known.backendId !== nextRow.backendId
  ) {
    // The backend renamed its Org, the persisted row predates
    // boundary-normalization (legacy `isPrivate: true`), or the
    // connection record was re-minted. Either way, re-store the
    // freshest normalized copy under the delivering backend.
    await hostStorage.set(
      OH.joinedOrgs,
      existing.map((row) => (row?.org?.id === nextRow.org.id ? nextRow : row)),
    );
  }
  return false;
}

/** Outcome of {@link claimJoinedOrg}. */
export type ClaimJoinedOrgResult =
  | ({ outcome: 'joined' } & RecordJoinedOrgResult)
  | { outcome: 'refused'; boundBackendId: string };

/**
 * The Org-uniqueness-guarded join writer (MULTI_BACKEND_PLAN.md §2): an
 * Org is authoritative on exactly one backend. A claim for an Org
 * already bound to a *different, still-present* `OH.backends` record is
 * refused — never silently re-bound, never double-consumed; the caller
 * surfaces it. A binding pointing at a deleted connection record is
 * stale and rebinds to the claimant (the same drift-update
 * {@link recordJoinedOrg} performs under the Phase-1 cap). The guard
 * and the upsert run under one lock so two concurrent WELCOMEs claiming
 * the same Org serialize — the loser observes the winner's binding.
 */
export async function claimJoinedOrg(org: Org, backendId: string): Promise<ClaimJoinedOrgResult> {
  const record = await hostStorage.get(OH.syntheticIdentity);
  if (record && record.org.id === org.id) {
    // The joiner's own home-org — nothing to record, not a join.
    return { outcome: 'joined', snapshot: await refreshIdentitySnapshotFromHostStorage(), firstJoin: false };
  }
  const normalized: Org = org.isPrivate ? { ...org, isPrivate: false } : org;
  let boundBackendId: string | null = null;
  let firstJoin = false;
  await withJoinedOrgsLock(async () => {
    const existing = (await hostStorage.get(OH.joinedOrgs)) ?? [];
    const known = existing.find((row) => row?.org?.id === normalized.id);
    if (known && known.backendId !== backendId) {
      const backends = (await hostStorage.get(OH.backends)) ?? [];
      if (pinnedBackendIds.has(known.backendId) || backends.some((b) => b.id === known.backendId)) {
        boundBackendId = known.backendId;
        return;
      }
    }
    firstJoin = await upsertJoinedOrgRowLocked({ org: normalized, backendId });
  });
  if (boundBackendId !== null) {
    return { outcome: 'refused', boundBackendId };
  }
  return { outcome: 'joined', snapshot: await refreshIdentitySnapshotFromHostStorage(), firstJoin };
}

/**
 * Drop every `OH.joinedOrgs` row bound to `backendId`, then rebuild the
 * snapshot. The designated cleaner behind the backend remove flow
 * (MULTI_BACKEND_PLAN.md §4): the fold already tolerates orphan rows by
 * presence-filtering them out, but removing the record is the moment the
 * unbind becomes deliberate, so the rows go with it. Returns the pruned
 * Orgs so the remove flow can name what was unbound.
 */
export async function pruneJoinedOrgsForBackend(backendId: string): Promise<readonly Org[]> {
  let pruned: Org[] = [];
  await withJoinedOrgsLock(async () => {
    const existing = (await hostStorage.get(OH.joinedOrgs)) ?? [];
    const kept = existing.filter((row) => row?.backendId !== backendId);
    if (kept.length === existing.length) return;
    pruned = existing.filter((row) => row?.backendId === backendId && row.org).map((row) => row.org);
    await hostStorage.set(OH.joinedOrgs, kept);
  });
  await refreshIdentitySnapshotFromHostStorage();
  return pruned;
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
