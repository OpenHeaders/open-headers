import { describe, expect, it } from 'vitest';
import {
  isHostLocalEntityType,
  isHostLocalMutation,
  type MutationEnvelope,
  type MutatorContext,
  recordSnapshotWatermark,
  SNAPSHOT_WATERMARK_ENTITY_TYPE,
  SNAPSHOT_WATERMARK_ID,
  SNAPSHOT_WATERMARK_MUTATOR_VERSION,
  SNAPSHOT_WATERMARK_PATH,
  type StateVector,
  snapshotWatermarkVector,
} from '../../../../src/sync';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'receiver' },
  surfaceId: 'sw',
  deviceId: 'device-a',
  ...overrides,
});

const covered: StateVector = {
  hub: { physicalMs: 900, logical: 3, nodeId: 'hub' },
  'other-peer': { physicalMs: 850, logical: 0, nodeId: 'other-peer' },
};

describe('recordSnapshotWatermark', () => {
  it('emits a single setField on the singleton carrying the covered vector', () => {
    const intent = recordSnapshotWatermark(ctx(), { vector: covered });
    expect(intent.batch.mutations).toHaveLength(1);
    const env = intent.batch.mutations[0];
    expect(env.mutatorVersion).toBe(SNAPSHOT_WATERMARK_MUTATOR_VERSION);
    expect(env.workspaceId).toBe('ws-1');
    expect(env.body).toMatchObject({
      kind: 'setField',
      type: SNAPSHOT_WATERMARK_ENTITY_TYPE,
      id: SNAPSHOT_WATERMARK_ID,
      path: SNAPSHOT_WATERMARK_PATH,
      value: covered,
    });
  });

  it('emits no side effects', () => {
    expect(recordSnapshotWatermark(ctx(), { vector: covered }).sideEffects).toEqual([]);
  });

  it('is host-local — what a host has seen of a peer never crosses a wire', () => {
    const intent = recordSnapshotWatermark(ctx(), { vector: covered });
    expect(isHostLocalEntityType(SNAPSHOT_WATERMARK_ENTITY_TYPE)).toBe(true);
    expect(isHostLocalMutation(intent.batch.mutations[0])).toBe(true);
  });

  it('honors caller-supplied batchId', () => {
    const intent = recordSnapshotWatermark(ctx({ batchId: 'B-9' }), { vector: covered });
    expect(intent.batch.batchId).toBe('B-9');
  });
});

describe('snapshotWatermarkVector', () => {
  it('reads the covered vector back from a watermark row', () => {
    const [env] = recordSnapshotWatermark(ctx(), { vector: covered }).batch.mutations;
    expect(snapshotWatermarkVector(env)).toEqual(covered);
  });

  it('answers null for every other row', () => {
    const [env] = recordSnapshotWatermark(ctx(), { vector: covered }).batch.mutations;
    const rule: MutationEnvelope = {
      ...env,
      body: { kind: 'setField', type: 'rule', id: 'r', path: 'name', value: 'x' },
    };
    const otherPath: MutationEnvelope = {
      ...env,
      body: {
        kind: 'setField',
        type: SNAPSHOT_WATERMARK_ENTITY_TYPE,
        id: SNAPSHOT_WATERMARK_ID,
        path: 'note',
        value: 1,
      },
    };
    const deleted: MutationEnvelope = {
      ...env,
      body: { kind: 'delete', type: SNAPSHOT_WATERMARK_ENTITY_TYPE, id: SNAPSHOT_WATERMARK_ID },
    };
    expect(snapshotWatermarkVector(rule)).toBeNull();
    expect(snapshotWatermarkVector(otherPath)).toBeNull();
    expect(snapshotWatermarkVector(deleted)).toBeNull();
  });

  it('answers null for a malformed value — the fold then falls back to the rows alone', () => {
    const [env] = recordSnapshotWatermark(ctx(), { vector: covered }).batch.mutations;
    const malformed: MutationEnvelope = {
      ...env,
      body: { ...env.body, kind: 'setField', path: SNAPSHOT_WATERMARK_PATH, value: { hub: { physicalMs: 'soon' } } },
    };
    expect(snapshotWatermarkVector(malformed)).toBeNull();
  });
});
