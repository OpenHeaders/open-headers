/**
 * Coverage for the backend-connection registry (`OH.backends`,
 * MULTI_BACKEND_PLAN.md §2 / Phase 1) — the persisted list, its
 * in-memory mirror, and the cap-1 `updatePrimaryBackend` writer.
 *
 * Pinned invariants:
 *   - The mirror notifies only on real change and keeps the prior array
 *     reference on a redundant install, so a repeat refresh can never
 *     re-dial a healthy socket or destabilize a React snapshot read.
 *   - `updatePrimaryBackend` creates entry #0 with safe defaults
 *     (loopback URL, unpaired, autoConnect on, DISABLED) and patches it
 *     in place afterwards, preserving `id` / `addedAt`.
 *   - Read-modify-write cycles are serialized — concurrent patches both
 *     land, last writer per field wins, nothing is clobbered.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  __clearBackendsForTests,
  getBackends,
  getPrimaryBackend,
  isLoopbackBackendUrl,
  refreshBackendsFromHostStorage,
  subscribeBackends,
  updatePrimaryBackend,
} from '../../src/backends';
import { hostStorage, setHostStorage } from '../../src/storage/host-storage';
import { OH } from '../../src/storage/keys';
import type { BackendConnection } from '../../src/types';
import { createHostStorageFake, type HostStorageFake } from '../identity/_host-storage-fake';

const STORED: BackendConnection = {
  id: '01900000-0000-7000-8000-0000000000aa',
  label: 'Desk',
  url: 'ws://127.0.0.1:8137',
  authToken: 'secret',
  autoConnect: true,
  enabled: true,
  addedAt: '2026-07-01T00:00:00.000Z',
  lastConnectedAt: null,
};

describe('backends registry — mirror + cap-1 writer', () => {
  let fake: HostStorageFake;

  beforeEach(() => {
    fake = createHostStorageFake();
    setHostStorage(fake);
    __clearBackendsForTests();
  });

  it('starts empty and hydrates the mirror from host storage', async () => {
    expect(getPrimaryBackend()).toBeNull();
    await hostStorage.set(OH.backends, [STORED]);
    await refreshBackendsFromHostStorage();
    expect(getPrimaryBackend()).toEqual(STORED);
  });

  it('notifies subscribers on change only, keeping the array reference stable otherwise', async () => {
    await hostStorage.set(OH.backends, [STORED]);
    let fired = 0;
    subscribeBackends(() => {
      fired += 1;
    });
    await refreshBackendsFromHostStorage();
    expect(fired).toBe(1);
    const first = getBackends();
    // Redundant refresh: same persisted content — no notify, same ref.
    await refreshBackendsFromHostStorage();
    expect(fired).toBe(1);
    expect(getBackends()).toBe(first);
  });

  it('updatePrimaryBackend creates entry #0 with defaults on first write', async () => {
    const created = await updatePrimaryBackend({ url: 'ws://127.0.0.1:9000' });
    expect(created.url).toBe('ws://127.0.0.1:9000');
    // Defaults: unpaired, autoConnect on, disabled until a switch enables it.
    expect(created.authToken).toBe('');
    expect(created.autoConnect).toBe(true);
    expect(created.enabled).toBe(false);
    expect(created.lastConnectedAt).toBeNull();
    expect(created.id.length).toBeGreaterThan(0);
    expect(await hostStorage.get(OH.backends)).toEqual([created]);
    expect(getPrimaryBackend()).toEqual(created);
  });

  it('updatePrimaryBackend patches in place, preserving id and addedAt', async () => {
    await hostStorage.set(OH.backends, [STORED]);
    await refreshBackendsFromHostStorage();
    const next = await updatePrimaryBackend({ enabled: false, authToken: 'rotated' });
    expect(next).toEqual({ ...STORED, enabled: false, authToken: 'rotated' });
    expect(await hostStorage.get(OH.backends)).toEqual([next]);
  });

  it('leaves entries beyond #0 untouched (cap-1 writer, N-record store)', async () => {
    const second: BackendConnection = { ...STORED, id: '01900000-0000-7000-8000-0000000000bb', label: 'LAN' };
    await hostStorage.set(OH.backends, [STORED, second]);
    await refreshBackendsFromHostStorage();
    await updatePrimaryBackend({ label: 'Primary' });
    const stored = (await hostStorage.get(OH.backends)) ?? [];
    expect(stored[0].label).toBe('Primary');
    expect(stored[1]).toEqual(second);
  });

  it('serializes concurrent patches — both land on the same record', async () => {
    await hostStorage.set(OH.backends, [STORED]);
    await refreshBackendsFromHostStorage();
    await Promise.all([updatePrimaryBackend({ authToken: 'tok' }), updatePrimaryBackend({ enabled: false })]);
    const stored = (await hostStorage.get(OH.backends)) ?? [];
    expect(stored).toHaveLength(1);
    expect(stored[0].authToken).toBe('tok');
    expect(stored[0].enabled).toBe(false);
    expect(stored[0].id).toBe(STORED.id);
  });

  it('classifies loopback URLs', () => {
    expect(isLoopbackBackendUrl('ws://127.0.0.1:8137')).toBe(true);
    expect(isLoopbackBackendUrl('ws://localhost:8137')).toBe(true);
    expect(isLoopbackBackendUrl('ws://[::1]:8137')).toBe(true);
    expect(isLoopbackBackendUrl('ws://192.168.1.20:8137')).toBe(false);
    expect(isLoopbackBackendUrl('wss://oh.openheaders.io')).toBe(false);
    expect(isLoopbackBackendUrl('')).toBe(false);
    expect(isLoopbackBackendUrl('not a url')).toBe(false);
  });
});
