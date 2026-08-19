/**
 * `ohd user add / list / deactivate` — the headless directory
 * surface (Phase 5 team tier, slice 1). Thin CLI plumbing over the
 * host-neutral `OH.daemonUsers` helpers in `@openheaders/core/identity`
 * against the daemon's own `storage.json`.
 *
 * Writes are offline by design — same single-writer law as show-token
 * and `config set`: the caller guards with a `/healthz` probe and
 * refuses while the daemon runs. Reads are safe anytime.
 *
 * `add` needs the daemon's own identity (`OH.syntheticIdentity`) to
 * anchor the new user in the daemon's Org — that record is seeded on
 * the daemon's FIRST boot, so a never-booted data dir refuses with a
 * "start the daemon once" hint rather than minting an orphan.
 */

import * as path from 'node:path';
import {
  createDaemonUser,
  deactivateDaemonUser,
  grantWorkspaceRole,
  listDaemonAuthTokens,
  listDaemonUsers,
  listWorkspaceRolesForPrincipal,
  revokeDaemonAuthToken,
  revokeWorkspaceRole,
  setDaemonUserPassword,
} from '@openheaders/core/identity';
import { setHostStorage } from '@openheaders/core/storage';
import type { DaemonUserRecord, WorkspaceRole, WorkspaceRoleAssignment } from '@openheaders/core/types';
import { hashPassword, PASSWORD_MIN_LENGTH } from '@openheaders/oracle-host-node/daemon/password-verifier';
import { FileBackedHostStorage } from '@openheaders/oracle-host-node/host-storage';
import type { DaemonConfig } from '../config';
import { resolveDaemonCipher } from '../vault-cipher';
import { withLicenseSeatProvider } from './license';

function installStorage(config: DaemonConfig): void {
  setHostStorage(
    new FileBackedHostStorage({
      filePath: path.join(config.dataDir, 'storage.json'),
      secretCipher: resolveDaemonCipher(config),
    }),
  );
}

export interface AddUserInput {
  displayName: string;
  email?: string;
  /** Individual-seat key redeemed at the seat wall (`--individual-license`). */
  personalLicense?: string;
}

export async function addUser(config: DaemonConfig, input: AddUserInput): Promise<DaemonUserRecord> {
  installStorage(config);
  // The seat gate reads the license snapshot through the same provider
  // seam the spine installs — here fed one-shot from the same
  // `license.key` the daemon would read. The personal-seat knob stays
  // at its default here: the operator running the offline CLI IS the
  // procurement authority the knob exists to protect.
  const uninstallSeatProvider = await withLicenseSeatProvider(config);
  try {
    const result = await createDaemonUser(input);
    if (result.ok) return result.record;
    if (result.reason === 'no-daemon-identity') {
      throw new Error(
        'the daemon has never booted against this data dir — start it once (ohd start) so its identity exists, then add users.',
      );
    }
    if (result.reason === 'duplicate-email') {
      throw new Error(`a user with email '${input.email}' already exists — see ohd user list.`);
    }
    if (result.reason === 'seat-limit-reached') {
      throw new Error(
        `seat limit reached (${result.seatLimit} active users) — deactivate a user to free a seat, ` +
          'install a license with more seats (ohd license install <file>), or redeem the joining ' +
          "user's individual seat (--individual-license <key>; keys at https://openheaders.com/pricing).",
      );
    }
    if (result.reason === 'personal-license-identity-mismatch') {
      throw new Error("the individual seat belongs to a different email — it only admits the licensee's own address.");
    }
    if (result.reason === 'personal-license-invalid') {
      throw new Error('the individual-seat key is not usable (invalid, expired, or not an individual seat).');
    }
    if (result.reason === 'personal-license-no-identity') {
      throw new Error('an individual seat needs the user email to match — add the user with --email.');
    }
    if (result.reason === 'personal-seats-disabled') {
      throw new Error('individual-seat redemption is disabled on this daemon (personalSeats: false).');
    }
    throw new Error('display name must not be empty.');
  } finally {
    uninstallSeatProvider();
  }
}

export async function listUsers(config: DaemonConfig): Promise<readonly DaemonUserRecord[]> {
  installStorage(config);
  return listDaemonUsers();
}

export interface DeactivateUserOutcome {
  /** Ids of the user's tokens revoked alongside the deactivation. */
  readonly revokedTokenIds: readonly string[];
}

/**
 * Deactivate a directory user (by id or unique email) and revoke every
 * token bound to them — the offline twin of `oh.daemon.users.deactivate`
 * (no live peers to evict here: the daemon is stopped by contract).
 */
export async function deactivateUser(config: DaemonConfig, idOrEmail: string): Promise<DeactivateUserOutcome> {
  installStorage(config);
  const record = await findUser(idOrEmail);
  const result = await deactivateDaemonUser(record.user.id);
  if (!result.ok) {
    throw new Error(result.reason === 'already-deactivated' ? 'user is already deactivated.' : 'unknown user.');
  }
  const revokedTokenIds: string[] = [];
  for (const token of await listDaemonAuthTokens()) {
    if (token.userId !== record.user.id || token.revokedAt !== null) continue;
    await revokeDaemonAuthToken(token.id);
    revokedTokenIds.push(token.id);
  }
  return { revokedTokenIds };
}

/** Roles the grant surface accepts; mirrors `WorkspaceRoleSchema`. */
export const WORKSPACE_ROLES: readonly WorkspaceRole[] = ['owner', 'editor', 'viewer'];

export function isWorkspaceRole(value: string): value is WorkspaceRole {
  return (WORKSPACE_ROLES as readonly string[]).includes(value);
}

export interface GrantUserRoleOutcome {
  readonly record: DaemonUserRecord;
  /** True when an existing grant's role was changed in place. */
  readonly updated: boolean;
}

/**
 * Grant a workspace role to a directory user (by id or unique email) —
 * the offline twin of `oh.daemon.users.grant`. Workspace existence
 * cannot be verified offline (workspaces live in `oracle.db`, not
 * `storage.json`); a grant against an id that never materializes is
 * dropped by the boot WRA reconcile — the caller prints that advisory.
 */
export async function grantUserRole(
  config: DaemonConfig,
  idOrEmail: string,
  workspaceId: string,
  role: WorkspaceRole,
): Promise<GrantUserRoleOutcome> {
  installStorage(config);
  const record = await findUser(idOrEmail);
  if (record.deactivatedAt !== null) {
    throw new Error(`user '${record.user.displayName}' is deactivated — reactivation is not supported; add anew.`);
  }
  const result = await grantWorkspaceRole({ principalId: record.principal.id, workspaceId, role });
  if (!result.ok) throw new Error(`grant refused: ${result.reason}.`);
  return { record, updated: result.updated };
}

/**
 * Drop a directory user's grant on one workspace — the offline twin of
 * `oh.daemon.users.revokeGrant`.
 */
export async function revokeUserGrant(
  config: DaemonConfig,
  idOrEmail: string,
  workspaceId: string,
): Promise<DaemonUserRecord> {
  installStorage(config);
  const record = await findUser(idOrEmail);
  const result = await revokeWorkspaceRole(record.principal.id, workspaceId);
  if (!result.ok) {
    throw new Error(`no grant for '${record.user.displayName}' on workspace ${workspaceId}.`);
  }
  return record;
}

/**
 * Set or clear a directory user's password (by id or unique email) —
 * the offline twin of `oh.daemon.users.setPassword`. The verifier is
 * minted by the SAME host hashing the login path verifies
 * (`password-verifier.ts` scrypt); core persists the opaque string.
 * `null` clears the credential — live sessions stand, the user just
 * can't password-login anew.
 */
export async function setUserPassword(
  config: DaemonConfig,
  idOrEmail: string,
  password: string | null,
): Promise<DaemonUserRecord> {
  installStorage(config);
  const record = await findUser(idOrEmail);
  if (password !== null && password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  }
  const verifier = password === null ? null : await hashPassword(password);
  const result = await setDaemonUserPassword(record.user.id, verifier);
  if (!result.ok) {
    throw new Error(
      result.reason === 'user-deactivated'
        ? `user '${record.user.displayName}' is deactivated — a deactivated user must not regain a login path.`
        : 'unknown user.',
    );
  }
  return record;
}

/** Every grant of one directory user, for the list projection. */
export function listUserGrants(record: DaemonUserRecord): Promise<WorkspaceRoleAssignment[]> {
  return listWorkspaceRolesForPrincipal(record.principal.id);
}

/**
 * Resolve a directory user by exact id or by email. On an email hit
 * the ACTIVE holder wins over a deactivated record sharing the address
 * (the add-anew lifecycle keeps the old record for audit continuity).
 * Storage must already be installed by the caller (every exported
 * command does).
 */
export async function findUser(idOrEmail: string): Promise<DaemonUserRecord> {
  const users = await listDaemonUsers();
  const matches = users.filter(
    (r) => r.user.id === idOrEmail || (r.userIdentity.kind === 'email' && r.userIdentity.value === idOrEmail),
  );
  const match = matches.find((r) => r.deactivatedAt === null) ?? matches[0];
  if (!match) {
    throw new Error(`no user with id or email '${idOrEmail}' — see ohd user list.`);
  }
  return match;
}

/**
 * Resolve a directory user by id or email against the daemon's own
 * `storage.json`, installing storage first. Deactivated records
 * resolve too — callers that need an active user check themselves.
 */
export async function resolveDirectoryUser(config: DaemonConfig, idOrEmail: string): Promise<DaemonUserRecord> {
  installStorage(config);
  return findUser(idOrEmail);
}

/**
 * Resolve the `--user` binding for `show-token`: id or email of an
 * ACTIVE directory user. Installs storage itself so `show-token` can
 * call it before its own mint (both hit the same `storage.json`).
 */
export async function resolveTokenUserBinding(config: DaemonConfig, idOrEmail: string): Promise<DaemonUserRecord> {
  const record = await resolveDirectoryUser(config, idOrEmail);
  if (record.deactivatedAt !== null) {
    throw new Error(`user '${record.user.displayName}' is deactivated — its tokens would be refused at the gate.`);
  }
  return record;
}
