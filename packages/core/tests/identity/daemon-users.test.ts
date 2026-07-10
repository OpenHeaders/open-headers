/**
 * Coverage for the daemon-local user directory (Phase 5 team tier,
 * slice 1) — create / list / deactivate over `OH.daemonUsers`, the
 * token→user binding on the auth-token ledger, and the admission-side
 * `resolveDaemonPeerUser` join (unbound token → daemon operator).
 */

import * as v from 'valibot';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createDaemonUser,
  deactivateDaemonUser,
  ensureSyntheticIdentity,
  findDaemonUserByEmail,
  listDaemonUsers,
  mintDaemonAuthToken,
  resolveDaemonPeerUser,
  validateDaemonAuthToken,
} from '../../src/identity';
import { DaemonUserRecordSchema } from '../../src/schemas';
import { hostStorage, setHostStorage } from '../../src/storage/host-storage';
import { OH } from '../../src/storage/keys';
import { createHostStorageFake, type HostStorageFake } from './_host-storage-fake';

describe('daemon users', () => {
  let fake: HostStorageFake;

  beforeEach(async () => {
    fake = createHostStorageFake();
    setHostStorage(fake);
    await ensureSyntheticIdentity({ hostKind: 'daemon', now: '2026-07-09T00:00:00.000Z' });
  });

  it('creates a user with the full §5 row tuple anchored in the daemon Org', async () => {
    const identity = await hostStorage.get(OH.syntheticIdentity);
    const result = await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io', now: () => 1111 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { record } = result;
    expect(v.safeParse(DaemonUserRecordSchema, record).success).toBe(true);
    expect(record.user.displayName).toBe('Alice');
    expect(record.user.homeOrgId).toBe(identity?.org.id);
    expect(record.user.isStandalone).toBe(false);
    expect(record.userIdentity.kind).toBe('email');
    expect(record.userIdentity.value).toBe('alice@openheaders.io');
    expect(record.userIdentity.isPrimary).toBe(true);
    expect(record.membership.orgId).toBe(identity?.org.id);
    expect(record.membership.primaryRole).toBe('member');
    expect(record.principal.userId).toBe(record.user.id);
    expect(record.createdAt).toBe(1111);
    expect(record.deactivatedAt).toBeNull();
    // The operator's identity is never duplicated into the directory.
    expect(record.user.id).not.toBe(identity?.user.id);
  });

  it('creates a local-kind identity row when no email is given', async () => {
    const result = await createDaemonUser({ displayName: 'CI runner' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.userIdentity.kind).toBe('local');
    expect(result.record.userIdentity.value).toBeNull();
  });

  it('refuses an empty display name and a duplicate email (case-insensitively)', async () => {
    const empty = await createDaemonUser({ displayName: '   ' });
    expect(empty).toEqual({ ok: false, reason: 'empty-display-name' });
    const first = await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io' });
    expect(first.ok).toBe(true);
    const dup = await createDaemonUser({ displayName: 'Alice 2', email: 'Alice@OPENHEADERS.IO' });
    expect(dup).toEqual({ ok: false, reason: 'duplicate-email' });
  });

  it("re-admits a deactivated user's email as a fresh record (add-anew lifecycle)", async () => {
    const first = await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io' });
    if (!first.ok) throw new Error('setup failed');
    await deactivateDaemonUser(first.record.user.id);
    const again = await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io' });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.record.user.id).not.toBe(first.record.user.id);
    // Both records persist — the deactivated one stays for audit continuity.
    expect(await listDaemonUsers()).toHaveLength(2);
  });

  it('lists every record including deactivated ones, in insertion order', async () => {
    const a = await createDaemonUser({ displayName: 'Alice' });
    const b = await createDaemonUser({ displayName: 'Bob' });
    if (!a.ok || !b.ok) throw new Error('setup failed');
    await deactivateDaemonUser(a.record.user.id, () => 2222);
    const list = await listDaemonUsers();
    expect(list).toHaveLength(2);
    expect(list[0].user.displayName).toBe('Alice');
    expect(list[0].deactivatedAt).toBe(2222);
    expect(list[1].deactivatedAt).toBeNull();
  });

  it('deactivate refuses unknown ids and double-deactivation', async () => {
    expect(await deactivateDaemonUser('nope')).toEqual({ ok: false, reason: 'unknown-user' });
    const a = await createDaemonUser({ displayName: 'Alice' });
    if (!a.ok) throw new Error('setup failed');
    expect(await deactivateDaemonUser(a.record.user.id)).toEqual({ ok: true });
    expect(await deactivateDaemonUser(a.record.user.id)).toEqual({ ok: false, reason: 'already-deactivated' });
  });

  it('concurrent creates both persist (store lock)', async () => {
    const [a, b] = await Promise.all([
      createDaemonUser({ displayName: 'Alice' }),
      createDaemonUser({ displayName: 'Bob' }),
    ]);
    expect(a.ok && b.ok).toBe(true);
    expect(await listDaemonUsers()).toHaveLength(2);
  });

  it('binds a minted token to a user and validation carries the binding', async () => {
    const created = await createDaemonUser({ displayName: 'Alice' });
    if (!created.ok) throw new Error('setup failed');
    const userId = created.record.user.id;
    const { record, secret } = await mintDaemonAuthToken({ label: 'alice laptop', userId });
    expect(record.userId).toBe(userId);
    const result = await validateDaemonAuthToken(secret);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.userId).toBe(userId);
  });

  it('an unbound token validates with no userId', async () => {
    const { secret } = await mintDaemonAuthToken({ label: 'solo' });
    const result = await validateDaemonAuthToken(secret);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.userId).toBeUndefined();
  });

  describe('findDaemonUserByEmail', () => {
    it('finds a record case-insensitively and returns deactivated ones too', async () => {
      const created = await createDaemonUser({ displayName: 'Alice', email: 'Alice@openheaders.io' });
      expect(created.ok).toBe(true);
      if (!created.ok) return;
      const found = await findDaemonUserByEmail('alice@OPENHEADERS.IO');
      expect(found?.user.id).toBe(created.record.user.id);
      await deactivateDaemonUser(created.record.user.id);
      const foundAfter = await findDaemonUserByEmail('alice@openheaders.io');
      expect(foundAfter?.user.id).toBe(created.record.user.id);
      expect(foundAfter?.deactivatedAt).not.toBeNull();
    });

    it('prefers the active holder when a deactivated record shares the email', async () => {
      const first = await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io' });
      if (!first.ok) throw new Error('setup failed');
      await deactivateDaemonUser(first.record.user.id);
      const again = await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io' });
      if (!again.ok) throw new Error('setup failed');
      const found = await findDaemonUserByEmail('alice@openheaders.io');
      expect(found?.user.id).toBe(again.record.user.id);
      expect(found?.deactivatedAt).toBeNull();
    });

    it('returns null for unknown, empty, and local-kind identities', async () => {
      await createDaemonUser({ displayName: 'NoMail' });
      expect(await findDaemonUserByEmail('nobody@openheaders.io')).toBeNull();
      expect(await findDaemonUserByEmail('   ')).toBeNull();
    });
  });

  describe('resolveDaemonPeerUser', () => {
    it('resolves an unbound token to the daemon operator', async () => {
      const identity = await hostStorage.get(OH.syntheticIdentity);
      const resolved = await resolveDaemonPeerUser(undefined);
      expect(resolved.ok).toBe(true);
      if (resolved.ok) expect(resolved.userId).toBe(identity?.user.id);
    });

    it('resolves a bound token to the directory user', async () => {
      const created = await createDaemonUser({ displayName: 'Alice' });
      if (!created.ok) throw new Error('setup failed');
      const resolved = await resolveDaemonPeerUser(created.record.user.id);
      expect(resolved).toEqual({ ok: true, userId: created.record.user.id, displayName: 'Alice' });
    });

    it('refuses a deactivated user', async () => {
      const created = await createDaemonUser({ displayName: 'Alice' });
      if (!created.ok) throw new Error('setup failed');
      await deactivateDaemonUser(created.record.user.id);
      expect(await resolveDaemonPeerUser(created.record.user.id)).toEqual({ ok: false, reason: 'user-deactivated' });
    });

    it('refuses a binding that matches no directory record', async () => {
      expect(await resolveDaemonPeerUser('01890000-0000-7000-8000-000000000000')).toEqual({
        ok: false,
        reason: 'unknown-user',
      });
    });
  });
});
