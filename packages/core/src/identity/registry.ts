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
import { type OrgLogoRejectReason, validateOrgLogoDataUri } from '../utils/org-logo';
import type { IdentitySnapshot } from './resolver';

let current: IdentitySnapshot | null = null;

/**
 * Org-id → `OH.backends` record id for every joined Org the snapshot
 * folds (same presence filter as the fold itself). This is the routing
 * key of the multi-backend connection plane (the multi-backend plan §3):
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

/**
 * True for a by-construction backend id (the web host's serving daemon)
 * — always present, no `OH.backends` record by design. Distinguishes it
 * from a genuinely removed backend, which also lacks a record.
 */
export function isPinnedBackendId(id: string): boolean {
  return pinnedBackendIds.has(id);
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
    // The snapshot is one principal's view. `OH.workspaceRoleAssignments`
    // carries every principal's rows since Phase 5 (daemon directory-user
    // grants share the slot); folding a foreign principal's grant here
    // would overwrite the operator's own row in the map.
    if (wra.principalId !== input.record.principal.id) continue;
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
  /**
   * The Orgs this record was bound to BEFORE this join and is no longer
   * — the identity that used to answer at the record's address. Empty
   * on every ordinary join and reconnect; non-empty exactly when the
   * host behind the record changed identity and the join replaced it.
   */
  replaced: readonly Org[];
}

/**
 * What a join does when the record it rides is already bound to a
 * DIFFERENT Org — the host behind that address changed identity (a
 * reinstalled or wiped store, a build with its own data dir, a record
 * re-pointed at another machine). One record names one host, and one
 * host announces one home Org, so the previous binding is dead on that
 * wire either way; the policy decides who says so.
 *
 *   replace — the previous binding is dropped and the new Org joins
 *             (trust-by-process wires: whatever answers on loopback is
 *             this device's own installation).
 *   refuse  — nothing is written; the caller surfaces the change and
 *             the person accepts it deliberately (authenticated wires:
 *             a replaced server behind a still-valid credential is a
 *             fact to show, never to absorb silently).
 */
export type JoinedOrgIdentityChangePolicy = 'replace' | 'refuse';

export interface ClaimJoinedOrgOptions {
  onIdentityChange: JoinedOrgIdentityChangePolicy;
}

/**
 * The rows bound to `backendId` that name an Org other than `orgId` —
 * the record's previous identity. Pure; the registry's one reading of
 * "one record, one Org".
 */
function previousIdentityRows(existing: readonly JoinedOrgRecord[], backendId: string, orgId: string): JoinedOrgRecord[] {
  return existing.filter((row) => row?.org && row.backendId === backendId && row.org.id !== orgId);
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
 * the Org's provenance (the multi-backend plan §2). This writer does NOT
 * enforce Org uniqueness — a differing stored `backendId` is
 * drift-updated in place. WELCOME processing goes through
 * {@link claimJoinedOrg}, which layers the uniqueness guard on top.
 *
 * One record, one Org: rows the same record held for a different Org
 * are REPLACED by this join and reported in `replaced`. The host that
 * dials a single fixed backend (the served tab) rides this writer, and
 * there the only way its backend's identity changes is the server
 * itself being reinstalled under the same origin — the tab IS that
 * server's page, so the replacement is the truthful reading.
 */
export async function recordJoinedOrg(org: Org, backendId: string): Promise<RecordJoinedOrgResult> {
  const record = await hostStorage.get(OH.syntheticIdentity);
  if (record && record.org.id === org.id) {
    // The joiner's own home-org — nothing to record, not a join. Reached
    // only if a host somehow handshakes against itself; harmless to ignore.
    return { snapshot: await refreshIdentitySnapshotFromHostStorage(), firstJoin: false, replaced: [] };
  }
  // Normalize: joined Orgs are never private by definition.
  const normalized: Org = org.isPrivate ? { ...org, isPrivate: false } : org;
  const nextRow: JoinedOrgRecord = { org: normalized, backendId };
  let upserted: UpsertJoinedOrgOutcome = { firstJoin: false, replaced: [] };
  await withJoinedOrgsLock(async () => {
    upserted = await upsertJoinedOrgRowLocked(nextRow);
  });
  return { snapshot: await refreshIdentitySnapshotFromHostStorage(), ...upserted };
}

interface UpsertJoinedOrgOutcome {
  firstJoin: boolean;
  replaced: readonly Org[];
}

/**
 * Upsert one `OH.joinedOrgs` row and drop the rows its record held for
 * any other Org (one record, one Org). Caller MUST hold
 * {@link withJoinedOrgsLock}. `firstJoin` is true when the Org was newly
 * recorded (a first join, not a reconnect); `replaced` names the Orgs
 * the record was bound to before.
 */
async function upsertJoinedOrgRowLocked(nextRow: JoinedOrgRecord): Promise<UpsertJoinedOrgOutcome> {
  const existing = (await hostStorage.get(OH.joinedOrgs)) ?? [];
  const previous = previousIdentityRows(existing, nextRow.backendId, nextRow.org.id);
  const kept = previous.length === 0 ? existing : existing.filter((row) => !previous.includes(row));
  const replaced = previous.map((row) => row.org);
  const known = kept.find((row) => row?.org?.id === nextRow.org.id);
  if (!known) {
    await hostStorage.set(OH.joinedOrgs, [...kept, nextRow]);
    return { firstJoin: true, replaced };
  }
  if (
    previous.length > 0 ||
    known.org.name !== nextRow.org.name ||
    known.org.isPrivate !== nextRow.org.isPrivate ||
    known.org.hostOs !== nextRow.org.hostOs ||
    known.org.logo !== nextRow.org.logo ||
    known.backendId !== nextRow.backendId
  ) {
    // The backend renamed / re-branded its Org (name, logo, hostOs),
    // the persisted row predates boundary-normalization (legacy
    // `isPrivate: true`), or the connection record was re-minted.
    // Either way, re-store the freshest normalized copy under the
    // delivering backend.
    await hostStorage.set(
      OH.joinedOrgs,
      kept.map((row) => (row?.org?.id === nextRow.org.id ? nextRow : row)),
    );
  }
  return { firstJoin: false, replaced };
}

/** Outcome of {@link claimJoinedOrg}. */
export type ClaimJoinedOrgResult =
  | ({ outcome: 'joined' } & RecordJoinedOrgResult)
  | { outcome: 'refused'; boundBackendId: string }
  | { outcome: 'identity-changed'; previousOrgs: readonly [Org, ...Org[]] };

/**
 * The Org-uniqueness-guarded join writer (the multi-backend plan §2): an
 * Org is authoritative on exactly one backend. A claim for an Org
 * already bound to a *different, still-present* `OH.backends` record is
 * refused — never silently re-bound, never double-consumed; the caller
 * surfaces it. A binding pointing at a deleted connection record is
 * stale and rebinds to the claimant (the same drift-update
 * {@link recordJoinedOrg} performs under the Phase-1 cap). The guard
 * and the upsert run under one lock so two concurrent WELCOMEs claiming
 * the same Org serialize — the loser observes the winner's binding.
 *
 * The mirror invariant, one record one Org: a claim over a record that
 * is bound to a different Org is an identity change of the host behind
 * that address, resolved by `options.onIdentityChange` — `replace`
 * drops the old binding and joins (reported in `replaced`); `refuse`
 * writes nothing and answers `identity-changed` with the Orgs the
 * record held, for the caller to surface and the person to accept.
 */
export async function claimJoinedOrg(
  org: Org,
  backendId: string,
  options: ClaimJoinedOrgOptions,
): Promise<ClaimJoinedOrgResult> {
  const record = await hostStorage.get(OH.syntheticIdentity);
  if (record && record.org.id === org.id) {
    // The joiner's own home-org — nothing to record, not a join.
    return {
      outcome: 'joined',
      snapshot: await refreshIdentitySnapshotFromHostStorage(),
      firstJoin: false,
      replaced: [],
    };
  }
  const normalized: Org = org.isPrivate ? { ...org, isPrivate: false } : org;
  let boundBackendId: string | null = null;
  let previousOrgs: readonly [Org, ...Org[]] | null = null;
  let upserted: UpsertJoinedOrgOutcome = { firstJoin: false, replaced: [] };
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
    if (options.onIdentityChange === 'refuse') {
      const [first, ...rest] = previousIdentityRows(existing, backendId, normalized.id);
      if (first) {
        previousOrgs = [first.org, ...rest.map((row) => row.org)];
        return;
      }
    }
    upserted = await upsertJoinedOrgRowLocked({ org: normalized, backendId });
  });
  if (boundBackendId !== null) {
    return { outcome: 'refused', boundBackendId };
  }
  if (previousOrgs !== null) {
    return { outcome: 'identity-changed', previousOrgs };
  }
  return { outcome: 'joined', snapshot: await refreshIdentitySnapshotFromHostStorage(), ...upserted };
}

/**
 * Drop every `OH.joinedOrgs` row bound to `backendId`, then rebuild the
 * snapshot. The designated cleaner behind the backend remove flow
 * (the multi-backend plan §4): the fold already tolerates orphan rows by
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

/** Outcome of {@link setHomeOrgLogo}. */
export type SetHomeOrgLogoResult = { ok: true } | { ok: false; reason: OrgLogoRejectReason | 'no-identity' };

/**
 * Set (or clear, with `null`) this host's own (home) Org logo — the
 * custom brand mark shown in place of the derived host glyph. Same
 * write path as {@link renameHomeOrg}: edits the `Org` row inside
 * `OH.syntheticIdentity`, then refreshes the snapshot.
 *
 * The candidate is validated here ({@link validateOrgLogoDataUri}:
 * format allow-list, byte cap, inert-SVG rules) so no surface can
 * persist an unvalidated payload. Only the home Org is editable — a
 * joined Org's branding is owned by its backend and re-propagates via
 * the WELCOME drift-update on the next reconnect; that is also how an
 * edit here reaches this Org's members.
 */
export function setHomeOrgLogo(logo: string | null): Promise<SetHomeOrgLogoResult> {
  return withHomeOrgLock(async () => {
    if (logo !== null) {
      const validation = validateOrgLogoDataUri(logo);
      if (!validation.ok) {
        return { ok: false, reason: validation.reason };
      }
    }
    const record = await hostStorage.get(OH.syntheticIdentity);
    if (!record) {
      return { ok: false, reason: 'no-identity' };
    }
    if ((record.org.logo ?? null) === logo) {
      return { ok: true };
    }
    const { logo: _cleared, ...orgWithoutLogo } = record.org;
    await hostStorage.set(OH.syntheticIdentity, {
      ...record,
      org: logo === null ? orgWithoutLogo : { ...record.org, logo },
    });
    await refreshIdentitySnapshotFromHostStorage();
    return { ok: true };
  });
}
