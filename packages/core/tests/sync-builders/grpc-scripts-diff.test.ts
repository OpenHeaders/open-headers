/**
 * gRPC update batch — the script slot record's flatten-diff (the
 * session builders' law): an empty record on either side reads as no
 * record, so a save without scripts never writes an empty leaf, a new
 * slot sets its own leaf, an emptied slot tombstones it, and an
 * untouched slot emits nothing.
 */

import type { MutatorContext } from '@openheaders/core/sync';
import { buildGrpcUpdateBatch } from '@openheaders/core/sync-builders/mutations/grpc-request-mutations';
import { describe, expect, it } from 'vitest';

const ctx: MutatorContext = {
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
};

function bodiesOf(live: unknown, next: Record<string, string>) {
  return buildGrpcUpdateBatch(
    'gr1',
    { scripts: next },
    ctx,
    () => [],
    (_uid, path) => (path === 'scripts' ? live : undefined),
  ).batch.mutations.map((m) => m.body);
}

describe('buildGrpcUpdateBatch — scripts', () => {
  it('an empty record over no record writes nothing', () => {
    expect(bodiesOf(undefined, {})).toEqual([]);
    expect(bodiesOf({}, {})).toEqual([]);
  });

  it('a new slot sets its leaf; an emptied slot tombstones it; an untouched one is silent', () => {
    expect(bodiesOf(undefined, { 'grpc-before-invoke': 'a();' })).toEqual([
      { kind: 'setField', type: 'grpcRequest', id: 'gr1', path: 'scripts.grpc-before-invoke', value: 'a();' },
    ]);
    expect(
      bodiesOf({ 'grpc-before-invoke': 'a();', 'grpc-on-message': 'm();' }, { 'grpc-on-message': 'm();' }),
    ).toEqual([{ kind: 'unsetField', type: 'grpcRequest', id: 'gr1', path: 'scripts.grpc-before-invoke' }]);
    expect(bodiesOf({ 'grpc-after-response': 'x();' }, {})).toEqual([
      { kind: 'unsetField', type: 'grpcRequest', id: 'gr1', path: 'scripts.grpc-after-response' },
    ]);
  });
});
