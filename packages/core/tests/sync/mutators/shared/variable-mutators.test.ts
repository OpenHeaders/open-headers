import { describe, expect, it } from 'vitest';
import type { MutationBatch, MutationBody } from '../../../../src/sync';
import type { Variable } from '../../../../src/types/v5/variable';
import {
  type MutatorContext,
  type SideEffectIntent,
  makeVariableMutators,
} from '../../../../src/sync';

const mintBatch = (ctx: MutatorContext, bodies: MutationBody[]): MutationBatch => ({
  batchId: ctx.batchId ?? 'test-batch',
  mutations: bodies.map((body, i) => ({
    mutationId: `mut-${i}`,
    hlc: ctx.hlc,
    origin: { surfaceId: ctx.surfaceId, deviceId: ctx.deviceId, userId: ctx.userId },
    workspaceId: ctx.workspaceId,
    mutatorVersion: 99,
    body,
  })),
});

const makeSideEffects = (uid: string, hlc: { physicalMs: number; logical: number; nodeId: string }): SideEffectIntent[] => [
  { kind: 'invalidate-test', key: uid, hlc },
];

const factories = makeVariableMutators({
  entityType: 'test-entity',
  varsPath: 'variables',
  mintBatch,
  makeSideEffects,
});

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

const v = (overrides: Partial<Variable> = {}): Variable => ({
  uid: 'var-aaaa',
  name: 'API_URL',
  value: 'https://openheaders.io',
  type: 'default',
  ...overrides,
});

describe('makeVariableMutators / setVariable', () => {
  it('emits an addToSet at the bound varsPath with itemId = variable.uid', () => {
    const variable = v();
    const intent = factories.setVariable(ctx(), { entityUid: 'ent-1', variable });
    expect(intent.batch.mutations).toHaveLength(1);
    const body = intent.batch.mutations[0].body;
    expect(body).toMatchObject({
      kind: 'addToSet',
      type: 'test-entity',
      id: 'ent-1',
      path: 'variables',
      itemId: 'var-aaaa',
      item: variable,
    });
    expect(intent.sideEffects).toEqual([{ kind: 'invalidate-test', key: 'ent-1', hlc: ctx().hlc }]);
  });

  it('honors explicit orderKey when provided + carries the full variable record (incl. secret type)', () => {
    const variable = v({ uid: 'var-bbbb', name: 'API_KEY', value: 'k', type: 'secret' });
    const intent = factories.setVariable(ctx(), { entityUid: 'ent-1', variable, orderKey: 'm' });
    expect(intent.batch.mutations[0].body).toMatchObject({
      itemId: 'var-bbbb',
      item: variable,
      orderKey: 'm',
    });
  });

  it('a re-emit at the same uid with a new name is a rename (one record, name changed)', () => {
    // Drives the "concurrent same-row rename converges to latest-name-wins" architectural
    // guarantee: rename is folded into setVariable at the same uid, and per-itemId LWW
    // resolves the concurrent case at the oracle.
    const renamed = v({ name: 'BASE_URL' });
    const intent = factories.setVariable(ctx(), { entityUid: 'ent-1', variable: renamed });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'addToSet',
      itemId: 'var-aaaa',
      item: { uid: 'var-aaaa', name: 'BASE_URL' },
    });
  });
});

describe('makeVariableMutators / removeVariable', () => {
  it('emits a removeFromSet with itemId = uid', () => {
    const intent = factories.removeVariable(ctx(), { entityUid: 'ent-1', uid: 'var-aaaa' });
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      type: 'test-entity',
      id: 'ent-1',
      path: 'variables',
      itemId: 'var-aaaa',
    });
    expect(intent.sideEffects).toEqual([{ kind: 'invalidate-test', key: 'ent-1', hlc: ctx().hlc }]);
  });
});
