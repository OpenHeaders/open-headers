/**
 * Daemon-local user directory (Phase 5 team tier, slice 1).
 *
 * Host-neutral CRUD over `OH.daemonUsers` — the daemon's directory of
 * users it admits beyond its own operator. Each entry reuses the §5
 * identity rows verbatim (User + UserIdentity + OrgMembership +
 * Principal, all anchored in the daemon's own Org) so the capability
 * resolver consumes directory users through the shapes it already
 * resolves; no parallel user model exists.
 *
 * Auth tokens bind to a directory user via `DaemonAuthToken.userId`.
 * {@link resolveDaemonPeerUser} is the admission-side join: it maps a
 * validated token's binding to the user the peer acts as — an unbound
 * token (every pre-team mint, plain `show-token`) resolves to the
 * daemon operator's own synthetic user, so the solo tier keeps its
 * exact semantics with zero directory entries.
 */

import type { LicenseKeyRing } from '../licensing/keys';
import { isPersonalSeatRedemptionEnabled, matchPersonalSeatIdentity } from '../licensing/personal';
import { getLicenseSeatLimit } from '../licensing/seats';
import { verifyLicense } from '../licensing/verify';
import { hostStorage, OH } from '../storage';
import type { DaemonUserRecord } from '../types';
import { createMutex } from '../utils/mutex';
import { uuidv7 } from '../utils/uuidv7';
import { emitAuditEntry } from './audit';
import { WORKSPACE_CREATE_FUNCTIONAL_ROLE } from './resolver';

export interface CreateDaemonUserInput {
  displayName: string;
  /** Verified contact identity; omitted → a `local`-kind identity row. */
  email?: string;
  /**
   * Personal-seat artifact presented at admission (paste-at-refusal).
   * Consulted only when the pool is exhausted — under capacity the
   * admission is pool-first and the license goes unread.
   */
  personalLicense?: string;
  /** Test seam — trust ring for the personal artifact; production uses the compiled ring. */
  ring?: LicenseKeyRing;
  /** Test seam — defaults to `Date.now()`. */
  now?: () => number;
}

export type PersonalSeatRefusalReason =
  /** The daemon's `personalSeats` knob is off — procurement control. */
  | 'personal-seats-disabled'
  /** The artifact failed verification, expired past grace, is an org license, or carries no licensee email. */
  | 'personal-license-invalid'
  /** The license belongs to a different identity — the anti-sharing refusal. */
  | 'personal-license-identity-mismatch'
  /** The user being admitted has no email identity to match — bare local users can't redeem. */
  | 'personal-license-no-identity';

export type CreateDaemonUserResult =
  | { readonly ok: true; readonly record: DaemonUserRecord }
  | { readonly ok: false; readonly reason: 'empty-display-name' | 'duplicate-email' | 'no-daemon-identity' }
  | { readonly ok: false; readonly reason: PersonalSeatRefusalReason }
  | {
      readonly ok: false;
      readonly reason: 'seat-limit-reached';
      /** The limit that refused: licensed seats, or `FREE_SEAT_LIMIT`. */
      readonly seatLimit: number;
    };

/** The refusal vocabulary, as the `users.create` channel's typed `reason` (admin surfaces branch on it, never the message). */
export type CreateDaemonUserRefusalReason = Extract<CreateDaemonUserResult, { readonly ok: false }>['reason'];

export type DeactivateDaemonUserResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'unknown-user' | 'already-deactivated' };

export type SetDaemonUserPasswordResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'unknown-user' | 'user-deactivated' };

export type SetDaemonUserWorkspaceCreateResult =
  | { readonly ok: true; readonly updated: boolean }
  | { readonly ok: false; readonly reason: 'unknown-user' | 'user-deactivated' };

export type ResolveDaemonPeerUserResult =
  | { readonly ok: true; readonly userId: string; readonly displayName: string }
  | { readonly ok: false; readonly reason: 'unknown-user' | 'user-deactivated' | 'no-daemon-identity' };

/**
 * Serializes every read-modify-write against `OH.daemonUsers` — same
 * discipline as the token ledger's mutex: overlapping get-then-set
 * cycles would otherwise clobber each other (a create lost under a
 * concurrent deactivate).
 */
const withUserStoreLock = createMutex();

async function readUsers(): Promise<DaemonUserRecord[]> {
  return (await hostStorage.get(OH.daemonUsers)) ?? [];
}

/**
 * Admit a new user to the daemon's directory. Mints the full §5 row
 * tuple in the daemon's own Org (`primaryRole: 'member'`; workspace
 * grants are a separate axis — WRA rows, slice 2). Refuses a duplicate
 * email so the directory keys human identities uniquely — among ACTIVE
 * records only, case-insensitively (the same fold the SSO join uses):
 * reactivation is not supported, so re-admitting a deactivated user's
 * email as a fresh record IS the sanctioned lifecycle. The deactivated
 * record stays for audit continuity; {@link findDaemonUserByEmail}
 * prefers the active one.
 */
export async function createDaemonUser(input: CreateDaemonUserInput): Promise<CreateDaemonUserResult> {
  const displayName = input.displayName.trim();
  if (!displayName) return { ok: false, reason: 'empty-display-name' };
  const email = input.email?.trim() || undefined;
  const identity = await hostStorage.get(OH.syntheticIdentity);
  if (!identity) return { ok: false, reason: 'no-daemon-identity' };
  const orgId = identity.org.id;
  const now = (input.now ?? Date.now)();

  return withUserStoreLock(async () => {
    const current = await readUsers();
    const needle = email?.toLowerCase();
    if (
      needle &&
      current.some(
        (r) =>
          r.deactivatedAt === null && r.userIdentity.kind === 'email' && r.userIdentity.value?.toLowerCase() === needle,
      )
    ) {
      return { ok: false, reason: 'duplicate-email' };
    }
    // The seat gate (the licensing plan §4) — the ONE enforcement point
    // every user-adding path funnels through: admin console RPC, CLI
    // `user add`, OIDC auto-provision. Counted against ACTIVE records
    // only, so deactivating a user frees their seat immediately; the
    // limit derives from the license snapshot at this moment (grace
    // still admits the licensed seats; past grace reverts new growth
    // to the free tier). Existing users are never re-checked.
    const seatLimit = getLicenseSeatLimit();
    const activeUsers = current.filter((r) => r.deactivatedAt === null).length;
    let admission: DaemonUserRecord['admission'];
    if (activeUsers >= seatLimit) {
      const refuse = (
        reason: 'seat-limit-reached' | PersonalSeatRefusalReason,
      ): Extract<CreateDaemonUserResult, { ok: false }> => {
        emitAuditEntry({
          actorUserId: identity.user.id,
          capability: 'daemon.seat-admit',
          decision: { allow: false, reason },
          orgId,
        });
        return reason === 'seat-limit-reached' ? { ok: false, reason, seatLimit } : { ok: false, reason };
      };
      // The personal-seat branch: a user-held license is an admission
      // ticket past the exhausted pool — identity-match + validity,
      // daemon-local and offline. Grace admits (renewal courtesy);
      // expired past grace and anything the ring refuses do not. The
      // duplicate-email check above already guarantees one active
      // admission per license: the license admits only its own email,
      // and that email can hold only one active record.
      const personalText = input.personalLicense?.trim();
      if (!personalText) return refuse('seat-limit-reached');
      if (!isPersonalSeatRedemptionEnabled()) return refuse('personal-seats-disabled');
      if (!email) return refuse('personal-license-no-identity');
      const verified = await verifyLicense(personalText, new Date(now), input.ring);
      if (verified.status === 'invalid' || verified.status === 'expired') return refuse('personal-license-invalid');
      const match = matchPersonalSeatIdentity(verified.license, email);
      if (!match.ok) {
        return refuse(
          match.reason === 'identity-mismatch' ? 'personal-license-identity-mismatch' : 'personal-license-invalid',
        );
      }
      admission = {
        kind: 'personal',
        licenseId: verified.license.licenseId,
        licenseKey: personalText.replace(/\s+/g, ''),
      };
      // The exceptional admission is the forensic event — pool
      // admissions under the limit stay unstamped.
      emitAuditEntry({
        actorUserId: identity.user.id,
        capability: 'daemon.seat-admit',
        decision: { allow: true },
        orgId,
      });
    }
    const userId = uuidv7();
    const record: DaemonUserRecord = {
      user: {
        id: userId,
        displayName,
        homeOrgId: orgId,
        isStandalone: false,
      },
      userIdentity: {
        id: uuidv7(),
        userId,
        kind: email ? 'email' : 'local',
        value: email ?? null,
        isPrimary: true,
        verifiedAt: new Date(now).toISOString(),
      },
      membership: {
        id: uuidv7(),
        userId,
        orgId,
        primaryRole: 'member',
        functionalRoles: [],
      },
      principal: {
        id: uuidv7(),
        userId,
        orgId,
      },
      createdAt: now,
      deactivatedAt: null,
      ...(admission ? { admission } : {}),
    };
    await hostStorage.set(OH.daemonUsers, [...current, record]);
    return { ok: true, record };
  });
}

export type AbsorbPersonalSeatResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'unknown-user' | 'not-personal' };

/**
 * Org buy-out: fold a personally-admitted user into the daemon's seat
 * pool by clearing the admission provenance (and the stored artifact
 * with it — the refresh agent stops renewing it here). The record is
 * a plain pool seat from then on; there is no reverse operation.
 */
export async function absorbPersonalSeat(userId: string): Promise<AbsorbPersonalSeatResult> {
  return withUserStoreLock(async () => {
    const current = await readUsers();
    const idx = current.findIndex((r) => r.user.id === userId);
    if (idx === -1) return { ok: false, reason: 'unknown-user' };
    if (current[idx].admission === undefined) return { ok: false, reason: 'not-personal' };
    const next = current.slice();
    const { admission: _cleared, ...rest } = current[idx];
    next[idx] = rest;
    await hostStorage.set(OH.daemonUsers, next);
    return { ok: true };
  });
}

/**
 * Swap a renewed personal-seat artifact into every record admitted
 * under `licenseId` (active or not — a deactivated record keeps its
 * provenance for audit continuity but is never renewed by the agent;
 * matching on the stable lineage id keeps the write idempotent).
 * Returns how many records changed.
 */
export async function replacePersonalSeatArtifact(licenseId: string, licenseKey: string): Promise<number> {
  const compact = licenseKey.replace(/\s+/g, '');
  return withUserStoreLock(async () => {
    const current = await readUsers();
    let changed = 0;
    const next = current.map((r) => {
      if (r.admission?.licenseId !== licenseId || r.admission.licenseKey === compact) return r;
      changed += 1;
      return { ...r, admission: { ...r.admission, licenseKey: compact } };
    });
    if (changed > 0) await hostStorage.set(OH.daemonUsers, next);
    return changed;
  });
}

/** Every directory record, including deactivated ones (forensic shape). */
export async function listDaemonUsers(): Promise<readonly DaemonUserRecord[]> {
  return readUsers();
}

/**
 * Look up a directory record by its email identity, case-insensitively
 * — the join an SSO login runs from the IdP's verified email claim.
 * The ACTIVE holder wins when a deactivated record shares the email
 * (the re-admit lifecycle keeps the old record for audit continuity);
 * with no active holder the deactivated record is returned so the
 * caller can refuse the login with the right reason (it must not
 * auto-provision a duplicate).
 */
export async function findDaemonUserByEmail(email: string): Promise<DaemonUserRecord | null> {
  const needle = email.trim().toLowerCase();
  if (!needle) return null;
  const users = await readUsers();
  const matches = users.filter(
    (r) => r.userIdentity.kind === 'email' && r.userIdentity.value?.toLowerCase() === needle,
  );
  return matches.find((r) => r.deactivatedAt === null) ?? matches[0] ?? null;
}

/**
 * Deactivate a directory user. Soft — the record stays for audit
 * continuity; admission refuses the user's tokens from the next HELLO
 * on ({@link resolveDaemonPeerUser}). Revoking the user's live tokens
 * and evicting connected sockets is the caller's concern (the spine's
 * RPC handler owns the peer registry).
 */
export async function deactivateDaemonUser(
  userId: string,
  now: () => number = Date.now,
): Promise<DeactivateDaemonUserResult> {
  return withUserStoreLock(async () => {
    const current = await readUsers();
    const idx = current.findIndex((r) => r.user.id === userId);
    if (idx === -1) return { ok: false, reason: 'unknown-user' };
    if (current[idx].deactivatedAt !== null) return { ok: false, reason: 'already-deactivated' };
    const next = current.slice();
    next[idx] = { ...current[idx], deactivatedAt: now() };
    await hostStorage.set(OH.daemonUsers, next);
    return { ok: true };
  });
}

/**
 * Set or clear a directory user's password verifier (enterprise
 * Phase 3). The verifier is an opaque host-computed string — hashing
 * and verification live on the host (`node:crypto` scrypt); core only
 * persists it. `null` clears the credential. Refused on deactivated
 * records: a deactivated user must not regain a login path without
 * re-admission.
 */
export async function setDaemonUserPassword(
  userId: string,
  verifier: string | null,
): Promise<SetDaemonUserPasswordResult> {
  return withUserStoreLock(async () => {
    const current = await readUsers();
    const idx = current.findIndex((r) => r.user.id === userId);
    if (idx === -1) return { ok: false, reason: 'unknown-user' };
    if (current[idx].deactivatedAt !== null) return { ok: false, reason: 'user-deactivated' };
    const next = current.slice();
    if (verifier === null) {
      const { passwordVerifier: _cleared, ...rest } = current[idx];
      next[idx] = rest;
    } else {
      next[idx] = { ...current[idx], passwordVerifier: verifier };
    }
    await hostStorage.set(OH.daemonUsers, next);
    return { ok: true };
  });
}

export type SetDaemonUserGitEmailResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'unknown-user' | 'user-deactivated' };

/**
 * Set or clear a directory user's git commit-author email override
 * (the git-sync plan §11.5). `null` clears it — attribution then falls back
 * to the identity email, then the synthetic noreply address. Refused
 * on deactivated records, same posture as the password setter.
 */
export async function setDaemonUserGitEmail(
  userId: string,
  gitEmail: string | null,
): Promise<SetDaemonUserGitEmailResult> {
  const trimmed = gitEmail?.trim() || null;
  return withUserStoreLock(async () => {
    const current = await readUsers();
    const idx = current.findIndex((r) => r.user.id === userId);
    if (idx === -1) return { ok: false, reason: 'unknown-user' };
    if (current[idx].deactivatedAt !== null) return { ok: false, reason: 'user-deactivated' };
    const next = current.slice();
    if (trimmed === null) {
      const { gitEmail: _cleared, ...rest } = current[idx];
      next[idx] = rest;
    } else {
      next[idx] = { ...current[idx], gitEmail: trimmed };
    }
    await hostStorage.set(OH.daemonUsers, next);
    return { ok: true };
  });
}

/**
 * Grant or revoke a directory user's `workspace.create` capability by
 * toggling the {@link WORKSPACE_CREATE_FUNCTIONAL_ROLE} entry on their
 * org membership — the axis the resolver consults for the verb.
 * Idempotent (`updated: false` when the flag already matches). Refused
 * on deactivated records, same posture as the password setter.
 */
export async function setDaemonUserWorkspaceCreate(
  userId: string,
  allowed: boolean,
): Promise<SetDaemonUserWorkspaceCreateResult> {
  return withUserStoreLock(async () => {
    const current = await readUsers();
    const idx = current.findIndex((r) => r.user.id === userId);
    if (idx === -1) return { ok: false, reason: 'unknown-user' };
    if (current[idx].deactivatedAt !== null) return { ok: false, reason: 'user-deactivated' };
    const roles = current[idx].membership.functionalRoles;
    const has = roles.includes(WORKSPACE_CREATE_FUNCTIONAL_ROLE);
    if (has === allowed) return { ok: true, updated: false };
    const nextRoles = allowed
      ? [...roles, WORKSPACE_CREATE_FUNCTIONAL_ROLE]
      : roles.filter((r) => r !== WORKSPACE_CREATE_FUNCTIONAL_ROLE);
    const next = current.slice();
    next[idx] = { ...current[idx], membership: { ...current[idx].membership, functionalRoles: nextRoles } };
    await hostStorage.set(OH.daemonUsers, next);
    return { ok: true, updated: true };
  });
}

/** Git-author identity for daemon-minted commits (the git-sync plan §11.5). */
export interface DaemonUserGitAttribution {
  readonly name: string;
  readonly email: string;
}

/**
 * The commit-author identity a contributing userId resolves to
 * (the git-sync plan §11.5 / the sync-engine design §23.6). The name is
 * always the directory `displayName` — attribution never drifts from
 * the directory; the email walks gitEmail → identity email → the
 * synthetic `<userId>@users.noreply.openheaders.com` (deterministic and
 * rename-stable, the platform-noreply convention). The operator's own
 * synthetic identity resolves too, so a mixed operator+user batch
 * lists every contributor. Deactivated records still resolve —
 * attribution is historical. Unknown ids return null.
 */
export async function resolveDaemonUserGitAttribution(userId: string): Promise<DaemonUserGitAttribution | null> {
  const syntheticEmail = `${userId}@users.noreply.openheaders.com`;
  const identity = await hostStorage.get(OH.syntheticIdentity);
  if (identity && identity.user.id === userId) {
    return { name: identity.user.displayName, email: syntheticEmail };
  }
  const record = (await readUsers()).find((r) => r.user.id === userId);
  if (!record) return null;
  const identityEmail = record.userIdentity.kind === 'email' ? record.userIdentity.value : null;
  return {
    name: record.user.displayName,
    email: record.gitEmail ?? identityEmail ?? syntheticEmail,
  };
}

/**
 * Admission-side join from a validated token's user binding to the
 * user the peer acts as. Unbound (`undefined`) → the daemon operator's
 * own synthetic user; bound → the directory record, refused when the
 * record is missing (stale binding after a directory wipe) or
 * deactivated.
 */
export async function resolveDaemonPeerUser(tokenUserId: string | undefined): Promise<ResolveDaemonPeerUserResult> {
  if (tokenUserId === undefined) {
    const identity = await hostStorage.get(OH.syntheticIdentity);
    if (!identity) return { ok: false, reason: 'no-daemon-identity' };
    return { ok: true, userId: identity.user.id, displayName: identity.user.displayName };
  }
  const users = await readUsers();
  const record = users.find((r) => r.user.id === tokenUserId);
  if (!record) return { ok: false, reason: 'unknown-user' };
  if (record.deactivatedAt !== null) return { ok: false, reason: 'user-deactivated' };
  return { ok: true, userId: record.user.id, displayName: record.user.displayName };
}
