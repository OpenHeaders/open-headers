/**
 * Multi-Backend Phase 2 — the three routing invariants, property-tested
 * over randomized multi-backend scenarios (MULTI_BACKEND_PLAN.md §3):
 *
 *   1. **Outbound (no cross-send)** — an envelope is sent to exactly the
 *      backend whose Org set contains its `orgId`; home-Org envelopes go
 *      to no backend; no envelope ever reaches two backends.
 *   2. **Inbound (no cross-inject)** — a connection's receiver accepts
 *      only envelopes stamped with that backend's Orgs; another
 *      backend's Orgs and the home Org are dropped at the wire.
 *   3. **Pending-out (per-backend flush)** — one log, one cursor per
 *      backend: offline edits flush to their own backend on ITS
 *      reconnect, regardless of any other backend's state, and a flush
 *      never sends another backend's envelopes.
 *
 * The connection manager is mocked down to its routing seams
 * (`sendToBackend` / `isBackendConnected`) with a per-backend recording
 * fake; identity + Org bindings are real (seeded via the shared
 * host-storage fake), so the bindings mirror, the outbound gate, and
 * the receiver gate all run production code.
 */

import { SYNC_MUTATION_TYPE } from '@openheaders/core/protocol';
import { type MutationEnvelope, mintBatch, RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { BackendConnection, Org } from '@openheaders/core/types';
import type { OracleSyncBroadcastEvent } from '@openheaders/oracle/sync';
import {
  __resetMutationStreamBridgeForTests,
  __resetOutboundGateForTests,
  hasRecentlyApplied,
  InMemoryPendingOutQueue,
} from '@openheaders/oracle/sync';
import { __initSyncServiceForTests, dispose as disposeSyncService } from '@openheaders/oracle/sync/service';
import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Per-backend recording wire fake: `connected` gates sends per backend,
// `sent` records every frame with its target.
const connected = new Set<string>();
const sent: Array<{ backendId: string; frame: Record<string, unknown> }> = [];

vi.mock('@/background/websocket', () => ({
  sendToBackend: (backendId: string, frame: Record<string, unknown>) => {
    if (!connected.has(backendId)) return false;
    sent.push({ backendId, frame });
    return true;
  },
  isBackendConnected: (backendId: string) => connected.has(backendId),
}));

import {
  __resetMutationForwarderForTests,
  flushPendingOutToBackend,
  forwardMutationToBackend,
  setPendingOutQueue,
} from '../../../src/background/sync-mutation-forwarder';
import { handleIncomingMutationFrame } from '../../../src/background/sync-mutation-receiver';
import type { BackendWireHandle } from '../../../src/background/websocket';
import { installSyntheticIdentityForTests, type JoinedOrgSeed } from './_identity-test-setup';
import { stressNumRuns } from './property-stress';

const BACKEND_IDS = ['backend-a', 'backend-b', 'backend-c'] as const;
const HOME = 'home' as const;

/** One randomized scenario: which backends exist, which Orgs bind where. */
interface Scenario {
  /** Backends in play (1–3). */
  readonly backendIds: readonly string[];
  /** Org id → owning backend id. */
  readonly orgToBackend: ReadonlyMap<string, string>;
  /** Envelope stamps: each is an Org key — a bound Org or 'home'. */
  readonly envelopeOrgs: readonly (string | typeof HOME)[];
}

const scenarioArb: fc.Arbitrary<Scenario> = fc
  .record({
    backendCount: fc.integer({ min: 1, max: 3 }),
    orgAssignments: fc.array(fc.integer({ min: 0, max: 2 }), { minLength: 1, maxLength: 6 }),
    envelopePicks: fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 12 }),
  })
  .map(({ backendCount, orgAssignments, envelopePicks }) => {
    const backendIds = BACKEND_IDS.slice(0, backendCount);
    const orgToBackend = new Map<string, string>();
    orgAssignments.forEach((pick, i) => {
      orgToBackend.set(`org-${i}`, backendIds[pick % backendIds.length]!);
    });
    const orgKeys = [...orgToBackend.keys()];
    const envelopeOrgs = envelopePicks.map((pick) =>
      pick === orgKeys.length ? HOME : (orgKeys[pick % orgKeys.length] ?? HOME),
    );
    return { backendIds, orgToBackend, envelopeOrgs };
  });

function seedsOf(scenario: Scenario): JoinedOrgSeed[] {
  return [...scenario.orgToBackend].map(([orgId, backendId]) => ({
    org: { id: orgId, name: orgId, hostKind: 'desktop', isPrivate: false } satisfies Org,
    backendId,
  }));
}

let seq = 0;

function makeEvent(orgId: string, ms: number): OracleSyncBroadcastEvent {
  seq += 1;
  return {
    envelope: {
      mutationId: `m-${seq}`,
      hlc: { physicalMs: ms, logical: seq, nodeId: 'sw' },
      origin: { surfaceId: 's', deviceId: 'd' },
      workspaceId: `ws-${orgId}`,
      orgId,
      mutatorVersion: 1,
      body: { kind: 'delete', type: 'rule', id: `r-${seq}` },
    },
    outcome: { status: 'applied' },
  } as OracleSyncBroadcastEvent;
}

let teardownIdentity: () => void = () => undefined;
let homeOrgId = '';

async function installScenario(scenario: Scenario): Promise<void> {
  teardownIdentity();
  teardownIdentity = await installSyntheticIdentityForTests([], seedsOf(scenario));
  const { getIdentitySnapshot } = await import('@openheaders/core/identity');
  homeOrgId = getIdentitySnapshot()?.user.homeOrgId ?? '';
}

const orgIdOf = (scenario: Scenario, key: string | typeof HOME): string => (key === HOME ? homeOrgId : key);

beforeEach(() => {
  connected.clear();
  sent.length = 0;
  seq = 0;
  __resetMutationForwarderForTests();
  __resetOutboundGateForTests();
});

afterEach(() => {
  __resetMutationForwarderForTests();
  __resetOutboundGateForTests();
  teardownIdentity();
  teardownIdentity = (): void => undefined;
});

describe('invariant 1 — outbound: an envelope reaches exactly its Org-bound backend', () => {
  it('routes every live envelope to its binding, home-Org to nowhere, none to two backends', async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArb, async (scenario) => {
        await installScenario(scenario);
        connected.clear();
        for (const id of scenario.backendIds) connected.add(id);
        sent.length = 0;
        seq = 0;

        const events = scenario.envelopeOrgs.map((key, i) => makeEvent(orgIdOf(scenario, key), 1_000 + i));
        for (const event of events) forwardMutationToBackend(event);

        // Every send matches its envelope's binding; each envelope was
        // sent at most once (never to two backends).
        const sendsByMutation = new Map<string, string[]>();
        for (const s of sent) {
          const id = (s.frame.envelope as MutationEnvelope).mutationId;
          sendsByMutation.set(id, [...(sendsByMutation.get(id) ?? []), s.backendId]);
        }
        for (const event of events) {
          const targets = sendsByMutation.get(event.envelope.mutationId) ?? [];
          const bound = scenario.orgToBackend.get(event.envelope.orgId);
          if (!bound) {
            // Home-Org envelope — goes to no backend.
            expect(targets).toEqual([]);
          } else {
            expect(targets).toEqual([bound]);
          }
        }
      }),
      { numRuns: stressNumRuns(48) },
    );
  });
});

describe('invariant 2 — inbound: a connection accepts only its own backend Orgs', () => {
  const RECV_WS = 'ws-inbound-prop';

  function fakeWire(backendId: string): BackendWireHandle {
    return {
      backendId,
      record: () =>
        ({
          id: backendId,
          label: '',
          url: 'ws://127.0.0.1:59210',
          authToken: '',
          autoConnect: true,
          enabled: true,
          addedAt: '2026-07-01T00:00:00.000Z',
          lastConnectedAt: null,
        }) as BackendConnection,
      isLoopback: () => true,
      isConnected: () => true,
      send: () => true,
    };
  }

  it('applies an envelope iff its Org is bound to the delivering connection — home Org never', async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArb, fc.integer({ min: 0, max: 2 }), async (scenario, wirePick) => {
        await installScenario(scenario);
        __initSyncServiceForTests(RECV_WS);
        __resetMutationStreamBridgeForTests();
        try {
          const wireBackendId = scenario.backendIds[wirePick % scenario.backendIds.length]!;
          const wire = fakeWire(wireBackendId);

          for (const [i, key] of scenario.envelopeOrgs.entries()) {
            const orgId = orgIdOf(scenario, key);
            const batch = mintBatch(
              {
                workspaceId: RECV_WS,
                orgId,
                hlc: { physicalMs: 10_000 + i, logical: 0, nodeId: 'peer' },
                surfaceId: 's',
                deviceId: 'peer-device',
              },
              [{ kind: 'delete', type: RULE_ENTITY_TYPE, id: `r-in-${i}` }],
            );
            const envelope = batch.mutations[0]!;
            const handled = await handleIncomingMutationFrame(
              { type: SYNC_MUTATION_TYPE, workspaceId: RECV_WS, envelope },
              wire,
            );
            expect(handled).toBe(true);
            const owned = scenario.orgToBackend.get(orgId) === wireBackendId;
            expect(hasRecentlyApplied(envelope.mutationId)).toBe(owned);
          }
        } finally {
          __resetMutationStreamBridgeForTests();
          disposeSyncService();
        }
      }),
      { numRuns: stressNumRuns(32) },
    );
  });
});

describe('invariant 3 — pending-out: one cursor per backend, independent flushes', () => {
  it("offline edits flush to their own backend on its reconnect, regardless of the others' state", async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArb, fc.integer({ min: 0, max: 2 }), async (scenario, reconnectPick) => {
        await installScenario(scenario);
        const queue = new InMemoryPendingOutQueue();
        setPendingOutQueue(queue);
        connected.clear(); // everything offline — all live sends fail → enqueue
        sent.length = 0;
        seq = 0;

        const events = scenario.envelopeOrgs.map((key, i) => makeEvent(orgIdOf(scenario, key), 1_000 + i));
        for (const event of events) forwardMutationToBackend(event);
        await Promise.resolve(); // enqueue is fire-and-forget

        // Expected cursor contents per backend.
        const expectedByBackend = new Map<string, string[]>();
        for (const event of events) {
          const bound = scenario.orgToBackend.get(event.envelope.orgId);
          if (!bound) continue; // home-Org: withheld by tenancy, never queued
          expectedByBackend.set(bound, [...(expectedByBackend.get(bound) ?? []), event.envelope.mutationId]);
        }
        for (const backendId of scenario.backendIds) {
          expect(await queue.size(backendId)).toBe(expectedByBackend.get(backendId)?.length ?? 0);
        }

        // Reconnect exactly one backend; flush it.
        const reconnected = scenario.backendIds[reconnectPick % scenario.backendIds.length]!;
        connected.add(reconnected);
        await flushPendingOutToBackend(reconnected);

        // Everything it owned went out on ITS wire, in full.
        expect(sent.every((s) => s.backendId === reconnected)).toBe(true);
        const flushedIds = sent.map((s) => (s.frame.envelope as MutationEnvelope).mutationId).sort();
        expect(flushedIds).toEqual([...(expectedByBackend.get(reconnected) ?? [])].sort());
        expect(await queue.size(reconnected)).toBe(0);

        // Every other backend's cursor is untouched.
        for (const backendId of scenario.backendIds) {
          if (backendId === reconnected) continue;
          expect(await queue.size(backendId)).toBe(expectedByBackend.get(backendId)?.length ?? 0);
        }
      }),
      { numRuns: stressNumRuns(48) },
    );
  });
});
