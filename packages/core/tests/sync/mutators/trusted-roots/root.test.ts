import { describe, expect, it } from 'vitest';
import {
  InMemoryDocumentStore,
  type MutatorContext,
  removeTrustedRoot,
  setTrustedRoot,
  TRUSTED_ROOTS_ENTITY_TYPE,
  TRUSTED_ROOTS_ID,
  TRUSTED_ROOTS_MUTATOR_VERSION,
  TRUSTED_ROOTS_PATH,
} from '../../../../src/sync';
import { deriveSideEffectsForEnvelope } from '../../../../src/sync/mutators/derive-side-effects';
import {
  projectTrustedRoots,
  seedTrustedRoots,
} from '../../../../src/sync-builders/projections/trusted-roots-projection';
import type { TrustedRoot } from '../../../../src/types';

let hlcMs = 1_000;
const nextHlcMs = (): number => {
  hlcMs += 1_000;
  return hlcMs;
};
const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: nextHlcMs(), logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

const PEM = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n';
const root = (uid: string, name: string): TrustedRoot => ({
  uid,
  name,
  certPem: PEM,
  addedAt: '2026-08-27T00:00:00.000Z',
});

function project(store: InMemoryDocumentStore) {
  const materialized = store.materializeOne(TRUSTED_ROOTS_ENTITY_TYPE, TRUSTED_ROOTS_ID);
  if (!materialized) return null;
  return projectTrustedRoots(
    materialized,
    store.liveOrderedSetItems(TRUSTED_ROOTS_ENTITY_TYPE, TRUSTED_ROOTS_ID, TRUSTED_ROOTS_PATH),
  );
}

describe('setTrustedRoot', () => {
  it('emits one addToSet on the singleton keyed by the root uid with no side effects', () => {
    const intent = setTrustedRoot(ctx(), { root: root('root0001', 'Corp Root') });
    expect(intent.batch.mutations).toHaveLength(1);
    const env = intent.batch.mutations[0];
    expect(env.mutatorVersion).toBe(TRUSTED_ROOTS_MUTATOR_VERSION);
    expect(env.body).toMatchObject({
      kind: 'addToSet',
      type: TRUSTED_ROOTS_ENTITY_TYPE,
      id: TRUSTED_ROOTS_ID,
      path: TRUSTED_ROOTS_PATH,
      itemId: 'root0001',
      item: { uid: 'root0001', name: 'Corp Root', certPem: PEM },
    });
    expect(intent.sideEffects).toEqual([]);
    expect(deriveSideEffectsForEnvelope(env)).toEqual([]);
  });
});

describe('removeTrustedRoot', () => {
  it('emits a single removeFromSet keyed by uid', () => {
    const intent = removeTrustedRoot(ctx(), { uid: 'root0001' });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      type: TRUSTED_ROOTS_ENTITY_TYPE,
      id: TRUSTED_ROOTS_ID,
      path: TRUSTED_ROOTS_PATH,
      itemId: 'root0001',
    });
  });
});

describe('trusted-roots seed ⇄ projection round trip', () => {
  it('seeds a persisted record into the store and projects it back in order', () => {
    const store = new InMemoryDocumentStore();
    const persisted = { schemaVersion: 5, roots: [root('root0001', 'Corp Root'), root('root0002', 'Lab Root')] };
    for (const env of seedTrustedRoots(persisted, ctx()).mutations) store.apply(env);
    expect(project(store)).toEqual(persisted);
  });

  it('a set then a remove converge the projection to the surviving row', () => {
    const store = new InMemoryDocumentStore();
    for (const env of seedTrustedRoots({ schemaVersion: 5, roots: [root('root0001', 'Corp Root')] }, ctx()).mutations) {
      store.apply(env);
    }
    for (const env of setTrustedRoot(ctx(), { root: root('root0002', 'Lab Root') }).batch.mutations) store.apply(env);
    for (const env of setTrustedRoot(ctx(), { root: root('root0001', 'Corp Root v2') }).batch.mutations) {
      store.apply(env);
    }
    expect(project(store)?.roots.map((r) => [r.uid, r.name])).toEqual([
      ['root0001', 'Corp Root v2'],
      ['root0002', 'Lab Root'],
    ]);
    for (const env of removeTrustedRoot(ctx(), { uid: 'root0001' }).batch.mutations) store.apply(env);
    expect(project(store)?.roots.map((r) => r.uid)).toEqual(['root0002']);
  });

  it('returns null for a foreign entity type', () => {
    const store = new InMemoryDocumentStore();
    expect(project(store)).toBeNull();
  });
});
