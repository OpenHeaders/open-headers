import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import {
  SYNC_MUTATION_BATCH_TYPE,
  SYNC_MUTATION_TYPE,
  SyncMutationBatchMessageSchema,
  SyncMutationMessageSchema,
  SyncMutationStreamMessageSchema,
} from '../../src/protocol';
import type { MutationEnvelope } from '../../src/sync';

const env: MutationEnvelope = {
  mutationId: 'm-1',
  hlc: { physicalMs: 1000, logical: 0, nodeId: 'sw' },
  origin: { surfaceId: 's', deviceId: 'd' },
  workspaceId: 'w',
  orgId: 'org-test',
  mutatorVersion: 1,
  body: { kind: 'delete', type: 'rule', id: 'r' },
};

describe('SyncMutationMessageSchema', () => {
  it('round-trips a single-envelope message', () => {
    const msg = { type: SYNC_MUTATION_TYPE, workspaceId: 'w', envelope: env };
    expect(v.parse(SyncMutationMessageSchema, msg)).toEqual(msg);
  });

  it('rejects a missing envelope', () => {
    expect(() =>
      v.parse(SyncMutationMessageSchema, { type: SYNC_MUTATION_TYPE, workspaceId: 'w' }),
    ).toThrow();
  });

  it('rejects an envelope with negative physicalMs', () => {
    const bad = { ...env, hlc: { ...env.hlc, physicalMs: -1 } };
    expect(() =>
      v.parse(SyncMutationMessageSchema, { type: SYNC_MUTATION_TYPE, workspaceId: 'w', envelope: bad }),
    ).toThrow();
  });
});

describe('SyncMutationBatchMessageSchema', () => {
  it('round-trips a batch with one envelope', () => {
    const msg = {
      type: SYNC_MUTATION_BATCH_TYPE,
      workspaceId: 'w',
      batch: { batchId: 'b-1', mutations: [env] },
    };
    expect(v.parse(SyncMutationBatchMessageSchema, msg)).toEqual(msg);
  });

  it('accepts an empty mutations array', () => {
    const msg = {
      type: SYNC_MUTATION_BATCH_TYPE,
      workspaceId: 'w',
      batch: { batchId: 'b-empty', mutations: [] },
    };
    expect(v.parse(SyncMutationBatchMessageSchema, msg)).toEqual(msg);
  });

  it('rejects a batch without batchId', () => {
    expect(() =>
      v.parse(SyncMutationBatchMessageSchema, {
        type: SYNC_MUTATION_BATCH_TYPE,
        workspaceId: 'w',
        batch: { mutations: [env] },
      }),
    ).toThrow();
  });
});

describe('SyncMutationStreamMessageSchema (union)', () => {
  it('routes both kinds by discriminator', () => {
    const single = { type: SYNC_MUTATION_TYPE, workspaceId: 'w', envelope: env };
    const batch = {
      type: SYNC_MUTATION_BATCH_TYPE,
      workspaceId: 'w',
      batch: { batchId: 'b', mutations: [env] },
    };
    expect(v.parse(SyncMutationStreamMessageSchema, single).type).toBe(SYNC_MUTATION_TYPE);
    expect(v.parse(SyncMutationStreamMessageSchema, batch).type).toBe(SYNC_MUTATION_BATCH_TYPE);
  });

  it('rejects an unknown discriminator', () => {
    expect(() =>
      v.parse(SyncMutationStreamMessageSchema, { type: 'oh.sync.elsewhere', workspaceId: 'w' }),
    ).toThrow();
  });
});
