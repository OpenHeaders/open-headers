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
  recordJoinedOrg,
  refreshIdentitySnapshotFromHostStorage,
} from '@openheaders/core/identity';
import { type HostStorage, hostStorage, OH, setHostStorage } from '@openheaders/core/storage';
import type { BackendConnection, Org } from '@openheaders/core/types';

const NOW = '2026-05-19T00:00:00.000Z';

/** The `OH.backends` record test joins bind to (fold-by-presence). */
export const TEST_BACKEND_ID = '01900000-0000-7000-8000-00000000feed';

/** A join seeded against a specific backend record (multi-backend cases). */
export interface JoinedOrgSeed {
  org: Org;
  backendId: string;
}

export function makeTestBackend(overrides: Partial<BackendConnection> = {}): BackendConnection {
  return {
    id: TEST_BACKEND_ID,
    label: '',
    url: 'ws://127.0.0.1:8137',
    authToken: '',
    autoConnect: true,
    enabled: true,
    addedAt: NOW,
    lastConnectedAt: null,
    ...overrides,
  };
}

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

export async function installSyntheticIdentityForTests(
  workspaceIds: readonly string[] = [],
  joinedOrgs: readonly (Org | JoinedOrgSeed)[] = [],
): Promise<() => void> {
  clearIdentitySnapshot();
  setHostStorage(createHostStorageFake());
  await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
  if (workspaceIds.length > 0) {
    await ensureWorkspaceRoleAssignments([...workspaceIds]);
  }
  // Phase U5.2 — fold in Orgs joined from other backends so tests can
  // exercise the consumed-Org transport paths (outbound gate, receiver
  // filter, connection-plane routing). Joins bind to seeded
  // `OH.backends` records — the snapshot refresh folds only Orgs whose
  // backend record exists. A bare `Org` binds to {@link TEST_BACKEND_ID};
  // a {@link JoinedOrgSeed} binds to its own record (multi-backend cases).
  const seeds: JoinedOrgSeed[] = joinedOrgs.map((entry) =>
    'backendId' in entry ? entry : { org: entry, backendId: TEST_BACKEND_ID },
  );
  if (seeds.length > 0) {
    const backendIds = [...new Set(seeds.map((s) => s.backendId))];
    await hostStorage.set(
      OH.backends,
      backendIds.map((id) => makeTestBackend({ id })),
    );
  }
  for (const seed of seeds) {
    await recordJoinedOrg(seed.org, seed.backendId);
  }
  await refreshIdentitySnapshotFromHostStorage();
  return () => {
    clearIdentitySnapshot();
  };
}
