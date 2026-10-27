/**
 * The snapshot watermark — the receiver's half of the C5 bootstrap.
 *
 * A snapshot re-materializes the sender's state as the receiver's own
 * commits, so the receiver's rows alone never cover the sender's nodes:
 * every later catch-up would count the sender's whole history as
 * missing and, past the threshold, bootstrap by snapshot again — the
 * workspace re-minted on every join. The watermark the wire bootstrap
 * logs after the apply is what the next STATE_VECTOR presents; the
 * sender then streams only the delta above the snapshot.
 *
 * One process plays both hosts: the service is re-initialized on the
 * hub's log or the receiver's log per step, as a restart would.
 */

import {
  SYNC_MUTATION_TYPE,
  SYNC_SNAPSHOT_TYPE,
  SYNC_STATE_VECTOR_TYPE,
  SYNC_SYNCED_TYPE,
  type SyncMutationMessage,
  type SyncSnapshotMessage,
  type SyncStateVectorMessage,
  type SyncSyncedMessage,
} from '@openheaders/core/protocol';
import {
  foldStateVector,
  type MutationEnvelope,
  type MutatorContext,
  type SnapshotThresholds,
  type StateVector,
  shouldBootstrapWithSnapshot,
} from '@openheaders/core/sync';
import { seedRule } from '@openheaders/core/sync-builders/projections/rule-projection';
import type { Rule } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import {
  applyWorkspaceSnapshot,
  computeSnapshotThresholdInputsFromLog,
  readWorkspaceStateVector,
  recordWorkspaceSnapshotWatermark,
  respondToStateVector,
} from '@openheaders/oracle/sync';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import {
  __initSyncServiceForTests,
  applySyncRequest,
  dispose as disposeSyncService,
} from '@openheaders/oracle/sync/service';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearTestIdentitySnapshot, installTestIdentitySnapshot } from '../../helpers/identity-snapshot';

const wsId = 'ws-watermark';
let clock = 0;

const ctx = (nodeId: string): MutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs: ++clock + 10_000, logical: 0, nodeId },
  surfaceId: 's',
  deviceId: nodeId,
});

const makeRule = (name: string): Rule =>
  ({
    schemaVersion: 5,
    uid: generateUid(),
    path: `rules/x/${name}`,
    type: 'header',
    name,
    enabled: true,
    conditions: [{ uid: 'cnd00001', type: 'url-filter', values: ['https://openheaders.io/*'] }],
    action: {
      requestHeaders: [{ uid: 'hmd00001', headerName: 'X-A', operation: 'override', value: '1' }],
      responseHeaders: [],
    },
  }) as unknown as Rule;

/** Four rules is past this ceiling; the hub answers a cold or lagging peer with a snapshot. */
const THRESHOLDS: SnapshotThresholds = { maxDeltaCount: 3, maxDeltaBytes: null };

type Frame = SyncSnapshotMessage | SyncMutationMessage | SyncSyncedMessage;

function collectingReply() {
  const frames: Frame[] = [];
  return {
    frames,
    send: (frame: Frame): boolean => {
      frames.push(frame);
      return true;
    },
  };
}

function stateVectorMessage(perNodeMaxHlc: StateVector): SyncStateVectorMessage {
  return { type: SYNC_STATE_VECTOR_TYPE, workspaceId: wsId, perNodeMaxHlc };
}

async function rows(log: InMemoryMutationLog): Promise<MutationEnvelope[]> {
  const out: MutationEnvelope[] = [];
  for await (const env of log.readSince(null)) out.push(env);
  return out;
}

/** The hub answers one catch-up for `peerVector` over its own log. */
async function join(hubLog: InMemoryMutationLog, peerVector: StateVector) {
  __initSyncServiceForTests(wsId, { log: hubLog });
  const reply = collectingReply();
  const result = await respondToStateVector(stateVectorMessage(peerVector), reply, { thresholds: THRESHOLDS });
  return { reply, result };
}

/** The receiver bootstraps from a snapshot frame the way the wire handshake does: apply, then record. */
async function bootstrap(receiverLog: InMemoryMutationLog, snapshot: SyncSnapshotMessage['snapshot']): Promise<void> {
  __initSyncServiceForTests(wsId, { log: receiverLog });
  const makeContext = () => ctx('receiver');
  await applyWorkspaceSnapshot(snapshot, { makeContext });
  await recordWorkspaceSnapshotWatermark(snapshot, { makeContext });
}

beforeEach(() => {
  clock = 0;
  installTestIdentitySnapshot();
});

afterEach(() => {
  disposeSyncService();
  clearTestIdentitySnapshot();
});

describe('the snapshot watermark', () => {
  it('records nothing for a snapshot that covers no node', async () => {
    const receiverLog = new InMemoryMutationLog();
    __initSyncServiceForTests(wsId, { log: receiverLog });
    await recordWorkspaceSnapshotWatermark(
      { workspaceId: wsId, takenAtHlc: {} },
      { makeContext: () => ctx('receiver') },
    );
    expect(await rows(receiverLog)).toHaveLength(0);
  });

  it('the receiver presents a vector that covers the sender up to the snapshot, so the next join streams nothing', async () => {
    const hubLog = new InMemoryMutationLog();
    __initSyncServiceForTests(wsId, { log: hubLog });
    for (const name of ['a', 'b', 'c', 'd']) {
      await applySyncRequest({ type: 'oh.sync.apply', batch: seedRule(makeRule(name), ctx('hub')) });
    }
    const hubVector = await readWorkspaceStateVector(wsId);
    expect(Object.keys(hubVector)).toEqual(['hub']);

    // Join 1 — a cold receiver: the hub bootstraps it with a snapshot.
    const first = await join(hubLog, {});
    expect(first.result.sentSnapshot).toBe(true);
    const snapshotFrame = first.reply.frames.find((f): f is SyncSnapshotMessage => f.type === SYNC_SNAPSHOT_TYPE);
    if (!snapshotFrame) throw new Error('expected a snapshot frame for a cold peer');
    expect(snapshotFrame.snapshot.takenAtHlc).toEqual(hubVector);

    const receiverLog = new InMemoryMutationLog();
    await bootstrap(receiverLog, snapshotFrame.snapshot);
    const receiverRows = await rows(receiverLog);
    expect(receiverRows.length).toBeGreaterThan(0);

    // The rows alone fold to the receiver's own node: without the
    // watermark the hub would count every one of its rows as missing
    // and answer with a snapshot on every join.
    const rowsOnly = foldStateVector(receiverRows);
    expect(Object.keys(rowsOnly)).toEqual(['receiver']);
    const lagging = await computeSnapshotThresholdInputsFromLog(hubLog, rowsOnly);
    expect(lagging.estimatedDeltaCount).toBe((await rows(hubLog)).length);
    expect(shouldBootstrapWithSnapshot(lagging, THRESHOLDS)).toBe(true);

    // With the watermark the presented vector covers the hub's node at
    // the snapshot's clock, and the hub finds nothing to stream.
    const receiverVector = await readWorkspaceStateVector(wsId);
    expect(receiverVector.hub).toEqual(hubVector.hub);
    const covered = await computeSnapshotThresholdInputsFromLog(hubLog, receiverVector);
    expect(covered.estimatedDeltaCount).toBe(0);
    expect(shouldBootstrapWithSnapshot(covered, THRESHOLDS)).toBe(false);

    // Join 2 — the receiver is warm: no snapshot, no delta, SYNCED.
    const second = await join(hubLog, receiverVector);
    expect(second.result.sentSnapshot).toBe(false);
    expect(second.result.deltasSent).toBe(0);
    expect(second.reply.frames.map((f) => f.type)).toEqual([SYNC_SYNCED_TYPE]);

    // The control: presenting the rows-only vector reproduces the loop.
    const control = await join(hubLog, rowsOnly);
    expect(control.result.sentSnapshot).toBe(true);

    // A restart of the receiver replays the watermark with the rest of
    // its log; the vector it presents is the same.
    __initSyncServiceForTests(wsId, { log: receiverLog });
    expect(await readWorkspaceStateVector(wsId)).toEqual(receiverVector);
    expect(await rows(receiverLog)).toHaveLength(receiverRows.length);
  });

  it('rows the sender writes after the snapshot stream as the delta above the watermark, with their own ids', async () => {
    const hubLog = new InMemoryMutationLog();
    __initSyncServiceForTests(wsId, { log: hubLog });
    for (const name of ['a', 'b', 'c', 'd']) {
      await applySyncRequest({ type: 'oh.sync.apply', batch: seedRule(makeRule(name), ctx('hub')) });
    }
    const first = await join(hubLog, {});
    const snapshotFrame = first.reply.frames.find((f): f is SyncSnapshotMessage => f.type === SYNC_SNAPSHOT_TYPE);
    if (!snapshotFrame) throw new Error('expected a snapshot frame for a cold peer');
    const receiverLog = new InMemoryMutationLog();
    await bootstrap(receiverLog, snapshotFrame.snapshot);
    const receiverVector = await readWorkspaceStateVector(wsId);
    const rowsBefore = (await rows(receiverLog)).length;

    // The hub writes on after the snapshot was taken.
    __initSyncServiceForTests(wsId, { log: hubLog });
    const later = seedRule(makeRule('later'), ctx('hub'));
    await applySyncRequest({ type: 'oh.sync.apply', batch: later });

    const third = await join(hubLog, receiverVector);
    expect(third.result.sentSnapshot).toBe(false);
    const streamed = third.reply.frames
      .filter((f): f is SyncMutationMessage => f.type === SYNC_MUTATION_TYPE)
      .map((f) => f.envelope);
    expect(streamed.map((env) => env.mutationId)).toEqual(later.mutations.map((env) => env.mutationId));

    // The receiver applies the delta as inbound rows under the hub's
    // ids; its vector now covers the hub's clock from the rows
    // themselves, above the watermark.
    __initSyncServiceForTests(wsId, { log: receiverLog });
    await applySyncRequest({
      type: 'oh.sync.apply',
      batch: { batchId: later.batchId, mutations: streamed },
      applyOrigin: 'inbound',
    });
    expect((await rows(receiverLog)).length).toBe(rowsBefore + streamed.length);
    const after = await readWorkspaceStateVector(wsId);
    expect(after.hub).toEqual(later.mutations[later.mutations.length - 1].hlc);

    const fourth = await join(hubLog, after);
    expect(fourth.result.sentSnapshot).toBe(false);
    expect(fourth.result.deltasSent).toBe(0);
  });
});
