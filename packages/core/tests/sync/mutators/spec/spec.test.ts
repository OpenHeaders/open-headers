import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { SpecSchema } from '../../../../src/schemas';
import {
  deleteSpec,
  type MutatorContext,
  removeSpecFile,
  SPEC_ENTITY_TYPE,
  SPEC_FILES_PATH,
  SPEC_MUTATOR_VERSION,
  setSpecField,
  setSpecFile,
  unsetSpecField,
} from '../../../../src/sync';
import { buildUpdateSpecBatch } from '../../../../src/sync-builders/mutations/spec-mutations';
import { projectSpec, seedSpec } from '../../../../src/sync-builders/projections/spec-projection';
import type { Spec, SpecFile } from '../../../../src/types';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: 2_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

const rootFile = (overrides: Partial<SpecFile> = {}): SpecFile => ({
  uid: 'file0001',
  fileName: 'index.yaml',
  content: "openapi: '3.1.0'\ninfo:\n  title: openheaders.io API\n  version: '1.0.0'\npaths: {}\n",
  ...overrides,
});

const spec = (overrides: Partial<Spec> = {}): Spec => ({
  schemaVersion: 5,
  uid: 'spec0001',
  path: 'specs/openheaders-api-spec0001',
  name: 'OpenHeaders API',
  format: 'openapi-3.1',
  rootFileUid: 'file0001',
  files: [rootFile()],
  ...overrides,
});

describe('SpecSchema', () => {
  it('accepts a full spec', () => {
    expect(() => v.parse(SpecSchema, spec({ description: 'design-time source of truth' }))).not.toThrow();
  });

  it('accepts an empty file set (mid-write scaffold state)', () => {
    expect(() => v.parse(SpecSchema, spec({ files: [] }))).not.toThrow();
  });

  it('accepts an empty file content (fresh blank scaffold)', () => {
    expect(() => v.parse(SpecSchema, spec({ files: [rootFile({ content: '' })] }))).not.toThrow();
  });

  it.each(['openapi-2.0', 'asyncapi-3.0', ''])('rejects unsupported format %j', (format) => {
    expect(() => v.parse(SpecSchema, spec({ format: format as Spec['format'] }))).toThrow();
  });

  it.each(['/etc/index.yaml', '../index.yaml', 'a/../b.yaml', ''])('rejects invalid fileName %j', (fileName) => {
    expect(() => v.parse(SpecSchema, spec({ files: [rootFile({ fileName })] }))).toThrow();
  });

  it.each(['index.yaml', 'index.json', 'components/schemas.yaml'])('accepts valid fileName %j', (fileName) => {
    expect(() => v.parse(SpecSchema, spec({ files: [rootFile({ fileName })] }))).not.toThrow();
  });
});

describe('deleteSpec', () => {
  it('emits a single delete envelope with no side effects', () => {
    const intent = deleteSpec(ctx(), { specUid: 'spec0001' });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].mutatorVersion).toBe(SPEC_MUTATOR_VERSION);
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'delete',
      type: SPEC_ENTITY_TYPE,
      id: 'spec0001',
    });
    expect(intent.sideEffects).toEqual([]);
  });
});

describe('setSpecField / unsetSpecField', () => {
  it('emits a setField at the typed scalar path', () => {
    const intent = setSpecField(ctx(), { specUid: 'spec0001', path: 'name', value: 'Payments API' });
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'setField',
      type: SPEC_ENTITY_TYPE,
      id: 'spec0001',
      path: 'name',
      value: 'Payments API',
    });
    expect(intent.sideEffects).toEqual([]);
  });

  it('emits an unsetField for optional paths', () => {
    const intent = unsetSpecField(ctx(), { specUid: 'spec0001', path: 'description' });
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'unsetField',
      type: SPEC_ENTITY_TYPE,
      id: 'spec0001',
      path: 'description',
    });
  });
});

describe('setSpecFile / removeSpecFile', () => {
  it('upserts the whole file row as an addToSet keyed by file uid', () => {
    const file = rootFile({ content: "openapi: '3.1.0'\n" });
    const intent = setSpecFile(ctx(), { specUid: 'spec0001', file, orderKey: 'a1' });
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'addToSet',
      type: SPEC_ENTITY_TYPE,
      id: 'spec0001',
      path: SPEC_FILES_PATH,
      itemId: 'file0001',
      item: file,
      orderKey: 'a1',
    });
    expect(intent.sideEffects).toEqual([]);
  });

  it('removes a file row by uid', () => {
    const intent = removeSpecFile(ctx(), { specUid: 'spec0001', uid: 'file0001' });
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'removeFromSet',
      type: SPEC_ENTITY_TYPE,
      id: 'spec0001',
      path: SPEC_FILES_PATH,
      itemId: 'file0001',
    });
  });
});

describe('buildUpdateSpecBatch', () => {
  it('emits one setField per defined key and skips undefined values', () => {
    const { batch, sideEffects } = buildUpdateSpecBatch(
      'spec0001',
      { name: 'renamed', rootFileUid: 'file0002', description: undefined },
      ctx(),
    );
    expect(batch.mutations).toHaveLength(2);
    expect(batch.mutations.map((m) => m.body)).toEqual([
      { kind: 'setField', type: SPEC_ENTITY_TYPE, id: 'spec0001', path: 'name', value: 'renamed' },
      { kind: 'setField', type: SPEC_ENTITY_TYPE, id: 'spec0001', path: 'rootFileUid', value: 'file0002' },
    ]);
    expect(sideEffects).toEqual([]);
  });
});

describe('seedSpec / projectSpec', () => {
  it('splits the create shell from per-file addToSet envelopes', () => {
    const entity = spec({
      description: 'two files',
      files: [rootFile(), rootFile({ uid: 'file0002', fileName: 'components/schemas.yaml' })],
    });
    const batch = seedSpec(entity, ctx());
    expect(batch.mutations).toHaveLength(3);

    const createBody = batch.mutations[0].body;
    expect(createBody).toMatchObject({ kind: 'create', type: SPEC_ENTITY_TYPE, id: 'spec0001' });
    if (createBody.kind !== 'create') throw new Error('expected create body');
    expect((createBody.payload as Record<string, unknown>).files).toBeUndefined();

    const addBodies = batch.mutations.slice(1).map((m) => m.body);
    expect(addBodies.map((b) => (b.kind === 'addToSet' ? b.itemId : null))).toEqual(['file0001', 'file0002']);
    const orderKeys = addBodies.map((b) => (b.kind === 'addToSet' ? b.orderKey : undefined));
    expect(new Set(orderKeys).size).toBe(2);
  });

  it('round-trips through the materialized shape', () => {
    const entity = spec();
    const batch = seedSpec(entity, ctx());
    const createBody = batch.mutations[0].body;
    if (createBody.kind !== 'create') throw new Error('expected create body');
    const projected = projectSpec({
      type: SPEC_ENTITY_TYPE,
      id: entity.uid,
      data: { ...(createBody.payload as Record<string, unknown>), files: entity.files },
      fieldOrigins: {},
    });
    expect(projected).toEqual(entity);
  });

  it('returns null for a foreign entity type', () => {
    expect(projectSpec({ type: 'rule', id: 'r1', data: {}, fieldOrigins: {} })).toBeNull();
  });
});
