/**
 * Coverage for `ensureSyntheticIdentity` — the host-neutral composition
 * helper that every host calls once at boot (U1.6 / U1.7 per
 * UNIFIED_ORACLE_STATUS.md).
 *
 * Pinned invariants:
 *   - First boot mints `OH.daemonConfig` + persists `OH.syntheticIdentity`;
 *     the persisted record matches the helper's return value.
 *   - Subsequent calls are pure reads — no re-mint, no re-derive — and
 *     return the persisted record bit-identically.
 *   - The persisted record passes the `SyntheticIdentityRecordSchema`
 *     boundary so a later boot loading via `hostStorage.getValidated`
 *     never trips a schema error.
 *   - First-boot inputs (`displayName`, `orgName`, `email`, `now`) flow
 *     into the persisted record; subsequent calls ignore them (the
 *     persisted record wins — promotion is the only mutation path).
 */

import * as v from 'valibot';
import { beforeEach, describe, expect, it } from 'vitest';
import { ensureSyntheticIdentity } from '../../src/identity';
import { SyntheticIdentityRecordSchema } from '../../src/schemas';
import { hostStorage, setHostStorage } from '../../src/storage/host-storage';
import { OH } from '../../src/storage/keys';
import { createHostStorageFake, type HostStorageFake } from './_host-storage-fake';

const NOW = '2026-05-19T00:00:00.000Z';

describe('ensureSyntheticIdentity', () => {
  let fake: HostStorageFake;

  beforeEach(() => {
    fake = createHostStorageFake();
    setHostStorage(fake);
  });

  it('mints + persists daemonConfig and syntheticIdentity on first boot', async () => {
    const record = await ensureSyntheticIdentity({ now: NOW });
    const cfg = await hostStorage.get(OH.daemonConfig);
    const persisted = await hostStorage.get(OH.syntheticIdentity);
    expect(cfg?.hostInstallId).toBeTruthy();
    expect(persisted).toEqual(record);
  });

  it('persisted record passes the SyntheticIdentityRecordSchema boundary', async () => {
    const record = await ensureSyntheticIdentity({ now: NOW });
    expect(v.safeParse(SyntheticIdentityRecordSchema, record).success).toBe(true);
  });

  it('is idempotent across boots (subsequent calls return persisted record)', async () => {
    const first = await ensureSyntheticIdentity({ now: NOW });
    const second = await ensureSyntheticIdentity({ now: NOW });
    expect(second).toEqual(first);
  });

  it('threads first-boot inputs into the persisted record', async () => {
    const r = await ensureSyntheticIdentity({
      displayName: 'Alice',
      orgName: 'alice-laptop',
      email: 'alice@openheaders.io',
      now: NOW,
    });
    expect(r.user.displayName).toBe('Alice');
    expect(r.org.name).toBe('alice-laptop');
    expect(r.userIdentity.value).toBe('alice@openheaders.io');
    expect(r.userIdentity.verifiedAt).toBe(NOW);
    expect(r.session.createdAt).toBe(NOW);
  });

  it('ignores inputs on subsequent calls — persisted record wins', async () => {
    const first = await ensureSyntheticIdentity({ displayName: 'Alice', now: NOW });
    const second = await ensureSyntheticIdentity({ displayName: 'Bob', now: '2027-01-01T00:00:00.000Z' });
    expect(second).toEqual(first);
    expect(second.user.displayName).toBe('Alice');
  });

  it('defaults `now` to a real timestamp when omitted', async () => {
    const before = Date.now();
    const r = await ensureSyntheticIdentity();
    const after = Date.now();
    const ts = Date.parse(r.session.createdAt);
    expect(Number.isNaN(ts)).toBe(false);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('uses the hostInstallId from the persisted daemonConfig (deterministic in it)', async () => {
    await hostStorage.set(OH.daemonConfig, { hostInstallId: 'pinned-host-id' });
    const r1 = await ensureSyntheticIdentity({ now: NOW });
    // Clear only the synthetic-identity record; daemonConfig stays.
    await hostStorage.remove(OH.syntheticIdentity);
    const r2 = await ensureSyntheticIdentity({ now: NOW });
    // Same hostInstallId → same row UUIDs (deterministic). User-visible
    // fields seeded from the second call's input (the record was rebuilt).
    expect(r2.user.id).toBe(r1.user.id);
    expect(r2.org.id).toBe(r1.org.id);
    expect(r2.principal.id).toBe(r1.principal.id);
  });
});
