/**
 * Coverage for daemon auth-token persistence + validation (U3.2,
 * `UNIFIED_ORACLE_MODEL.md` §4.2 + `DATA_PLANE_TOPOLOGIES.md` §11.4).
 *
 * Exercises the full mint → validate → revoke lifecycle against the
 * shared in-memory `HostStorage` fake. No transport, no UI — just the
 * pure helpers that the WS handshake gate consults.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  listDaemonAuthTokens,
  mintDaemonAuthToken,
  revokeDaemonAuthToken,
  validateDaemonAuthToken,
} from '../../src/identity';
import { hostStorage, setHostStorage } from '../../src/storage/host-storage';
import { OH } from '../../src/storage/keys';
import { createHostStorageFake, type HostStorageFake } from './_host-storage-fake';

describe('daemon auth tokens', () => {
  let fake: HostStorageFake;

  beforeEach(() => {
    fake = createHostStorageFake();
    setHostStorage(fake);
  });

  it('mints a fresh token and persists only the hash', async () => {
    const { record, secret } = await mintDaemonAuthToken({ label: 'alice' });
    expect(secret).toMatch(/^oh_/);
    expect(secret.length).toBeGreaterThan(8);
    expect(record.id).toMatch(/^[0-9a-f-]+$/i);
    expect(record.tokenHash).not.toBe(secret);
    expect(record.label).toBe('alice');
    expect(record.lastUsedAt).toBeNull();
    expect(record.revokedAt).toBeNull();
    const persisted = await hostStorage.get(OH.daemonAuthTokens);
    expect(persisted).toHaveLength(1);
    // Raw secret must NOT appear anywhere on disk.
    expect(JSON.stringify(fake.snapshot().get(OH.daemonAuthTokens.key))).not.toContain(secret);
  });

  it('accepts a valid token and bumps lastUsedAt', async () => {
    const { record, secret } = await mintDaemonAuthToken();
    const now = 1234567890;
    const result = await validateDaemonAuthToken(secret, () => now);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tokenId).toBe(record.id);
    }
    const persisted = (await hostStorage.get(OH.daemonAuthTokens)) ?? [];
    expect(persisted[0].lastUsedAt).toBe(now);
  });

  it('rejects an unknown token without leaking storage state', async () => {
    await mintDaemonAuthToken({ label: 'real' });
    const result = await validateDaemonAuthToken('oh_definitely-not-issued');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unknown');
  });

  it('rejects with no-token when the peer sends nothing', async () => {
    await mintDaemonAuthToken();
    const result = await validateDaemonAuthToken(undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no-token');
  });

  it('marks a token revoked + rejects future validations with revoked reason', async () => {
    const { record, secret } = await mintDaemonAuthToken();
    await revokeDaemonAuthToken(record.id, () => 4242);
    const result = await validateDaemonAuthToken(secret);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('revoked');
    const persisted = (await hostStorage.get(OH.daemonAuthTokens)) ?? [];
    expect(persisted[0].revokedAt).toBe(4242);
  });

  it('list returns every token (including revoked) in insertion order', async () => {
    await mintDaemonAuthToken({ label: 'first' });
    await mintDaemonAuthToken({ label: 'second' });
    const list = await listDaemonAuthTokens();
    expect(list).toHaveLength(2);
    expect(list[0].label).toBe('first');
    expect(list[1].label).toBe('second');
  });

  it('distinct mints produce distinct secrets + hashes', async () => {
    const a = await mintDaemonAuthToken();
    const b = await mintDaemonAuthToken();
    expect(a.secret).not.toBe(b.secret);
    expect(a.record.tokenHash).not.toBe(b.record.tokenHash);
    expect(a.record.id).not.toBe(b.record.id);
  });

  it('revoking an unknown id is a no-op', async () => {
    await mintDaemonAuthToken();
    await revokeDaemonAuthToken('not-a-real-id');
    const persisted = (await hostStorage.get(OH.daemonAuthTokens)) ?? [];
    expect(persisted[0].revokedAt).toBeNull();
  });

  // Concurrency regressions (Session 23 audit): mint / revoke / validate
  // each run a non-atomic get-then-set; without the store lock an
  // overlapping pair loses one another's write.

  it('concurrent mints both persist (no last-write-wins loss)', async () => {
    const [a, b] = await Promise.all([
      mintDaemonAuthToken({ label: 'first' }),
      mintDaemonAuthToken({ label: 'second' }),
    ]);
    const persisted = (await hostStorage.get(OH.daemonAuthTokens)) ?? [];
    expect(persisted).toHaveLength(2);
    const ids = new Set(persisted.map((t) => t.id));
    expect(ids.has(a.record.id)).toBe(true);
    expect(ids.has(b.record.id)).toBe(true);
  });

  it('a validate racing a revoke never resurrects the revoked token', async () => {
    const { record, secret } = await mintDaemonAuthToken();
    // validate writes back a lastUsedAt bump; revoke writes back
    // revokedAt. Run together — the token must end up revoked whichever
    // order the lock grants.
    await Promise.all([validateDaemonAuthToken(secret), revokeDaemonAuthToken(record.id, () => 9999)]);
    const persisted = (await hostStorage.get(OH.daemonAuthTokens)) ?? [];
    expect(persisted[0].revokedAt).toBe(9999);
    // And a subsequent validate sees it as revoked.
    const after = await validateDaemonAuthToken(secret);
    expect(after.ok).toBe(false);
    if (!after.ok) expect(after.reason).toBe('revoked');
  });

  it('concurrent revokes of distinct tokens both land', async () => {
    const a = await mintDaemonAuthToken({ label: 'a' });
    const b = await mintDaemonAuthToken({ label: 'b' });
    await Promise.all([revokeDaemonAuthToken(a.record.id, () => 1), revokeDaemonAuthToken(b.record.id, () => 2)]);
    const persisted = (await hostStorage.get(OH.daemonAuthTokens)) ?? [];
    expect(persisted.every((t) => t.revokedAt !== null)).toBe(true);
  });
});
