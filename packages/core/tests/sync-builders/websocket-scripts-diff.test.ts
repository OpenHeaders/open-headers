/**
 * WebSocket update batch — the script slot record's flatten-diff: an
 * empty record on either side reads as no record, so a save without
 * scripts never writes an empty leaf, a new slot sets its own leaf,
 * an emptied slot tombstones it, and an untouched slot emits nothing.
 */

import type { MutatorContext } from '@openheaders/core/sync';
import { buildWebSocketUpdateBatch } from '@openheaders/core/sync-builders/mutations/websocket-request-mutations';
import { describe, expect, it } from 'vitest';

const ctx: MutatorContext = {
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
};

function bodiesOf(live: unknown, next: Record<string, string>) {
  return buildWebSocketUpdateBatch(
    'ws1',
    { scripts: next },
    ctx,
    () => [],
    (_uid, path) => (path === 'scripts' ? live : undefined),
  ).batch.mutations.map((m) => m.body);
}

describe('buildWebSocketUpdateBatch — scripts', () => {
  it('an empty record over no record writes nothing', () => {
    expect(bodiesOf(undefined, {})).toEqual([]);
    expect(bodiesOf({}, {})).toEqual([]);
  });

  it('a new slot sets its leaf; an emptied slot tombstones it; an untouched one is silent', () => {
    expect(bodiesOf(undefined, { 'ws-before-connect': 'a();' })).toEqual([
      { kind: 'setField', type: 'websocketRequest', id: 'ws1', path: 'scripts.ws-before-connect', value: 'a();' },
    ]);
    expect(bodiesOf({ 'ws-before-connect': 'a();', 'ws-on-message': 'm();' }, { 'ws-on-message': 'm();' })).toEqual([
      { kind: 'unsetField', type: 'websocketRequest', id: 'ws1', path: 'scripts.ws-before-connect' },
    ]);
    expect(bodiesOf({ 'ws-after-close': 'x();' }, {})).toEqual([
      { kind: 'unsetField', type: 'websocketRequest', id: 'ws1', path: 'scripts.ws-after-close' },
    ]);
  });
});
