/**
 * Org branding — the custom logo (`setHomeOrgLogo`) and the stamped
 * host OS (`ensureSyntheticIdentity.hostOs`).
 *
 * Pinned invariants:
 *   - `setHomeOrgLogo` validates BEFORE persisting — an invalid data
 *     URI never reaches storage; `null` clears the field entirely.
 *   - `hostOs` is machine-derived: re-stamped on every boot rather than
 *     frozen at first mint, and dropped from nothing (absent input on a
 *     record without one is a no-op).
 *   - A joined Org's logo/hostOs drift-updates in place on reconnect —
 *     the same branch that catches a backend rename.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearIdentitySnapshot,
  ensureSyntheticIdentity,
  getIdentitySnapshot,
  recordJoinedOrg,
  refreshIdentitySnapshotFromHostStorage,
  setHomeOrgLogo,
} from '../../src/identity';
import { hostStorage, setHostStorage } from '../../src/storage/host-storage';
import { OH } from '../../src/storage/keys';
import type { BackendConnection, Org } from '../../src/types';
import { createHostStorageFake } from './_host-storage-fake';

const NOW = '2026-07-11T00:00:00.000Z';

const PNG_LOGO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const BACKEND_ID = '01900000-0000-7000-8000-00000000aaaa';

const DAEMON_ORG: Org = {
  id: '01900000-0000-7000-8000-0000000000bb',
  name: 'oh-ubuntu-s-4vcpu-8gb-240gb-intel-fra1',
  hostKind: 'daemon',
  isPrivate: false,
};

function makeBackend(id: string): BackendConnection {
  return {
    id,
    label: '',
    url: 'ws://127.0.0.1:8137',
    authToken: '',
    autoConnect: true,
    enabled: true,
    addedAt: NOW,
    lastConnectedAt: null,
  };
}

beforeEach(() => {
  setHostStorage(createHostStorageFake());
  clearIdentitySnapshot();
});

describe('setHomeOrgLogo', () => {
  it('persists a valid logo and refreshes the snapshot', async () => {
    const record = await ensureSyntheticIdentity({ hostKind: 'daemon', orgName: 'HQ', now: NOW });
    await refreshIdentitySnapshotFromHostStorage();

    const result = await setHomeOrgLogo(PNG_LOGO);
    expect(result).toEqual({ ok: true });
    expect((await hostStorage.get(OH.syntheticIdentity))?.org.logo).toBe(PNG_LOGO);
    expect(getIdentitySnapshot()?.orgs.get(record.org.id)?.logo).toBe(PNG_LOGO);
  });

  it('rejects an invalid candidate without writing', async () => {
    await ensureSyntheticIdentity({ hostKind: 'daemon', orgName: 'HQ', now: NOW });
    const result = await setHomeOrgLogo('data:image/gif;base64,AAAA');
    expect(result).toEqual({ ok: false, reason: 'unsupported-format' });
    expect((await hostStorage.get(OH.syntheticIdentity))?.org.logo).toBeUndefined();
  });

  it('clears the logo with null', async () => {
    await ensureSyntheticIdentity({ hostKind: 'daemon', orgName: 'HQ', now: NOW });
    await setHomeOrgLogo(PNG_LOGO);
    const result = await setHomeOrgLogo(null);
    expect(result).toEqual({ ok: true });
    const stored = await hostStorage.get(OH.syntheticIdentity);
    expect(stored?.org.logo).toBeUndefined();
    expect(stored && 'logo' in stored.org).toBe(false);
  });

  it('reports no-identity before bootstrap', async () => {
    expect(await setHomeOrgLogo(PNG_LOGO)).toEqual({ ok: false, reason: 'no-identity' });
  });
});

describe('ensureSyntheticIdentity hostOs', () => {
  it('stamps hostOs on first boot', async () => {
    const record = await ensureSyntheticIdentity({ hostKind: 'daemon', orgName: 'VM', hostOs: 'ubuntu', now: NOW });
    expect(record.org.hostOs).toBe('ubuntu');
    expect((await hostStorage.get(OH.syntheticIdentity))?.org.hostOs).toBe('ubuntu');
  });

  it('re-stamps a changed hostOs on a later boot, preserving everything else', async () => {
    const first = await ensureSyntheticIdentity({ hostKind: 'daemon', orgName: 'VM', hostOs: 'ubuntu', now: NOW });
    await setHomeOrgLogo(PNG_LOGO);
    const second = await ensureSyntheticIdentity({ hostKind: 'daemon', orgName: 'VM', hostOs: 'debian', now: NOW });
    expect(second.org.hostOs).toBe('debian');
    expect(second.org.id).toBe(first.org.id);
    expect(second.org.logo).toBe(PNG_LOGO);
  });

  it('leaves the record untouched when hostOs is absent or unchanged', async () => {
    const first = await ensureSyntheticIdentity({ hostKind: 'daemon', orgName: 'VM', hostOs: 'ubuntu', now: NOW });
    expect(await ensureSyntheticIdentity({ hostKind: 'daemon', now: NOW })).toEqual(first);
    expect(await ensureSyntheticIdentity({ hostKind: 'daemon', hostOs: 'ubuntu', now: NOW })).toEqual(first);
  });
});

describe('joined-org branding drift', () => {
  it('drift-updates a joined Org whose logo or hostOs changed on reconnect', async () => {
    await ensureSyntheticIdentity({ hostKind: 'browser', orgName: 'Chrome', now: NOW });
    await hostStorage.set(OH.backends, [makeBackend(BACKEND_ID)]);

    await recordJoinedOrg(DAEMON_ORG, BACKEND_ID);
    let snapshot = getIdentitySnapshot();
    expect(snapshot?.orgs.get(DAEMON_ORG.id)?.logo).toBeUndefined();

    // The backend admin sets a logo + the daemon stamps its OS; the next
    // reconnect's WELCOME re-delivers the Org row.
    const rebranded: Org = { ...DAEMON_ORG, logo: PNG_LOGO, hostOs: 'ubuntu' };
    const { firstJoin } = await recordJoinedOrg(rebranded, BACKEND_ID);
    expect(firstJoin).toBe(false);

    snapshot = getIdentitySnapshot();
    expect(snapshot?.orgs.get(DAEMON_ORG.id)?.logo).toBe(PNG_LOGO);
    expect(snapshot?.orgs.get(DAEMON_ORG.id)?.hostOs).toBe('ubuntu');
  });
});
