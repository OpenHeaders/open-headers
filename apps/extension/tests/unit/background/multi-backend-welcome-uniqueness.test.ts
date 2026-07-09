/**
 * Multi-Backend Phase 2 — the Org-uniqueness guard at WELCOME
 * (MULTI_BACKEND_PLAN.md §2): an Org is authoritative on exactly one
 * backend. A WELCOME from wire B claiming an Org already bound to
 * still-present wire A is refused — the binding never moves, the join
 * is never double-consumed. A binding whose record was deleted is stale
 * and rebinds.
 *
 * The initiator is mocked to capture each wire's `onJoinedOrg`; the
 * identity registry (claimJoinedOrg, bindings mirror) runs for real on
 * the shared host-storage fake, so this pins the exact production path
 * a WELCOME takes.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Capture each wire's initiator config keyed by the HELLO auth-token
// closure identity — simplest is capture-in-order.
type OnJoinedOrg = (org: unknown, backendActiveWorkspaceId?: string) => Promise<void>;
const capturedConfigs: Array<{ onJoinedOrg?: OnJoinedOrg }> = [];

vi.mock('@openheaders/oracle/sync/client/sync-handshake-initiator', () => ({
  createSyncHandshakeInitiator: (config: { onJoinedOrg?: OnJoinedOrg }) => {
    capturedConfigs.push(config);
    return { refreshFanOut: vi.fn(), reset: vi.fn() };
  },
}));

vi.mock('@openheaders/oracle/sync/client/mutation-forwarder', () => ({
  applyPeerStateVectorToPendingOut: vi.fn(async () => {}),
  flushPendingOutToBackend: vi.fn(async () => {}),
}));
vi.mock('@openheaders/oracle/sync/snapshot-applier', () => ({ applyWorkspaceSnapshot: vi.fn() }));
vi.mock('@openheaders/oracle/sync/state-vector-reader', () => ({ readWorkspaceStateVector: vi.fn() }));
vi.mock('@openheaders/oracle/sync/service', () => ({
  getOrCreateWorkspaceService: () => ({ context: { nodeId: 'n', next: () => ({}) }, hydrated: Promise.resolve() }),
  releaseWorkspaceService: vi.fn(),
}));
vi.mock('@openheaders/oracle/workspace/extension-workspace-store', () => ({
  getWorkspace: () => null,
  listWorkspaces: () => [],
  peekActiveWorkspaceId: () => null,
  setActiveWorkspaceById: vi.fn(async () => {}),
}));

import { clearIdentitySnapshot, ensureSyntheticIdentity, getOrgBackendBindings } from '@openheaders/core/identity';
import { HANDSHAKE_ROLES } from '@openheaders/core/protocol';
import { hostStorage, OH, setHostStorage } from '@openheaders/core/storage';
import type { BackendConnection, Org } from '@openheaders/core/types';
import type { BackendWireHandle } from '@openheaders/oracle/sync/client/backend-connection-manager';
import { createSyncHandshakeForWire } from '@openheaders/oracle/sync/client/backend-wire-handshake';

const WIRE_DEPS = {
  role: HANDSHAKE_ROLES.EXTENSION,
  getAgent: () => '@openheaders/extension@0.0.0',
} as const;

const NOW = '2026-07-08T00:00:00.000Z';
const BACKEND_A = 'backend-aaaa';
const BACKEND_B = 'backend-bbbb';

const ORG: Org = { id: 'org-shared', name: 'Shared Org', hostKind: 'desktop', isPrivate: false };
const OTHER_ORG: Org = { id: 'org-other', name: 'Other Org', hostKind: 'desktop', isPrivate: false };

function makeRecord(id: string): BackendConnection {
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

function makeWire(backendId: string): BackendWireHandle {
  return {
    backendId,
    record: () => makeRecord(backendId),
    isLoopback: () => true,
    isConnected: () => true,
    send: () => true,
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

/** The captured `onJoinedOrg` of the most recently created wire. */
function joinedOrgOf(index: number): OnJoinedOrg {
  const cb = capturedConfigs[index]?.onJoinedOrg;
  if (!cb) throw new Error('initiator config not captured');
  return cb;
}

beforeEach(async () => {
  capturedConfigs.length = 0;
  clearIdentitySnapshot();
  setHostStorage(createHostStorageFake());
  await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
  await hostStorage.set(OH.backends, [makeRecord(BACKEND_A), makeRecord(BACKEND_B)]);
});

describe('WELCOME Org-uniqueness guard (per-wire onJoinedOrg)', () => {
  it('refuses a WELCOME claiming an Org bound to a different backend — the binding never moves', async () => {
    createSyncHandshakeForWire(makeWire(BACKEND_A), WIRE_DEPS);
    createSyncHandshakeForWire(makeWire(BACKEND_B), WIRE_DEPS);

    await joinedOrgOf(0)(ORG); // A joins first
    expect(getOrgBackendBindings().get(ORG.id)).toBe(BACKEND_A);

    await joinedOrgOf(1)(ORG); // B's WELCOME claims the same Org
    expect(getOrgBackendBindings().get(ORG.id)).toBe(BACKEND_A);
    expect((await hostStorage.get(OH.joinedOrgs))?.map((r) => r.backendId)).toEqual([BACKEND_A]);
    // The refusal also lands durably — one (backendId, orgId) row the
    // connections list renders under B until the conflict resolves.
    const conflicts = (await hostStorage.get(OH.backendOrgConflicts)) ?? [];
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      backendId: BACKEND_B,
      orgId: ORG.id,
      orgName: ORG.name,
      boundBackendId: BACKEND_A,
    });
  });

  it('accepts distinct Orgs on distinct wires', async () => {
    createSyncHandshakeForWire(makeWire(BACKEND_A), WIRE_DEPS);
    createSyncHandshakeForWire(makeWire(BACKEND_B), WIRE_DEPS);

    await joinedOrgOf(0)(ORG);
    await joinedOrgOf(1)(OTHER_ORG);

    expect(getOrgBackendBindings().get(ORG.id)).toBe(BACKEND_A);
    expect(getOrgBackendBindings().get(OTHER_ORG.id)).toBe(BACKEND_B);
  });

  it('rebinds when the previously-bound record was deleted (stale binding, legitimate re-join)', async () => {
    createSyncHandshakeForWire(makeWire(BACKEND_A), WIRE_DEPS);
    createSyncHandshakeForWire(makeWire(BACKEND_B), WIRE_DEPS);

    await joinedOrgOf(0)(ORG);
    // B's claim while A is present is refused and recorded durably.
    await joinedOrgOf(1)(ORG);
    expect((await hostStorage.get(OH.backendOrgConflicts)) ?? []).toHaveLength(1);
    // A's record is removed (Phase-3 remove flow); B later serves the Org.
    await hostStorage.set(OH.backends, [makeRecord(BACKEND_B)]);
    await joinedOrgOf(1)(ORG);

    expect(getOrgBackendBindings().get(ORG.id)).toBe(BACKEND_B);
    // The successful claim resolves B's durable conflict row.
    expect((await hostStorage.get(OH.backendOrgConflicts)) ?? []).toHaveLength(0);
  });

  it('a reconnect re-sending WELCOME over the same wire stays idempotent', async () => {
    createSyncHandshakeForWire(makeWire(BACKEND_A), WIRE_DEPS);
    await joinedOrgOf(0)(ORG);
    await joinedOrgOf(0)(ORG);
    expect((await hostStorage.get(OH.joinedOrgs))?.length).toBe(1);
    expect(getOrgBackendBindings().get(ORG.id)).toBe(BACKEND_A);
  });
});
