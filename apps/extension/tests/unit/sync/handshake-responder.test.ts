/**
 * Phase C handshake responder — `respondToStateVector` integration.
 *
 * Walks the responder against the per-workspace service registry. Three
 * shapes:
 *   1. Delta path (small log, fresh peer below snapshot threshold).
 *   2. Snapshot path (cold peer with non-trivial local history).
 *   3. Mid-stream disconnect (`reply.send` returns false → stop early,
 *      no SYNCED).
 *
 * Pure responder math against the threshold heuristic is covered in
 * core; this exercises the compose-with-the-oracle glue both desktop
 * main and the future daemon depend on.
 */
import { SYNC_MUTATION_TYPE, SYNC_SNAPSHOT_TYPE, SYNC_SYNCED_TYPE } from '@openheaders/core/protocol';
import type { MutatorContext, StateVector } from '@openheaders/core/sync';
import { seedRule } from '@openheaders/core/sync-builders/projections/rule-projection';
import type { Rule } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { respondToStateVector } from '@openheaders/oracle/sync';
import {
  __initSyncServiceForTests,
  applySyncRequest,
  dispose as disposeSyncService,
} from '@openheaders/oracle/sync/service';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearTestIdentitySnapshot, installTestIdentitySnapshot } from '../../helpers/identity-snapshot';

const wsId = 'ws-resp';

const ctx = (ms: number, nodeId = 'sw'): MutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs: ms, logical: 0, nodeId },
  surfaceId: 's',
  deviceId: 'd0',
});

const makeRule = (uid: string, name: string): Rule =>
  ({
    schemaVersion: 5,
    uid,
    path: `rules/x/${uid}`,
    type: 'header',
    name,
    enabled: true,
    conditions: [{ uid: 'cnd00001', kind: 'url-pattern', urlPattern: 'https://openheaders.io/*' }],
    action: {
      requestHeaders: [{ uid: 'hmd00001', headerName: 'X-A', operation: 'set', value: '1' }],
      responseHeaders: [],
    },
  }) as unknown as Rule;

function makeReply() {
  const frames: object[] = [];
  let openLimit = Infinity;
  const reply = {
    send: (frame: object) => {
      if (frames.length >= openLimit) return false;
      frames.push(frame);
      return true;
    },
  };
  const closeAfter = (n: number) => {
    openLimit = n;
  };
  return { reply, frames, closeAfter };
}

beforeEach(() => {
  __initSyncServiceForTests(wsId);
  installTestIdentitySnapshot();
});

afterEach(() => {
  disposeSyncService();
  clearTestIdentitySnapshot();
});

describe('respondToStateVector — delta path', () => {
  it('streams the delta envelopes the peer is missing then SYNCED', async () => {
    const r1 = seedRule(makeRule(generateUid(), 'one'), ctx(1_000));
    const r2 = seedRule(makeRule(generateUid(), 'two'), ctx(2_000));
    await applySyncRequest({ type: 'oh.sync.apply', batch: r1, sideEffects: [] });
    await applySyncRequest({ type: 'oh.sync.apply', batch: r2, sideEffects: [] });

    const { reply, frames } = makeReply();
    // A non-empty peerVector with an unrelated node skips the
    // cold-receiver snapshot branch; the local log is below maxDeltaCount
    // so we stay on the pure delta path.
    const peerVector: StateVector = {
      'other-node': { physicalMs: 1, logical: 0, nodeId: 'other-node' },
    };
    const result = await respondToStateVector(
      { type: 'oh.sync.stateVector', workspaceId: wsId, perNodeMaxHlc: peerVector },
      reply,
      { thresholds: { maxDeltaCount: 10, maxDeltaBytes: null } },
    );

    expect(result.sentSnapshot).toBe(false);
    expect(result.deltasSent).toBe(r1.mutations.length + r2.mutations.length);
    expect(result.syncedSent).toBe(true);

    const types = frames.map((f) => (f as { type: string }).type);
    expect(types).toEqual([...frames.slice(0, -1).map(() => SYNC_MUTATION_TYPE), SYNC_SYNCED_TYPE]);
  });

  it('emits only SYNCED when the peer is already caught up', async () => {
    const r1 = seedRule(makeRule(generateUid(), 'one'), ctx(1_000, 'sw'));
    await applySyncRequest({ type: 'oh.sync.apply', batch: r1, sideEffects: [] });

    const peerVector: StateVector = { sw: { physicalMs: 9_999_999, logical: 999, nodeId: 'sw' } };
    const { reply, frames } = makeReply();
    const result = await respondToStateVector(
      { type: 'oh.sync.stateVector', workspaceId: wsId, perNodeMaxHlc: peerVector },
      reply,
    );

    expect(result.sentSnapshot).toBe(false);
    expect(result.deltasSent).toBe(0);
    expect(result.syncedSent).toBe(true);
    expect(frames).toHaveLength(1);
    expect((frames[0] as { type: string }).type).toBe(SYNC_SYNCED_TYPE);
  });
});

describe('respondToStateVector — snapshot path', () => {
  it('ships a snapshot first then SYNCED for a cold peer', async () => {
    const r1 = seedRule(makeRule(generateUid(), 'one'), ctx(1_000));
    await applySyncRequest({ type: 'oh.sync.apply', batch: r1, sideEffects: [] });

    const { reply, frames } = makeReply();
    const result = await respondToStateVector(
      { type: 'oh.sync.stateVector', workspaceId: wsId, perNodeMaxHlc: {} satisfies StateVector },
      reply,
      // Force the snapshot path even though delta count is small: empty
      // peerVector + any local mutations already trips
      // shouldBootstrapWithSnapshot.
    );

    expect(result.sentSnapshot).toBe(true);
    expect(result.syncedSent).toBe(true);
    expect((frames[0] as { type: string }).type).toBe(SYNC_SNAPSHOT_TYPE);
    expect((frames[frames.length - 1] as { type: string }).type).toBe(SYNC_SYNCED_TYPE);
  });
});

describe('respondToStateVector — mid-stream disconnect', () => {
  it('stops streaming when reply.send returns false and reports syncedSent=false', async () => {
    const r1 = seedRule(makeRule(generateUid(), 'one'), ctx(1_000, 'sw'));
    const r2 = seedRule(makeRule(generateUid(), 'two'), ctx(2_000, 'sw'));
    const r3 = seedRule(makeRule(generateUid(), 'three'), ctx(3_000, 'sw'));
    await applySyncRequest({ type: 'oh.sync.apply', batch: r1, sideEffects: [] });
    await applySyncRequest({ type: 'oh.sync.apply', batch: r2, sideEffects: [] });
    await applySyncRequest({ type: 'oh.sync.apply', batch: r3, sideEffects: [] });

    const { reply, frames, closeAfter } = makeReply();
    closeAfter(2); // accept first two mutation frames, drop subsequent sends

    // Non-empty peerVector with an unrelated node skips the
    // cold-receiver snapshot branch; high maxDeltaCount keeps us on
    // the pure delta path so the test exercises mid-stream cutoff.
    const peerVector: StateVector = {
      'other-node': { physicalMs: 1, logical: 0, nodeId: 'other-node' },
    };
    const result = await respondToStateVector(
      { type: 'oh.sync.stateVector', workspaceId: wsId, perNodeMaxHlc: peerVector },
      reply,
      { thresholds: { maxDeltaCount: 100, maxDeltaBytes: null } },
    );

    expect(result.syncedSent).toBe(false);
    expect(frames.length).toBe(2);
    expect(frames.every((f) => (f as { type: string }).type === SYNC_MUTATION_TYPE)).toBe(true);
  });
});
