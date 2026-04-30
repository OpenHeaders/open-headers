import { describe, expect, it } from 'vitest';
import {
  addFileRef,
  FILES_ENTITY_TYPE,
  FILES_ID,
  FILES_MUTATOR_VERSION,
  FILES_REFS_PATH,
  type FileRefSlot,
  type MutatorContext,
  removeFileRef,
  renameFileRef,
} from '../../../../src/sync';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

const slot = (overrides: Partial<FileRefSlot> = {}): FileRefSlot => ({
  fileId: 'file:abc',
  hash: 'sha256:deadbeef',
  filename: 'invoice.pdf',
  mimeType: 'application/pdf',
  size: 1234,
  ...overrides,
});

describe('addFileRef', () => {
  it('emits one addToSet on the singleton with itemId = fileId', () => {
    const intent = addFileRef(ctx(), { ref: slot() });
    expect(intent.batch.mutations).toHaveLength(1);
    const env = intent.batch.mutations[0];
    expect(env.mutatorVersion).toBe(FILES_MUTATOR_VERSION);
    expect(env.body).toMatchObject({
      kind: 'addToSet',
      type: FILES_ENTITY_TYPE,
      id: FILES_ID,
      path: FILES_REFS_PATH,
      itemId: 'file:abc',
      item: slot(),
    });
    expect(intent.sideEffects).toEqual([]);
  });

  it('preserves optional mimeType when omitted', () => {
    const ref: FileRefSlot = {
      fileId: 'file:no-mime',
      hash: 'sha256:1',
      filename: 'raw.bin',
      size: 64,
    };
    const intent = addFileRef(ctx(), { ref });
    expect(intent.batch.mutations[0].body).toMatchObject({ item: ref });
  });
});

describe('removeFileRef', () => {
  it('emits a single removeFromSet keyed by fileId', () => {
    const intent = removeFileRef(ctx(), { fileId: 'file:gone' });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      type: FILES_ENTITY_TYPE,
      id: FILES_ID,
      path: FILES_REFS_PATH,
      itemId: 'file:gone',
    });
    expect(intent.sideEffects).toEqual([]);
  });
});

describe('renameFileRef', () => {
  it('emits one addToSet keyed by fileId carrying the rewritten slot', () => {
    const renamed = slot({ filename: 'invoice-renamed.pdf' });
    const intent = renameFileRef(ctx(), { ref: renamed });
    expect(intent.batch.mutations).toHaveLength(1);
    const env = intent.batch.mutations[0];
    expect(env.mutatorVersion).toBe(FILES_MUTATOR_VERSION);
    expect(env.body).toMatchObject({
      kind: 'addToSet',
      type: FILES_ENTITY_TYPE,
      id: FILES_ID,
      path: FILES_REFS_PATH,
      itemId: 'file:abc',
      item: renamed,
    });
    expect(intent.sideEffects).toEqual([]);
  });
});

describe('shared batchId via context', () => {
  it('threads the supplied batchId across emitted mutations', () => {
    const intent = addFileRef(ctx({ batchId: 'B7' }), { ref: slot() });
    expect(intent.batch.batchId).toBe('B7');
  });
});
