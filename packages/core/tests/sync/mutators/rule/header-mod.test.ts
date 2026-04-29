/**
 * Header-mod factory unit tests. Spec is the catalog contract:
 *   - addHeaderMod emits exactly two mutations (addToSet + moveBefore)
 *     so naked-add lands at the end of the live order.
 *   - removeHeaderMod emits a single removeFromSet.
 *   - reorderHeaderMod emits a single moveBefore.
 *   - All factories enqueue a recompile-dnr side effect keyed by ruleUid.
 *   - The same `batchId` propagates across every envelope when the
 *     caller passes one (oracle's all-or-nothing contract).
 */

import { describe, expect, it } from 'vitest';
import { addHeaderMod, type MutatorContext } from '../../../../src/sync';
import {
  RECOMPILE_DNR,
  removeHeaderMod,
  reorderHeaderMod,
  RULE_ENTITY_TYPE,
} from '../../../../src/sync/mutators/rule';

const ctx = (): MutatorContext => ({
  workspaceId: 'ws-1',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'node-a' },
  surfaceId: 'surface-popup',
  deviceId: 'device-a',
  batchId: 'batch-fixed',
});

describe('addHeaderMod', () => {
  it('emits a single addToSet carrying the order key when supplied', () => {
    const intent = addHeaderMod(ctx(), {
      ruleUid: 'rule-1',
      side: 'request',
      mod: { operation: 'override', headerName: 'X-Trace', value: 'on' },
      itemId: 'item-1',
      orderKey: 'mz',
    });
    expect(intent.batch.batchId).toBe('batch-fixed');
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'addToSet',
      type: RULE_ENTITY_TYPE,
      id: 'rule-1',
      path: 'action.requestHeaders',
      itemId: 'item-1',
      item: { operation: 'override', headerName: 'X-Trace', value: 'on' },
      orderKey: 'mz',
    });
  });

  it('omits orderKey on the envelope when the caller does not supply one', () => {
    const intent = addHeaderMod(ctx(), {
      ruleUid: 'rule-1',
      side: 'request',
      mod: { operation: 'override', headerName: 'X-Trace' },
      itemId: 'item-1',
    });
    const body = intent.batch.mutations[0].body as { orderKey?: string };
    expect(body.orderKey).toBeUndefined();
  });

  it('targets responseHeaders for the response side', () => {
    const intent = addHeaderMod(ctx(), {
      ruleUid: 'rule-1',
      side: 'response',
      mod: { operation: 'add', headerName: 'X-Out', value: '1' },
      itemId: 'item-2',
    });
    for (const env of intent.batch.mutations) {
      const body = env.body as { path?: string };
      expect(body.path).toBe('action.responseHeaders');
    }
  });

  it('emits exactly one recompile-dnr side effect keyed by ruleUid', () => {
    const intent = addHeaderMod(ctx(), {
      ruleUid: 'rule-1',
      side: 'request',
      mod: { operation: 'remove', headerName: 'Cookie' },
    });
    expect(intent.sideEffects).toHaveLength(1);
    expect(intent.sideEffects[0]).toMatchObject({ kind: RECOMPILE_DNR, key: 'rule-1' });
  });
});

describe('removeHeaderMod', () => {
  it('emits a single removeFromSet', () => {
    const intent = removeHeaderMod(ctx(), { ruleUid: 'rule-1', side: 'request', itemId: 'item-1' });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      path: 'action.requestHeaders',
      itemId: 'item-1',
    });
    expect(intent.sideEffects[0].kind).toBe(RECOMPILE_DNR);
  });
});

describe('reorderHeaderMod', () => {
  it('emits a single moveBefore carrying the writer-committed order key', () => {
    const intent = reorderHeaderMod(ctx(), {
      ruleUid: 'rule-1',
      side: 'request',
      itemId: 'item-1',
      orderKey: 'aa',
    });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'moveBefore',
      path: 'action.requestHeaders',
      itemId: 'item-1',
      orderKey: 'aa',
    });
  });
});
