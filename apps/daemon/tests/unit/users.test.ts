/**
 * `oh daemon user add / list / deactivate` — the offline directory
 * surface over the daemon's `storage.json`. Exercises the real
 * `OH.daemonUsers` helpers against on-disk storage: the §5 row tuple
 * lands in the plain bucket, add refuses a never-booted data dir,
 * deactivate revokes the user's bound tokens, and the show-token
 * `--user` binding resolves by id or email and refuses deactivated
 * users. Sqlite-free like every CLI path.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ensureSyntheticIdentity } from '@openheaders/core/identity';
import { setHostStorage } from '@openheaders/core/storage';
import { FileBackedHostStorage } from '@openheaders/oracle-host-node/host-storage';
import { afterEach, describe, expect, it } from 'vitest';
import { mintBootstrapToken } from '../../src/cli/show-token';
import {
  addUser,
  deactivateUser,
  grantUserRole,
  listUserGrants,
  listUsers,
  resolveTokenUserBinding,
  revokeUserGrant,
} from '../../src/cli/users';
import type { DaemonConfig } from '../../src/config';
import { noCipherYet } from '../../src/no-cipher';

const tempDirs: string[] = [];

function makeConfig(overrides: Partial<DaemonConfig> = {}): DaemonConfig {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-users-'));
  tempDirs.push(dataDir);
  return {
    dataDir,
    bindAddress: '127.0.0.1',
    bindPort: 8137,
    logLevel: 'info',
    trustedProxy: false,
    allowedHosts: [],
    webRoot: null,
    oidc: null,
    configPath: path.join(dataDir, 'daemon.json'),
    ...overrides,
  };
}

/** Stand in for the daemon's first boot: seed the synthetic identity. */
async function seedDaemonIdentity(config: DaemonConfig): Promise<void> {
  setHostStorage(
    new FileBackedHostStorage({
      filePath: path.join(config.dataDir, 'storage.json'),
      secretCipher: noCipherYet,
    }),
  );
  await ensureSyntheticIdentity({ hostKind: 'daemon', now: '2026-07-09T00:00:00.000Z' });
}

function readTokens(dataDir: string): Array<{ id: string; userId?: string; revokedAt: number | null }> {
  const envelope = JSON.parse(fs.readFileSync(path.join(dataDir, 'storage.json'), 'utf-8')) as {
    values: Record<string, unknown>;
  };
  return (envelope.values['oh.daemonAuthTokens'] ?? []) as Array<{
    id: string;
    userId?: string;
    revokedAt: number | null;
  }>;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('oh daemon user', () => {
  it('refuses to add a user against a never-booted data dir', async () => {
    const config = makeConfig();
    await expect(addUser(config, { displayName: 'Alice' })).rejects.toThrow('never booted');
  });

  it('adds a user anchored in the daemon Org and lists it', async () => {
    const config = makeConfig();
    await seedDaemonIdentity(config);
    const record = await addUser(config, { displayName: 'Alice', email: 'alice@openheaders.io' });
    expect(record.user.displayName).toBe('Alice');
    expect(record.userIdentity.value).toBe('alice@openheaders.io');
    const users = await listUsers(config);
    expect(users).toHaveLength(1);
    expect(users[0].user.id).toBe(record.user.id);
  });

  it('refuses a duplicate email with a readable message', async () => {
    const config = makeConfig();
    await seedDaemonIdentity(config);
    await addUser(config, { displayName: 'Alice', email: 'alice@openheaders.io' });
    await expect(addUser(config, { displayName: 'Alice 2', email: 'alice@openheaders.io' })).rejects.toThrow(
      'already exists',
    );
  });

  it('binds a show-token mint to a user resolved by email, refuses after deactivation', async () => {
    const config = makeConfig();
    await seedDaemonIdentity(config);
    const record = await addUser(config, { displayName: 'Alice', email: 'alice@openheaders.io' });

    const bound = await resolveTokenUserBinding(config, 'alice@openheaders.io');
    expect(bound.user.id).toBe(record.user.id);
    const minted = await mintBootstrapToken(config, 'alice laptop', bound.user.id);
    const ledger = readTokens(config.dataDir);
    expect(ledger.find((t) => t.id === minted.tokenId)?.userId).toBe(record.user.id);

    await deactivateUser(config, record.user.id);
    await expect(resolveTokenUserBinding(config, 'alice@openheaders.io')).rejects.toThrow('deactivated');
  });

  it('deactivate revokes exactly the user-bound tokens and reports them', async () => {
    const config = makeConfig();
    await seedDaemonIdentity(config);
    const record = await addUser(config, { displayName: 'Alice' });
    const boundToken = await mintBootstrapToken(config, 'alice', record.user.id);
    const unboundToken = await mintBootstrapToken(config, 'operator');

    const { revokedTokenIds } = await deactivateUser(config, record.user.id);
    expect(revokedTokenIds).toEqual([boundToken.tokenId]);
    const ledger = readTokens(config.dataDir);
    expect(ledger.find((t) => t.id === boundToken.tokenId)?.revokedAt).not.toBeNull();
    expect(ledger.find((t) => t.id === unboundToken.tokenId)?.revokedAt).toBeNull();
    const users = await listUsers(config);
    expect(users[0].deactivatedAt).not.toBeNull();
  });

  it('deactivate resolves by email and refuses unknown ids', async () => {
    const config = makeConfig();
    await seedDaemonIdentity(config);
    await addUser(config, { displayName: 'Bob', email: 'bob@openheaders.io' });
    await deactivateUser(config, 'bob@openheaders.io');
    const users = await listUsers(config);
    expect(users[0].deactivatedAt).not.toBeNull();
    await expect(deactivateUser(config, 'nobody@openheaders.io')).rejects.toThrow('no user');
  });

  it('grants a workspace role by email, updates it in place, and revokes it', async () => {
    const config = makeConfig();
    await seedDaemonIdentity(config);
    const record = await addUser(config, { displayName: 'Alice', email: 'alice@openheaders.io' });
    const wsId = '01900000-aaaa-7000-8000-000000000001';

    const granted = await grantUserRole(config, 'alice@openheaders.io', wsId, 'viewer');
    expect(granted.updated).toBe(false);
    let grants = await listUserGrants(record);
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({ principalId: record.principal.id, workspaceId: wsId, role: 'viewer' });

    const regranted = await grantUserRole(config, record.user.id, wsId, 'editor');
    expect(regranted.updated).toBe(true);
    grants = await listUserGrants(record);
    expect(grants).toHaveLength(1);
    expect(grants[0].role).toBe('editor');

    await revokeUserGrant(config, 'alice@openheaders.io', wsId);
    expect(await listUserGrants(record)).toHaveLength(0);
  });

  it('grant refuses deactivated users; revoke refuses a grant that does not exist', async () => {
    const config = makeConfig();
    await seedDaemonIdentity(config);
    const record = await addUser(config, { displayName: 'Alice', email: 'alice@openheaders.io' });
    const wsId = '01900000-aaaa-7000-8000-000000000002';

    await expect(revokeUserGrant(config, record.user.id, wsId)).rejects.toThrow('no grant');
    await deactivateUser(config, record.user.id);
    await expect(grantUserRole(config, record.user.id, wsId, 'viewer')).rejects.toThrow('deactivated');
  });
});
