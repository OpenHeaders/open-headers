import { describe, expect, it } from 'vitest';
import type { MutationBatch, MutationBody } from '../../../../src/sync';
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

describe('makeVariableMutators / setVariable', () => {
  it('emits an addToSet at the bound varsPath with itemId = name', () => {
    const intent = factories.setVariable(ctx(), {
      entityUid: 'ent-1',
      name: 'API_URL',
      value: 'https://openheaders.io',
    });
    expect(intent.batch.mutations).toHaveLength(1);
    const body = intent.batch.mutations[0].body;
    expect(body).toMatchObject({
      kind: 'addToSet',
      type: 'test-entity',
      id: 'ent-1',
      path: 'variables',
      itemId: 'API_URL',
      item: { name: 'API_URL', value: 'https://openheaders.io', type: 'default' },
    });
    expect(intent.sideEffects).toEqual([{ kind: 'invalidate-test', key: 'ent-1', hlc: ctx().hlc }]);
  });

  it('honors explicit type + orderKey when provided', () => {
    const intent = factories.setVariable(ctx(), {
      entityUid: 'ent-1',
      name: 'API_KEY',
      value: 'k',
      type: 'secret',
      orderKey: 'm',
    });
    expect(intent.batch.mutations[0].body).toMatchObject({
      itemId: 'API_KEY',
      item: { name: 'API_KEY', value: 'k', type: 'secret' },
      orderKey: 'm',
    });
  });
});

describe('makeVariableMutators / removeVariable', () => {
  it('emits a removeFromSet with itemId = name', () => {
    const intent = factories.removeVariable(ctx(), { entityUid: 'ent-1', name: 'API_URL' });
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      type: 'test-entity',
      id: 'ent-1',
      path: 'variables',
      itemId: 'API_URL',
    });
    expect(intent.sideEffects).toEqual([{ kind: 'invalidate-test', key: 'ent-1', hlc: ctx().hlc }]);
  });
});

describe('makeVariableMutators / renameVariable', () => {
  it('emits a 2-mutation batch (remove old + add new) under one batchId', () => {
    const intent = factories.renameVariable(ctx({ batchId: 'shared' }), {
      entityUid: 'ent-1',
      oldName: 'API_URL',
      newName: 'BASE_URL',
      value: 'https://openheaders.io',
    });
    expect(intent.batch.batchId).toBe('shared');
    expect(intent.batch.mutations).toHaveLength(2);
    expect(intent.batch.mutations[0].body).toMatchObject({ kind: 'removeFromSet', itemId: 'API_URL' });
    expect(intent.batch.mutations[1].body).toMatchObject({
      kind: 'addToSet',
      itemId: 'BASE_URL',
      item: { name: 'BASE_URL', value: 'https://openheaders.io', type: 'default' },
    });
  });

  it('returns an empty batch + no side effects when oldName === newName', () => {
    const intent = factories.renameVariable(ctx(), {
      entityUid: 'ent-1',
      oldName: 'X',
      newName: 'X',
      value: 'v',
    });
    expect(intent.batch.mutations).toHaveLength(0);
    expect(intent.sideEffects).toEqual([]);
  });
});

describe('makeVariableMutators / setVariableType', () => {
  it('replaces the whole record via addToSet (LWW per itemId)', () => {
    const intent = factories.setVariableType(ctx(), {
      entityUid: 'ent-1',
      name: 'TOKEN',
      value: 'abc',
      type: 'secret',
    });
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'addToSet',
      itemId: 'TOKEN',
      item: { name: 'TOKEN', value: 'abc', type: 'secret' },
    });
  });
});
