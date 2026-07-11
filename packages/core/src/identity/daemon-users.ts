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

import { hostStorage, OH } from '../storage';
import type { DaemonUserRecord } from '../types';
import { createMutex } from '../utils/mutex';
import { uuidv7 } from '../utils/uuidv7';

export interface CreateDaemonUserInput {
  displayName: string;
  /** Verified contact identity; omitted → a `local`-kind identity row. */
  email?: string;
  /** Test seam — defaults to `Date.now()`. */
  now?: () => number;
}

export type CreateDaemonUserResult =
  | { readonly ok: true; readonly record: DaemonUserRecord }
  | { readonly ok: false; readonly reason: 'empty-display-name' | 'duplicate-email' | 'no-daemon-identity' };

export type DeactivateDaemonUserResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'unknown-user' | 'already-deactivated' };

export type SetDaemonUserPasswordResult =
  | { readonly ok: true }
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
    };
    await hostStorage.set(OH.daemonUsers, [...current, record]);
    return { ok: true, record };
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
