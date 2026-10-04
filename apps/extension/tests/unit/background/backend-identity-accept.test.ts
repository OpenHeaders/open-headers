/**
 * The person's accept of a backend's new identity — forgets the
 * record's previous Org binding (its workspaces stay as local copies)
 * and re-dials the wire so the fresh WELCOME joins the new Org. The
 * identity registry runs for real on a host-storage fake; the manager
 * is mocked at the one seam the accept touches.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const reconnectBackend = vi.fn<(backendId: string) => boolean>();
vi.mock('@openheaders/oracle/sync/client/backend-connection-manager', () => ({
  reconnectBackend: (backendId: string) => reconnectBackend(backendId),
}));

import { clearIdentitySnapshot, ensureSyntheticIdentity, getOrgBackendBindings } from '@openheaders/core/identity';
import { hostStorage, OH, setHostStorage } from '@openheaders/core/storage';
import type { BackendConnection, Org } from '@openheaders/core/types';
import { acceptBackendIdentityChange } from '@openheaders/oracle/sync/client/backend-identity-accept';

const NOW = '2026-10-04T00:00:00.000Z';
const BACKEND_A = 'backend-aaaa';
const BACKEND_B = 'backend-bbbb';
const ORG_A: Org = { id: 'org-a', name: 'Server A', hostKind: 'daemon', isPrivate: false };
const ORG_B: Org = { id: 'org-b', name: 'Server B', hostKind: 'daemon', isPrivate: false };

function makeRecord(id: string): BackendConnection {
  return {
    id,
    label: '',
    url: 'ws://192.168.1.20:8137',
    authToken: 'oh_t',
    autoConnect: true,
    enabled: true,
    addedAt: NOW,
    lastConnectedAt: null,
  };
}

function createHostStorageFake(): Parameters<typeof setHostStorage>[0] {
  const map = new Map<string, unknown>();
  return {
    get: async (spec) => map.get(spec.key) as never,
    getMany: async (specs) => {
      const out: Record<string, unknown> = {};
      for (const [k, spec] of Object.entries(specs)) out[k] = map.get(spec.key);
      return out as never;
    },
    set: async (spec, value) => {
      map.set(spec.key, value);
    },
    setMany: async (writes) => {
      for (const [spec, value] of writes) map.set(spec.key, value);
    },
    remove: async (specs) => {
      const list = Array.isArray(specs) ? specs : [specs];
      for (const spec of list) map.delete(spec.key);
    },
    getValidated: async () => null,
    getValidatedArray: async () => [],
    subscribe: () => () => undefined,
  };
}

beforeEach(async () => {
  reconnectBackend.mockReset();
  clearIdentitySnapshot();
  setHostStorage(createHostStorageFake());
  await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
  await hostStorage.set(OH.backends, [makeRecord(BACKEND_A), makeRecord(BACKEND_B)]);
  await hostStorage.set(OH.joinedOrgs, [
    { org: ORG_A, backendId: BACKEND_A },
    { org: ORG_B, backendId: BACKEND_B },
  ]);
});

describe('acceptBackendIdentityChange', () => {
  it('forgets only the accepted record previous identity and re-dials its wire', async () => {
    reconnectBackend.mockReturnValue(true);
    const result = await acceptBackendIdentityChange(BACKEND_A);

    expect(result).toEqual({ reconnected: true });
    expect(reconnectBackend).toHaveBeenCalledWith(BACKEND_A);
    expect((await hostStorage.get(OH.joinedOrgs))?.map((r) => r.backendId)).toEqual([BACKEND_B]);
    expect(getOrgBackendBindings().has(ORG_A.id)).toBe(false);
    expect(getOrgBackendBindings().get(ORG_B.id)).toBe(BACKEND_B);
  });

  it('reports a record with no live wire as not reconnected, the identity still forgotten', async () => {
    reconnectBackend.mockReturnValue(false);
    const result = await acceptBackendIdentityChange(BACKEND_A);

    expect(result).toEqual({ reconnected: false });
    expect(getOrgBackendBindings().has(ORG_A.id)).toBe(false);
  });
});
