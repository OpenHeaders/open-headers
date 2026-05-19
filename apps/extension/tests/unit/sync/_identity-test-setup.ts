/**
 * Shared test helper — install a synthetic identity + LocalAdmin WRA so
 * tests that exercise the gated `dispatchSyncRpc` surface (Phase U2) can
 * pass the resolver check without each suite re-implementing the
 * `HostStorage` fake + bootstrap dance.
 *
 * Returns a teardown that clears the snapshot and storage. Tests must
 * call this in `beforeEach` and the returned function in `afterEach`.
 */

import {
  clearIdentitySnapshot,
  ensureSyntheticIdentity,
  ensureWorkspaceRoleAssignments,
  refreshIdentitySnapshotFromHostStorage,
} from '@openheaders/core/identity';
import { setHostStorage, type HostStorage } from '@openheaders/core/storage';

const NOW = '2026-05-19T00:00:00.000Z';

function createHostStorageFake(): HostStorage {
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

export async function installSyntheticIdentityForTests(workspaceIds: readonly string[] = []): Promise<() => void> {
  clearIdentitySnapshot();
  setHostStorage(createHostStorageFake());
  await ensureSyntheticIdentity({ now: NOW });
  if (workspaceIds.length > 0) {
    await ensureWorkspaceRoleAssignments([...workspaceIds]);
  }
  await refreshIdentitySnapshotFromHostStorage();
  return () => {
    clearIdentitySnapshot();
  };
}
