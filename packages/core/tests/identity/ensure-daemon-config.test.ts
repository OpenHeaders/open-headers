/**
 * Coverage for `ensureDaemonConfig` — the host-neutral entry point for
 * minting + persisting `hostInstallId` (U1.4 per UNIFIED_ORACLE_STATUS.md).
 *
 * Uses the shared in-memory `HostStorage` fake so the test exercises the
 * real proxy + key plumbing without coupling to any host's storage
 * adapter.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { ensureDaemonConfig } from '../../src/identity';
import { hostStorage, setHostStorage } from '../../src/storage/host-storage';
import { OH } from '../../src/storage/keys';
import { createHostStorageFake, type HostStorageFake } from './_host-storage-fake';

describe('ensureDaemonConfig', () => {
  let fake: HostStorageFake;

  beforeEach(() => {
    fake = createHostStorageFake();
    setHostStorage(fake);
  });

  it('mints + persists a hostInstallId on first boot', async () => {
    const cfg = await ensureDaemonConfig();
    expect(typeof cfg.hostInstallId).toBe('string');
    expect(cfg.hostInstallId.length).toBeGreaterThan(0);
    const persisted = await hostStorage.get(OH.daemonConfig);
    expect(persisted).toEqual(cfg);
  });

  it('returns the persisted record on subsequent calls (idempotent)', async () => {
    const first = await ensureDaemonConfig();
    const second = await ensureDaemonConfig();
    expect(second).toEqual(first);
    expect(second.hostInstallId).toBe(first.hostInstallId);
  });

  it('does not re-mint when a config already exists in storage', async () => {
    await hostStorage.set(OH.daemonConfig, { hostInstallId: 'preexisting-host-id' });
    const cfg = await ensureDaemonConfig();
    expect(cfg.hostInstallId).toBe('preexisting-host-id');
  });

  it('distinct hosts (fresh storages) mint distinct ids', async () => {
    const first = await ensureDaemonConfig();
    // Simulate a different host with a fresh storage backend.
    setHostStorage(createHostStorageFake());
    const second = await ensureDaemonConfig();
    expect(second.hostInstallId).not.toBe(first.hostInstallId);
  });
});
