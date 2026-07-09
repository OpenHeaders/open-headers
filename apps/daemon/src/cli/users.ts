/**
 * `oh daemon user add / list / deactivate` — the headless directory
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
  listDaemonAuthTokens,
  listDaemonUsers,
  revokeDaemonAuthToken,
} from '@openheaders/core/identity';
import { setHostStorage } from '@openheaders/core/storage';
import type { DaemonUserRecord } from '@openheaders/core/types';
import { FileBackedHostStorage } from '@openheaders/oracle-host-node/host-storage';
import type { DaemonConfig } from '../config';
import { noCipherYet } from '../no-cipher';

function installStorage(config: DaemonConfig): void {
  setHostStorage(
    new FileBackedHostStorage({
      filePath: path.join(config.dataDir, 'storage.json'),
      secretCipher: noCipherYet,
    }),
  );
}

export interface AddUserInput {
  displayName: string;
  email?: string;
}

export async function addUser(config: DaemonConfig, input: AddUserInput): Promise<DaemonUserRecord> {
  installStorage(config);
  const result = await createDaemonUser(input);
  if (result.ok) return result.record;
  if (result.reason === 'no-daemon-identity') {
    throw new Error(
      'the daemon has never booted against this data dir — start it once (oh daemon start) so its identity exists, then add users.',
    );
  }
  if (result.reason === 'duplicate-email') {
    throw new Error(`a user with email '${input.email}' already exists — see oh daemon user list.`);
  }
  throw new Error('display name must not be empty.');
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

/**
 * Resolve a directory user by exact id or by email. Storage must
 * already be installed by the caller (every exported command does).
 */
export async function findUser(idOrEmail: string): Promise<DaemonUserRecord> {
  const users = await listDaemonUsers();
  const match = users.find(
    (r) => r.user.id === idOrEmail || (r.userIdentity.kind === 'email' && r.userIdentity.value === idOrEmail),
  );
  if (!match) {
    throw new Error(`no user with id or email '${idOrEmail}' — see oh daemon user list.`);
  }
  return match;
}

/**
 * Resolve the `--user` binding for `show-token`: id or email of an
 * ACTIVE directory user. Installs storage itself so `show-token` can
 * call it before its own mint (both hit the same `storage.json`).
 */
export async function resolveTokenUserBinding(config: DaemonConfig, idOrEmail: string): Promise<DaemonUserRecord> {
  installStorage(config);
  const record = await findUser(idOrEmail);
  if (record.deactivatedAt !== null) {
    throw new Error(`user '${record.user.displayName}' is deactivated — its tokens would be refused at the gate.`);
  }
  return record;
}
