import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { ScriptPackageSchema } from '../../../../src/schemas';
import {
  createScriptPackage,
  deleteScriptPackage,
  type MutatorContext,
  SCRIPT_PACKAGE_ENTITY_TYPE,
  SCRIPT_PACKAGE_MUTATOR_VERSION,
  setScriptPackageField,
  unsetScriptPackageField,
} from '../../../../src/sync';
import { buildUpdateScriptPackageBatch } from '../../../../src/sync-builders/mutations/script-package-mutations';
import {
  projectScriptPackage,
  seedScriptPackage,
} from '../../../../src/sync-builders/projections/script-package-projection';
import type { ScriptPackage } from '../../../../src/types';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: 2_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

const pkg = (overrides: Partial<ScriptPackage> = {}): ScriptPackage => ({
  schemaVersion: 5,
  uid: 'pkg00001',
  path: 'packages/utils',
  name: 'utils',
  source: 'module.exports = { add: (a, b) => a + b };',
  ...overrides,
});

describe('ScriptPackageSchema', () => {
  it('accepts a full package', () => {
    expect(() => v.parse(ScriptPackageSchema, pkg({ description: 'helpers' }))).not.toThrow();
  });

  it('accepts an empty source (drafting state)', () => {
    expect(() => v.parse(ScriptPackageSchema, pkg({ source: '' }))).not.toThrow();
  });

  it.each(['1utils', 'my package', 'a.b', ''])('rejects invalid name %j', (name) => {
    expect(() => v.parse(ScriptPackageSchema, pkg({ name }))).toThrow();
  });

  it.each(['utils', 'my-package', 'My_Package', '_private'])('accepts valid name %j', (name) => {
    expect(() => v.parse(ScriptPackageSchema, pkg({ name }))).not.toThrow();
  });
});

describe('createScriptPackage', () => {
  it('mints a single create envelope carrying the full payload with no side effects', () => {
    const payload = { schemaVersion: 5, path: 'packages/utils', name: 'utils', source: 'module.exports = {};' };
    const intent = createScriptPackage(ctx(), { scriptPackageUid: 'pkg00001', payload });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].mutatorVersion).toBe(SCRIPT_PACKAGE_MUTATOR_VERSION);
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'create',
      type: SCRIPT_PACKAGE_ENTITY_TYPE,
      id: 'pkg00001',
      payload,
    });
    expect(intent.sideEffects).toEqual([]);
  });
});

describe('deleteScriptPackage', () => {
  it('emits a single delete envelope with no side effects', () => {
    const intent = deleteScriptPackage(ctx(), { scriptPackageUid: 'pkg00001' });
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'delete',
      type: SCRIPT_PACKAGE_ENTITY_TYPE,
      id: 'pkg00001',
    });
    expect(intent.sideEffects).toEqual([]);
  });
});

describe('setScriptPackageField / unsetScriptPackageField', () => {
  it('emits a setField at the typed scalar path', () => {
    const intent = setScriptPackageField(ctx(), {
      scriptPackageUid: 'pkg00001',
      path: 'source',
      value: 'module.exports = { x: 1 };',
    });
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'setField',
      type: SCRIPT_PACKAGE_ENTITY_TYPE,
      id: 'pkg00001',
      path: 'source',
      value: 'module.exports = { x: 1 };',
    });
    expect(intent.sideEffects).toEqual([]);
  });

  it('emits an unsetField for optional paths', () => {
    const intent = unsetScriptPackageField(ctx(), { scriptPackageUid: 'pkg00001', path: 'description' });
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'unsetField',
      type: SCRIPT_PACKAGE_ENTITY_TYPE,
      id: 'pkg00001',
      path: 'description',
    });
  });
});

describe('buildUpdateScriptPackageBatch', () => {
  it('emits one setField per defined key and skips undefined values', () => {
    const { batch, sideEffects } = buildUpdateScriptPackageBatch(
      'pkg00001',
      { name: 'renamed', source: 'module.exports = {};', description: undefined },
      ctx(),
    );
    expect(batch.mutations).toHaveLength(2);
    expect(batch.mutations.map((m) => m.body)).toEqual([
      { kind: 'setField', type: SCRIPT_PACKAGE_ENTITY_TYPE, id: 'pkg00001', path: 'name', value: 'renamed' },
      {
        kind: 'setField',
        type: SCRIPT_PACKAGE_ENTITY_TYPE,
        id: 'pkg00001',
        path: 'source',
        value: 'module.exports = {};',
      },
    ]);
    expect(sideEffects).toEqual([]);
  });
});

describe('seedScriptPackage / projectScriptPackage', () => {
  it('round-trips through a create envelope + materialized shape', () => {
    const entity = pkg({ description: 'shared helpers' });
    const batch = seedScriptPackage(entity, ctx());
    expect(batch.mutations).toHaveLength(1);
    const body = batch.mutations[0].body;
    expect(body).toMatchObject({ kind: 'create', type: SCRIPT_PACKAGE_ENTITY_TYPE, id: 'pkg00001' });
    if (body.kind !== 'create') throw new Error('expected create body');
    const projected = projectScriptPackage({
      type: SCRIPT_PACKAGE_ENTITY_TYPE,
      id: entity.uid,
      data: body.payload as Record<string, unknown>,
      fieldOrigins: {},
    });
    expect(projected).toEqual(entity);
  });

  it('returns null for a foreign entity type', () => {
    expect(projectScriptPackage({ type: 'rule', id: 'r1', data: {}, fieldOrigins: {} })).toBeNull();
  });
});
